// content/reply-ui.js
// Builds and manages the single "ReplyPilot" floating card. It lives in the
// top-right corner of the Gmail page, can be dragged by its header, and
// operates on the currently active reply box.
//
// The card is a guided generator: pick a tone, optionally write a short
// instruction ("politely decline, keep it short"), then generate one reply
// straight into the output box. Quick phrases can be added to the instruction
// with one click and are user-customisable.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var ERROR_KEYS = {
    API_KEY_MISSING: 'errNoApiKey',
    API_KEY_INVALID: 'errApiInvalid',
    MODEL_NOT_FOUND: 'errModelNotFound',
    MODEL_MISSING: 'errModelMissing',
    RATE_LIMITED: 'errRateLimited',
    NETWORK_ERROR: 'errNetwork',
    TIMEOUT: 'errTimeout',
    EMPTY_RESPONSE: 'errModel',
    PARSE_FAILED: 'errModel',
    CONTEXT_INVALIDATED: 'errContextInvalidated'
  };

  // i18n key for a tone id, e.g. "professional" -> "toneProfessional".
  function toneI18nKey(tone) {
    tone = String(tone || 'professional');
    return 'tone' + tone.charAt(0).toUpperCase() + tone.slice(1);
  }

  var cardRefs = null;
  var activeBox = null;
  // Remembered conversation + last used tone so we can revise a reply.
  var lastContext = null;
  var lastTone = 'professional';

  // Panel state (loaded from storage).
  var signature = { text: '', enabled: false };
  var selectedTone = 'professional';
  var quickPrompts = [];

  function loadSignature() {
    return RP.storage.getAll().then(function (s) {
      signature.text = s.rp_signature || '';
      signature.enabled = !!s.rp_useSignature;
    }).catch(function () { /* ignore */ });
  }

  function defaultQuickPrompts() {
    return [
      RP.i18n.t('qpPolitelyDecline'),
      RP.i18n.t('qpDeclineDirect'),
      RP.i18n.t('qpShorten'),
      RP.i18n.t('qpWarmAgree'),
      RP.i18n.t('qpAskMore'),
      RP.i18n.t('qpFollowUp')
    ];
  }

  function loadPanelState() {
    return RP.storage.getAll().then(function (s) {
      signature.text = s.rp_signature || '';
      signature.enabled = !!s.rp_useSignature;
      selectedTone = s.rp_tone || 'professional';
      lastTone = selectedTone;
      if (s.rp_quickPrompts == null) {
        quickPrompts = defaultQuickPrompts();
        RP.storage.set('rp_quickPrompts', quickPrompts);
      } else {
        quickPrompts = Array.isArray(s.rp_quickPrompts) ? s.rp_quickPrompts.slice() : [];
      }
    }).catch(function () { /* ignore */ });
  }

  // Append the signature (by code, never by the model) so the exact text is
  // always respected. Skipped when disabled or already present.
  function applySignature(reply) {
    var r = reply || '';
    var sig = (signature.text || '').replace(/\r/g, '').trim();
    if (!signature.enabled || !sig) return r;
    var trimmed = r.replace(/\s+$/, '');
    if (trimmed.slice(-sig.length) === sig) return r;
    return trimmed + '\n\n' + sig;
  }

  function friendlyError(e) {
    var code = e && e.code;
    if (code && ERROR_KEYS[code]) {
      var base = RP.i18n.t(ERROR_KEYS[code]);
      if (code === 'RATE_LIMITED' && e.retryAfter) {
        return base + ' ' + RP.i18n.t('errRateLimitedWait', { secs: e.retryAfter });
      }
      return base;
    }
    return (e && e.message) ? e.message : RP.i18n.t('errUnknown');
  }

  function makeButton(cls, i18nKey) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = RP.i18n.t(i18nKey);
    b._i18nKey = i18nKey;
    return b;
  }

  function makeFieldLabel(i18nKey) {
    var el = document.createElement('div');
    el.className = 'rp-field-label';
    el.setAttribute('data-i18n', i18nKey);
    el.textContent = RP.i18n.t(i18nKey);
    el._i18nKey = i18nKey;
    return el;
  }

  function createCard() {
    var card = document.createElement('div');
    card.className = 'rp-card';
    card.setAttribute('data-rp-card', '1');

    // Header
    var head = document.createElement('div');
    head.className = 'rp-card-head';
    head.setAttribute('data-rp-drag', '1');

    var dragIcon = document.createElement('span');
    dragIcon.className = 'rp-card-drag-icon';
    dragIcon.textContent = '⋮⋮';
    dragIcon.setAttribute('data-rp-drag', '1');

    var title = document.createElement('span');
    title.className = 'rp-card-title';
    title.textContent = '✨ ReplyPilot';

    var status = document.createElement('span');
    status.className = 'rp-card-status';

    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'rp-card-collapse';
    collapseBtn.textContent = '–';
    collapseBtn.title = 'Collapse';
    collapseBtn.setAttribute('aria-label', 'Collapse');

    var headRight = document.createElement('div');
    headRight.className = 'rp-card-head-right';
    headRight.appendChild(status);
    headRight.appendChild(collapseBtn);

    head.appendChild(dragIcon);
    head.appendChild(title);
    head.appendChild(headRight);

    // Body (scrollable)
    var body = document.createElement('div');
    body.className = 'rp-card-body';

    var errorBanner = document.createElement('div');
    errorBanner.className = 'rp-error-banner';
    errorBanner.style.display = 'none';

    // Tone selector
    var toneField = document.createElement('div');
    toneField.className = 'rp-field-block';
    var toneLabel = makeFieldLabel('panelToneLabel');
    var toneChips = document.createElement('div');
    toneChips.className = 'rp-chips';
    toneField.appendChild(toneLabel);
    toneField.appendChild(toneChips);

    // Instruction input
    var guideField = document.createElement('div');
    guideField.className = 'rp-field-block';
    var guideLabel = makeFieldLabel('guidingLabel');
    var guideInput = document.createElement('input');
    guideInput.type = 'text';
    guideInput.className = 'rp-guide-input';
    guideInput.setAttribute('data-i18n-placeholder', 'guidingPlaceholder');
    guideInput.placeholder = 'e.g. Politely decline, keep it short';
    guideField.appendChild(guideLabel);
    guideField.appendChild(guideInput);

    // Quick phrases
    var quickField = document.createElement('div');
    quickField.className = 'rp-field-block';
    var quickLabel = makeFieldLabel('quickPromptsLabel');
    var quickChips = document.createElement('div');
    quickChips.className = 'rp-chips';
    var quickAddInput = document.createElement('input');
    quickAddInput.type = 'text';
    quickAddInput.className = 'rp-quick-add-input';
    quickAddInput.setAttribute('data-i18n-placeholder', 'quickPromptPlaceholder');
    quickAddInput.placeholder = RP.i18n.t('quickPromptPlaceholder');
    var quickAdd = document.createElement('button');
    quickAdd.type = 'button';
    quickAdd.className = 'rp-chip rp-chip-add';
    quickAdd.textContent = '+';
    quickAdd.setAttribute('data-i18n-title', 'addQuickPrompt');
    quickAdd.title = RP.i18n.t('addQuickPrompt');
    quickField.appendChild(quickLabel);
    quickField.appendChild(quickChips);
    quickField.appendChild(quickAddInput);
    quickField.appendChild(quickAdd);

    // Output textarea
    var text = document.createElement('textarea');
    text.className = 'rp-card-text';
    text.rows = 6;
    text.setAttribute('data-i18n-placeholder', 'statusReady');

    // Revise-by-feedback row: appears once a reply exists so the user can
    // ask for a tweak without losing the draft they already have.
    var reviseRow = document.createElement('div');
    reviseRow.className = 'rp-card-revise';
    reviseRow.style.display = 'none';

    var reviseInput = document.createElement('input');
    reviseInput.type = 'text';
    reviseInput.className = 'rp-card-revise-input';
    reviseInput.setAttribute('data-i18n-placeholder', 'revisePlaceholder');
    reviseInput.placeholder = 'Tell how to adjust the reply...';

    var reviseBtn = makeButton('rp-btn rp-btn-secondary', 'reviseReply');

    reviseRow.appendChild(reviseInput);
    reviseRow.appendChild(reviseBtn);

    body.appendChild(errorBanner);
    body.appendChild(toneField);
    body.appendChild(guideField);
    body.appendChild(quickField);
    body.appendChild(text);
    body.appendChild(reviseRow);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'rp-card-actions';

    var gen = makeButton('rp-btn rp-btn-primary', 'generateReply');
    var regen = makeButton('rp-btn', 'regenerate');
    var ins = makeButton('rp-btn', 'insertReply');
    var copy = makeButton('rp-btn rp-btn-ghost', 'copyReply');
    var clear = makeButton('rp-btn rp-btn-ghost rp-btn-block', 'clearReply');

    // Insert/Copy are disabled until a reply exists.
    ins.disabled = true;
    copy.disabled = true;
    clear.disabled = true;

    actions.appendChild(gen);
    actions.appendChild(regen);
    actions.appendChild(ins);
    actions.appendChild(copy);
    actions.appendChild(clear);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(actions);

    document.body.appendChild(card);

    return {
      card: card,
      head: head,
      status: status,
      errorBanner: errorBanner,
      text: text,
      gen: gen,
      regen: regen,
      ins: ins,
      copy: copy,
      clear: clear,
      collapseBtn: collapseBtn,
      toneLabel: toneLabel,
      toneChips: toneChips,
      guideLabel: guideLabel,
      guideInput: guideInput,
      quickLabel: quickLabel,
      quickChips: quickChips,
      quickAdd: quickAdd,
      quickAddInput: quickAddInput,
      reviseRow: reviseRow,
      reviseInput: reviseInput,
      reviseBtn: reviseBtn
    };
  }

  function ensureCard() {
    if (!cardRefs) {
      cardRefs = createCard();
      bindCardEvents(cardRefs);
    }
    return cardRefs;
  }

  // --- Tone chips -------------------------------------------------------
  function renderToneChips() {
    var refs = ensureCard();
    refs.toneChips.innerHTML = '';
    var tones = RP.parser.TONES || ['professional'];
    tones.forEach(function (tone) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rp-chip rp-tone-chip' + (tone === selectedTone ? ' rp-chip-active' : '');
      chip.setAttribute('data-tone', tone);
      chip.textContent = RP.i18n.t(toneI18nKey(tone));
      chip.addEventListener('click', function () { selectTone(tone); });
      refs.toneChips.appendChild(chip);
    });
  }

  function selectTone(tone) {
    selectedTone = tone;
    lastTone = tone;
    var refs = ensureCard();
    var chips = refs.toneChips.querySelectorAll('.rp-tone-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('rp-chip-active',
        chips[i].getAttribute('data-tone') === tone);
    }
    RP.storage.set('rp_tone', tone);
  }

  // --- Quick phrases ----------------------------------------------------
  function persistQuickPrompts() {
    RP.storage.set('rp_quickPrompts', quickPrompts);
  }

  function appendToGuide(text) {
    var refs = ensureCard();
    var cur = refs.guideInput.value.trim();
    refs.guideInput.value = cur ? (cur + ' ' + text) : text;
    refs.guideInput.focus();
    try {
      refs.guideInput.setSelectionRange(refs.guideInput.value.length,
        refs.guideInput.value.length);
    } catch (e) { /* ignore */ }
  }

  function removeQuickPrompt(text) {
    var idx = quickPrompts.indexOf(text);
    if (idx === -1) return;
    quickPrompts.splice(idx, 1);
    persistQuickPrompts();
    renderQuickPrompts();
  }

  function renderQuickPrompts() {
    var refs = ensureCard();
    refs.quickChips.innerHTML = '';
    quickPrompts.forEach(function (p) {
      var chip = document.createElement('span');
      chip.className = 'rp-chip rp-quick-chip';

      var label = document.createElement('button');
      label.type = 'button';
      label.className = 'rp-chip-label';
      label.textContent = p;
      label.addEventListener('click', function () { appendToGuide(p); });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'rp-chip-del';
      del.textContent = '×';
      del.setAttribute('data-i18n-title', 'removeQuickPrompt');
      del.title = RP.i18n.t('removeQuickPrompt');
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        removeQuickPrompt(p);
      });

      chip.appendChild(label);
      chip.appendChild(del);
      refs.quickChips.appendChild(chip);
    });
  }

  function showQuickAdd() {
    var refs = ensureCard();
    refs.quickAddInput.value = '';
    refs.quickAddInput.style.display = 'inline-block';
    refs.quickAdd.style.display = 'none';
    refs.quickAddInput.focus();
  }

  function commitQuickAdd() {
    if (!cardRefs) return;
    var refs = cardRefs;
    refs.quickAddInput.style.display = 'none';
    refs.quickAdd.style.display = '';
    var v = refs.quickAddInput.value.trim();
    refs.quickAddInput.value = '';
    if (!v) return;
    if (quickPrompts.indexOf(v) === -1) {
      quickPrompts.push(v);
      persistQuickPrompts();
      renderQuickPrompts();
    }
  }

  function bindCardEvents(refs) {
    refs.gen.addEventListener('click', function () { onGenerate(); });
    refs.regen.addEventListener('click', function () { onGenerate(); });
    refs.ins.addEventListener('click', function () { onInsert(); });
    refs.copy.addEventListener('click', function () { onCopy(); });
    refs.clear.addEventListener('click', function () { onClear(); });
    refs.reviseBtn.addEventListener('click', function () { onRevise(); });
    refs.reviseInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onRevise();
      }
    });

    // Enter in the instruction box generates right away.
    refs.guideInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onGenerate();
      }
    });

    // Quick-phrase add flow.
    refs.quickAdd.addEventListener('click', function () { showQuickAdd(); });
    refs.quickAddInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitQuickAdd(); }
      else if (e.key === 'Escape') { e.preventDefault(); commitQuickAdd(); }
    });
    refs.quickAddInput.addEventListener('blur', function () { commitQuickAdd(); });

    // Collapse / expand the card body+actions, leaving only the header.
    refs.collapseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var collapsed = refs.card.classList.toggle('rp-card-collapsed');
      refs.collapseBtn.textContent = collapsed ? '+' : '–';
      refs.collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
      // Remove status badge from DOM when collapsed; re-insert on expand.
      // This is more reliable than display:none which can fail in content-script CSS
      if (collapsed) {
        if (refs.status.parentNode) {
          refs.status.parentNode.removeChild(refs.status);
        }
      } else {
        var headRight = refs.collapseBtn.parentNode;
        if (headRight && !refs.status.parentNode) {
          headRight.insertBefore(refs.status, refs.collapseBtn);
        }
      }
    });

    // Dragging
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;

    refs.head.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = refs.card.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      refs.card.classList.add('rp-card-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      refs.card.style.left = Math.max(0, startLeft + dx) + 'px';
      refs.card.style.top = Math.max(0, startTop + dy) + 'px';
      refs.card.style.right = 'auto';
    });

    document.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        refs.card.classList.remove('rp-card-dragging');
      }
    });
  }

  function setActiveBox(box) {
    if (box && box !== activeBox) {
      // User switched to a different reply box -> reset for the new email.
      resetCard();
    }
    activeBox = box || activeBox;
    ensureCard().card.style.display = 'block';
  }

  function setStatus(text, kind) {
    var refs = ensureCard();
    if (kind === 'error') {
      // Long error messages live in a body banner so the header stays compact.
      refs.status.textContent = RP.i18n.t('statusErrorShort');
      refs.status.className = 'rp-card-status rp-status-error';
      refs.errorBanner.textContent = text;
      refs.errorBanner.style.display = 'block';
    } else {
      refs.status.textContent = text;
      refs.status.className = 'rp-card-status' + (kind ? ' rp-status-' + kind : '');
      refs.errorBanner.style.display = 'none';
      refs.errorBanner.textContent = '';
    }
  }

  function setBusy(busy) {
    var refs = ensureCard();
    refs.gen.disabled = busy;
    refs.regen.disabled = busy;
    refs.reviseBtn.disabled = busy;
  }

  function setActionsEnabled(enabled) {
    var refs = ensureCard();
    refs.ins.disabled = !enabled;
    refs.copy.disabled = !enabled;
  }

  function getActiveBox() {
    if (activeBox && RP.dom.isVisible(activeBox)) return activeBox;
    var boxes = RP.dom.getReplyBoxes();
    if (boxes.length) {
      activeBox = boxes[0];
      return activeBox;
    }
    return null;
  }

  // Hard cooldown so a fast double-click (or a click right after a request
  // settles) can't fire a second API call within COOLDOWN_MS.
  var COOLDOWN_MS = 1500;
  var cooldownUntil = 0;

  function onGenerate() {
    if (Date.now() < cooldownUntil) return;
    var refs = ensureCard();
    refs.text.value = '';
    refs.clear.disabled = false;
    setActionsEnabled(false);
    setBusy(true);
    setStatus(RP.i18n.t('statusGenerating'), 'generating');

    // Safety net: ensure setBusy(false) always runs even if everything else fails
    function done() { setBusy(false); }

    var ctx = RP.dom.getConversation();
    if (!ctx.emailBody) {
      setStatus(RP.i18n.t('errNoEmail'), 'error');
      done();
      return;
    }
    lastContext = ctx;

    var instruction = refs.guideInput.value.trim();
    var tone = selectedTone;

    // Refresh the signature so the freshly generated reply uses the latest config.
    var p = loadSignature()
      .then(function () {
        return RP.ai.generateGuided({
          subject: ctx.subject,
          emailBody: ctx.emailBody,
          tone: tone,
          instruction: instruction
        });
      })
      .then(function (reply) {
        refilledReply(reply, ctx);
        setStatus(RP.i18n.t('statusDone'), 'done');
      })
      .catch(function (e) {
        setStatus(RP.i18n.t('statusError', { reason: friendlyError(e) }), 'error');
      });

    // Always restore the button state after the request settles (success or error),
    // then keep the buttons disabled for COOLDOWN_MS to prevent rapid re-clicks.
    function settle() {
      done();
      cooldownUntil = Date.now() + COOLDOWN_MS;
      setTimeout(function () {
        // Only clear the cooldown if no newer request has started it again.
        if (Date.now() >= cooldownUntil) cooldownUntil = 0;
      }, COOLDOWN_MS);
    }
    Promise.resolve(p).then(settle, settle);
  }

  // Fill the output box with a new reply and keep it ready to insert/copy.
  function refilledReply(reply, ctx, tone) {
    var refs = ensureCard();
    if (ctx) lastContext = ctx;
    if (tone) lastTone = tone;
    refs.text.value = applySignature(reply);
    setActionsEnabled(true);
    refs.clear.disabled = false;
    // Once a reply exists, show the "revise by feedback" row.
    refs.reviseRow.style.display = 'flex';
    refs.reviseInput.value = '';
  }

  function onInsert() {
    var refs = ensureCard();
    var text = refs.text.value;
    if (!text) {
      setStatus(RP.i18n.t('errNoEmail'), 'error');
      return;
    }
    var box = getActiveBox();
    if (!box) {
      setStatus(RP.i18n.t('errNoEmail'), 'error');
      return;
    }
    var res = RP.dom.insertReplyInto(box, text);
    if (res && res.ok) {
      setStatus(RP.i18n.t('msgInserted'), 'done');
    } else {
      setStatus(RP.i18n.t('errInsertFailed'), 'error');
    }
  }

  function onClear() {
    var refs = ensureCard();
    refs.text.value = '';
    setActionsEnabled(false);
    refs.clear.disabled = true;
    setStatus(RP.i18n.t('statusReady'), 'ready');
  }

  function onCopy() {
    var refs = ensureCard();
    var text = refs.text.value;
    if (!text) return;
    var done = function () { setStatus(RP.i18n.t('msgCopied'), 'done'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(refs.text); done();
      });
    } else {
      fallbackCopy(refs.text); done();
    }
  }

  function fallbackCopy(el) {
    try {
      el.focus();
      el.select();
      document.execCommand('copy');
    } catch (e) { /* ignore */ }
  }

  // Revise the current reply based on the user's written feedback. The draft
  // in the textarea is sent back to the model together with the original email
  // and the user's instruction, then replaced with the revised version.
  function onRevise() {
    if (Date.now() < cooldownUntil) return;
    var refs = ensureCard();
    var instruction = refs.reviseInput.value.trim();
    var currentReply = refs.text.value.trim();

    if (!instruction) {
      setStatus(RP.i18n.t('errNoInstruction'), 'error');
      return;
    }
    if (!currentReply) {
      setStatus(RP.i18n.t('errNoEmail'), 'error');
      return;
    }
    if (!lastContext) {
      setStatus(RP.i18n.t('errContextInvalidated'), 'error');
      return;
    }

    refs.reviseInput.disabled = true;
    refs.reviseBtn.disabled = true;
    refs.reviseBtn.textContent = RP.i18n.t('statusRevising');
    setBusy(true);
    setStatus(RP.i18n.t('statusRevising'), 'generating');

    function done() {
      setBusy(false);
      refs.reviseInput.disabled = false;
      refs.reviseBtn.disabled = false;
      refs.reviseBtn.textContent = RP.i18n.t('reviseReply');
    }

    var ctx = {
      subject: lastContext.subject,
      emailBody: lastContext.emailBody,
      tone: lastTone,
      currentReply: currentReply,
      instruction: instruction
    };

    var p = RP.ai.reviseReply(ctx);

    p.then(function (reply) {
      refilledReply(reply, ctx);
      setStatus(RP.i18n.t('statusRevised'), 'done');
    }).catch(function (e) {
      var msg = friendlyError(e);
      setStatus(RP.i18n.t('statusError', { reason: msg }), 'error');
    });

    function settle() {
      done();
      cooldownUntil = Date.now() + COOLDOWN_MS;
      setTimeout(function () {
        if (Date.now() >= cooldownUntil) cooldownUntil = 0;
      }, COOLDOWN_MS);
    }
    Promise.resolve(p).then(settle, settle);
  }

  function attachTo(box) {
    if (!box) return;
    ensureCard();
    if (!activeBox || !RP.dom.isVisible(activeBox)) {
      activeBox = box;
    }
    box.addEventListener('focus', function () { setActiveBox(box); }, true);
    box.addEventListener('click', function () { setActiveBox(box); });
    box.dataset.rpUi = '1';
  }

  function refreshTexts() {
    if (!cardRefs) return;
    [cardRefs.gen, cardRefs.regen, cardRefs.ins, cardRefs.copy, cardRefs.clear,
      cardRefs.reviseBtn
      ].forEach(function (b) {
      b.textContent = RP.i18n.t(b._i18nKey);
    });
    [cardRefs.toneLabel, cardRefs.guideLabel, cardRefs.quickLabel].forEach(function (el) {
      el.textContent = RP.i18n.t(el._i18nKey);
    });
    cardRefs.text.setAttribute('placeholder', RP.i18n.t('statusReady'));
    cardRefs.reviseInput.setAttribute('placeholder', RP.i18n.t('revisePlaceholder'));
    cardRefs.guideInput.setAttribute('placeholder', RP.i18n.t('guidingPlaceholder'));
    cardRefs.quickAddInput.setAttribute('placeholder', RP.i18n.t('quickPromptPlaceholder'));
    cardRefs.quickAdd.title = RP.i18n.t('addQuickPrompt');
    // Chip labels depend on the language, so rebuild them.
    renderToneChips();
    renderQuickPrompts();
  }

  function refreshAll() {
    refreshTexts();
    loadPanelState().then(function () {
      renderToneChips();
      renderQuickPrompts();
    });
  }

  function resetCard() {
    if (cardRefs) {
      cardRefs.text.value = '';
      setActionsEnabled(false);
      cardRefs.clear.disabled = true;
      cardRefs.reviseRow.style.display = 'none';
      cardRefs.reviseInput.value = '';
      cardRefs.reviseInput.disabled = false;
      cardRefs.reviseBtn.disabled = false;
      cardRefs.reviseBtn.textContent = RP.i18n.t('reviseReply');
      cardRefs.guideInput.value = '';
      lastContext = null;
      setStatus(RP.i18n.t('statusReady'), 'ready');
    }
  }

  RP.ui = {
    init: function () {
      ensureCard();
      loadPanelState().then(function () {
        renderToneChips();
        renderQuickPrompts();
      });
    },
    attachTo: attachTo,
    refreshAll: refreshAll,
    refreshTexts: refreshTexts,
    resetCard: resetCard
  };
})(window.RP);

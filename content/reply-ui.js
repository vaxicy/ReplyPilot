// content/reply-ui.js
// Builds and manages the single "ReplyPilot" floating card. It lives in the
// top-right corner of the Gmail page, can be dragged by its header, and
// operates on the currently active reply box.
//
// The card is a guided generator with a single input model: write an
// instruction ("politely decline, keep it short") in the guidance box, or tap
// a keyword chip (which inserts its text there). Keywords are user-customisable
// and include the former tone names, so there is no separate tone selector.
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

  var cardRefs = null;
  var activeBox = null;
  // Remembered conversation so we can revise a reply without re-reading Gmail.
  var lastContext = null;

  // Panel state (loaded from storage).
  var signature = { text: '', enabled: false };
  var quickPrompts = [];

  function loadSignature() {
    return RP.storage.getAll().then(function (s) {
      signature.text = s.rp_signature || '';
      signature.enabled = !!s.rp_useSignature;
    }).catch(function () { /* ignore */ });
  }

  // Default keyword chips. Tone names are folded in here on purpose, so the
  // user can pick a style and an intent (decline / ask more / follow up) from
  // one place.
  function defaultQuickPrompts() {
    return [
      RP.i18n.t('toneDeclinePolite'),
      RP.i18n.t('toneDeclineDirect'),
      RP.i18n.t('toneProfessional'),
      RP.i18n.t('toneFriendly'),
      RP.i18n.t('toneCasual'),
      RP.i18n.t('toneShort'),
      RP.i18n.t('toneWarm'),
      RP.i18n.t('toneFormal'),
      RP.i18n.t('toneDirect'),
      RP.i18n.t('toneEnthusiastic'),
      RP.i18n.t('qpAskMore'),
      RP.i18n.t('qpFollowUp')
    ];
  }

  // Bumped whenever the shipped default keyword set changes, so existing users
  // get the new keywords merged into their list exactly once.
  var QUICK_PROMPTS_VERSION = 2;

  function loadPanelState() {
    return RP.storage.getAll().then(function (s) {
      signature.text = s.rp_signature || '';
      signature.enabled = !!s.rp_useSignature;

      var defaults = defaultQuickPrompts();
      if (s.rp_quickPrompts == null) {
        quickPrompts = defaults;
        RP.storage.setMany({
          rp_quickPrompts: quickPrompts,
          rp_quickPromptsVersion: QUICK_PROMPTS_VERSION
        });
        return;
      }

      quickPrompts = Array.isArray(s.rp_quickPrompts) ? s.rp_quickPrompts.slice() : [];

      // Merge the current defaults into a user list created before this
      // version, keeping the defaults first and preserving any custom entries.
      if (quickPrompts.length && (s.rp_quickPromptsVersion || 1) < QUICK_PROMPTS_VERSION) {
        var merged = defaults.slice();
        quickPrompts.forEach(function (p) {
          if (merged.indexOf(p) === -1) merged.push(p);
        });
        quickPrompts = merged;
        RP.storage.setMany({
          rp_quickPrompts: quickPrompts,
          rp_quickPromptsVersion: QUICK_PROMPTS_VERSION
        });
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

    // Keyword chips (tones are folded in here). The add controls live inside
    // the same flex row so they wrap inline with the chips, never on their own.
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

    quickChips.appendChild(quickAdd);
    quickChips.appendChild(quickAddInput);
    quickField.appendChild(quickLabel);
    quickField.appendChild(quickChips);

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

  // --- Keyword chips ----------------------------------------------------
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

  // Rebuild the chips, keeping the add controls (which live in the same row)
  // in place so they always flow inline with the chips.
  function renderQuickPrompts() {
    var refs = ensureCard();
    var olds = refs.quickChips.querySelectorAll('.rp-quick-chip');
    for (var i = 0; i < olds.length; i++) olds[i].remove();

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
      refs.quickChips.insertBefore(chip, refs.quickAdd);
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

    // Enter in the guidance box generates right away.
    refs.guideInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onGenerate();
      }
    });

    // Keyword add flow.
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

    // Refresh the signature so the freshly generated reply uses the latest config.
    var p = loadSignature()
      .then(function () {
        return RP.ai.generateGuided({
          subject: ctx.subject,
          emailBody: ctx.emailBody,
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
  function refilledReply(reply, ctx) {
    var refs = ensureCard();
    if (ctx) lastContext = ctx;
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
    [cardRefs.guideLabel, cardRefs.quickLabel].forEach(function (el) {
      el.textContent = RP.i18n.t(el._i18nKey);
    });
    cardRefs.text.setAttribute('placeholder', RP.i18n.t('statusReady'));
    cardRefs.reviseInput.setAttribute('placeholder', RP.i18n.t('revisePlaceholder'));
    cardRefs.guideInput.setAttribute('placeholder', RP.i18n.t('guidingPlaceholder'));
    cardRefs.quickAddInput.setAttribute('placeholder', RP.i18n.t('quickPromptPlaceholder'));
    cardRefs.quickAdd.title = RP.i18n.t('addQuickPrompt');
    // Chip labels depend on the language, so rebuild them.
    renderQuickPrompts();
  }

  function refreshAll() {
    refreshTexts();
    loadPanelState().then(function () {
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
        renderQuickPrompts();
      });
    },
    attachTo: attachTo,
    refreshAll: refreshAll,
    refreshTexts: refreshTexts,
    resetCard: resetCard
  };
})(window.RP);

// content/reply-ui.js
// Builds and manages the single "ReplyPilot" floating card. It lives in the
// top-right corner of the Gmail page, can be dragged by its header, and
// operates on the currently active reply box.
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

  // The three reply strategies shown as options after generation.
  var OPTION_KEYS = ['positive', 'neutral', 'decline'];
  var OPTION_I18N = {
    positive: 'optionPositive',
    neutral: 'optionNeutral',
    decline: 'optionDecline'
  };

  var cardRefs = null;
  var activeBox = null;
  // Remembered conversation + last generated reply so we can revise it.
  var lastContext = null;
  var lastReply = '';

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

    // Body: error banner + textarea + options panel
    var body = document.createElement('div');
    body.className = 'rp-card-body';

    var errorBanner = document.createElement('div');
    errorBanner.className = 'rp-error-banner';
    errorBanner.style.display = 'none';

    var text = document.createElement('textarea');
    text.className = 'rp-card-text';
    text.rows = 6;
    text.setAttribute('data-i18n-placeholder', 'statusReady');

    var optionsPanel = document.createElement('div');
    optionsPanel.className = 'rp-card-options';
    optionsPanel.style.display = 'none';

    var optionsTitle = document.createElement('div');
    optionsTitle.className = 'rp-card-options-title';
    optionsTitle.setAttribute('data-i18n', 'optionTitle');
    optionsTitle.textContent = 'Choose a reply';

    var optionsList = document.createElement('div');
    optionsList.className = 'rp-card-options-list';

    optionsPanel.appendChild(optionsTitle);
    optionsPanel.appendChild(optionsList);

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
    body.appendChild(text);
    body.appendChild(reviseRow);
    body.appendChild(optionsPanel);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'rp-card-actions';

    var gen = makeButton('rp-btn rp-btn-primary', 'generateReply');
    var regen = makeButton('rp-btn', 'regenerate');
    var ins = makeButton('rp-btn', 'insertReply');
    var copy = makeButton('rp-btn rp-btn-ghost', 'copyReply');
    var clear = makeButton('rp-btn rp-btn-ghost rp-btn-block', 'clearReply');

    // Insert/Copy are disabled until the user selects an option.
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
      optionsPanel: optionsPanel,
      optionsTitle: optionsTitle,
      optionsList: optionsList,
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

  // --- Hover tooltip for full reply text -------------------------------
  var optionTooltip = null;

  function getOptionTooltip() {
    if (optionTooltip) return optionTooltip;
    optionTooltip = document.createElement('div');
    optionTooltip.className = 'rp-option-tooltip';
    optionTooltip.setAttribute('role', 'tooltip');
    optionTooltip.style.display = 'none';
    document.body.appendChild(optionTooltip);
    return optionTooltip;
  }

  function showOptionTooltip(reply, anchor) {
    var tip = getOptionTooltip();
    tip.textContent = reply.replace(/\s+/g, ' ').trim();
    tip.style.display = 'block';

    var rect = anchor.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8; // flip below if no room above
    var left = rect.left;
    var maxLeft = window.innerWidth - tipRect.width - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function hideOptionTooltip() {
    if (optionTooltip) optionTooltip.style.display = 'none';
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

  function showOptions(show) {
    var refs = ensureCard();
    refs.text.style.display = show ? 'none' : 'block';
    refs.optionsPanel.style.display = show ? 'block' : 'none';
  }

  // Hard cooldown so a fast double-click (or a click right after a request
  // settles) can't fire a second API call within COOLDOWN_MS. NVIDIA's free
  // tier is only 40 rpm, so even two accidental requests in a row burn quota.
  var COOLDOWN_MS = 1500;
  var cooldownUntil = 0;

  function onGenerate() {
    if (Date.now() < cooldownUntil) return;
    var refs = ensureCard();
    refs.text.value = '';
    refs.clear.disabled = false;
    setActionsEnabled(false);
    setBusy(true);
    showOptions(false);
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
    lastReply = '';

    var p = RP.ai.generateOptions(ctx);
    // Attach a noop catch so the chain always has a .then to clean up
    p.then(function (options) {
      if (!options || !options.length) {
        setStatus(RP.i18n.t('statusError', { reason: RP.i18n.t('errModel') }), 'error');
        return;
      }
      renderOptions(options, ctx);
      setStatus(RP.i18n.t('statusDone'), 'done');
    }).catch(function (e) {
      var msg = friendlyError(e);
      setStatus(RP.i18n.t('statusError', { reason: msg }), 'error');
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

  function renderOptions(options, ctx) {
    var refs = ensureCard();
    refs.optionsList.innerHTML = '';

    options.forEach(function (opt) {
      var item = document.createElement('div');
      item.className = 'rp-option-item';

      var title = document.createElement('div');
      title.className = 'rp-option-title';
      title.textContent = RP.i18n.t(OPTION_I18N[opt.key] || 'optionPositive');

      var preview = document.createElement('div');
      preview.className = 'rp-option-preview';
      var snippet = opt.reply.replace(/\s+/g, ' ').trim();
      preview.textContent = snippet.length > 80 ? snippet.slice(0, 80) + '…' : snippet;

      item.addEventListener('mouseenter', function (e) {
        showOptionTooltip(opt.reply, e.currentTarget);
      });
      item.addEventListener('mouseleave', hideOptionTooltip);

      var choose = document.createElement('button');
      choose.type = 'button';
      choose.className = 'rp-btn rp-btn-small';
      choose.setAttribute('data-i18n', 'selectThisOption');
      choose.textContent = RP.i18n.t('selectThisOption');
      choose.addEventListener('click', function () {
        refilledReply(opt.reply, ctx);
        setStatus(RP.i18n.t('statusDone'), 'done');
      });

      item.appendChild(title);
      item.appendChild(preview);
      item.appendChild(choose);
      refs.optionsList.appendChild(item);
    });

    showOptions(true);
  }

  // Replace the reply textarea with a new reply and keep it selected/ready.
  function refilledReply(reply, ctx) {
    var refs = ensureCard();
    lastReply = reply || '';
    if (ctx) lastContext = ctx;
    refs.text.value = reply;
    showOptions(false);
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
    showOptions(false);
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
      tone: lastContext.tone,
      replyLanguage: lastContext.replyLanguage,
      storeName: lastContext.storeName,
      storeCategory: lastContext.storeCategory,
      shippingInfo: lastContext.shippingInfo,
      returnPolicy: lastContext.returnPolicy,
      shippingRegions: lastContext.shippingRegions,
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
    cardRefs.text.setAttribute('placeholder', RP.i18n.t('statusReady'));
    cardRefs.reviseInput.setAttribute('placeholder', RP.i18n.t('revisePlaceholder'));
    cardRefs.optionsTitle.textContent = RP.i18n.t('optionTitle');
    var chooseBtns = cardRefs.optionsList.querySelectorAll('button[data-i18n="selectThisOption"]');
    for (var i = 0; i < chooseBtns.length; i++) {
      chooseBtns[i].textContent = RP.i18n.t('selectThisOption');
    }
  }

  function refreshAll() {
    refreshTexts();
  }

  function resetCard() {
    if (cardRefs) {
      cardRefs.text.value = '';
      showOptions(false);
      setActionsEnabled(false);
      cardRefs.clear.disabled = true;
      cardRefs.reviseRow.style.display = 'none';
      cardRefs.reviseInput.value = '';
      cardRefs.reviseInput.disabled = false;
      cardRefs.reviseBtn.disabled = false;
      cardRefs.reviseBtn.textContent = RP.i18n.t('reviseReply');
      lastContext = null;
      lastReply = '';
      setStatus(RP.i18n.t('statusReady'), 'ready');
    }
  }

  RP.ui = {
    init: function () { ensureCard(); },
    attachTo: attachTo,
    refreshAll: refreshAll,
    refreshTexts: refreshTexts,
    resetCard: resetCard
  };
})(window.RP);

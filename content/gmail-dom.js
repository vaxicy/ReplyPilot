// content/gmail-dom.js
// All Gmail DOM access lives here. Selectors are centralized and tried in
// order; none of the getters assume a single permanent class (Gmail is a SPA
// and Google changes markup frequently). Every getter degrades gracefully and
// returns friendly error info instead of throwing.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  // Centralized, order-sensitive selector lists. Add new candidates at the
  // front when Gmail changes its markup.
  var GMAIL_SELECTORS = {
    subject: [
      'h2[data-thread-perm-id]',
      '.ha h2',
      'h2',
      '[role="heading"][aria-level="1"]'
    ],
    sender: [
      '.gD',                 // sender name + email attribute
      'span[email]',         // any element carrying an email attribute
      '[data-hovercard-id]', // hovercard id is the email
      '.gE .gD'
    ],
    body: [
      '.a3s.aiL',            // current message body (preferred)
      '.a3s',                // any message body
      '[role="listitem"] .a3s',
      '.ii.gt .a3s',
      '[data-message-id] .a3s'
    ],
    // Reply / reply-all / compose textboxes (contenteditable). We first match
    // on Gmail's localized aria-labels, then fall back to structural detection
    // (any contenteditable textbox that sits inside a compose area with a send
    // button). This keeps the selector robust when Gmail changes its labels.
    replyBox: [
      // Localized reply / body labels
      '[role="textbox"][contenteditable="true"][aria-label*="Reply" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="回复" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="Message body" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="邮件正文" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="Body" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="正文" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="Message" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="邮件" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="Compose" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="撰写" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="Draft" i]',
      '[role="textbox"][contenteditable="true"][aria-label*="草稿" i]',
      // Older Gmail markup
      'div[contenteditable="true"].LW-avf',
      'div[contenteditable="true"].editable',
      'div[contenteditable="true"][aria-label*="Reply" i]',
      'div[contenteditable="true"][aria-label*="回复" i]',
      'div[contenteditable="true"][aria-label*="Message body" i]',
      'div[contenteditable="true"][aria-label*="邮件正文" i]',
      'div[contenteditable="true"][aria-label*="Body" i]',
      'div[contenteditable="true"][aria-label*="正文" i]',
      'div[contenteditable="true"][aria-label*="Message" i]',
      'div[contenteditable="true"][aria-label*="邮件" i]',
      'div[contenteditable="true"][aria-label*="Compose" i]',
      'div[contenteditable="true"][aria-label*="撰写" i]'
    ]
  };

  function firstMatch(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) { /* invalid selector, try next */ }
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' ||
        parseFloat(style.opacity) === 0) {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getSubject() {
    var el = firstMatch(GMAIL_SELECTORS.subject);
    if (!el) return { ok: false, error: 'SUBJECT_NOT_FOUND', value: '' };
    return { ok: true, value: el.textContent.trim() };
  }

  function getSender() {
    var el = firstMatch(GMAIL_SELECTORS.sender);
    if (!el) return { ok: false, error: 'SENDER_NOT_FOUND', value: { name: '', email: '' } };
    var name = el.textContent.trim();
    var email = el.getAttribute('email') ||
      el.getAttribute('data-hovercard-id') || '';
    return { ok: true, value: { name: name, email: email } };
  }

  function getEmailBody() {
    // Prefer the most recent message in the thread.
    var candidates = [];
    for (var i = 0; i < GMAIL_SELECTORS.body.length; i++) {
      try {
        var found = document.querySelectorAll(GMAIL_SELECTORS.body[i]);
        for (var j = 0; j < found.length; j++) candidates.push(found[j]);
      } catch (e) { /* skip */ }
    }
    if (!candidates.length) {
      return { ok: false, error: 'BODY_NOT_FOUND', value: '' };
    }
    var last = candidates[candidates.length - 1];
    return { ok: true, value: htmlToText(last) };
  }

  function htmlToText(el) {
    if (!el) return '';
    // Clone so we can strip quoted/forwarded blocks without touching the page.
    var clone = el.cloneNode(true);
    var selectorsToRemove = ['.gmail_quote', 'blockquote', '.gmail_signature', '.yj6qo'];
    selectorsToRemove.forEach(function (s) {
      var nodes = clone.querySelectorAll(s);
      for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    });
    // innerText is only meaningful for nodes attached to the rendered document,
    // so attach the clone off-screen, read it, then remove it.
    var holder = document.createElement('div');
    holder.style.position = 'absolute';
    holder.style.left = '-99999px';
    holder.style.top = '0';
    holder.style.width = '600px';
    holder.style.height = '1px';
    holder.style.overflow = 'hidden';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    var text = (clone.innerText || clone.textContent || '').replace(/\s+\n/g, '\n').trim();
    document.body.removeChild(holder);
    return text;
  }

  function getConversation() {
    var subject = getSubject();
    var sender = getSender();
    var body = getEmailBody();
    var ctx = {
      subject: subject.ok ? subject.value : '',
      sender: sender.ok ? sender.value : { name: '', email: '' },
      emailBody: body.ok ? body.value : '',
      subjectError: subject.ok ? null : subject.error,
      bodyError: body.ok ? null : body.error
    };
    ctx.ok = !!ctx.emailBody;
    return ctx;
  }

  function isInsideComposeArea(el) {
    // Walk up a few ancestors and look for a Gmail send / draft button.
    // This confirms the contenteditable is a reply/body box, not a search bar
    // or other editable widget.
    var root = el;
    for (var i = 0; i < 7 && root; i++) {
      root = root.parentElement;
      if (!root) break;
      var sendBtn = root.querySelector([
        '[role="button"][aria-label*="Send" i]',
        '[role="button"][aria-label*="发送" i]',
        '[role="button"][aria-label*="Draft" i]',
        '[role="button"][aria-label*="草稿" i]',
        '[role="button"][data-tooltip*="Send" i]',
        '[role="button"][data-tooltip*="发送" i]',
        '[role="button"][data-tooltip*="Draft" i]',
        '[role="button"][data-tooltip*="草稿" i]'
      ].join(','));
      if (sendBtn) return true;
    }
    return false;
  }

  // Visible reply textboxes (array). Specific selectors first, then a structural
  // fallback for Gmail's ever-changing labels.
  function getReplyBoxes() {
    var out = [];
    for (var i = 0; i < GMAIL_SELECTORS.replyBox.length; i++) {
      try {
        var found = document.querySelectorAll(GMAIL_SELECTORS.replyBox[i]);
        for (var j = 0; j < found.length; j++) {
          var box = found[j];
          if (isVisible(box) && out.indexOf(box) === -1) out.push(box);
        }
      } catch (e) { /* skip */ }
    }
    // Fallback: any contenteditable textbox that lives inside a Gmail compose
    // area (has a send/draft button nearby). This catches new Gmail variants even
    // when aria-labels are empty or different from our explicit list.
    if (out.length === 0) {
      try {
        var all = document.querySelectorAll('div[contenteditable="true"][role="textbox"], div[contenteditable="true"].editable');
        for (var k = 0; k < all.length; k++) {
          var b = all[k];
          if (isVisible(b) && isInsideComposeArea(b) && out.indexOf(b) === -1) {
            out.push(b);
          }
        }
      } catch (e) { /* skip */ }
    }
    return out;
  }

  function getReplyBox() {
    var boxes = getReplyBoxes();
    return boxes.length ? boxes[0] : null;
  }

  // Insert text into a specific contenteditable reply box and fire the events
  // Gmail needs to register the change. Never sends the email.
  function insertReplyInto(box, text) {
    if (!box) return { ok: false, error: 'NO_REPLY_BOX' };
    try {
      box.focus();
      // execCommand insertText is the most reliable way to insert into Gmail's
      // contenteditable while preserving caret + triggering Gmail internals.
      var ok = false;
      try {
        ok = document.execCommand('insertText', false, text);
      } catch (e) { ok = false; }

      if (!ok) {
        // Fallback: set text content directly.
        box.innerText = text;
      }
      box.dispatchEvent(new InputEvent('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    } catch (e) {
      RP.logger.error('insertReplyInto failed', e);
      return { ok: false, error: 'INSERT_EXCEPTION' };
    }
  }

  RP.dom = {
    GMAIL_SELECTORS: GMAIL_SELECTORS,
    getSubject: getSubject,
    getSender: getSender,
    getEmailBody: getEmailBody,
    getConversation: getConversation,
    getReplyBoxes: getReplyBoxes,
    getReplyBox: getReplyBox,
    insertReplyInto: insertReplyInto,
    isVisible: isVisible
  };
})(window.RP);

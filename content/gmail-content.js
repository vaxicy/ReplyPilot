// content/gmail-content.js
// Entry point for the Gmail content script. Detects reply boxes (Gmail is a
// SPA, so we use a MutationObserver + debounce) and registers them with the
// single floating ReplyPilot card. Handles language changes and popup
// "refresh" messages.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var scanTimer = null;

  function debouncedScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndAttach, 300);
  }

  function resetCards() {
    var cards = document.querySelectorAll('[data-rp-card]');
    for (var i = 0; i < cards.length; i++) cards[i].remove();
    var boxes = document.querySelectorAll('[data-rp-ui="1"]');
    for (var j = 0; j < boxes.length; j++) boxes[j].removeAttribute('data-rp-ui');
  }

  function scanAndAttach() {
    try {
      var boxes = RP.dom.getReplyBoxes();
      for (var i = 0; i < boxes.length; i++) {
        RP.ui.attachTo(boxes[i]);
      }
    } catch (e) {
      RP.logger.error('scanAndAttach failed', e);
    }
  }

  function start() {
    RP.i18n.init().then(function () {
      RP.ui.init();
      RP.ui.refreshAll();
      scanAndAttach();

      // Watch for SPA navigation / reply box open-close.
      var observer = new MutationObserver(debouncedScan);
      observer.observe(document.body, { childList: true, subtree: true });

      // Reply boxes sometimes appear only after a focus/click.
      document.addEventListener('focusin', debouncedScan, true);

      // Re-translate the floating card when the user changes language in Options.
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local' && changes.rp_language) {
          var newLang = changes.rp_language.newValue;
          if (RP.i18n.getLanguage() !== newLang) {
            RP.i18n.setLanguage(newLang).then(function () {
              RP.ui.refreshAll();
            });
          } else {
            RP.ui.refreshAll();
          }
        }
      });

      // Messages from the popup ("Refresh Assistant").
      chrome.runtime.onMessage.addListener(function (msg) {
        if (msg && msg.type === 'RP_REFRESH') {
          // Tear down the floating card so it can be rebuilt with the latest code
          // and language, then re-scan.
          resetCards();
          RP.ui.init();
          scanAndAttach();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.RP);

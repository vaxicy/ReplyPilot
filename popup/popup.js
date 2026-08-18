// popup/popup.js
(async function () {
  'use strict';

  await RP.i18n.init();
  RP.i18n.applyTo(document);

  var settings = await RP.storage.getAll();
  var aiStatus = document.getElementById('aiStatus');

  // Resolve the active provider's own key (per-provider slots take priority).
  var provider = settings.rp_provider || 'siliconflow';
  var slot = (settings.rp_providerConfigs && settings.rp_providerConfigs[provider]) || null;
  var activeKey = (slot && slot.apiKey) ? slot.apiKey : (settings.rp_apiKey || '');

  if (activeKey && activeKey.trim()) {
    aiStatus.textContent = RP.i18n.t('statusConfigured');
    aiStatus.className = 'rp-badge rp-badge-ok';
  } else {
    aiStatus.textContent = RP.i18n.t('statusNotConfigured');
    aiStatus.className = 'rp-badge rp-badge-warn';
  }

  document.getElementById('openSettings').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById('refresh').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (tab && tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'RP_REFRESH' }, function () {
          // ignore response / errors (e.g., not a Gmail tab)
          if (chrome.runtime.lastError) { /* noop */ }
        });
      }
      window.close();
    });
  });
})();

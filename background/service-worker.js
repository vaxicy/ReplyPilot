// background/service-worker.js
// Minimal MV3 service worker. Handles install and relays simple messages.
'use strict';

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    // First install: open the options page so the user can add an API key.
    chrome.runtime.openOptionsPage();
  }
});

// Messages from popup / content scripts.
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === 'RP_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'RP_GET_TAB_INFO') {
    // Used by the popup to know whether the active tab is Gmail.
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      var url = tab && tab.url ? tab.url : '';
      sendResponse({ isGmail: url.indexOf('mail.google.com') !== -1, url: url });
    });
    return true; // keep channel open for async response
  }
});

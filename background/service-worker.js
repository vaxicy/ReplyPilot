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

  if (msg.type === 'RP_FETCH_CHAT') {
    // Forward the actual chat-completions request from the content script.
    // Content scripts running on mail.google.com are blocked by Gmail's CSP
    // (connect-src) from fetching external APIs directly, so we relay through
    // the background service worker, whose origin is chrome-extension:// and is
    // not subject to the page CSP. host_permissions includes https://*/*.
    relayChatRequest(msg.payload)
      .then(function (result) { sendResponse(result); })
      .catch(function (err) {
        sendResponse({ ok: false, status: 0, error: String(err && err.message || err) });
      });
    return true; // keep channel open for async response
  }
});

// Perform the chat-completions POST on behalf of a content script.
function relayChatRequest(payload) {
  payload = payload || {};
  var endpoint = payload.endpoint;
  var apiKey = payload.apiKey;
  var timeout = payload.timeout || 45000;

  return new Promise(function (resolve, reject) {
    if (!endpoint || !apiKey) {
      reject(new Error('Missing endpoint or apiKey'));
      return;
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(new Error('TIMEOUT')); }, timeout);

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages || [],
        temperature: payload.temperature != null ? payload.temperature : 0.5,
        max_tokens: payload.max_tokens || 2048,
        stream: false
      }),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timer);
        // Relay status + parsed body (or text) so the caller can map errors.
        return res.text().then(function (text) {
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
          resolve({ ok: res.ok, status: res.status, body: json, raw: text,
            retryAfter: res.headers.get('Retry-After') || null });
        });
      })
      .catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
  });
}

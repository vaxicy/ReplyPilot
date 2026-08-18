// services/siliconflow.js
// SiliconFlow chat completions client (OpenAI-compatible).
// The API key and model are read from user settings at call time; nothing is
// hard-coded. Errors are normalized into codes the UI can present friendly text.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
  var DEFAULT_TIMEOUT = 45000; // 45s client-side ceiling

  // Accept either a full OpenAI-compatible completions URL or just the base URL.
  // Users often paste only https://host/v1, so we append /chat/completions when
  // it is missing. This keeps both "test connection" and real chat calls working.
  function normalizeChatEndpoint(endpoint) {
    endpoint = (endpoint || '').trim();
    if (!endpoint) return ENDPOINT;
    // Remove trailing slash(es) for consistent comparison.
    endpoint = endpoint.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(endpoint)) return endpoint;
    return endpoint + '/chat/completions';
  }

  function makeError(code, message) {
    var e = new Error(message || code);
    e.code = code;
    return e;
  }

  function isAbortError(err) {
    if (!err) return false;
    if (err.name === 'AbortError' || err.code === 'AbortError' || err.code === 'ABORT_ERR') return true;
    var msg = String(err.message || '').toLowerCase();
    return /aborted|signal.*abort|abort.*signal|the user aborted a request/i.test(msg);
  }

  // messages: [{role, content}]
  function chat(opts) {
    opts = opts || {};
      var apiKey = opts.apiKey;
      var model = opts.model;
      var messages = opts.messages || [];
      var endpoint = normalizeChatEndpoint(opts.endpoint); // OpenAI-compatible URL
      var signal = opts.signal; // optional AbortSignal for timeout
      var timeout = opts.timeout || DEFAULT_TIMEOUT;

    return new Promise(function (resolve, reject) {
      if (!apiKey) {
        reject(makeError('API_KEY_MISSING', 'API key missing'));
        return;
      }
      if (!model) {
        reject(makeError('MODEL_MISSING', 'Model ID missing'));
        return;
      }

      // Forward the request through the background service worker. Content
      // scripts running on mail.google.com are blocked by the page CSP from
      // fetching external APIs directly, so the relay avoids the "Network
      // error" we used to see inside Gmail. The background worker's origin is
      // chrome-extension:// and is not subject to that CSP.
      chrome.runtime.sendMessage(
        {
          type: 'RP_FETCH_CHAT',
          payload: {
            endpoint: endpoint,
            apiKey: apiKey,
            model: model,
            messages: messages,
            temperature: 0.5,
            max_tokens: opts.max_tokens || 2048,
            timeout: timeout
          }
        },
        function (res) {
          if (chrome.runtime.lastError) {
            // Channel-level failure (e.g. SW not reachable) — surface clearly.
            reject(makeError('NETWORK_ERROR', chrome.runtime.lastError.message || 'Network error'));
            return;
          }
          if (!res || !res.ok) {
            var status = res && res.status;
            if (status === 401) {
              reject(makeError('API_KEY_INVALID', 'API key invalid (401)'));
              return;
            }
            if (status === 404) {
              reject(makeError('MODEL_NOT_FOUND', 'Model not found (404)'));
              return;
            }
            if (status === 429) {
              reject(makeError('RATE_LIMITED', 'Rate limited (429)'));
              return;
            }
            if (status) {
              reject(makeError('HTTP_' + status, 'HTTP error ' + status));
              return;
            }
            reject(makeError('NETWORK_ERROR', (res && res.error) || 'Network error'));
            return;
          }
          resolve(res.body);
        }
      );
    });
  }

  // Quick connectivity test — uses GET /v1/models to validate API key + network instantly.
  // No model inference needed; returns in <2s on normal connections.
  function testConnection(opts) {
    opts = opts || {};
    var apiKey = opts.apiKey;
    var endpoint = normalizeChatEndpoint(opts.endpoint);
    var timeout = opts.timeout || 8000;

    return new Promise(function (resolve, reject) {
      if (!apiKey) {
        reject(makeError('API_KEY_MISSING', 'API key missing'));
        return;
      }

      // Derive base URL from chat completions endpoint: replace /chat/completions with /models
      var baseUrl = endpoint.replace(/\/chat\/completions\/?$/, '') + '/models';

      var controller = new AbortController();
      var timeoutId = setTimeout(function () {
        controller.abort(new Error('TIMEOUT'));
      }, timeout);

      function cleanup() { clearTimeout(timeoutId); }

      fetch(baseUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + apiKey
        },
        signal: controller.signal
      })
        .then(function (res) {
          cleanup();
          if (res.status === 401) {
            reject(makeError('API_KEY_INVALID', 'API key invalid (401)'));
            return;
          }
          if (!res.ok) {
            reject(makeError('HTTP_' + res.status, 'HTTP error ' + res.status));
            return;
          }
          resolve({ status: res.status, ok: true });
        })
        .catch(function (err) {
          cleanup();
          if (err && err.code) { reject(err); return; }
          if (isAbortError(err)) {
            reject(makeError('TIMEOUT', 'Request timed out'));
          } else {
            reject(makeError('NETWORK_ERROR', 'Network error'));
          }
        });
    });
  }

  RP.siliconflow = {
    ENDPOINT: ENDPOINT,
    chat: chat,
    testConnection: testConnection
  };
})(window.RP);

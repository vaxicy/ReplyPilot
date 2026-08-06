// services/siliconflow.js
// SiliconFlow chat completions client (OpenAI-compatible).
// The API key and model are read from user settings at call time; nothing is
// hard-coded. Errors are normalized into codes the UI can present friendly text.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
  var DEFAULT_TIMEOUT = 30000; // 30s client-side ceiling

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
      var endpoint = opts.endpoint || ENDPOINT; // OpenAI-compatible URL
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

      var controller = null;
      var timeoutId = null;
      if (!signal) {
        controller = new AbortController();
        signal = controller.signal;
        timeoutId = setTimeout(function () {
          controller.abort(new Error('TIMEOUT'));
        }, timeout);
      }

      function cleanup() {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: opts.max_tokens || 1500,
          stream: false
        }),
        signal: signal
      })
        .then(function (res) {
          cleanup();
          if (res.status === 401) {
            throw makeError('API_KEY_INVALID', 'API key invalid (401)');
          }
          if (res.status === 404) {
            throw makeError('MODEL_NOT_FOUND', 'Model not found (404)');
          }
          if (res.status === 429) {
            throw makeError('RATE_LIMITED', 'Rate limited (429)');
          }
          if (!res.ok) {
            throw makeError('HTTP_' + res.status, 'HTTP error ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          cleanup();
          resolve(data);
        })
        .catch(function (err) {
          cleanup();
          if (err && err.code) {
            reject(err);
            return;
          }
          // fetch-level failure: network error / timeout / CORS
          if (isAbortError(err)) {
            reject(makeError('TIMEOUT', 'Request timed out'));
          } else {
            reject(makeError('NETWORK_ERROR', 'Network error'));
          }
        });
    });
  }

  // Quick connectivity test — uses GET /v1/models to validate API key + network instantly.
  // No model inference needed; returns in <2s on normal connections.
  function testConnection(opts) {
    opts = opts || {};
    var apiKey = opts.apiKey;
    var endpoint = opts.endpoint || ENDPOINT;
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

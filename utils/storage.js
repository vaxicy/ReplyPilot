// utils/storage.js
// Thin promise wrapper around chrome.storage.local.
// All user settings (including the API key) live here and are never written
// to source code or exposed in logs.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var DEFAULTS = {
    rp_language: '',            // '' => follow browser locale
    rp_provider: 'siliconflow', // siliconflow | openai | custom
    rp_apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    rp_apiKey: '',
    rp_model: 'deepseek-ai/DeepSeek-V4-Flash',
    rp_tone: 'professional',      // professional | friendly | short | luxury
    rp_replyLanguage: 'auto',     // auto | zh | en
    rp_storeName: '',             // store name injected into prompts
    rp_storeCategory: '',         // main category injected into prompts
    rp_shippingInfo: '',          // shipping info injected into prompts
    rp_returnPolicy: ''           // return policy injected into prompts
  };

  function get(key) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(key, function (res) {
          resolve(res && res[key] !== undefined ? res[key] : undefined);
        });
      } catch (e) {
        RP.logger.error('storage.get failed', e);
        resolve(undefined);
      }
    });
  }

  function isContextInvalidatedError(e) {
    return e && typeof e.message === 'string' &&
      e.message.toLowerCase().indexOf('extension context invalidated') !== -1;
  }

  function getAll() {
    return new Promise(function (resolve, reject) {
      try {
        chrome.storage.local.get(DEFAULTS, function (res) {
          resolve(res || {});
        });
      } catch (e) {
        if (isContextInvalidatedError(e)) {
          var err = new Error('Extension context invalidated');
          err.code = 'CONTEXT_INVALIDATED';
          reject(err);
          return;
        }
        RP.logger.error('storage.getAll failed', e);
        resolve(Object.assign({}, DEFAULTS));
      }
    });
  }

  function set(key, value) {
    return new Promise(function (resolve) {
      try {
        var obj = {};
        obj[key] = value;
        chrome.storage.local.set(obj, function () { resolve(true); });
      } catch (e) {
        RP.logger.error('storage.set failed', e);
        resolve(false);
      }
    });
  }

  function setMany(obj) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(obj, function () { resolve(true); });
      } catch (e) {
        RP.logger.error('storage.setMany failed', e);
        resolve(false);
      }
    });
  }

  RP.storage = {
    DEFAULTS: DEFAULTS,
    get: get,
    getAll: getAll,
    set: set,
    setMany: setMany
  };
})(window.RP);

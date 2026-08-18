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
    rp_providerConfigs: {},     // { [provider]: { apiEndpoint, apiKey, model } }
    rp_tone: 'professional',      // professional | friendly | short | luxury
    rp_replyLanguage: 'auto',     // auto | zh | en
    rp_storeName: '',             // store name injected into prompts
    rp_storeCategory: '',         // main category injected into prompts
    rp_shippingInfo: '',          // shipping info injected into prompts
    rp_returnPolicy: '',          // return policy injected into prompts
    rp_shippingRegions: ''        // shipping regions injected into prompts
  };

  // Ensure every known provider has its own slot in rp_providerConfigs,
  // seeding empty slots from the built-in presets so the UI and runtime never
  // fall back to a shared global credential. Legacy flat fields (rp_apiKey /
  // rp_apiEndpoint / rp_model) are intentionally ignored — each provider must
  // be configured independently.
  var PRESET_ENDPOINTS = {
    siliconflow: 'https://api.siliconflow.cn/v1',
    openai: 'https://api.openai.com/v1',
    custom: ''
  };
  var PRESET_MODELS = {
    siliconflow: 'deepseek-ai/DeepSeek-V4-Flash',
    openai: 'gpt-4o-mini',
    custom: ''
  };

  function normalizeProviderConfigs(res) {
    if (!res || typeof res !== 'object') return res;
    var configs = (res.rp_providerConfigs && typeof res.rp_providerConfigs === 'object')
      ? res.rp_providerConfigs : {};
    ['siliconflow', 'openai', 'custom'].forEach(function (p) {
      var slot = configs[p];
      if (!slot || typeof slot !== 'object') slot = {};
      configs[p] = {
        apiEndpoint: (slot.apiEndpoint != null && slot.apiEndpoint !== '')
          ? slot.apiEndpoint : (PRESET_ENDPOINTS[p] || ''),
        apiKey: (slot.apiKey != null) ? slot.apiKey : '',
        model: (slot.model != null && slot.model !== '')
          ? slot.model : (PRESET_MODELS[p] || '')
      };
    });
    res.rp_providerConfigs = configs;
    return res;
  }

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
          resolve(normalizeProviderConfigs(res || {}));
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

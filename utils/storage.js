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
    rp_replyLanguage: 'auto',   // auto | zh | en
    rp_closing: 'Best regards', // sign-off line placed above the signature
    rp_closingMode: 'manual',   // manual | ai (ai = let the model choose the closing)
    rp_signature: '',           // optional name/signature appended to replies
    rp_useSignature: false,     // whether to append the closing + signature
    rp_myContext: '',           // free-text background the AI should keep in mind
    rp_quickPrompts: null,      // null = uninitialised; defaults seeded on first use
    rp_quickPromptsVersion: 0   // bumped when the default keyword set changes
  };

  // Legacy fields kept only for a one-time migration. After migrating they are
  // removed from storage so callers never see them again.
  var LEGACY_STORE_KEYS = [
    'rp_storeName', 'rp_storeCategory', 'rp_shippingInfo',
    'rp_returnPolicy', 'rp_shippingRegions'
  ];
  var LEGACY_KEYS = LEGACY_STORE_KEYS.concat(['rp_myName', 'rp_tone', 'rp_toneSet', 'rp_closingAi']);

  function migrateLegacy(res) {
    if (!res) return res;
    var changed = false;

    // 1) Legacy e-commerce store fields -> free-text myContext.
    if (!res.rp_myContext) {
      var parts = [];
      if (res.rp_storeName) parts.push('Store: ' + res.rp_storeName);
      if (res.rp_storeCategory) parts.push('Category: ' + res.rp_storeCategory);
      if (res.rp_shippingInfo) parts.push('Shipping: ' + res.rp_shippingInfo);
      if (res.rp_returnPolicy) parts.push('Returns: ' + res.rp_returnPolicy);
      if (res.rp_shippingRegions) parts.push('Ships to: ' + res.rp_shippingRegions);
      if (parts.length) { res.rp_myContext = parts.join('\n'); changed = true; }
    }

    // 2) Legacy single "my name" -> signature text.
    if (!res.rp_signature && res.rp_myName) {
      res.rp_signature = res.rp_myName;
      changed = true;
    }

    // 3) Legacy tone / tone set: tones are now keyword chips, so just discard.
    if (res.rp_tone || (Array.isArray(res.rp_toneSet) && res.rp_toneSet.length)) {
      changed = true;
    }

    // 4) Legacy closing AI toggle -> closing mode select.
    if (res.rp_closingAi) {
      res.rp_closingMode = 'ai';
      changed = true;
    }

    if (changed) {
      var toSave = {
        rp_myContext: res.rp_myContext,
        rp_signature: res.rp_signature
      };
      try {
        chrome.storage.local.set(toSave, function () {
          chrome.storage.local.remove(LEGACY_KEYS, function () { });
        });
      } catch (e) { /* ignore migration failures */ }
      LEGACY_KEYS.forEach(function (k) { delete res[k]; });
    }
    return res;
  }

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
        // Request the defaults plus any legacy keys so we can migrate their
        // values in one pass.
        var keys = {};
        Object.keys(DEFAULTS).forEach(function (k) { keys[k] = DEFAULTS[k]; });
        LEGACY_KEYS.forEach(function (k) { keys[k] = ''; });
        chrome.storage.local.get(keys, function (res) {
          res = normalizeProviderConfigs(res || {});
          resolve(migrateLegacy(res));
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

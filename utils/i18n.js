// utils/i18n.js
// Runtime, in-app switchable i18n. Loads message dictionaries from the
// extension's _locales files so a single source of truth is used, and lets the
// user override the language from the Options page (independent of the browser
// locale). Works in both content scripts (via web_accessible_resources) and
// extension pages (popup / options).
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var SUPPORTED = ['en', 'zh_CN'];

  var current = 'en';
  var dicts = { en: {}, zh_CN: {} };
  var initialized = false;

  function resolveInitial() {
    // 1. stored preference  2. browser locale  3. English
    return RP.storage.get('rp_language').then(function (saved) {
      if (saved && SUPPORTED.indexOf(saved) !== -1) {
        current = saved;
        return;
      }
      var nav = (navigator.language || 'en').toLowerCase();
      current = nav.indexOf('zh') === 0 ? 'zh_CN' : 'en';
    });
  }

  function loadLocale(locale) {
    return new Promise(function (resolve) {
      var url;
      try {
        url = chrome.runtime.getURL('_locales/' + locale + '/messages.json');
      } catch (e) {
        resolve();
        return;
      }
      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error('http ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var flat = {};
          for (var k in data) {
            if (data.hasOwnProperty(k) && data[k] && data[k].message) {
              flat[k] = data[k].message;
            }
          }
          dicts[locale] = flat;
          resolve();
        })
        .catch(function (e) {
          RP.logger.warn('i18n: failed to load', locale, e);
          resolve();
        });
    });
  }

  function init() {
    if (initialized) return Promise.resolve();
    initialized = true;
    return resolveInitial().then(function () {
      return Promise.all(SUPPORTED.map(loadLocale));
    });
  }

  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = 'en';
    current = lang;
    return RP.storage.set('rp_language', lang);
  }

  // Translate a key, with optional {{var}} interpolation.
  // Resolution order: runtime dict (in-app language) -> English runtime dict ->
  // native chrome.i18n (browser locale, works without fetch) -> raw key.
  function t(key, vars) {
    var str = (dicts[current] && dicts[current][key]) || dicts.en[key];
    if (!str && typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      str = chrome.i18n.getMessage(key);
    }
    if (!str) str = key;
    if (vars && typeof vars === 'object') {
      for (var v in vars) {
        if (vars.hasOwnProperty(v)) {
          str = str.split('{{' + v + '}}').join(vars[v]);
        }
      }
    }
    return str;
  }

  // Apply translations to elements using data-i18n / data-i18n-placeholder /
  // data-i18n-title attributes within the given root (default: document).
  function applyTo(root) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    var ph = root.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < ph.length; j++) {
      ph[j].setAttribute('placeholder', t(ph[j].getAttribute('data-i18n-placeholder')));
    }
    var tt = root.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < tt.length; k++) {
      tt[k].setAttribute('title', t(tt[k].getAttribute('data-i18n-title')));
    }
    if (root.documentElement) {
      root.documentElement.setAttribute('lang', current === 'zh_CN' ? 'zh-CN' : 'en');
    }
  }

  RP.i18n = {
    SUPPORTED: SUPPORTED,
    init: init,
    setLanguage: setLanguage,
    t: t,
    applyTo: applyTo,
    getLanguage: function () { return current; }
  };
})(window.RP);

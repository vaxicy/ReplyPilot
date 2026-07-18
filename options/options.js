// options/options.js
(function () {
  'use strict';

  var ids = ['provider', 'apiKey', 'quickModel', 'model', 'language', 'tone', 'replyLanguage', 'aiMemory'];
  var MODEL_OPTIONS = {
    'deepseek-ai/DeepSeek-V4-Flash': 'deepseek-ai/DeepSeek-V4-Flash',
    'deepseek-ai/DeepSeek-V3': 'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen2.5-72B-Instruct': 'Qwen/Qwen2.5-72B-Instruct'
  };

  function init() {
    RP.i18n.init().then(function () {
      RP.i18n.applyTo(document);
      loadSettings();
      bindEvents();
    });
  }

  function loadSettings() {
    RP.storage.getAll().then(function (settings) {
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var key = 'rp_' + id;
        if (id === 'provider') key = 'rp_provider';
        var value = settings[key];
        if (el.type === 'checkbox') {
          el.checked = !!value;
        } else {
          el.value = value || '';
        }
      });

      // Sync quickModel dropdown with the saved model value.
      syncQuickModelFromInput();
    });
  }

  function syncQuickModelFromInput() {
    var modelInput = document.getElementById('model');
    var quickModel = document.getElementById('quickModel');
    if (!modelInput || !quickModel) return;
    var value = modelInput.value.trim();
    if (MODEL_OPTIONS[value]) {
      quickModel.value = value;
    } else {
      quickModel.value = '';
    }
  }

  function bindEvents() {
    var langSelect = document.getElementById('language');
    if (langSelect) {
      langSelect.addEventListener('change', function () {
        RP.i18n.setLanguage(langSelect.value).then(function () {
          RP.i18n.applyTo(document);
          showStatus(RP.i18n.t('optNeedReload'));
        });
      });
    }

    var quickModel = document.getElementById('quickModel');
    var modelInput = document.getElementById('model');
    if (quickModel && modelInput) {
      quickModel.addEventListener('change', function () {
        if (quickModel.value) {
          modelInput.value = quickModel.value;
        }
      });
      modelInput.addEventListener('input', syncQuickModelFromInput);
    }

    var form = document.getElementById('optionsForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        saveSettings();
      });
    }
  }

  function saveSettings() {
    var obj = {};
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var key = 'rp_' + id;
      if (id === 'provider') key = 'rp_provider';
      obj[key] = el.value;
    });

    RP.storage.setMany(obj).then(function () {
      showStatus(RP.i18n.t('optSaved'));
    });
  }

  function showStatus(text) {
    var el = document.getElementById('saveStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.add('rp-save-status-visible');
    setTimeout(function () {
      el.classList.remove('rp-save-status-visible');
      el.textContent = '';
    }, 4000);
  }

  init();
})();

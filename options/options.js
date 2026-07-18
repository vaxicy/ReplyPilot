// options/options.js
// Settings page logic: loads/saves user config, syncs the quick-model
// dropdown with the typed model ID, and applies per-provider presets
// (endpoint + recommended models) so any OpenAI-compatible API works.
(function () {
  'use strict';

  var ids = ['provider', 'apiEndpoint', 'apiKey', 'quickModel', 'model',
             'language', 'tone', 'replyLanguage', 'aiMemory'];

  // Per-provider defaults. Custom has no preset models/endpoint.
  var PROVIDER_PRESETS = {
    siliconflow: {
      endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      models: ['deepseek-ai/DeepSeek-V4-Flash', 'deepseek-ai/DeepSeek-V3',
               'Qwen/Qwen2.5-72B-Instruct']
    },
    openai: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']
    },
    custom: {
      endpoint: '',
      models: []
    }
  };

  var currentProvider = 'siliconflow';

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
        var value = settings[key];
        if (el.type === 'checkbox') {
          el.checked = !!value;
        } else {
          el.value = value || '';
        }
      });

      // Rebuild the quick-model dropdown to match the saved provider, then
      // sync the selection with the saved model value. We do NOT overwrite
      // the saved endpoint/model here.
      var provider = document.getElementById('provider');
      currentProvider = provider ? provider.value : 'siliconflow';
      buildQuickModelOptions(currentProvider);
      syncQuickModelFromInput();
    });
  }

  function buildQuickModelOptions(provider) {
    var quickModel = document.getElementById('quickModel');
    if (!quickModel) return;
    var preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;

    quickModel.innerHTML = '';
    var customOpt = document.createElement('option');
    customOpt.value = '';
    customOpt.setAttribute('data-i18n', 'quickModelCustom');
    customOpt.textContent = RP.i18n.t('quickModelCustom');
    quickModel.appendChild(customOpt);

    preset.models.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      quickModel.appendChild(o);
    });
  }

  // Apply a provider preset. On a user-initiated change we overwrite the
  // endpoint and swap the model to the new provider's default (unless the
  // user had typed a custom model ID that belongs to neither provider).
  function applyProviderPreset(provider, opts) {
    opts = opts || {};
    var preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
    var endpointInput = document.getElementById('apiEndpoint');
    var modelInput = document.getElementById('model');
    var quickModel = document.getElementById('quickModel');

    buildQuickModelOptions(provider);

    if (endpointInput && !opts.skipEndpoint) {
      endpointInput.value = preset.endpoint;
    }

    if (modelInput && quickModel) {
      var current = modelInput.value.trim();
      var wasPreset = (opts.oldModels || []).indexOf(current) !== -1;
      if (!current || wasPreset) {
        modelInput.value = preset.models[0] || '';
      }
      syncQuickModelFromInput();
    }
  }

  function syncQuickModelFromInput() {
    var modelInput = document.getElementById('model');
    var quickModel = document.getElementById('quickModel');
    if (!modelInput || !quickModel) return;
    var value = modelInput.value.trim();
    var match = false;
    for (var i = 0; i < quickModel.options.length; i++) {
      if (quickModel.options[i].value === value) { match = true; break; }
    }
    quickModel.value = match ? value : '';
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

    var provider = document.getElementById('provider');
    if (provider) {
      provider.addEventListener('change', function () {
        var oldModels = (PROVIDER_PRESETS[currentProvider] || {}).models || [];
        applyProviderPreset(provider.value, { oldModels: oldModels });
        currentProvider = provider.value;
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

// options/options.js
// Settings page logic: loads/saves user config and applies per-provider
// presets (endpoint + default model) so any OpenAI-compatible API works.
(function () {
  'use strict';

  var ids = ['provider', 'apiEndpoint', 'apiKey', 'model',
             'language', 'tone', 'replyLanguage', 'aiMemory'];

  // Per-provider defaults. Custom has no preset models/endpoint.
  var PROVIDER_PRESETS = {
    siliconflow: {
      endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      model: 'deepseek-ai/DeepSeek-V4-Flash'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini'
    },
    custom: {
      endpoint: '',
      model: ''
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

      // Remember the saved provider so provider-change can detect the old preset.
      var provider = document.getElementById('provider');
      currentProvider = provider ? provider.value : 'siliconflow';
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

    if (endpointInput && !opts.skipEndpoint) {
      endpointInput.value = preset.endpoint;
    }

    if (modelInput) {
      var current = modelInput.value.trim();
      var wasPreset = opts.oldModel && opts.oldModel === current;
      if (!current || wasPreset) {
        modelInput.value = preset.model;
      }
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

    var provider = document.getElementById('provider');
    if (provider) {
      provider.addEventListener('change', function () {
        var oldModel = (PROVIDER_PRESETS[currentProvider] || {}).model;
        applyProviderPreset(provider.value, { oldModel: oldModel });
        currentProvider = provider.value;
      });
    }

    bindTutorialModal();
    bindDonateModal();

    var form = document.getElementById('optionsForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        saveSettings();
      });
    }
  }

  function bindTutorialModal() {
    var modal = document.getElementById('tutorialModal');
    if (!modal) return;
    var openBtn = document.getElementById('openTutorial');
    var closeBtn = document.getElementById('closeTutorial');
    var closeFooter = document.getElementById('tutorialCloseBtn');

    function open() { modal.hidden = false; }
    function close() { modal.hidden = true; }

    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (closeFooter) closeFooter.addEventListener('click', close);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  function bindDonateModal() {
    var modal = document.getElementById('donateModal');
    if (!modal) return;
    var openBtn = document.getElementById('openDonate');
    var closeBtn = document.getElementById('closeDonate');
    var closeFooter = document.getElementById('donateCloseBtn');

    var tabs = modal.querySelectorAll('.rp-donate-tab');
    var panels = {
      wechat: document.getElementById('donatePanelWeChat'),
      paypal: document.getElementById('donatePanelPayPal')
    };

    function switchTab(name) {
      tabs.forEach(function (t) {
        var active = t.getAttribute('data-tab') === name;
        t.classList.toggle('rp-donate-tab-active', active);
      });
      Object.keys(panels).forEach(function (k) {
        if (panels[k]) panels[k].hidden = (k !== name);
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        switchTab(t.getAttribute('data-tab'));
      });
    });

    function open() { modal.hidden = false; }
    function close() { modal.hidden = true; }

    if (openBtn) openBtn.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (closeFooter) closeFooter.addEventListener('click', close);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
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

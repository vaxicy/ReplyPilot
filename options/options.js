// options/options.js
// Settings page logic: loads/saves user config and applies per-provider
// presets (endpoint + default model) so any OpenAI-compatible API works.
(function () {
  'use strict';

  var ids = ['provider', 'apiEndpoint', 'apiKey', 'model',
             'language', 'tone', 'replyLanguage',
             'storeName', 'storeCategory', 'shippingInfo', 'returnPolicy', 'shippingRegions'];

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
        scheduleAutoSave();
      });
    }

    // Auto-save on any input/change across all fields (debounced 500ms).
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', scheduleAutoSave);
      el.addEventListener('change', scheduleAutoSave);
    });

    bindTestConnection();
    bindTutorialModal();
    bindDonateModal();
    bindFeedbackLink();

    var form = document.getElementById('optionsForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        saveSettings();
      });
    }
  }

  // --- Auto-save (debounced) ---
  var autoSaveTimer = null;
  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () {
      autoSaveTimer = null;
      saveSettings(true);
    }, 500);
  }

  // --- Test connection ---
  function bindTestConnection() {
    var btn = document.getElementById('testConnection');
    if (!btn) return;
    btn.addEventListener('click', function () {
      runConnectionTest(btn);
    });
  }

  function runConnectionTest(btn) {
    var apiKey = document.getElementById('apiKey').value.trim();
    var endpoint = document.getElementById('apiEndpoint').value.trim();

    if (!apiKey) {
      setTestStatus('API_KEY_MISSING', false);
      return;
    }
    if (!endpoint) {
      setTestStatus('ENDPOINT_MISSING', false);
      return;
    }

    btn.disabled = true;
    btn.textContent = RP.i18n.t('optTesting');
    setTestStatus('', null);

    // Derive the models endpoint from the chat completions endpoint so it
    // works for SiliconFlow, OpenAI and any custom OpenAI-compatible host.
    var baseUrl = endpoint.replace(/\/chat\/completions\/?$/, '') + '/models';

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(new Error('TIMEOUT')); }, 8000);

    fetch(baseUrl, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (res.status === 401) { setTestStatus('API_KEY_INVALID', false); return; }
        if (!res.ok) { setTestStatus('HTTP_' + res.status, false); return; }
        setTestStatus('OK', true);
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        var msg = String(err && err.message || '').toLowerCase();
        if (msg.indexOf('abort') !== -1) { setTestStatus('TIMEOUT', false); return; }
        setTestStatus('NETWORK_ERROR', false);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = RP.i18n.t('optTestConnection');
      });
  }

  function setTestStatus(code, ok) {
    var el = document.getElementById('testStatus');
    if (!el) return;
    if (!code) { el.textContent = ''; el.className = 'rp-test-status'; return; }
    el.textContent = RP.i18n.t(testCodeKey(code));
    el.className = 'rp-test-status ' + (ok ? 'rp-test-ok' : 'rp-test-fail');
  }

  function testCodeKey(code) {
    switch (code) {
      case 'OK': return 'optConnectionSuccess';
      case 'API_KEY_INVALID': return 'optApiKeyInvalid';
      case 'API_KEY_MISSING': return 'optApiKeyMissing';
      case 'ENDPOINT_MISSING': return 'optEndpointMissing';
      case 'TIMEOUT': return 'optTimeout';
      case 'NETWORK_ERROR': return 'optNetwork';
      default: return 'optConnectionFailed';
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

  function bindFeedbackLink() {
    var link = document.getElementById('feedbackLink');
    if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var mailto = 'mailto:huangzero2004@gmail.com?subject=' +
        encodeURIComponent('ReplyPilot 问题反馈') +
        '&body=' + encodeURIComponent('Hi, I would like to report a problem / give feedback:\n\n');
      window.open(mailto, '_blank');
    });
  }

  function saveSettings(silent) {
    var obj = {};
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var key = 'rp_' + id;
      obj[key] = el.value;
    });

    RP.storage.setMany(obj).then(function () {
      showStatus(RP.i18n.t(silent ? 'optAutoSaved' : 'optSaved'));
    }).catch(function (e) {
      console.error('Save failed', e);
      showStatus(RP.i18n.t('optSaveFailed'));
    });
  }

  function bindStoreInfo() {
    // No-op placeholder kept for future store-info interactions if needed.
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

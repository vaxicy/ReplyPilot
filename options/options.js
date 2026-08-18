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
      endpoint: 'https://api.siliconflow.cn/v1',
      model: 'deepseek-ai/DeepSeek-V4-Flash'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1',
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

  // Read the per-provider config slot (endpoint/key/model) for `provider`.
  // Returns the slot directly (already seeded from presets by storage). Never
  // falls back to a shared legacy field, so each provider stays independent.
  function readProviderSlot(settings, provider) {
    var slot = (settings.rp_providerConfigs && settings.rp_providerConfigs[provider]) || {};
    return {
      apiEndpoint: (slot.apiEndpoint != null && slot.apiEndpoint !== '') ? slot.apiEndpoint : (PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom).endpoint,
      apiKey: (slot.apiKey != null) ? slot.apiKey : '',
      model: (slot.model != null && slot.model !== '') ? slot.model : (PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom).model
    };
  }

  function loadSettings() {
    RP.storage.getAll().then(function (settings) {
      // Non-provider fields (language, tone, store info, etc.)
      ['language', 'tone', 'replyLanguage', 'storeName', 'storeCategory',
       'shippingInfo', 'returnPolicy', 'shippingRegions'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var value = settings['rp_' + id];
        if (el.type === 'checkbox') {
          el.checked = !!value;
        } else {
          el.value = value || '';
        }
      });

      var provider = settings.rp_provider || 'siliconflow';
      currentProvider = provider;
      var providerEl = document.getElementById('provider');
      if (providerEl) providerEl.value = provider;

      // Fill the api key/endpoint/model from this provider's own slot.
      var slot = readProviderSlot(settings, provider);
      setField('apiKey', slot.apiKey);
      setField('apiEndpoint', slot.apiEndpoint);
      setField('model', slot.model);
    });
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  // Persist the current input values into the active provider's own slot.
  function writeCurrentSlot(settings) {
    settings.rp_providerConfigs = settings.rp_providerConfigs || {};
    settings.rp_providerConfigs[currentProvider] = {
      apiEndpoint: (document.getElementById('apiEndpoint') || {}).value || '',
      apiKey: (document.getElementById('apiKey') || {}).value || '',
      model: (document.getElementById('model') || {}).value || ''
    };
    return settings;
  }

  // Apply a provider slot when switching. Each provider's slot is fully
  // self-contained (seeded from its preset by storage), so switching always
  // loads that provider's own endpoint/key/model verbatim.
  function applyProviderSlot(provider, settings) {
    var slot = readProviderSlot(settings, provider);
    setField('apiKey', slot.apiKey);
    setField('apiEndpoint', slot.apiEndpoint);
    setField('model', slot.model);
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
        // Save the current provider's input values into its own slot first,
        // then load the newly selected provider's slot (or its preset).
        RP.storage.getAll().then(function (settings) {
          settings.rp_provider = currentProvider;
          writeCurrentSlot(settings);
          settings.rp_provider = provider.value;
          applyProviderSlot(provider.value, settings);
          currentProvider = provider.value;
          // Pass the in-memory settings so saveSettings merges against the
          // updated slots (preserving the previous provider's unsaved values).
          saveSettings(true, settings);
        });
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

  function saveSettings(silent, baseSettings) {
    // Read existing provider configs so we don't accidentally wipe the slots of
    // other providers. If baseSettings was passed (e.g. during provider switch),
    // use it directly because it already contains the freshly-merged slots.
    var existingPromise = baseSettings ? Promise.resolve(baseSettings) : RP.storage.getAll();

    existingPromise.then(function (existing) {
      var obj = {};
      // Persist everything except the provider api fields (those live in slots).
      ['language', 'tone', 'replyLanguage', 'storeName', 'storeCategory',
       'shippingInfo', 'returnPolicy', 'shippingRegions', 'provider'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        obj['rp_' + id] = el.value;
      });

      // Save the active provider's key/endpoint/model into its own slot,
      // merging into the existing providerConfigs instead of replacing them.
      // Each provider keeps an independent slot; no shared flat fields.
      var endpoint = (document.getElementById('apiEndpoint') || {}).value || '';
      var apiKey = (document.getElementById('apiKey') || {}).value || '';
      var model = (document.getElementById('model') || {}).value || '';
      obj.rp_provider = currentProvider;
      obj.rp_providerConfigs = existing.rp_providerConfigs || {};
      obj.rp_providerConfigs[currentProvider] = {
        apiEndpoint: endpoint,
        apiKey: apiKey,
        model: model
      };

      return RP.storage.setMany(obj).then(function () {
        showStatus(RP.i18n.t(silent ? 'optAutoSaved' : 'optSaved'));
      }).catch(function (e) {
        console.error('Save failed', e);
        showStatus(RP.i18n.t('optSaveFailed'));
      });
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

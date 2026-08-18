// services/ai-service.js
// Orchestrates prompt building + SiliconFlow call + reply extraction.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  function parseReply(text) {
    if (!text) return '';
    var t = String(text).trim();

    // Strip markdown code fences if the model wrapped the JSON.
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();

    // Try direct JSON parse.
    try {
      var obj = JSON.parse(t);
      if (obj && typeof obj.reply === 'string') return obj.reply.trim();
    } catch (e) { /* fall through */ }

    // Try to extract the first {...} block.
    var m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        var obj2 = JSON.parse(m[0]);
        if (obj2 && typeof obj2.reply === 'string') return obj2.reply.trim();
      } catch (e2) { /* fall through */ }
    }

    // Last resort: return the trimmed text as-is (model returned plain text).
    return t;
  }

  function parseOptions(text) {
    if (!text) return [];
    var t = String(text).trim();

    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();

    try {
      var obj = JSON.parse(t);
      var opts = normalizeOptions(obj);
      if (opts.length) return opts;
    } catch (e) { /* fall through */ }

    var m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        var obj2 = JSON.parse(m[0]);
        var opts2 = normalizeOptions(obj2);
        if (opts2.length) return opts2;
      } catch (e2) { /* fall through */ }
    }

    return [];
  }

  function normalizeOptions(obj) {
    if (!obj || typeof obj !== 'object') return [];
    var keys = ['positive', 'neutral', 'decline'];
    var out = [];
    keys.forEach(function (key) {
      if (obj[key] && typeof obj[key] === 'string') {
        out.push({ key: key, reply: obj[key].trim() });
      }
    });
    return out;
  }

  function makeError(message, code) {
    var e = new Error(message);
    e.code = code;
    return e;
  }

  function checkApiKey(s) {
    var cfg = resolveProviderConfig(s);
    if (!cfg.apiKey || !cfg.apiKey.trim()) {
      throw makeError('API key missing', 'API_KEY_MISSING');
    }
  }

  // Resolve the effective apiKey/endpoint/model for the active provider.
  // Each provider keeps its own slot in rp_providerConfigs; the slot is already
  // seeded from presets by storage, so there is no shared fallback here.
  function resolveProviderConfig(s) {
    var provider = s.rp_provider || 'siliconflow';
    var slot = (s.rp_providerConfigs && s.rp_providerConfigs[provider]) || {};
    return {
      apiKey: (slot.apiKey != null) ? slot.apiKey : '',
      endpoint: (slot.apiEndpoint != null && slot.apiEndpoint !== '') ? slot.apiEndpoint : '',
      model: (slot.model != null && slot.model !== '') ? slot.model : ''
    };
  }

  function extractContent(data) {
    var content = data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (!content) {
      throw makeError('Empty response from model', 'EMPTY_RESPONSE');
    }
    return content;
  }

  // context: { subject, sender:{name,email}, emailBody, strategy }
  // settings: full settings object (optional; fetched if omitted)
  function generateReply(context, settings) {
    context = context || {};
    var settingsPromise = settings ? Promise.resolve(settings) : RP.storage.getAll();

    return settingsPromise.then(function (s) {
      checkApiKey(s);
      var cfg = resolveProviderConfig(s);

      var prompt = RP.parser.buildPrompt({
        tone: s.rp_tone,
        replyLanguage: s.rp_replyLanguage || 'auto',
        storeName: s.rp_storeName || '',
        storeCategory: s.rp_storeCategory || '',
        shippingInfo: s.rp_shippingInfo || '',
        returnPolicy: s.rp_returnPolicy || '',
        shippingRegions: s.rp_shippingRegions || '',
        subject: context.subject,
        emailBody: context.emailBody
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful e-commerce customer service assistant. ' +
            'Always respond with valid JSON in the exact format {"reply": "..."}. ' +
            'Do not wrap it in markdown code fences.'
        },
        { role: 'user', content: prompt }
      ];

      return RP.siliconflow.chat({
        apiKey: cfg.apiKey,
        model: cfg.model,
        endpoint: cfg.endpoint,
        messages: messages,
        max_tokens: 2048
      }).then(function (data) {
        var reply = parseReply(extractContent(data));
        if (!reply) {
          throw makeError('Could not parse model reply', 'PARSE_FAILED');
        }
        return reply;
      });
    });
  }

  // context: { subject, sender:{name,email}, emailBody }
  // settings: full settings object (optional; fetched if omitted)
  function generateOptions(context, settings) {
    context = context || {};
    var settingsPromise = settings ? Promise.resolve(settings) : RP.storage.getAll();

    return settingsPromise.then(function (s) {
      checkApiKey(s);
      var cfg = resolveProviderConfig(s);

      var prompt = RP.parser.buildOptionsPrompt({
        tone: s.rp_tone,
        replyLanguage: s.rp_replyLanguage || 'auto',
        storeName: s.rp_storeName || '',
        storeCategory: s.rp_storeCategory || '',
        shippingInfo: s.rp_shippingInfo || '',
        returnPolicy: s.rp_returnPolicy || '',
        shippingRegions: s.rp_shippingRegions || '',
        subject: context.subject,
        emailBody: context.emailBody
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful e-commerce customer service assistant. ' +
            'Always respond with valid JSON in the exact format ' +
            '{"positive": "...", "neutral": "...", "decline": "..."}. ' +
            'Do not wrap it in markdown code fences.'
        },
        { role: 'user', content: prompt }
      ];

      return RP.siliconflow.chat({
        apiKey: cfg.apiKey,
        model: cfg.model,
        endpoint: cfg.endpoint,
        messages: messages,
        max_tokens: 2048
      }).then(function (data) {
        var options = parseOptions(extractContent(data));
        if (!options.length) {
          throw makeError('Could not parse model options', 'PARSE_FAILED');
        }
        return options;
      });
    });
  }

  // ctx: { subject, emailBody, tone, replyLanguage, store info...,
  //        currentReply, instruction }
  // settings: full settings object (optional; fetched if omitted)
  function reviseReply(ctx, settings) {
    ctx = ctx || {};
    if (!ctx.instruction || !ctx.instruction.trim()) {
      return Promise.reject(makeError('No revision instruction', 'EMPTY_INSTRUCTION'));
    }
    if (!ctx.currentReply || !ctx.currentReply.trim()) {
      return Promise.reject(makeError('No current reply to revise', 'EMPTY_REPLY'));
    }
    var settingsPromise = settings ? Promise.resolve(settings) : RP.storage.getAll();

    return settingsPromise.then(function (s) {
      checkApiKey(s);
      var cfg = resolveProviderConfig(s);

      var prompt = RP.parser.buildRevisePrompt({
        tone: s.rp_tone,
        replyLanguage: s.rp_replyLanguage || 'auto',
        storeName: s.rp_storeName || '',
        storeCategory: s.rp_storeCategory || '',
        shippingInfo: s.rp_shippingInfo || '',
        returnPolicy: s.rp_returnPolicy || '',
        shippingRegions: s.rp_shippingRegions || '',
        subject: ctx.subject,
        emailBody: ctx.emailBody,
        currentReply: ctx.currentReply,
        instruction: ctx.instruction
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful e-commerce customer service assistant. ' +
            'Always respond with valid JSON in the exact format {"reply": "..."}. ' +
            'Do not wrap it in markdown code fences.'
        },
        { role: 'user', content: prompt }
      ];

      return RP.siliconflow.chat({
        apiKey: cfg.apiKey,
        model: cfg.model,
        endpoint: cfg.endpoint,
        messages: messages,
        max_tokens: 2048
      }).then(function (data) {
        var reply = parseReply(extractContent(data));
        if (!reply) {
          throw makeError('Could not parse model reply', 'PARSE_FAILED');
        }
        return reply;
      });
    });
  }

  RP.ai = {
    generateReply: generateReply,
    generateOptions: generateOptions,
    reviseReply: reviseReply,
    parseReply: parseReply,
    parseOptions: parseOptions
  };
})(window.RP);

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

  // Parse the multi-tone response: {"replies":[{"tone":"...","reply":"..."}]}.
  // `tones` is the requested tone list, used as a positional fallback when the
  // model omits or mangles the tone field.
  function parseToneReplies(text, tones) {
    if (!text) return [];
    var t = String(text).trim();

    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();

    var obj = null;
    try { obj = JSON.parse(t); } catch (e) { /* fall through */ }
    if (!obj) {
      var m = t.match(/\{[\s\S]*\}/);
      if (m) { try { obj = JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
    }
    if (!obj) return [];

    var arr = Array.isArray(obj) ? obj : obj.replies;
    if (!Array.isArray(arr)) return [];

    var out = [];
    arr.forEach(function (item) {
      if (!item || typeof item.reply !== 'string') return;
      var tone = item.tone || (tones && tones[out.length]) || '';
      tone = String(tone).trim() || 'professional';
      out.push({ tone: tone, reply: item.reply.trim() });
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
        tone: (s.rp_toneSet && s.rp_toneSet[0]) || 'professional',
        replyLanguage: s.rp_replyLanguage || 'auto',
        myContext: s.rp_myContext || '',
        subject: context.subject,
        emailBody: context.emailBody
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful smart email reply assistant. ' +
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

  // The configured tones to generate (1-4), with a safe fallback set.
  function getToneSet(s) {
    var set = (s.rp_toneSet && s.rp_toneSet.length) ? s.rp_toneSet : ['professional', 'friendly', 'short'];
    return set.slice(0, 4);
  }

  // context: { subject, sender:{name,email}, emailBody }
  // Generates one reply per configured tone; returns [{ tone, reply }].
  // settings: full settings object (optional; fetched if omitted)
  function generateReplies(context, settings) {
    context = context || {};
    var settingsPromise = settings ? Promise.resolve(settings) : RP.storage.getAll();

    return settingsPromise.then(function (s) {
      checkApiKey(s);
      var cfg = resolveProviderConfig(s);
      var tones = getToneSet(s);

      var prompt = RP.parser.buildTonesPrompt({
        tones: tones,
        replyLanguage: s.rp_replyLanguage || 'auto',
        myContext: s.rp_myContext || '',
        subject: context.subject,
        emailBody: context.emailBody
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful smart email reply assistant. ' +
            'Always respond with valid JSON in the exact format ' +
            '{"replies": [{"tone": "<tone>", "reply": "..."}]}. ' +
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
        var replies = parseToneReplies(extractContent(data), tones);
        if (!replies.length) {
          throw makeError('Could not parse model replies', 'PARSE_FAILED');
        }
        return replies;
      });
    });
  }

  // Regenerate a single reply for one tone. Returns the reply string.
  function regenerateOne(context, tone, settings) {
    context = context || {};
    var settingsPromise = settings ? Promise.resolve(settings) : RP.storage.getAll();

    return settingsPromise.then(function (s) {
      checkApiKey(s);
      var cfg = resolveProviderConfig(s);

      var prompt = RP.parser.buildRegenOnePrompt({
        tone: tone,
        replyLanguage: s.rp_replyLanguage || 'auto',
        myContext: s.rp_myContext || '',
        subject: context.subject,
        emailBody: context.emailBody
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful smart email reply assistant. ' +
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

  // ctx: { subject, emailBody, tone, replyLanguage, myContext,
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
        tone: ctx.tone || (s.rp_toneSet && s.rp_toneSet[0]) || 'professional',
        replyLanguage: s.rp_replyLanguage || 'auto',
        myContext: s.rp_myContext || '',
        subject: ctx.subject,
        emailBody: ctx.emailBody,
        currentReply: ctx.currentReply,
        instruction: ctx.instruction
      });

      var messages = [
        {
          role: 'system',
          content: 'You are a helpful smart email reply assistant. ' +
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
    generateReplies: generateReplies,
    regenerateOne: regenerateOne,
    reviseReply: reviseReply,
    parseReply: parseReply,
    parseToneReplies: parseToneReplies
  };
})(window.RP);

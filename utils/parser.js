// utils/parser.js
// Helpers for detecting customer language and building the AI prompt.
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  // Detect whether text is predominantly Chinese (zh) or English (en).
  function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';
    var cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    var total = text.replace(/\s/g, '').length || 1;
    return (cjk / total) > 0.2 ? 'zh' : 'en';
  }

  // Tone labels shown to the model (bilingual so the model understands intent).
  var TONE_LABELS = {
    professional: 'Professional (专业、礼貌、商务)',
    friendly: 'Friendly (友好、亲切、轻松)',
    short: 'Short (简洁、直接、要点明确)',
    warm: 'Warm (温暖、共情、体贴、有人情味)'
  };

  var REPLY_LANGUAGE_LABELS = {
    auto: 'Auto (根据客户邮件语言自动判断)',
    zh: 'Chinese (中文)',
    en: 'English (英文)'
  };

  function toneLabel(tone) {
    return TONE_LABELS[tone] || TONE_LABELS.professional;
  }

  function replyLanguageLabel(lang) {
    return REPLY_LANGUAGE_LABELS[lang] || REPLY_LANGUAGE_LABELS.auto;
  }

  // Cap sizes to keep prompts short and response fast
  var MAX_BODY = 3000;        // ~750 tokens

  function clampText(text, max, label) {
    if (!text) return '';
    var t = String(text).trim();
    if (t.length <= max) return t;
    return t.substring(0, max) + '\n[...' + label + ' truncated...]';
  }

  // Build a compact profile context from the user's own details.
  // Keeps the prompt short (~80 chars) to avoid timeouts / truncation.
  function buildUserContext(ctx) {
    ctx = ctx || {};
    var parts = [];
    if (ctx.myName) parts.push('Name to sign as: ' + ctx.myName.trim());
    if (ctx.myContext) parts.push('Background: ' + ctx.myContext.trim());
    return parts.length ? parts.join('. ') + '.' : '';
  }

  // Build the prompt for generating a single reply (kept for compatibility).
  function buildPrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildUserContext(ctx);

    // Compact prompt: ~250 tokens of template + the incoming email
    var lines = [
      'You are a smart email reply assistant helping the user draft a reply.',
      'Tone: ' + tone + '. Reply language: ' + lang + '.',
      'Rules: write like a real person, matching the sender\'s context. Do NOT fabricate facts, dates, names, numbers, or commitments you do not have. Ask politely if something is unknown. No apologies unless warranted.',
      ''
    ];
    if (mem) lines.push('About me: ' + mem, '');
    lines.push('Incoming email:', 'Subject: ' + subject, '', body, '', 'Return JSON: {"reply": "your reply"}');
    return lines.join('\n');
  }

  // Build the prompt that asks the model to return multiple reply options.
  function buildOptionsPrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildUserContext(ctx);

    // Compact prompt: ~250 tokens of template + the incoming email
    var lines = [
      'You are a smart email reply assistant helping the user draft a reply.',
      'Tone: ' + tone + '. Reply language: ' + lang + '.',
      'Generate 3 reply options with different stances: positive (supportive, agreeing), neutral (balanced, factual), decline (polite refusal or pushback).',
      'Rules: write like a real person, matching the sender\'s context. Do NOT fabricate facts, dates, names, numbers, or commitments you do not have. Ask politely if something is unknown.',
      '',
      'Return strict JSON only, no markdown:',
      '{"positive": "...", "neutral": "...", "decline": "..."}'
    ];
    if (mem) lines.splice(4, 0, 'About me: ' + mem);
    lines.push('', 'Incoming email:', 'Subject: ' + subject, '', body);
    return lines.join('\n');
  }

  // Build the prompt that revises an already generated reply based on user
  // feedback. We pass the original email, the current reply and the user's
  // instruction, and ask the model to ONLY apply the requested change without
  // inventing new order/tracking/refund facts.
  function buildRevisePrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildUserContext(ctx);
    var currentReply = (ctx.currentReply || '').trim();
    var instruction = (ctx.instruction || '').trim();

    var lines = [
      'You are a smart email reply assistant helping the user draft a reply.',
      'Tone: ' + tone + '. Reply language: ' + lang + '.',
      'Rules: write like a real person, matching the sender\'s context. Do NOT fabricate facts, dates, names, numbers, or commitments you do not have. Ask politely if something is unknown.',
      ''
    ];
    if (mem) lines.push('About me: ' + mem, '');
    lines.push(
      'Incoming email:',
      'Subject: ' + subject,
      '',
      body,
      '',
      'Current reply (draft):',
      currentReply,
      '',
      'User feedback / revision instruction:',
      instruction,
      '',
      'Instructions: revise the "Current reply" so it follows the feedback above. ' +
        'Keep what is good, change only what the feedback asks for. Do not add new facts. ' +
        'Return JSON: {"reply": "your revised reply"}'
    );
    return lines.join('\n');
  }

  RP.parser = {
    detectLanguage: detectLanguage,
    toneLabel: toneLabel,
    replyLanguageLabel: replyLanguageLabel,
    buildPrompt: buildPrompt,
    buildOptionsPrompt: buildOptionsPrompt,
    buildRevisePrompt: buildRevisePrompt
  };
})(window.RP);
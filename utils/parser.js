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
    luxury: 'Luxury Brand (高级品牌、优雅、克制、尊贵)'
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

  // Build a compact one-line store context from structured fields.
  // Keeps the prompt short (~80 chars) to avoid timeouts / truncation.
  function buildStoreContext(ctx) {
    ctx = ctx || {};
    var parts = [];
    if (ctx.storeName) parts.push('Store: ' + ctx.storeName.trim());
    if (ctx.storeCategory) parts.push('Category: ' + ctx.storeCategory.trim());
    if (ctx.shippingInfo) parts.push('Shipping: ' + ctx.shippingInfo.trim());
    if (ctx.returnPolicy) parts.push('Returns: ' + ctx.returnPolicy.trim());
    return parts.length ? parts.join('. ') + '.' : '';
  }

  // Build the prompt for generating a single reply (kept for compatibility).
  function buildPrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildStoreContext(ctx);

    // Compact prompt: ~250 tokens of template + customer content
    var lines = [
      'You are an e-commerce customer service assistant.',
      'Tone: ' + tone + '. Reply language: ' + lang + '.',
      'Rules: respond like a real human agent. Do NOT fabricate order/tracking/refund info. Ask politely if unknown. No apologies unless warranted.',
      ''
    ];
    if (mem) lines.push('Store context: ' + mem, '');
    lines.push('Customer email:', 'Subject: ' + subject, '', body, '', 'Return JSON: {"reply": "your reply"}');
    return lines.join('\n');
  }

  // Build the prompt that asks the model to return multiple reply options.
  function buildOptionsPrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildStoreContext(ctx);

    // Compact prompt: ~250 tokens of template + customer content
    var lines = [
      'You are an e-commerce customer service assistant.',
      'Tone: ' + tone + '. Reply language: ' + lang + '.',
      'Generate 3 reply options: positive (helpful), neutral (factual), decline (polite refusal).',
      'Rules: respond like a real human agent. Do NOT fabricate order/tracking/refund info. Ask politely if unknown.',
      '',
      'Return strict JSON only, no markdown:',
      '{"positive": "...", "neutral": "...", "decline": "..."}'
    ];
    if (mem) lines.splice(4, 0, 'Store context: ' + mem);
    lines.push('', 'Customer email:', 'Subject: ' + subject, '', body);
    return lines.join('\n');
  }

  RP.parser = {
    detectLanguage: detectLanguage,
    toneLabel: toneLabel,
    replyLanguageLabel: replyLanguageLabel,
    buildPrompt: buildPrompt,
    buildOptionsPrompt: buildOptionsPrompt
  };
})(window.RP);
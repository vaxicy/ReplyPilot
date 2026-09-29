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
    casual: 'Casual (轻松、随意、口语化)',
    short: 'Short (简洁、直接、要点明确)',
    warm: 'Warm (温暖、共情、体贴、有人情味)',
    formal: 'Formal (正式、严谨、庄重)',
    direct: 'Direct (直接、果断、明确立场)',
    enthusiastic: 'Enthusiastic (热情、积极、有感染力)',
    declinePolite: 'Polite decline (委婉拒绝、礼貌、留有余地，给对方台阶)',
    declineDirect: 'Direct decline (明确、直接地拒绝，不绕弯子)'
  };

  // Canonical tone order; the single source of truth for the tone key list.
  var TONE_ORDER = ['professional', 'friendly', 'casual', 'short',
    'warm', 'formal', 'direct', 'enthusiastic', 'declinePolite', 'declineDirect'];

  // Shared rules applied to every generation prompt. The signature is appended
  // by the extension (not the model), so the model must never write one.
  var BASE_RULES = 'Rules: write like a real person, matching the sender\'s context. ' +
    'Do NOT fabricate facts, dates, names, numbers, or commitments you do not have. ' +
    'Ask politely if something is unknown. ' +
    'Do NOT add a signature or sign-off, and never use placeholders like "[Your Name]".';

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
      BASE_RULES
    ];
    if (mem) lines.push('About me: ' + mem);
    lines.push('', 'Return JSON: {"reply": "your reply"}',
      '', 'Incoming email:', 'Subject: ' + subject, '', body);
    return lines.join('\n');
  }

  // Build the prompt for the guided single-reply generator: the user picks a
  // tone and may add a short instruction guiding how to reply.
  function buildGuidedPrompt(ctx) {
    ctx = ctx || {};
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildUserContext(ctx);
    var instruction = (ctx.instruction || '').trim();

    // Compact prompt: ~250 tokens of template + the incoming email
    var lines = [
      'You are a smart email reply assistant helping the user draft a reply.',
      'Tone: ' + toneLabel(ctx.tone) + '. Reply language: ' + lang + '.',
      BASE_RULES
    ];
    if (mem) lines.push('About me: ' + mem);
    if (instruction) lines.push('User\'s guidance for this reply: ' + instruction);
    lines.push('', 'Return JSON: {"reply": "your reply"}',
      '', 'Incoming email:', 'Subject: ' + subject, '', body);
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
      BASE_RULES
    ];
    if (mem) lines.push('About me: ' + mem);
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
    TONES: TONE_ORDER,
    buildPrompt: buildPrompt,
    buildGuidedPrompt: buildGuidedPrompt,
    buildRevisePrompt: buildRevisePrompt
  };
})(window.RP);
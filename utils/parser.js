// utils/parser.js
// Helpers for detecting language and building the AI prompts.
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

  // Reply-language directives. These are intentionally imperative: the user's
  // guidance (and the incoming email) may be in another language, so the model
  // must be told explicitly which language to answer in.
  var REPLY_LANGUAGE_LABELS = {
    auto: 'match the language of the incoming email',
    zh: 'Simplified Chinese (简体中文) ONLY',
    en: 'English ONLY'
  };

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
  function buildUserContext(ctx) {
    ctx = ctx || {};
    var parts = [];
    if (ctx.myContext) parts.push('Background: ' + ctx.myContext.trim());
    return parts.length ? parts.join('. ') + '.' : '';
  }

  // Shared rules applied to every prompt. The signature is appended by the
  // extension (not the model), so the model must never write one.
  var BASE_RULES = 'Rules: write like a real person, matching the sender\'s context. ' +
    'Write the reply in the required reply language, even if the guidance or the ' +
    'incoming email is written in a different language. ' +
    'Do NOT fabricate facts, dates, names, numbers, or commitments you do not have. ' +
    'Ask politely if something is unknown. ' +
    'Do NOT add a signature or sign-off, and never use placeholders like "[Your Name]".';

  // Fallback guidance when the user leaves the box empty.
  var DEFAULT_GUIDANCE = 'Write a natural, courteous reply that fits the email.';

  // Build the prompt for the guided single-reply generator. Tone and intent are
  // expressed as free-text guidance (keyword chips insert into it), so there is
  // no separate tone parameter.
  function buildGuidedPrompt(ctx) {
    ctx = ctx || {};
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildUserContext(ctx);
    var instruction = (ctx.instruction || '').trim() || DEFAULT_GUIDANCE;

    // Compact prompt: ~250 tokens of template + the incoming email
    var lines = [
      'You are a smart email reply assistant helping the user draft a reply.',
      'Required reply language: ' + lang + '.',
      BASE_RULES
    ];
    if (mem) lines.push('About me: ' + mem);
    lines.push('User\'s guidance for this reply: ' + instruction);
    lines.push('', 'Return JSON: {"reply": "your reply in the required language"}',
      '', 'Incoming email:', 'Subject: ' + subject, '', body);
    return lines.join('\n');
  }

  // Build the prompt that revises an already generated reply based on user
  // feedback. We pass the original email, the current reply and the user's
  // instruction, and ask the model to ONLY apply the requested change without
  // inventing new facts.
  function buildRevisePrompt(ctx) {
    ctx = ctx || {};
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var body = clampText(ctx.emailBody, MAX_BODY, 'content');
    var mem = buildUserContext(ctx);
    var currentReply = (ctx.currentReply || '').trim();
    var instruction = (ctx.instruction || '').trim();

    var lines = [
      'You are a smart email reply assistant helping the user draft a reply.',
      'Required reply language: ' + lang + '.',
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
    replyLanguageLabel: replyLanguageLabel,
    buildGuidedPrompt: buildGuidedPrompt,
    buildRevisePrompt: buildRevisePrompt
  };
})(window.RP);

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

  // Build the prompt for generating a single reply.
  // Kept for compatibility; the floating card now uses buildOptionsPrompt.
  function buildPrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var emailBody = ctx.emailBody || '';

    var prompt = [
      '你是一名专业的电商客服助手。',
      '你的任务是帮助在线商店卖家回复客户邮件。',
      '请根据客户邮件内容生成自然、礼貌、专业的回复。',
      '',
      '回复要求：',
      '语气风格：' + tone,
      '回复语言：' + lang,
      ''
    ].join('\n');

    prompt += buildLanguageRule(ctx.replyLanguage);
    prompt += buildMemoryRule(ctx.aiMemory);

    // Truncate extremely long email body to keep within model token limits
    var MAX_BODY = 6000;
    var truncatedBody = emailBody.length > MAX_BODY
      ? emailBody.substring(0, MAX_BODY) + '\n[...内容已截断...]'
      : emailBody;

    prompt += [
      '',
      '客户邮件：',
      '主题：' + subject,
      '',
      '正文：',
      truncatedBody,
      '',
      '生成规则：',
      '1. 回复必须像真实客服人员，而不是AI。',
      '2. 保持友好、专业。',
      '3. 根据客户语言回复。',
      '4. 如果客户使用英文，默认英文回复。',
      '5. 如果客户使用中文，默认中文回复。',
      '6. 不要随意改变语言。',
      '7. 不要虚构订单号。',
      '8. 不要虚构物流信息。',
      '9. 不要承诺不存在的退款。',
      '10. 不知道的信息需要礼貌询问。',
      '11. 不要责怪客户。',
      '12. 避免机械化表达。',
      '13. 回复长度适中。',
      '14. 适合电商客服场景。',
      '',
      '返回 JSON：',
      '{',
      '  "reply": "生成的邮件回复"',
      '}'
    ].join('\n');

    return prompt;
  }

  function buildLanguageRule(replyLanguage) {
    if (replyLanguage === 'zh') {
      return '\n注意：无论客户邮件使用什么语言，回复都必须全程使用中文。\n';
    }
    if (replyLanguage === 'en') {
      return '\n注意：无论客户邮件使用什么语言，回复都必须全程使用英文。\n';
    }
    return '\n注意：请根据客户邮件语言自动判断回复语言，不要随意切换语言。\n';
  }

  // Inject user-supplied background info (AI memory) as reference context.
  function buildMemoryRule(aiMemory) {
    if (!aiMemory || !aiMemory.trim()) return '';
    var mem = aiMemory.trim();
    var MAX_MEMORY = 800;
    if (mem.length > MAX_MEMORY) {
      mem = mem.substring(0, MAX_MEMORY) + '\n[...记忆已截断...]';
    }
    return '\n用户背景信息（请作为参考上下文，自然地融入回复，不要生硬照搬）：\n'
      + mem + '\n';
  }

  // Build the prompt that asks the model to return multiple reply options.
  function buildOptionsPrompt(ctx) {
    ctx = ctx || {};
    var tone = toneLabel(ctx.tone);
    var lang = replyLanguageLabel(ctx.replyLanguage);
    var subject = ctx.subject || '';
    var emailBody = ctx.emailBody || '';

    var prompt = [
      '你是一名专业的电商客服助手。',
      '请根据以下客户邮件，用「' + tone + '」语气生成 3 个不同的回复方案。',
      '',
      '回复语言：' + lang,
      ''
    ].join('\n');

    prompt += buildLanguageRule(ctx.replyLanguage);
    prompt += buildMemoryRule(ctx.aiMemory);

    // Truncate extremely long email body to keep within model token limits
    var MAX_BODY = 6000;
    var truncatedBody = emailBody.length > MAX_BODY
      ? emailBody.substring(0, MAX_BODY) + '\n[...内容已截断...]'
      : emailBody;

    prompt += [
      '',
      '客户邮件：',
      '主题：' + subject,
      '',
      '正文：',
      truncatedBody,
      '',
      '三个方案要求：',
      '1. 积极支持（Positive）：支持客户、提供解决方案、表达愿意帮忙。',
      '2. 客观中性（Neutral）：客观说明情况、不带强烈立场、普通告知。',
      '3. 委婉拒绝（Decline）：礼貌地说明无法满足请求，并给出原因或替代建议。',
      '4. 三个方案都要像真实客服人员，不要像 AI。',
      '5. 不要虚构订单号、物流、退款等信息。',
      '6. 不知道的信息要礼貌询问，不要责怪客户。',
      '7. 回复长度适中，适合电商客服邮件。',
      '',
      '请严格按以下 JSON 格式返回，不要添加 markdown 代码块：',
      '{',
      '  "positive": "方案一的回复内容",',
      '  "neutral": "方案二的回复内容",',
      '  "decline": "方案三的回复内容"',
      '}'
    ].join('\n');

    return prompt;
  }

  RP.parser = {
    detectLanguage: detectLanguage,
    toneLabel: toneLabel,
    replyLanguageLabel: replyLanguageLabel,
    buildPrompt: buildPrompt,
    buildOptionsPrompt: buildOptionsPrompt
  };
})(window.RP);

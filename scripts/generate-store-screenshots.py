# Generate Chrome Web Store screenshots for ReplyPilot (guided-generator UI).
# Outputs five 1280x800 PNGs per language into store-assets/screenshots/{zh,en}/:
#   01 provider - connect your AI provider (Base URL / API Key / model)
#   02 open     - the floating card appears next to the email
#   03 guide    - type a one-line instruction, or tap a keyword chip
#   04 reply    - the AI draft, already carrying the closing + signature
#   05 settings - closing / signature / memory are customisable
#
# Visual QA is enforced with asserts (see the store-asset-generator skill) so a
# bad layout fails at generation time instead of shipping.
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1280, 800
SAFE_BOTTOM = H - 12

COLORS = {
    "gmail_bg": "#f6f8fc",
    "gmail_side": "#eaf1fb",
    "gmail_card": "#ffffff",
    "gmail_border": "#e5e7eb",
    "gmail_text": "#202124",
    "gmail_sub": "#5f6368",
    "gmail_link": "#1a73e8",
    "rp_card": "#ffffff",
    "rp_border": "#e6e8ef",
    "rp_text": "#1f2330",
    "rp_sub": "#6b7280",
    "rp_primary": "#6366f1",
    "rp_bg": "#fbfbfd",
    "rp_input_border": "#e2e5ee",
    "rp_green": "#1a8a4f",
    "rp_green_bg": "#e9f8ef",
    "rp_purple": "#5b5ef0",
    "rp_purple_bg": "#eef0ff",
    "rp_chip_active_border": "#8b8ef5",
    "set_bg": "#eef0f6",
    "set_panel": "#ffffff",
    "set_border": "#e6e8ef",
    "set_ink": "#1f2330",
    "set_sub": "#6b7280",
    "set_hint": "#9aa0ac",
}


def load_font(size, bold=False):
    candidates = []
    if bold:
        candidates += [
            Path("C:/Windows/Fonts/msyhbd.ttc"),
            Path("C:/Windows/Fonts/simhei.ttf"),
            Path("C:/Windows/Fonts/arialbd.ttf"),
        ]
    candidates += [
        Path("C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/simsun.ttc"),
    ]
    for c in candidates:
        if c.exists():
            try:
                return ImageFont.truetype(str(c), size)
            except Exception:
                continue
    return ImageFont.load_default()


F = {
    "gmail_logo": load_font(22, bold=True),
    "gmail_search": load_font(14),
    "gmail_nav": load_font(14),
    "gmail_nav_count": load_font(12),
    "email_sender": load_font(18, bold=True),
    "email_subject": load_font(22, bold=True),
    "email_body": load_font(14),
    "email_quote": load_font(13),
    "rp_title": load_font(13, bold=True),
    "rp_status": load_font(11),
    "rp_body": load_font(12),
    "rp_small": load_font(12),
    "rp_tiny": load_font(11),
    "rp_btn": load_font(12, bold=True),
    "rp_btn_small": load_font(11),
    "rp_chip": load_font(10),
    "rp_field_label": load_font(11, bold=True),
    "step_label": load_font(15, bold=True),
    "step_number": load_font(17, bold=True),
    "set_title": load_font(18, bold=True),
    "set_section": load_font(13, bold=True),
    "set_label": load_font(12, bold=True),
    "set_input": load_font(12),
    "set_hint": load_font(11),
}


def rounded_rect(draw, xy, fill, radius=14, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill,
                           outline=outline, width=width)


def draw_text(draw, xy, text, fill, font, anchor=None):
    draw.text(xy, text, fill=fill, font=font, anchor=anchor)


def text_width(draw, text, font):
    return draw.textlength(text, font=font)


def wrap_text(draw, text, max_width, font):
    lines = []
    current = ""
    is_cjk = any(0x4E00 <= ord(c) <= 0x9FFF or 0x3000 <= ord(c) <= 0x303F for c in text)
    for segment in text.split("\n"):
        for token in (segment if is_cjk else segment.split(" ")):
            sep = "" if is_cjk else " "
            test = current + (sep if current else "") + token
            if not current or text_width(draw, test, font) <= max_width:
                current = test
            else:
                lines.append(current)
                current = token
        lines.append(current)
        current = ""
    return [ln for ln in lines if ln != ""]


def draw_star(draw, cx, cy, r, fill):
    draw.polygon([(cx, cy - r), (cx + r * 0.25, cy - r * 0.25),
                  (cx + r, cy), (cx + r * 0.25, cy + r * 0.25),
                  (cx, cy + r), (cx - r * 0.25, cy + r * 0.25),
                  (cx - r, cy), (cx - r * 0.25, cy - r * 0.25)],
                 fill=fill)


def draw_star5(draw, cx, cy, r, fill):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=fill)


def draw_arrow(draw, cx, cy, direction, color, size=8):
    d = 1 if direction == "right" else -1
    draw.line([(cx - d * size, cy), (cx + d * size, cy)], fill=color, width=2)
    draw.line([(cx + d * size, cy), (cx + d * (size - 5), cy - 5)], fill=color, width=2)
    draw.line([(cx + d * size, cy), (cx + d * (size - 5), cy + 5)], fill=color, width=2)


def draw_nav_icon(draw, kind, cx, cy, color):
    """Small vector icons — Windows CJK fonts lack the emoji used before, which
    rendered as empty tofu boxes."""
    if kind == "inbox":
        rounded_rect(draw, (cx - 9, cy - 7, cx + 9, cy + 7), fill=None, radius=3,
                     outline=color, width=2)
        draw.line([(cx - 9, cy + 2), (cx - 3, cy + 2), (cx - 1, cy + 5),
                   (cx + 1, cy + 5), (cx + 3, cy + 2), (cx + 9, cy + 2)],
                  fill=color, width=2)
    elif kind == "star":
        draw_star5(draw, cx, cy, 9, color)
    elif kind == "clock":
        draw.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], outline=color, width=2)
        draw.line([(cx, cy), (cx, cy - 5)], fill=color, width=2)
        draw.line([(cx, cy), (cx + 4, cy + 2)], fill=color, width=2)
    elif kind == "send":
        draw_arrow(draw, cx, cy, "right", color)
    elif kind == "reply":
        draw_arrow(draw, cx, cy, "left", color)
    elif kind == "cart":
        draw.line([(cx - 9, cy - 6), (cx - 6, cy + 2), (cx + 6, cy + 2)],
                  fill=color, width=2)
        draw.line([(cx - 7, cy - 2), (cx + 8, cy - 2)], fill=color, width=2)
        draw.ellipse([cx - 6, cy + 5, cx - 2, cy + 9], fill=color)
        draw.ellipse([cx + 2, cy + 5, cx + 6, cy + 9], fill=color)
    elif kind == "tag":
        rounded_rect(draw, (cx - 8, cy - 8, cx + 8, cy + 8), fill=None, radius=3,
                     outline=color, width=2)
        draw.ellipse([cx - 3, cy - 3, cx + 1, cy + 1], fill=color)
    elif kind == "trash":
        rounded_rect(draw, (cx - 6, cy - 4, cx + 6, cy + 9), fill=None, radius=2,
                     outline=color, width=2)
        draw.line([(cx - 9, cy - 6), (cx + 9, cy - 6)], fill=color, width=2)
        draw.line([(cx - 3, cy - 9), (cx + 3, cy - 9)], fill=color, width=2)
    elif kind == "envelope":
        rounded_rect(draw, (cx - 10, cy - 6, cx + 10, cy + 6), fill=None, radius=2,
                     outline=color, width=2)
        draw.line([(cx - 9, cy - 5), (cx, cy + 2)], fill=color, width=2)
        draw.line([(cx + 9, cy - 5), (cx, cy + 2)], fill=color, width=2)
    elif kind == "chevron_down":
        draw.line([(cx - 5, cy - 3), (cx, cy + 3)], fill=color, width=2)
        draw.line([(cx + 5, cy - 3), (cx, cy + 3)], fill=color, width=2)


# ---------------------------------------------------------------- copy ------

COPY = {
    "zh": {
        "card_ready": "就绪",
        "card_done": "回复已生成",
        "label_guide": "指导 AI 回复",
        "label_keywords": "关键词",
        "guide_placeholder": "例如：帮我委婉拒绝，简洁即可",
        "guide_text": "帮我委婉拒绝，简洁即可",
        "output_placeholder": "点击「生成回复」，AI 会按你的要求写一条草稿",
        "reply": (
            "您好，感谢您的来信与建议。不过目前我暂时没有这方面的计划，这次就先不继续了。\n"
            "如果之后有变化，我会主动联系您。祝一切顺利！"
        ),
        "closing": "Best regards,",
        "signature": "Alex",
        "chip_add": "+",
        "chips": ["委婉拒绝", "直接拒绝", "专业", "友好", "轻松", "简洁",
                  "温暖", "正式", "直接", "热情", "询问更多信息", "稍后跟进"],
        "btn_gen": "生成回复",
        "btn_regen": "重新生成",
        "btn_insert": "插入回复",
        "btn_copy": "复制回复",
        "btn_clear": "清空回复",
        "btn_revise": "按意见重新生成",
        "revise_placeholder": "例如：更正式一点",
        "steps": {
            1: "配置 AI 提供商",
            2: "打开邮件，浮窗自动出现",
            3: "写一句指导，或点关键词",
            4: "AI 直接生成回复草稿",
            5: "结束语 / 署名都能自定义",
        },
        "prov_title": "ReplyPilot 设置",
        "prov_sub": "AI 提供商 · 首次配置",
        "prov_section": "AI 提供商",
        "prov_provider": "当前提供商",
        "prov_provider_val": "SiliconFlow",
        "prov_provider_hint": "选择服务商，或选「自定义」接入任意 OpenAI 兼容 API。",
        "prov_endpoint": "API 地址",
        "prov_endpoint_val": "https://api.siliconflow.cn/v1",
        "prov_endpoint_hint": "OpenAI 兼容 Base URL，会自动补上 /chat/completions。",
        "prov_key": "API Key",
        "prov_key_val": "sk-••••••••••••••••••••••••",
        "prov_key_hint": "仅保存在本地 chrome.storage.local，绝不上传到第三方。",
        "prov_model": "模型 ID",
        "prov_model_val": "deepseek-ai/DeepSeek-V4-Flash",
        "prov_model_hint": "把模型 ID 发送给 API，例如 deepseek-ai/DeepSeek-V4-Flash。",
        "prov_test": "测试连接",
        "prov_test_ok": "连接成功",
        "set_title": "ReplyPilot 设置",
        "set_sub": "偏好设置 · 关于我",
        "sec_pref": "偏好设置",
        "lang_ui": "界面语言",
        "lang_ui_val": "简体中文",
        "lang_reply": "回复语言",
        "lang_reply_val": "Auto",
        "sec_about": "关于我",
        "master": "每次回复自动附加结束语与署名",
        "closing_label": "结束语",
        "closing_mode": "自定义",
        "closing_val": "Best regards",
        "signature_label": "署名",
        "signature_val": "Alex",
        "memory_label": "上下文 / AI 记忆",
        "memory_val": "我是项目经理；回复习惯简短、友好。",
    },
    "en": {
        "card_ready": "Ready",
        "card_done": "Reply generated",
        "label_guide": "Guide the AI",
        "label_keywords": "Quick phrases",
        "guide_placeholder": "e.g. Politely decline and keep it short",
        "guide_text": "Politely decline, keep it short",
        "output_placeholder": "Click Generate and the AI drafts a reply for you",
        "reply": (
            "Hi Jordan, thanks for reaching out - but I'm not able to move forward with this "
            "right now.\nI'll reach out if anything changes on my end. All the best!"
        ),
        "closing": "Best regards,",
        "signature": "Alex",
        "chip_add": "+",
        "chips": ["politely decline", "decline directly", "Professional", "Friendly",
                  "Casual", "Short", "Warm", "Formal", "Direct", "Enthusiastic",
                  "ask for more info", "follow up later"],
        "btn_gen": "Generate Reply",
        "btn_regen": "Regenerate",
        "btn_insert": "Insert Reply",
        "btn_copy": "Copy Reply",
        "btn_clear": "Clear Reply",
        "btn_revise": "Revise by feedback",
        "revise_placeholder": "e.g. more formal",
        "steps": {
            1: "Connect your AI provider",
            2: "Open the email - the card appears",
            3: "Type a brief, or tap a keyword",
            4: "The AI drafts the reply for you",
            5: "Closing & signature are yours to set",
        },
        "prov_title": "ReplyPilot Settings",
        "prov_sub": "AI Provider - first-time setup",
        "prov_section": "AI Provider",
        "prov_provider": "Current Provider",
        "prov_provider_val": "SiliconFlow",
        "prov_provider_hint": "Pick a provider, or choose Custom for any OpenAI-compatible API.",
        "prov_endpoint": "API Base URL",
        "prov_endpoint_val": "https://api.siliconflow.cn/v1",
        "prov_endpoint_hint": "OpenAI-compatible Base URL; /chat/completions is appended automatically.",
        "prov_key": "API Key",
        "prov_key_val": "sk-••••••••••••••••••••••••",
        "prov_key_hint": "Stored locally in chrome.storage.local. Never uploaded.",
        "prov_model": "Model ID",
        "prov_model_val": "deepseek-ai/DeepSeek-V4-Flash",
        "prov_model_hint": "The model ID sent to the API, e.g. deepseek-ai/DeepSeek-V4-Flash.",
        "prov_test": "Test Connection",
        "prov_test_ok": "Connected",
        "set_title": "ReplyPilot Settings",
        "set_sub": "Preferences - About you",
        "sec_pref": "Preferences",
        "lang_ui": "Interface Language",
        "lang_ui_val": "English",
        "lang_reply": "Reply Language",
        "lang_reply_val": "Auto",
        "sec_about": "About You",
        "master": "Append the closing and signature to every reply",
        "closing_label": "Closing",
        "closing_mode": "Custom",
        "closing_val": "Best regards",
        "signature_label": "Signature",
        "signature_val": "Alex",
        "memory_label": "Context / Memory",
        "memory_val": "I'm a project manager; I like short, friendly replies.",
    },
}


# ------------------------------------------------------------ gmail chrome --

def draw_gmail_mark(draw, x, cy):
    """Simplified envelope mark in Gmail red, left of the wordmark."""
    x0, y0, x1, y1 = x, cy - 11, x + 26, cy + 11
    rounded_rect(draw, (x0, y0, x1, y1), fill="white", radius=4,
                 outline="#ea4335", width=2)
    mid = (x0 + x1) / 2
    draw.line([(x0 + 2, y0 + 3), (mid, cy + 2)], fill="#ea4335", width=2)
    draw.line([(x1 - 2, y0 + 3), (mid, cy + 2)], fill="#ea4335", width=2)


def draw_search_icon(draw, cx, cy, color):
    draw.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], outline=color, width=2)
    draw.line([(cx + 5, cy + 5), (cx + 11, cy + 11)], fill=color, width=2)


def draw_gmail_background(draw, lang="zh"):
    draw.rectangle([0, 0, W, H], fill=COLORS["gmail_bg"])
    draw.rectangle([0, 0, W, 64], fill=COLORS["gmail_card"])
    draw.rectangle([0, 64, 220, H], fill=COLORS["gmail_side"])

    # wordmark with envelope mark sits in the top bar, clear of the search pill
    draw_gmail_mark(draw, 28, 32)
    draw_text(draw, (62, 32), "Gmail", fill="#5f6368",
              font=F["gmail_logo"], anchor="lm")

    # search pill: magnifier icon + placeholder, properly padded
    rounded_rect(draw, (236, 12, 720, 52), fill=COLORS["gmail_bg"], radius=8,
                 outline=COLORS["gmail_border"], width=1)
    draw_search_icon(draw, 262, 32, COLORS["gmail_sub"])
    search_hint = {"zh": "搜索邮件", "en": "Search mail"}[lang]
    draw_text(draw, (284, 32), search_hint, fill=COLORS["gmail_sub"],
              font=F["gmail_search"], anchor="lm")


def draw_gmail_sidebar(draw, lang="zh"):
    icons = ["inbox", "star", "clock", "send", "cart", "tag"]
    labels = {
        "zh": ["收件箱", "已加星标", "已延后", "已发邮件", "购物", "标签"],
        "en": ["Inbox", "Starred", "Snoozed", "Sent", "Shopping", "Labels"],
    }[lang]
    counts = ["2,222", "", "", "", "18", ""]
    for i, (icon, label, cnt) in enumerate(zip(icons, labels, counts)):
        y = 88 + i * 44
        if i == 0:
            rounded_rect(draw, (8, y - 4, 204, y + 36), fill="#d3e3fd", radius=20)
        draw_nav_icon(draw, icon, 33, y + 16, COLORS["gmail_text"])
        draw_text(draw, (56, y + 16), label, fill=COLORS["gmail_text"],
                  font=F["gmail_nav"], anchor="lm")
        if cnt:
            draw_text(draw, (196, y + 16), cnt, fill=COLORS["gmail_sub"],
                      font=F["gmail_nav_count"], anchor="rm")
    draw_nav_icon(draw, "chevron_down", 32, 348, COLORS["gmail_text"])
    draw_text(draw, (24, H - 60), "Store Emails", fill=COLORS["gmail_sub"],
              font=F["gmail_nav_count"])
    draw_text(draw, (24, H - 40), "31", fill=COLORS["gmail_sub"], font=F["gmail_nav_count"])


def draw_email_content(draw, lang="zh"):
    x0, y0 = 236, 80
    x1, y1 = 880, H - 24
    rounded_rect(draw, (x0, y0, x1, y1), fill=COLORS["gmail_card"], radius=16)

    for icon, cx in [("reply", 272), ("trash", 312), ("envelope", 352),
                     ("clock", 392), ("send", 432)]:
        draw_nav_icon(draw, icon, cx, 108, COLORS["gmail_sub"])

    subject = {
        "zh": "有机会给你一些店铺反馈吗？",
        "en": "Open to some feedback on your store?",
    }[lang]
    draw_text(draw, (264, 148), subject, fill=COLORS["gmail_text"], font=F["email_subject"])

    avatar_letter = {"zh": "李", "en": "J"}[lang]
    sender_name = {"zh": "李华", "en": "Jordan Lee"}[lang]
    sender_email = {"zh": "<lihua@samplestore.com>", "en": "<jordan.lee@samplestore.com>"}[lang]
    draw.ellipse([264, 190, 298, 224], fill="#ea4335")
    draw_text(draw, (281, 207), avatar_letter, fill="white", font=F["email_sender"], anchor="mm")
    draw_text(draw, (314, 198), sender_name, fill=COLORS["gmail_text"], font=F["email_sender"])
    draw_text(draw, (314, 218), sender_email, fill=COLORS["gmail_sub"], font=F["email_body"])

    date_text = {"zh": "7月17日周五 19:10 (6天前)",
                 "en": "Fri, Jul 17, 2026, 7:10 PM (6 days ago)"}[lang]
    draw_text(draw, (x1 - 20, 207), date_text, fill=COLORS["gmail_sub"],
              font=F["email_body"], anchor="rm")

    banner_y = 250
    rounded_rect(draw, (264, banner_y, 640, banner_y + 40), fill="#e8f0fe", radius=6)
    hint_text = {"zh": "此邮件似乎是用英语撰写的",
                 "en": "This message may be in another language"}[lang]
    draw_text(draw, (284, banner_y + 20), hint_text, fill=COLORS["gmail_text"],
              font=F["email_body"], anchor="lm")
    draw_text(draw, (620, banner_y + 20), "X", fill=COLORS["gmail_sub"],
              font=F["email_body"], anchor="rm")

    body_y = 320
    body_x, body_max_w = 264, 596
    body_lines = {
        "zh": [
            "嗨，我浏览了你们的店铺，注意到有些东西可能正在影响你的销售。",
            "",
            "只是好奇你是否愿意接受一些反馈？",
            "",
            "期待你的回复，谢谢！",
            "",
            "此致，",
            "李华",
        ],
        "en": [
            "Hey! While I was checking out your store, I noticed something that could be costing you sales.",
            "",
            "Just curious if you'd be open to some feedback?",
            "",
            "Hope to hear from you. Thanks!",
            "",
            "Best regards,",
            "Jordan Lee",
        ],
    }[lang]
    for line in body_lines:
        if not line:
            body_y += 24
            continue
        for wrapped in wrap_text(draw, line, body_max_w, F["email_body"]):
            draw_text(draw, (body_x, body_y), wrapped, fill=COLORS["gmail_text"],
                      font=F["email_body"])
            body_y += 24

    reply_y = H - 140  # keeps a 20px bottom padding inside the email card
    assert body_y < reply_y - 12, "email body runs into the reply box"
    rounded_rect(draw, (264, reply_y, 560, reply_y + 50), fill=COLORS["gmail_bg"],
                 radius=24, outline=COLORS["gmail_border"], width=1)
    draw_nav_icon(draw, "reply", 296, reply_y + 25, COLORS["gmail_sub"])
    reply_placeholder = {"zh": "回复 李华...", "en": "Reply to Jordan Lee..."}[lang]
    draw_text(draw, (318, reply_y + 25), reply_placeholder, fill=COLORS["gmail_sub"],
              font=F["email_body"], anchor="lm")
    rounded_rect(draw, (264, reply_y + 60, 364, reply_y + 96), fill="#1a73e8", radius=20)
    draw_text(draw, (314, reply_y + 78), {"zh": "发送", "en": "Send"}[lang],
              fill="white", font=F["email_body"], anchor="mm")


# ------------------------------------------------- ReplyPilot card (v2 UI) --

CARD_X, CARD_Y = 900, 80
CARD_W, CARD_H = 360, 600
CARD_PAD = 14

ACTIONS_ROWS = 3
BTN_H = 34
BTN_GAP = 8
ACTIONS_H = ACTIONS_ROWS * BTN_H + (ACTIONS_ROWS - 1) * BTN_GAP


def draw_chip(draw, x, y, text, font, active=False, is_add=False):
    pad_x = 9
    h = 22
    tw = text_width(draw, text, font)
    w = tw + pad_x * 2
    if active:
        fill, outline, color = COLORS["rp_purple_bg"], COLORS["rp_chip_active_border"], "#4b4fd6"
    else:
        fill, outline, color = COLORS["rp_bg"], COLORS["rp_input_border"], \
            ("#6b7280" if is_add else "#4b5060")
    rounded_rect(draw, (x, y, x + w, y + h), fill=fill, radius=h // 2,
                 outline=outline, width=1)
    draw_text(draw, (x + w / 2, y + h / 2 + 1), text, fill=color, font=font, anchor="mm")
    return w


def draw_chips(draw, x, y, max_w, labels, font, active_idx=(), is_last_add=False, max_rows=3):
    """Lay chips out in wrapping rows. Trailing keywords are dropped first so the
    add chip never ends up alone on the last row (no orphan rows), and everything
    shown fits within max_rows (the real card scrolls)."""
    widths = [text_width(draw, lb, font) + 18 for lb in labels]

    def row_counts_for(idxs):
        counts, cx, cur_count = [], 0, 0
        for i in idxs:
            w = widths[i]
            if cx > 0 and cx + w > max_w:
                counts.append(cur_count)
                cx, cur_count = 0, 0
                if len(counts) >= max_rows:
                    return None  # a new row would exceed max_rows
            cur_count += 1
            cx += w + 6
        counts.append(cur_count)
        return counts

    idxs = list(range(len(labels)))
    counts = row_counts_for(idxs)
    while (counts is None or counts[-1] < 2) and len(idxs) > 2:
        del idxs[-2]  # drop the last keyword, keep the add chip last
        counts = row_counts_for(idxs)
    assert counts is not None, "chips do not fit within max_rows"

    cx, cy, rows = x, y, len(counts)
    for i in idxs:
        w = widths[i]
        if cx > x and cx + w > x + max_w:
            cx, cy = x, cy + 22 + 6
        draw_chip(draw, cx, cy, labels[i], font, active=(i in active_idx),
                  is_add=(is_last_add and i == len(labels) - 1))
        cx += w + 6
    return rows * 22 + (rows - 1) * 6


def draw_rp_header(draw, x, y, w, lang, state):
    draw_star(draw, x + 24, y + 18, 7, fill="#f59e0b")
    draw_text(draw, (x + 42, y + 18), "ReplyPilot", fill=COLORS["rp_text"], font=F["rp_title"])

    status = COPY[lang]["card_done"] if state == "reply" else COPY[lang]["card_ready"]
    tw = text_width(draw, status, F["rp_status"])
    badge_w = tw + 16
    badge_x = x + w - 20 - badge_w
    rounded_rect(draw, (badge_x, y + 12, badge_x + badge_w, y + 34),
                 fill=COLORS["rp_green_bg"] if state == "reply" else "#f1f2f7", radius=12)
    draw_text(draw, (badge_x + badge_w / 2, y + 23), status,
              fill=COLORS["rp_green"] if state == "reply" else COLORS["rp_sub"],
              font=F["rp_status"], anchor="mm")


def draw_rp_button(draw, x, y, w, h, text, primary=False, ghost=False):
    if primary:
        fill, outline, color = COLORS["rp_primary"], COLORS["rp_primary"], "white"
    elif ghost:
        fill, outline, color = "white", "white", COLORS["rp_sub"]
    else:
        fill, outline, color = "white", COLORS["rp_input_border"], COLORS["rp_text"]
    rounded_rect(draw, (x, y, x + w, y + h), fill=fill, radius=8, outline=outline, width=1)
    draw_text(draw, (x + w / 2, y + h / 2 + 1), text, fill=color, font=F["rp_btn"], anchor="mm")


def draw_rp_card(img, draw, lang="zh", state="idle"):
    c = COPY[lang]
    x, y, w, h = CARD_X, CARD_Y, CARD_W, CARD_H

    shadow = Image.new("RGBA", (w + 32, h + 32), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([16, 16, 16 + w, 16 + h], radius=14, fill=(17, 24, 39, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
    img.paste(shadow, (x - 16, y - 16), shadow)

    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["rp_card"],
                 radius=14, outline=COLORS["rp_border"], width=1)
    draw_rp_header(draw, x + 10, y + 10, w - 28, lang, state)

    body_x = x + CARD_PAD
    body_w = w - CARD_PAD * 2
    top = y + 58

    # guidance label + input
    draw_text(draw, (body_x, top), c["label_guide"], fill=COLORS["rp_sub"],
              font=F["rp_field_label"])
    top += 18
    rounded_rect(draw, (body_x, top, body_x + body_w, top + 34), fill=COLORS["rp_bg"],
                 radius=8, outline=COLORS["rp_input_border"], width=1)
    if state == "idle":
        gtext, gcolor = c["guide_placeholder"], "#9aa0ac"
    else:
        gtext, gcolor = c["guide_text"], COLORS["rp_text"]
    draw_text(draw, (body_x + 11, top + 17), gtext, fill=gcolor, font=F["rp_body"], anchor="lm")
    top += 34 + 12

    # keyword chips
    draw_text(draw, (body_x, top), c["label_keywords"], fill=COLORS["rp_sub"],
              font=F["rp_field_label"])
    top += 18
    active = (0, 5) if state != "idle" else ()
    chips_h = draw_chips(draw, body_x, top, body_w, c["chips"] + [c["chip_add"]],
                         F["rp_chip"], active_idx=active, is_last_add=True, max_rows=3)
    top += chips_h + 14

    # output box (adaptive height, always above the actions)
    actions_top = y + h - 12 - ACTIONS_H
    if state == "reply":
        revise_h = 30
        revise_top = actions_top - 10 - revise_h
        out_bottom = revise_top - 12
    else:
        revise_top = None
        out_bottom = actions_top - 12

    assert out_bottom - top >= 120, "output box too short: %d" % (out_bottom - top)

    rounded_rect(draw, (body_x, top, body_x + body_w, out_bottom), fill=COLORS["rp_bg"],
                 radius=10, outline=COLORS["rp_input_border"], width=1)

    if state == "reply":
        lines = wrap_text(draw, c["reply"], body_w - 22, F["rp_body"])
        lines += ["", c["closing"], c["signature"]]
        yy = top + 12
        max_lines = (out_bottom - top - 24) // 19
        assert len(lines) <= max_lines, \
            "reply needs %d lines, only %d fit" % (len(lines), max_lines)
        for line in lines[:max_lines]:
            draw_text(draw, (body_x + 11, yy), line, fill=COLORS["rp_text"], font=F["rp_body"])
            yy += 19
    else:
        lines = wrap_text(draw, c["output_placeholder"], body_w - 22, F["rp_body"])
        yy = top + 12
        for line in lines[:3]:
            draw_text(draw, (body_x + 11, yy), line, fill="#9aa0ac", font=F["rp_body"])
            yy += 19

    # revise-by-feedback row (only once a reply exists)
    if revise_top is not None:
        row_x = body_x
        btn_w = 120
        input_w = body_w - btn_w - 8
        assert text_width(draw, c["revise_placeholder"], F["rp_btn_small"]) <= input_w - 16, \
            "revise placeholder overflows its input"
        rounded_rect(draw, (row_x, revise_top, row_x + input_w, revise_top + 30),
                     fill="#f9fafb", radius=8, outline="#d1d5db", width=1)
        draw_text(draw, (row_x + 10, revise_top + 15), c["revise_placeholder"],
                  fill="#9aa0ac", font=F["rp_btn_small"], anchor="lm")
        draw_rp_button(draw, row_x + input_w + 8, revise_top, btn_w, 30, c["btn_revise"])

    # actions (3 rows, pinned to the bottom so the card height is stable)
    by = actions_top
    col_w = (body_w - 8) // 2
    draw_rp_button(draw, body_x, by, col_w, BTN_H, c["btn_gen"], primary=True)
    draw_rp_button(draw, body_x + col_w + 8, by, col_w, BTN_H, c["btn_regen"])
    by += BTN_H + BTN_GAP
    draw_rp_button(draw, body_x, by, col_w, BTN_H, c["btn_insert"])
    draw_rp_button(draw, body_x + col_w + 8, by, col_w, BTN_H, c["btn_copy"], ghost=True)
    by += BTN_H + BTN_GAP
    draw_rp_button(draw, body_x, by, body_w, BTN_H, c["btn_clear"], ghost=True)


# ------------------------------------------------------------- step label --

def draw_step_label(draw, lang, step, x, w):
    num, desc = str(step), COPY[lang]["steps"][step]
    y, h = 20, 36
    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["rp_primary"], radius=10)

    cy = y + h // 2
    draw.ellipse([x + 10, cy - 12, x + 34, cy + 12], fill="white")
    draw_text(draw, (x + 22, cy + 1), num, fill=COLORS["rp_primary"],
              font=F["step_number"], anchor="mm")
    draw_text(draw, (x + 44, cy + 1), desc, fill="white", font=F["step_label"], anchor="lm")


# -------------------------------------------------------- settings screenshot

SET_X, SET_Y, SET_W, SET_H = 330, 90, 620, 660


def draw_input(draw, x, y, w, text, muted=False, h=34):
    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["rp_bg"], radius=8,
                 outline=COLORS["rp_input_border"], width=1)
    draw_text(draw, (x + 11, y + h / 2 + 1), text,
              fill=("#9aa0ac" if muted else COLORS["set_ink"]),
              font=F["set_input"], anchor="lm")
    return h


def draw_select(draw, x, y, w, text, h=34):
    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["rp_bg"], radius=8,
                 outline=COLORS["rp_input_border"], width=1)
    draw_text(draw, (x + 11, y + h / 2 + 1), text, fill=COLORS["set_ink"],
              font=F["set_input"], anchor="lm")
    # chevron
    cx, cy = x + w - 16, y + h / 2
    draw.polygon([(cx - 5, cy - 2), (cx + 5, cy - 2), (cx, cy + 3)], fill="#6b7280")
    return h


def draw_settings_screenshot(lang):
    img = Image.new("RGBA", (W, H), COLORS["set_bg"])
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, H], fill=COLORS["set_bg"])
    c = COPY[lang]

    draw_step_label(draw, lang, 5, SET_X, SET_W)

    rounded_rect(draw, (SET_X, SET_Y, SET_X + SET_W, SET_Y + SET_H),
                 fill=COLORS["set_panel"], radius=16, outline=COLORS["set_border"], width=1)

    px = SET_X + 30
    pw = SET_W - 60

    draw_star(draw, px + 9, SET_Y + 32, 8, fill="#f59e0b")
    draw_text(draw, (px + 26, SET_Y + 32), c["set_title"], fill=COLORS["set_ink"],
              font=F["set_title"], anchor="lm")
    draw_text(draw, (px, SET_Y + 58), c["set_sub"], fill=COLORS["set_hint"],
              font=F["set_hint"])

    # --- Preferences ---
    yy = SET_Y + 96
    draw_text(draw, (px, yy), c["sec_pref"], fill=COLORS["set_ink"], font=F["set_section"])
    yy += 26
    draw_text(draw, (px, yy), c["lang_ui"], fill=COLORS["set_ink"], font=F["set_label"])
    yy += 18
    draw_select(draw, px, yy, pw, c["lang_ui_val"])
    yy += 34 + 18
    draw_text(draw, (px, yy), c["lang_reply"], fill=COLORS["set_ink"], font=F["set_label"])
    yy += 18
    draw_select(draw, px, yy, pw, c["lang_reply_val"])

    # --- About you ---
    yy += 34 + 40
    about_title_y = yy
    draw_text(draw, (px, yy), c["sec_about"], fill=COLORS["set_ink"], font=F["set_section"])
    yy += 26

    # master switch
    box = 15
    rounded_rect(draw, (px, yy, px + box, yy + box), fill=COLORS["rp_primary"],
                 radius=4, outline=COLORS["rp_primary"], width=1)
    draw.line([(px + 3.5, yy + 8), (px + 6.5, yy + 11), (px + 12, yy + 4)],
              fill="white", width=2)
    draw_text(draw, (px + box + 9, yy + box / 2 + 1), c["master"], fill="#2b2f3a",
              font=F["set_input"], anchor="lm")
    yy += box + 22

    # closing (mode select + custom input)
    draw_text(draw, (px, yy), c["closing_label"], fill=COLORS["set_ink"], font=F["set_label"])
    yy += 18
    mode_w = 150
    draw_select(draw, px, yy, mode_w, c["closing_mode"])
    yy += 34 + 8
    draw_input(draw, px, yy, pw, c["closing_val"])
    yy += 34 + 18

    # signature
    draw_text(draw, (px, yy), c["signature_label"], fill=COLORS["set_ink"], font=F["set_label"])
    yy += 18
    draw_input(draw, px, yy, pw, c["signature_val"])
    yy += 34

    # divider + memory
    yy += 20
    draw.line([(px, yy), (px + pw, yy)], fill="#e4e8f1", width=1)
    yy += 20
    draw_text(draw, (px, yy), c["memory_label"], fill=COLORS["set_ink"], font=F["set_label"])
    yy += 18
    mem_h = 60
    rounded_rect(draw, (px, yy, px + pw, yy + mem_h), fill=COLORS["rp_bg"], radius=8,
                 outline=COLORS["rp_input_border"], width=1)
    draw_text(draw, (px + 11, yy + 14), c["memory_val"], fill=COLORS["set_ink"],
              font=F["set_input"])
    yy += mem_h

    assert yy < SET_Y + SET_H - 12, "settings panel content overflows: %d" % yy
    assert yy < SAFE_BOTTOM, "settings content below safe bottom"
    return img


# ------------------------------------------------------- provider screenshot --

PROV_Y, PROV_H = 90, 610


def draw_provider_screenshot(lang):
    """First-run setup: the AI Provider section of the options page."""
    img = Image.new("RGBA", (W, H), COLORS["set_bg"])
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, H], fill=COLORS["set_bg"])
    c = COPY[lang]

    draw_step_label(draw, lang, 1, SET_X, SET_W)

    rounded_rect(draw, (SET_X, PROV_Y, SET_X + SET_W, PROV_Y + PROV_H),
                 fill=COLORS["set_panel"], radius=16, outline=COLORS["set_border"], width=1)

    px = SET_X + 30
    pw = SET_W - 60

    draw_star(draw, px + 9, PROV_Y + 32, 8, fill="#f59e0b")
    draw_text(draw, (px + 26, PROV_Y + 32), c["prov_title"], fill=COLORS["set_ink"],
              font=F["set_title"], anchor="lm")
    draw_text(draw, (px, PROV_Y + 58), c["prov_sub"], fill=COLORS["set_hint"],
              font=F["set_hint"])

    def field(yy, label, value, hint, is_select=False):
        draw_text(draw, (px, yy), label, fill=COLORS["set_ink"], font=F["set_label"])
        yy += 20
        if is_select:
            draw_select(draw, px, yy, pw, value)
        else:
            draw_input(draw, px, yy, pw, value)
        yy += 34 + 8
        assert text_width(draw, hint, F["set_hint"]) <= pw, "provider hint overflows"
        draw_text(draw, (px, yy), hint, fill=COLORS["set_hint"], font=F["set_hint"])
        return yy + 14

    yy = PROV_Y + 96
    draw_text(draw, (px, yy), c["prov_section"], fill=COLORS["set_ink"], font=F["set_section"])
    yy += 40
    yy = field(yy, c["prov_provider"], c["prov_provider_val"], c["prov_provider_hint"],
               is_select=True) + 24
    yy = field(yy, c["prov_endpoint"], c["prov_endpoint_val"], c["prov_endpoint_hint"]) + 24
    yy = field(yy, c["prov_key"], c["prov_key_val"], c["prov_key_hint"]) + 24
    yy = field(yy, c["prov_model"], c["prov_model_val"], c["prov_model_hint"]) + 28

    # test-connection button + success status
    btn_w = text_width(draw, c["prov_test"], F["set_label"]) + 40
    rounded_rect(draw, (px, yy, px + btn_w, yy + 34), fill="white", radius=8,
                 outline=COLORS["rp_input_border"], width=1)
    draw_text(draw, (px + btn_w / 2, yy + 18), c["prov_test"], fill=COLORS["set_ink"],
              font=F["set_label"], anchor="mm")
    cx = px + btn_w + 16
    draw.ellipse([cx, yy + 10, cx + 14, yy + 24], fill=COLORS["rp_green"])
    draw.line([(cx + 4, yy + 18), (cx + 7, yy + 21), (cx + 11, yy + 14)],
              fill="white", width=2)
    draw_text(draw, (cx + 21, yy + 18), c["prov_test_ok"], fill=COLORS["rp_green"],
              font=F["set_input"], anchor="lm")

    assert yy + 34 < PROV_Y + PROV_H - 12, "provider panel content overflows: %d" % (yy + 34)
    assert yy + 34 < SAFE_BOTTOM, "provider content below safe bottom"
    return img


# ------------------------------------------------------------------ compose --

def screenshot(lang, state, filename, step):
    img = Image.new("RGBA", (W, H), COLORS["gmail_bg"])
    draw = ImageDraw.Draw(img)

    draw_gmail_background(draw, lang=lang)
    draw_gmail_sidebar(draw, lang=lang)
    draw_email_content(draw, lang=lang)
    draw_step_label(draw, lang, step, CARD_X, CARD_W)
    draw_rp_card(img, draw, lang=lang, state=state)

    # layout safety: everything stays inside the canvas. The card keeps the real
    # Gmail position (right: 20px), so the right margin is 20px by design.
    assert CARD_Y + CARD_H < SAFE_BOTTOM, "card bottom below the safe line"
    assert CARD_X + CARD_W <= W - 12, "card right edge too close to the canvas"
    assert CARD_X > 880, "card must not cover the email column"

    out_dir = OUT / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_dir / filename)
    print("saved: %s" % (out_dir / filename))


def clean_old():
    """Remove stale screenshot files so the folder is always the current set."""
    keep = set()
    for lang in ("zh", "en"):
        keep.add("screenshot-01-provider.png")
        keep.add("screenshot-02-open.png")
        keep.add("screenshot-03-guide.png")
        keep.add("screenshot-04-reply.png")
        keep.add("screenshot-05-settings.png")
    for lang in ("zh", "en"):
        d = OUT / lang
        if not d.is_dir():
            continue
        for p in d.glob("*.png"):
            if p.name not in keep:
                p.unlink()
                print("removed stale: %s" % p)


if __name__ == "__main__":
    for lang in ("zh", "en"):
        (OUT / lang).mkdir(parents=True, exist_ok=True)

        out = OUT / lang / "screenshot-01-provider.png"
        draw_provider_screenshot(lang).convert("RGB").save(out)
        print("saved: %s" % out)

        screenshot(lang, "idle", "screenshot-02-open.png", 2)
        screenshot(lang, "guide", "screenshot-03-guide.png", 3)
        screenshot(lang, "reply", "screenshot-04-reply.png", 4)

        out = OUT / lang / "screenshot-05-settings.png"
        draw_settings_screenshot(lang).convert("RGB").save(out)
        print("saved: %s" % out)
    clean_old()
    print("Done. Outputs in %s" % OUT)

# Generate Chrome Web Store tutorial screenshots for ReplyPilot.
# Outputs 1280x800 PNGs for both zh and en.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1280, 800

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
    "rp_shadow": "#111827",
    "rp_text": "#1f2330",
    "rp_sub": "#6b7280",
    "rp_primary": "#6366f1",
    "rp_primary_hover": "#5457e6",
    "rp_bg": "#fbfbfd",
    "rp_green": "#1a8a4f",
    "rp_green_bg": "#e9f8ef",
    "rp_purple": "#5b5ef0",
    "rp_purple_bg": "#eef0ff",
    "black": "#000000",
}


def load_font(size, bold=False, italic=False):
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
    "rp_body": load_font(13),
    "rp_small": load_font(12),
    "rp_tiny": load_font(11),
    "rp_btn": load_font(13, bold=True),
    "rp_btn_small": load_font(12),
    "rp_option_title": load_font(13, bold=True),
    "label": load_font(12, bold=True),
    "hero": load_font(26, bold=True),
    "caption": load_font(16),
}


def rounded_rect(draw, xy, fill, radius=14, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


def draw_text(draw, xy, text, fill, font, anchor=None):
    draw.text(xy, text, fill=fill, font=font, anchor=anchor)


def text_width(draw, text, font):
    return draw.textlength(text, font=font)


def wrap_text(draw, text, max_width, font):
    lines = []
    current = ""
    # For CJK: character wrap; for others: word wrap on spaces
    is_cjk = any(0x4E00 <= ord(c) <= 0x9FFF or 0x3000 <= ord(c) <= 0x303F for c in text)
    for token in (text if is_cjk else text.split(" ")):
        sep = "" if is_cjk else " "
        test = current + (sep if current else "") + token
        if not current or text_width(draw, test, font) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = token
    if current:
        lines.append(current)
    return lines


# ---------- Gmail chrome ----------

def draw_gmail_background(draw):
    # Main background
    draw.rectangle([0, 0, W, H], fill=COLORS["gmail_bg"])
    # Top bar
    draw.rectangle([0, 0, W, 64], fill=COLORS["gmail_card"])
    # Left sidebar
    draw.rectangle([0, 64, 220, H], fill=COLORS["gmail_side"])
    # Search bar
    rounded_rect(draw, (236, 12, 720, 52), fill=COLORS["gmail_bg"], radius=8, outline=COLORS["gmail_border"], width=1)
    # Gmail logo
    draw_text(draw, (244, 32), "Gmail", fill=COLORS["gmail_text"], font=F["gmail_logo"], anchor="lm")
    # Search placeholder
    draw_text(draw, (326, 32), "搜索邮件", fill=COLORS["gmail_sub"], font=F["gmail_search"], anchor="lm")


def draw_gmail_sidebar(draw, lang="zh"):
    icons = ["✉", "⭐", "⏰", "📤", "🛒", "🏷"]
    labels = {
        "zh": ["收件箱", "已加星标", "已延后", "已发邮件", "购物", "标签"],
        "en": ["Inbox", "Starred", "Snoozed", "Sent", "Shopping", "Labels"]
    }[lang]
    counts = ["2,222", "", "", "", "18", ""]
    for i, (icon, label, cnt) in enumerate(zip(icons, labels, counts)):
        y = 88 + i * 44
        if i == 0:
            rounded_rect(draw, (8, y - 4, 204, y + 36), fill="#d3e3fd", radius=20)
        draw_text(draw, (24, y + 10), icon, fill=COLORS["gmail_text"], font=F["gmail_nav"])
        draw_text(draw, (56, y + 10), label, fill=COLORS["gmail_text"], font=F["gmail_nav"])
        if cnt:
            draw_text(draw, (188, y + 10), cnt, fill=COLORS["gmail_sub"], font=F["gmail_nav_count"])

    # More labels (collapsed section)
    draw_text(draw, (24, 340), "⬇", fill=COLORS["gmail_text"], font=F["gmail_nav"])

    # Bottom label
    draw_text(draw, (24, H - 60), "Store Emails", fill=COLORS["gmail_sub"], font=F["gmail_nav_count"])
    draw_text(draw, (24, H - 40), "31", fill=COLORS["gmail_sub"], font=F["gmail_nav_count"])


def draw_email_content(draw, lang="zh"):
    # White card area
    x0, y0 = 236, 80
    x1, y1 = 880, H - 24
    rounded_rect(draw, (x0, y0, x1, y1), fill=COLORS["gmail_card"], radius=16)

    # Toolbar icons
    toolbar_y = 104
    for icon, x in [("←", 264), ("🗑", 304), ("📧", 344), ("⏰", 384), ("➡", 424)]:
        draw_text(draw, (x, toolbar_y), icon, fill=COLORS["gmail_sub"], font=F["gmail_nav"])

    # Subject line
    subject = {
        "zh": "Re: 关于订单 #2026-0718 的最早发货时间",
        "en": "Re: Earliest delivery for order #2026-0718"
    }[lang]
    draw_text(draw, (264, 158), subject, fill=COLORS["gmail_text"], font=F["email_subject"])

    # Sender info
    # Avatar circle
    draw.ellipse([264, 190, 298, 224], fill="#ea4335")
    draw_text(draw, (281, 207), "A", fill="white", font=F["email_sender"], anchor="mm")
    sender_name = "Adunny Baby"
    sender_email = "<adunnyb@gmail.com>"
    draw_text(draw, (314, 198), sender_name, fill=COLORS["gmail_text"], font=F["email_sender"])
    draw_text(draw, (314, 218), sender_email, fill=COLORS["gmail_sub"], font=F["email_body"])

    # Date
    date_text = {"zh": "7月17日周五 19:10 (6天前)", "en": "Fri, Jul 17, 2026, 7:10 PM (6 days ago)"}[lang]
    draw_text(draw, (x1 - 20, 198), date_text, fill=COLORS["gmail_sub"], font=F["email_body"], anchor="rm")

    # Translation hint banner (like real screenshot)
    banner_y = 250
    rounded_rect(draw, (264, banner_y, 620, banner_y + 40), fill="#e8f0fe", radius=6)
    hint_text = {"zh": "此邮件似乎是用英语撰写的", "en": "This message may be in another language"}[lang]
    draw_text(draw, (284, banner_y + 20), hint_text, fill=COLORS["gmail_text"], font=F["email_body"], anchor="lm")
    draw_text(draw, (600, banner_y + 20), "X", fill=COLORS["gmail_sub"], font=F["email_body"], anchor="rm")

    # Email body
    body_y = 320
    body_lines = {
        "zh": [
            "嗨，我浏览了你们的店铺，注意到有些东西可能正在影响你的销售。",
            "",
            "只是好奇你是否愿意接受一些反馈？",
            "",
            "另外，如果今天下单，最早什么时候可以送达？",
            "",
            "此致，",
            "LifeMakeEasier"
        ],
        "en": [
            "Hey! While I was checking out your store, I noticed something that could be costing you sales.",
            "",
            "Just curious if you'd be open to some feedback?",
            "",
            "Also, if I place an order today, when is the earliest it can be delivered?",
            "",
            "Best regards,",
            "LifeMakeEasier"
        ]
    }[lang]
    for line in body_lines:
        draw_text(draw, (264, body_y), line, fill=COLORS["gmail_text"], font=F["email_body"])
        body_y += 24

    # Quoted reply area
    quote_y = body_y + 24
    quote_text = {
        "zh": "On Fri, Jul 17, 2026, 12:08 PM lilin huang <huangzero2004@gmail.com> wrote:",
        "en": "On Fri, Jul 17, 2026, 12:08 PM lilin huang <huangzero2004@gmail.com> wrote:"
    }[lang]
    draw_text(draw, (264, quote_y), quote_text, fill=COLORS["gmail_link"], font=F["email_quote"])
    draw_text(draw, (264, quote_y + 22), "Hi,", fill=COLORS["gmail_text"], font=F["email_quote"])
    draw_text(draw, (264, quote_y + 44), "Thanks for reaching out.", fill=COLORS["gmail_text"], font=F["email_quote"])
    draw_text(draw, (264, quote_y + 66), "The earliest delivery date depends on the specific product and delivery location. Please let me know your ZIP/postal code, and I'll check the current estimated delivery time for you.", fill=COLORS["gmail_text"], font=F["email_quote"])

    # Reply box at bottom
    reply_y = H - 120
    rounded_rect(draw, (264, reply_y, 560, reply_y + 50), fill=COLORS["gmail_bg"], radius=24, outline=COLORS["gmail_border"], width=1)
    draw_text(draw, (288, reply_y + 25), "✏", fill=COLORS["gmail_sub"], font=F["email_body"], anchor="lm")
    reply_placeholder = {"zh": "回复 Adunny Baby...", "en": "Reply to Adunny Baby..."}[lang]
    draw_text(draw, (318, reply_y + 25), reply_placeholder, fill=COLORS["gmail_sub"], font=F["email_body"], anchor="lm")

    # Send button
    rounded_rect(draw, (264, reply_y + 60, 364, reply_y + 96), fill="#1a73e8", radius=20)
    draw_text(draw, (314, reply_y + 78), {"zh": "发送", "en": "Send"}[lang], fill="white", font=F["email_body"], anchor="mm")


# ---------- ReplyPilot floating card ----------


def draw_star(draw, cx, cy, r, fill):
    """Draw a simple 4-point sparkle star."""
    draw.polygon([(cx, cy - r), (cx + r * 0.25, cy - r * 0.25),
                  (cx + r, cy), (cx + r * 0.25, cy + r * 0.25),
                  (cx, cy + r), (cx - r * 0.25, cy + r * 0.25),
                  (cx - r, cy), (cx - r * 0.25, cy - r * 0.25)],
                 fill=fill)


def draw_rp_header(draw, x, y, w, lang="zh"):
    # Star sparkle icon instead of emoji
    draw_star(draw, x + 24, y + 18, 7, fill="#f59e0b")
    # Title
    draw_text(draw, (x + 42, y + 18), "ReplyPilot", fill=COLORS["rp_text"], font=F["rp_title"])

    # Status badge
    status = {"zh": "回复已生成", "en": "Reply generated"}[lang]
    tw = text_width(draw, status, F["rp_status"])
    badge_x = x + w - 20 - tw - 16
    badge_w = tw + 16
    rounded_rect(draw, (badge_x, y + 12, badge_x + badge_w, y + 34), fill=COLORS["rp_green_bg"], radius=12)
    draw_text(draw, (badge_x + badge_w // 2, y + 23), status, fill=COLORS["rp_green"], font=F["rp_status"], anchor="mm")


def draw_rp_textarea(draw, x, y, w, placeholder, lang="zh"):
    h = 140
    rounded_rect(draw, (x + 14, y, x + w - 14, y + h), fill=COLORS["rp_bg"], radius=10, outline="#e2e5ee", width=1)
    # Text lines
    if placeholder:
        lines = wrap_text(draw, placeholder, w - 44, F["rp_body"])
        yy = y + 12
        for line in lines[:6]:
            draw_text(draw, (x + 24, yy), line, fill=COLORS["rp_text"], font=F["rp_body"])
            yy += 20
    return h


def draw_rp_button(draw, x, y, w, h, text, primary=False, ghost=False, lang="zh"):
    if primary:
        fill = COLORS["rp_primary"]
        outline = COLORS["rp_primary"]
        text_color = "white"
    elif ghost:
        fill = "white"
        outline = "white"
        text_color = COLORS["rp_sub"]
    else:
        fill = "white"
        outline = "#e2e5ee"
        text_color = COLORS["rp_text"]
    rounded_rect(draw, (x, y, x + w, y + h), fill=fill, radius=8, outline=outline, width=1)
    draw_text(draw, (x + w // 2, y + h // 2 + 1), text, fill=text_color, font=F["rp_btn"], anchor="mm")


def draw_rp_options(draw, x, y, w, lang="zh"):
    # Options title
    title = {"zh": "选择一个方案", "en": "Choose a reply"}[lang]
    draw_text(draw, (x + 14, y), title, fill=COLORS["rp_sub"], font=F["rp_tiny"])

    options = {
        "zh": [
            ("积极支持", "Hi there! Thank you so much for reaching out with your feedback—we truly apprec..."),
            ("客观中性", "Hello, thank you for your message regarding feedback on our store. We take all c..."),
            ("委婉拒绝", "Hi, thank you for your interest in providing feedback. At this time, we are not...")
        ],
        "en": [
            ("Positive", "Hi there! Thank you so much for reaching out with your feedback—we truly apprec..."),
            ("Neutral", "Hello, thank you for your message regarding feedback on our store. We take all c..."),
            ("Decline", "Hi, thank you for your interest in providing feedback. At this time, we are not...")
        ]
    }[lang]

    yy = y + 24
    for title, preview in options:
        # Option card
        rounded_rect(draw, (x + 14, yy, x + w - 14, yy + 86), fill=COLORS["rp_bg"], radius=10, outline="#e2e5ee", width=1)
        draw_text(draw, (x + 28, yy + 12), title, fill=COLORS["rp_text"], font=F["rp_option_title"])

        # Preview text (clamped to 2 lines)
        lines = wrap_text(draw, preview, w - 52, F["rp_small"])
        py = yy + 32
        for line in lines[:2]:
            draw_text(draw, (x + 28, py), line, fill=COLORS["rp_sub"], font=F["rp_small"])
            py += 17

        # Select button
        btn_text = {"zh": "选择此方案", "en": "Use this"}[lang]
        btn_w = 82
        btn_x = x + w - 14 - btn_w
        btn_y = yy + 52
        draw_rp_button(draw, btn_x, btn_y, btn_w, 26, btn_text, primary=False, lang=lang)

        yy += 94

    return yy - y


def draw_rp_card(img, draw, lang="zh", state="idle"):
    """Draw the ReplyPilot floating card on the right side.
       state: idle | options | result
    """
    x, y = 900, 80
    w = 360
    h = 560

    # Soft shadow composite
    shadow = Image.new("RGBA", (w + 32, h + 32), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([16, 16, 16 + w, 16 + h], radius=14, fill=(17, 24, 39, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
    img.paste(shadow, (x - 16, y - 16), shadow)

    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["rp_card"], radius=14, outline=COLORS["rp_border"], width=1)
    draw_rp_header(draw, x + 10, y + 10, w - 28, lang=lang)

    body_top = y + 60
    if state == "idle":
        # Textarea with placeholder
        placeholder = {
            "zh": "点击「生成回复」获取 AI 生成的 3 个回复方案。选择后可直接插入 Gmail 或复制。",
            "en": "Click 'Generate Reply' to get 3 AI reply options. Pick one, then insert into Gmail or copy."
        }[lang]
        ta_h = draw_rp_textarea(draw, x, body_top, w, placeholder, lang=lang)
        body_top += ta_h + 20

    elif state == "options":
        # Options list
        options_h = draw_rp_options(draw, x, body_top, w, lang=lang)
        body_top += options_h + 16

    elif state == "result":
        # Textarea with full reply
        result_text = {
            "zh": "您好！感谢您主动联系并提供反馈，我们非常重视。关于送货时间，如果今天下单，我们会尽快安排发货，预计最快 2–3 个工作日送达，具体以物流信息为准。期待为您服务！",
            "en": "Hi there! Thank you for reaching out with your feedback — we truly appreciate it. Regarding delivery, if you place an order today, we'll arrange shipment as soon as possible and estimate delivery within 2–3 business days. Looking forward to serving you!"
        }[lang]
        ta_h = draw_rp_textarea(draw, x, body_top, w, result_text, lang=lang)
        body_top += ta_h + 20

    # Buttons
    btn_y = body_top + 10
    col_w = (w - 36) // 2
    if state == "idle":
        draw_rp_button(draw, x + 14, btn_y, col_w, 34, {"zh": "生成回复", "en": "Generate Reply"}[lang], primary=True, lang=lang)
        draw_rp_button(draw, x + 22 + col_w, btn_y, col_w, 34, {"zh": "重新生成", "en": "Regenerate"}[lang], lang=lang)
        btn_y += 42
        draw_rp_button(draw, x + 14, btn_y, col_w, 34, {"zh": "插入回复", "en": "Insert Reply"}[lang], lang=lang)
        draw_rp_button(draw, x + 22 + col_w, btn_y, col_w, 34, {"zh": "复制回复", "en": "Copy Reply"}[lang], ghost=True, lang=lang)
        btn_y += 42
        draw_rp_button(draw, x + 14, btn_y, w - 28, 34, {"zh": "清空回复", "en": "Clear Reply"}[lang], ghost=True, lang=lang)
    elif state == "options":
        draw_rp_button(draw, x + 14, btn_y, col_w, 34, {"zh": "生成回复", "en": "Generate Reply"}[lang], primary=True, lang=lang)
        draw_rp_button(draw, x + 22 + col_w, btn_y, col_w, 34, {"zh": "重新生成", "en": "Regenerate"}[lang], lang=lang)
        btn_y += 42
        draw_rp_button(draw, x + 14, btn_y, col_w, 34, {"zh": "插入回复", "en": "Insert Reply"}[lang], lang=lang)
        draw_rp_button(draw, x + 22 + col_w, btn_y, col_w, 34, {"zh": "复制回复", "en": "Copy Reply"}[lang], ghost=True, lang=lang)
        btn_y += 42
        draw_rp_button(draw, x + 14, btn_y, w - 28, 34, {"zh": "清空回复", "en": "Clear Reply"}[lang], ghost=True, lang=lang)
    elif state == "result":
        draw_rp_button(draw, x + 14, btn_y, col_w, 34, {"zh": "插入回复", "en": "Insert Reply"}[lang], primary=True, lang=lang)
        draw_rp_button(draw, x + 22 + col_w, btn_y, col_w, 34, {"zh": "复制回复", "en": "Copy Reply"}[lang], lang=lang)
        btn_y += 42
        draw_rp_button(draw, x + 14, btn_y, w - 28, 34, {"zh": "清空回复", "en": "Clear Reply"}[lang], ghost=True, lang=lang)


# ---------- Scene helpers ----------

def draw_tutorial_annotation(draw, lang="zh"):
    # Skip per user request; screenshots are self-explanatory via UI.
    pass


def screenshot(lang, state, filename):
    img = Image.new("RGBA", (W, H), COLORS["gmail_bg"])
    draw = ImageDraw.Draw(img)

    draw_gmail_background(draw)
    draw_gmail_sidebar(draw, lang=lang)
    draw_email_content(draw, lang=lang)
    draw_rp_card(img, draw, lang=lang, state=state)

    out_dir = OUT / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    # Convert to RGB for Chrome Web Store (24-bit PNG, no alpha)
    img.convert("RGB").save(out_dir / filename)
    print(f"saved: {out_dir / filename}")


if __name__ == "__main__":
    # Tutorial flow: 1) open card, 2) generate options, 3) insert reply
    for lang in ("zh", "en"):
        screenshot(lang, "idle", "screenshot-01-open.png")
        screenshot(lang, "options", "screenshot-02-options.png")
        screenshot(lang, "result", "screenshot-03-insert.png")
    print(f"Done. Outputs in {OUT}")

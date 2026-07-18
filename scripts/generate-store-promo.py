# Generate Chrome Web Store promo images for ReplyPilot.
# Outputs bilingual (zh + en) promo tiles:
#   - 440x280 (small promo)
#   - 1400x560 (large promo / marquee)
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets" / "promo"
OUT.mkdir(parents=True, exist_ok=True)


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


COLORS = {
    "primary": "#6366f1",
    "primary_dark": "#4f46e5",
    "accent": "#f59e0b",
    "white": "#ffffff",
    "off_white": "#f3f4ff",
    "sub": "#e0e7ff",
    "card": "#ffffff",
    "card_border": "#e2e5ee",
    "text_dark": "#1f2330",
    "text_sub": "#6b7280",
    "green": "#1a8a4f",
    "green_bg": "#e9f8ef",
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


def draw_gradient_bg(draw, W, H, c1, c2):
    """Draw a vertical gradient background from two hex colors."""
    c1 = c1.lstrip("#")
    c2 = c2.lstrip("#")
    for y in range(H):
        r = int(int(c1[0:2], 16) + (int(c2[0:2], 16) - int(c1[0:2], 16)) * y / H)
        g = int(int(c1[2:4], 16) + (int(c2[2:4], 16) - int(c1[2:4], 16)) * y / H)
        b = int(int(c1[4:6], 16) + (int(c2[4:6], 16) - int(c1[4:6], 16)) * y / H)
        draw.line([(0, y), (W, y)], fill=(r, g, b))


def draw_star(draw, cx, cy, r, fill):
    draw.polygon([(cx, cy - r), (cx + r * 0.25, cy - r * 0.25),
                  (cx + r, cy), (cx + r * 0.25, cy + r * 0.25),
                  (cx, cy + r), (cx - r * 0.25, cy + r * 0.25),
                  (cx - r, cy), (cx - r * 0.25, cy - r * 0.25)],
                 fill=fill)


def draw_card_mockup(draw, x, y, w, h, scale):
    """Draw a simplified ReplyPilot card mockup."""
    # shadow
    shadow = Image.new("RGBA", (w + 20, h + 20), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([10, 10, 10 + w, 10 + h], radius=12, fill=(17, 24, 39, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=6))
    img = draw._image
    img.paste(shadow, (x - 10, y - 10), shadow)

    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["card"], radius=12, outline=COLORS["card_border"], width=1)

    title_font = load_font(int(13 * scale), bold=True)
    body_font = load_font(int(12 * scale))
    small_font = load_font(int(11 * scale))
    btn_font = load_font(int(12 * scale), bold=True)

    # Header
    draw_star(draw, x + int(18 * scale), y + int(18 * scale), int(7 * scale), fill=COLORS["accent"])
    draw_text(draw, (x + int(34 * scale), y + int(18 * scale)), "ReplyPilot", fill=COLORS["text_dark"], font=title_font)

    status = "回复已生成"
    tw = text_width(draw, status, small_font)
    badge_x = x + w - int(16 * scale) - int(tw) - int(10 * scale)
    badge_y = y + int(10 * scale)
    rounded_rect(draw, (badge_x, badge_y, badge_x + int(tw) + int(10 * scale), badge_y + int(18 * scale)), fill=COLORS["green_bg"], radius=10)
    draw_text(draw, (badge_x + (int(tw) + int(10 * scale)) // 2, badge_y + int(9 * scale)), status, fill=COLORS["green"], font=small_font, anchor="mm")

    # Options preview
    option_y = y + int(40 * scale)
    for label, preview in [
        ("积极支持", "感谢您主动联系并提供反馈..."),
        ("客观中性", "关于发货时间，具体取决于..."),
        ("委婉拒绝", "目前我们暂不接收额外反馈..."),
    ]:
        oh = int(58 * scale)
        rounded_rect(draw, (x + int(10 * scale), option_y, x + w - int(10 * scale), option_y + oh), fill="#fbfbfd", radius=8, outline=COLORS["card_border"], width=1)
        draw_text(draw, (x + int(18 * scale), option_y + int(8 * scale)), label, fill=COLORS["text_dark"], font=body_font)
        lines = wrap_text(draw, preview, w - int(36 * scale), small_font)
        py = option_y + int(24 * scale)
        for line in lines[:2]:
            draw_text(draw, (x + int(18 * scale), py), line, fill=COLORS["text_sub"], font=small_font)
            py += int(14 * scale)
        option_y += oh + int(6 * scale)

    # Buttons
    btn_y = y + h - int(46 * scale)
    col_w = (w - int(24 * scale)) // 2
    rounded_rect(draw, (x + int(10 * scale), btn_y, x + int(10 * scale) + col_w, btn_y + int(26 * scale)), fill=COLORS["primary"], radius=6)
    draw_text(draw, (x + int(10 * scale) + col_w // 2, btn_y + int(13 * scale)), "生成回复", fill=COLORS["white"], font=btn_font, anchor="mm")
    rounded_rect(draw, (x + int(14 * scale) + col_w, btn_y, x + w - int(10 * scale), btn_y + int(26 * scale)), fill=COLORS["white"], radius=6, outline=COLORS["card_border"], width=1)
    draw_text(draw, (x + int(14 * scale) + col_w + col_w // 2, btn_y + int(13 * scale)), "复制回复", fill=COLORS["text_dark"], font=btn_font, anchor="mm")


def draw_large_promo(W, H):
    img = Image.new("RGBA", (W, H), COLORS["primary"])
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(draw, W, H, "#6366f1", "#4f46e5")

    F = {
        "title": load_font(56, bold=True),
        "subtitle": load_font(28),
        "bullet": load_font(22),
        "cta": load_font(20, bold=True),
        "small": load_font(16),
    }

    # Left copy
    left_x = 70
    top_y = 80

    draw_text(draw, (left_x, top_y), "ReplyPilot", fill=COLORS["white"], font=F["title"])
    draw_text(draw, (left_x, top_y + 70), "AI 邮件回复助手", fill=COLORS["off_white"], font=F["subtitle"])
    draw_text(draw, (left_x, top_y + 108), "AI Email Reply Assistant", fill=COLORS["sub"], font=F["small"])

    bullets = [
        ("一键生成 3 个回复方案", "Generate 3 reply options in one click"),
        ("直接插入 Gmail 回复框", "Insert directly into Gmail reply box"),
        ("支持多种语气与场景", "Multiple tones and scenarios"),
    ]
    by = top_y + 170
    for zh, en in bullets:
        rounded_rect(draw, (left_x, by, left_x + 8, by + 8), fill=COLORS["accent"], radius=2)
        draw_text(draw, (left_x + 18, by - 4), zh, fill=COLORS["white"], font=F["bullet"])
        draw_text(draw, (left_x + 18, by + 28), en, fill=COLORS["sub"], font=F["small"])
        by += 70

    # CTA button
    btn_w = 240
    btn_h = 50
    btn_x = left_x
    btn_y = H - 110
    rounded_rect(draw, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h), fill=COLORS["white"], radius=25)
    draw_text(draw, (btn_x + btn_w // 2, btn_y + btn_h // 2 + 1), "立即体验 · Try It Now", fill=COLORS["primary"], font=F["cta"], anchor="mm")

    # Right card mockup
    card_w = 380
    card_h = 420
    card_x = W - card_w - 90
    card_y = (H - card_h) // 2
    draw_card_mockup(draw, card_x, card_y, card_w, card_h, scale=1.0)

    return img


def draw_small_promo(W, H):
    img = Image.new("RGBA", (W, H), COLORS["primary"])
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(draw, W, H, "#6366f1", "#4f46e5")

    scale = 0.6
    F = {
        "title": load_font(34, bold=True),
        "subtitle": load_font(16),
        "bullet": load_font(14),
        "small": load_font(11),
        "cta": load_font(12, bold=True),
    }

    left_x = 22
    top_y = 28

    draw_text(draw, (left_x, top_y), "ReplyPilot", fill=COLORS["white"], font=F["title"])
    draw_text(draw, (left_x, top_y + 42), "AI 邮件回复助手", fill=COLORS["off_white"], font=F["subtitle"])
    draw_text(draw, (left_x, top_y + 64), "AI Email Reply Assistant", fill=COLORS["sub"], font=F["small"])

    bullets = [
        ("一键生成 3 个方案", "3 options in one click"),
        ("直接插入 Gmail", "Insert into Gmail"),
    ]
    by = top_y + 96
    for zh, en in bullets:
        rounded_rect(draw, (left_x, by, left_x + 5, by + 5), fill=COLORS["accent"], radius=1)
        draw_text(draw, (left_x + 12, by - 3), zh, fill=COLORS["white"], font=F["bullet"])
        draw_text(draw, (left_x + 12, by + 18), en, fill=COLORS["sub"], font=F["small"])
        by += 46

    # CTA button
    btn_w = 160
    btn_h = 34
    btn_x = left_x
    btn_y = H - 54
    rounded_rect(draw, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h), fill=COLORS["white"], radius=17)
    # Bilingual text split into two lines, centered vertically in button
    center_y = btn_y + btn_h // 2
    draw_text(draw, (btn_x + btn_w // 2, center_y - 7), "立即体验", fill=COLORS["primary"], font=F["cta"], anchor="mm")
    draw_text(draw, (btn_x + btn_w // 2, center_y + 10), "Try It Now", fill=COLORS["primary"], font=F["small"], anchor="mm")

    # Right card mockup (smaller)
    card_w = 200
    card_h = 240
    card_x = W - card_w - 16
    card_y = (H - card_h) // 2
    draw_card_mockup(draw, card_x, card_y, card_w, card_h, scale=scale)

    return img


def save(img, filename):
    out_path = OUT / filename
    img.convert("RGB").save(out_path)
    print(f"saved: {out_path}")


if __name__ == "__main__":
    save(draw_large_promo(1400, 560), "promo-marquee-1400x560.png")
    save(draw_small_promo(440, 280), "promo-small-440x280.png")
    print(f"Done. Outputs in {OUT}")

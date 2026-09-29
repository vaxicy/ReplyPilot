# Generate Chrome Web Store promo images for ReplyPilot.
# Outputs bilingual (zh + en) promo tiles:
#   - 440x280  (small promo)
#   - 1400x560 (large promo / marquee)
#
# Layout rules (see the store-asset-generator skill QA checklist):
#   - one shared margin for both columns; card top and copy top share a baseline
#   - the last bullet must never touch the CTA (checked with an assert)
#   - the CTA bottom stays >= 12px above the canvas bottom
#   - the card mock is laid out proportionally from a 400x420 reference so it
#     fills the frame instead of leaving a big empty area
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets" / "promo"
OUT.mkdir(parents=True, exist_ok=True)

COLORS = {
    "primary": "#6366f1",
    "accent": "#f59e0b",
    "white": "#ffffff",
    "off_white": "#f3f4ff",
    "sub": "#c7cdfb",
    "card_border": "#e2e5ee",
    "text_dark": "#1f2330",
    "text_sub": "#6b7280",
    "chip_border": "#e2e5ee",
    "chip_active": "#eef0ff",
    "chip_active_border": "#8b8ef5",
    "green": "#1a8a4f",
    "green_bg": "#e9f8ef",
    "input_bg": "#fbfbfd",
    "input_border": "#e2e5ee",
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


def rounded_rect(draw, xy, fill, radius=14, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill,
                           outline=outline, width=width)


def draw_text(draw, xy, text, fill, font, anchor=None):
    draw.text(xy, text, fill=fill, font=font, anchor=anchor)


def text_width(draw, text, font):
    return draw.textlength(text, font=font)


def draw_gradient_bg(draw, W, H, c1, c2):
    c1, c2 = c1.lstrip("#"), c2.lstrip("#")
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


# ------------------------------------------------------------------- card ---

# The card mock is authored against this reference box, then scaled to fit.
CARD_REF_W, CARD_REF_H = 400.0, 420.0


def draw_card_mockup(draw, x, y, w, h, compact=False):
    """Draw a proportional ReplyPilot card mockup that fills the given box."""
    s = w / CARD_REF_W
    img = draw._image

    shadow = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([12, 12, 12 + w, 12 + h], radius=max(6, int(12 * s)),
                         fill=(17, 24, 39, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(3, int(7 * s))))
    img.paste(shadow, (x - 12, y - 12), shadow)

    fx = lambda size, bold=False: load_font(max(7, int(round(size * s))), bold=bold)
    f_title = fx(13, True)
    f_label = fx(10, True)
    f_body = fx(10.5)
    f_chip = fx(9.5)
    f_btn = fx(11, True)

    def Y(v):
        return y + int(round(v * s))

    def X(v):
        return x + int(round(v * s))

    rounded_rect(draw, (x, y, x + w, y + h), fill=COLORS["white"],
                 radius=max(6, int(12 * s)), outline=COLORS["card_border"], width=1)

    pad = 14

    # header
    draw_star(draw, X(pad + 7), Y(24), max(4, int(7 * s)), fill=COLORS["accent"])
    draw_text(draw, (X(pad + 18), Y(24)), "ReplyPilot", fill=COLORS["text_dark"],
              font=f_title, anchor="lm")
    status = "回复已生成"
    tw_ref = text_width(draw, status, f_chip) / s          # chip width in ref units
    badge_w_ref = tw_ref + 14
    bx0 = CARD_REF_W - pad - badge_w_ref
    rounded_rect(draw, (X(bx0), Y(16), X(CARD_REF_W - pad), Y(33)),
                 fill=COLORS["green_bg"], radius=max(3, int(8 * s)))
    draw_text(draw, (X(bx0 + badge_w_ref / 2), Y(24.5)), status,
              fill=COLORS["green"], font=f_chip, anchor="mm")

    # guidance input (label sits 7px clear of the box below it)
    draw_text(draw, (X(pad), Y(48)), "指导 AI 回复", fill=COLORS["text_sub"], font=f_label)
    rounded_rect(draw, (X(pad), Y(68), X(CARD_REF_W - pad), Y(102)),
                 fill=COLORS["input_bg"], radius=max(3, int(8 * s)),
                 outline=COLORS["input_border"], width=1)
    draw_text(draw, (X(pad + 9), Y(85)), "帮我委婉拒绝，简洁即可",
              fill=COLORS["text_dark"], font=f_body, anchor="lm")

    # keyword chips (two rows, first chip active; 12px between rows)
    draw_text(draw, (X(pad), Y(118)), "关键词", fill=COLORS["text_sub"], font=f_label)
    chips = [(["委婉拒绝", "直接拒绝", "专业"], True),
             (["简洁", "温暖", "+"], False)]
    cy = 138
    for row, active_first in chips:
        cx = pad                                        # cursor, in ref units
        for i, label in enumerate(row):
            cw_ref = text_width(draw, label, f_chip) / s + 18
            active = active_first and i == 0
            rounded_rect(draw, (X(cx), Y(cy), X(cx + cw_ref), Y(cy + 22)),
                         fill=COLORS["chip_active"] if active else COLORS["input_bg"],
                         radius=int(11 * s),
                         outline=COLORS["chip_active_border"] if active
                         else COLORS["chip_border"], width=1)
            draw_text(draw, (X(cx + cw_ref / 2), Y(cy + 11)), label,
                      fill="#4b4fd6" if active else "#4b5060", font=f_chip, anchor="mm")
            cx += cw_ref + 6
        cy += 34
    assert cy - 34 + 22 <= 212 - 6, "chip rows crowd the output label"

    # output box
    draw_text(draw, (X(pad), Y(212)), "生成结果", fill=COLORS["text_sub"], font=f_label)
    rounded_rect(draw, (X(pad), Y(232), X(CARD_REF_W - pad), Y(366)),
                 fill=COLORS["input_bg"], radius=max(4, int(10 * s)),
                 outline=COLORS["input_border"], width=1)
    body = "感谢来信。目前我暂时没有这方面的计划，这次就先不继续了。"
    yy = 246
    if compact:
        body = "感谢来信，这次先不继续了。"
    # simple character wrap against the inner width
    inner_w = (CARD_REF_W - pad * 2 - 22) * s
    line, lines = "", []
    for ch in body:
        test = line + ch
        if text_width(draw, test, f_body) > inner_w and line:
            lines.append(line)
            line = ch
        else:
            line = test
    if line:
        lines.append(line)
    for ln in lines[:3]:
        draw_text(draw, (X(pad + 10), Y(yy)), ln, fill=COLORS["text_dark"], font=f_body)
        yy += 16
    yy += 6
    draw_text(draw, (X(pad + 10), Y(yy)), "Best regards,", fill=COLORS["text_dark"], font=f_body)
    draw_text(draw, (X(pad + 10), Y(yy + 15)), "Alex", fill=COLORS["text_dark"], font=f_body)

    # actions
    by = CARD_REF_H - pad - 30
    assert by - 366 >= 8, "output box crowds the action buttons"  # ref units (proportional)
    col_w = (CARD_REF_W - pad * 2 - 8) / 2
    rounded_rect(draw, (X(pad), Y(by), X(pad + col_w), Y(by + 30)),
                 fill=COLORS["primary"], radius=max(4, int(7 * s)))
    draw_text(draw, (X(pad + col_w / 2), Y(by + 15)), "生成回复", fill=COLORS["white"],
              font=f_btn, anchor="mm")
    rounded_rect(draw, (X(pad + col_w + 8), Y(by), X(CARD_REF_W - pad), Y(by + 30)),
                 fill=COLORS["white"], radius=max(4, int(7 * s)),
                 outline=COLORS["card_border"], width=1)
    draw_text(draw, (X(pad + col_w + 8 + col_w / 2), Y(by + 15)), "复制回复",
              fill=COLORS["text_dark"], font=f_btn, anchor="mm")


# ------------------------------------------------------------------ promos --

BULLETS = [
    ("一句话指挥 AI 写回复", "Tell the AI in one line what to write"),
    ("直接插入 Gmail 回复框", "Insert directly into Gmail reply box"),
    ("结束语与署名自动落款", "Closing and signature added for you"),
]

BULLETS_SMALL = [
    ("一句话指挥 AI", "One-line prompts"),
    ("直接插入 Gmail", "Insert into Gmail"),
]


def draw_bullets(draw, left_x, top, items, bullet_font, sub_font, pitch, gap):
    """Draw dot + zh line + en line; returns the bottom y of the block."""
    by = top
    for zh, en in items:
        dot = max(5, int(bullet_font.size * 0.35))
        rounded_rect(draw, (left_x, by + int(bullet_font.size * 0.35), left_x + dot,
                            by + int(bullet_font.size * 0.35) + dot),
                     fill=COLORS["accent"], radius=2)
        draw_text(draw, (left_x + dot + 12, by), zh, fill=COLORS["white"],
                  font=bullet_font)
        draw_text(draw, (left_x + dot + 12, by + gap), en, fill=COLORS["sub"],
                  font=sub_font)
        by += pitch
    return by - pitch + gap + sub_font.size + 4


def draw_large_promo(W, H):
    img = Image.new("RGBA", (W, H), COLORS["primary"])
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(draw, W, H, "#6366f1", "#4f46e5")

    F = {
        "title": load_font(52, bold=True),
        "subtitle": load_font(26),
        "sub_en": load_font(16),
        "bullet": load_font(21),
        "bullet_en": load_font(15),
        "cta": load_font(19, bold=True),
    }

    margin = 80
    left_x = margin
    top_y = 76

    draw_text(draw, (left_x, top_y), "ReplyPilot", fill=COLORS["white"], font=F["title"])
    draw_text(draw, (left_x, top_y + 66), "AI 邮件回复助手", fill=COLORS["off_white"],
              font=F["subtitle"])
    draw_text(draw, (left_x, top_y + 106), "AI Email Reply Assistant", fill=COLORS["sub"],
              font=F["sub_en"])

    bullets_top = top_y + 152
    block_bottom = draw_bullets(draw, left_x, bullets_top, BULLETS, F["bullet"],
                                F["bullet_en"], pitch=64, gap=34)

    btn_w, btn_h = 252, 52
    btn_x, btn_y = left_x, H - 112
    assert block_bottom <= btn_y - 14, \
        "last bullet (%d) too close to the CTA (%d)" % (block_bottom, btn_y)
    assert btn_y + btn_h <= H - 12, "CTA breaks the bottom safe line"

    rounded_rect(draw, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
                 fill=COLORS["white"], radius=btn_h // 2)
    draw_text(draw, (btn_x + btn_w // 2, btn_y + btn_h // 2 + 1),
              "立即体验 · Try It Now", fill=COLORS["primary"], font=F["cta"], anchor="mm")

    # right card: top aligned with the copy, bottom aligned with the CTA
    card_w = 400
    card_h = 420
    card_x = W - margin - card_w
    card_y = btn_y + btn_h - card_h
    assert card_y >= 60, "card would overlap the top edge"
    draw_card_mockup(draw, card_x, card_y, card_w, card_h)

    return img


def draw_small_promo(W, H):
    img = Image.new("RGBA", (W, H), COLORS["primary"])
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(draw, W, H, "#6366f1", "#4f46e5")

    F = {
        "title": load_font(32, bold=True),
        "subtitle": load_font(15),
        "sub_en": load_font(11),
        "bullet": load_font(14),
        "bullet_en": load_font(11),
        "cta": load_font(13, bold=True),
        "cta_en": load_font(10),
    }

    margin = 22
    left_x = margin
    top_y = 26

    draw_text(draw, (left_x, top_y), "ReplyPilot", fill=COLORS["white"], font=F["title"])
    draw_text(draw, (left_x, top_y + 42), "AI 邮件回复助手", fill=COLORS["off_white"],
              font=F["subtitle"])
    draw_text(draw, (left_x, top_y + 68), "AI Email Reply Assistant", fill=COLORS["sub"],
              font=F["sub_en"])

    bullets_top = top_y + 104
    block_bottom = draw_bullets(draw, left_x, bullets_top, BULLETS_SMALL, F["bullet"],
                                F["bullet_en"], pitch=46, gap=20)

    btn_w, btn_h = 168, 42
    btn_x, btn_y = left_x, H - 56
    assert block_bottom <= btn_y - 10, \
        "last bullet (%d) too close to the CTA (%d)" % (block_bottom, btn_y)
    assert btn_y + btn_h <= H - 10, "CTA breaks the bottom safe line"

    rounded_rect(draw, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
                 fill=COLORS["white"], radius=btn_h // 2)
    cy = btn_y + btn_h // 2
    draw_text(draw, (btn_x + btn_w // 2, cy - 8), "立即体验", fill=COLORS["primary"],
              font=F["cta"], anchor="mm")
    draw_text(draw, (btn_x + btn_w // 2, cy + 9), "Try It Now", fill=COLORS["primary"],
              font=F["cta_en"], anchor="mm")

    card_w = 212
    card_h = int(card_w * CARD_REF_H / CARD_REF_W)
    card_x = W - margin - card_w + 8
    card_y = (H - card_h) // 2
    draw_card_mockup(draw, card_x, card_y, card_w, card_h, compact=True)

    return img


def save(img, filename):
    out_path = OUT / filename
    img.convert("RGB").save(out_path)
    print("saved: %s" % out_path)


if __name__ == "__main__":
    save(draw_large_promo(1400, 560), "promo-marquee-1400x560.png")
    save(draw_small_promo(440, 280), "promo-small-440x280.png")
    print("Done. Outputs in %s" % OUT)

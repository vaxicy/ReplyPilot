# Generate ReplyPilot logo concept previews (Pillow).
# Output: logo-preview/concepts/*.png  +  logo-preview/concepts_sheet.png
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
CONC = os.path.join(OUT, 'concepts')
os.makedirs(CONC, exist_ok=True)

# ---- palette ----
INDIGO = (99, 102, 241)
VIOLET = (139, 92, 246)
WHITE  = (255, 255, 255)
LIGHT  = (213, 217, 224)
AMBER  = (251, 191, 36)
BG     = (245, 246, 250)

FONT_B = r"C:\Windows\Fonts\arialbd.ttf"
FONT_R = r"C:\Windows\Fonts\arial.ttf"

def gradient(size, c1, c2):
    w, h = size
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = np.linspace(c1[i], c2[i], h, dtype=np.uint8)[:, None]
    return Image.fromarray(arr, 'RGB')

def rounded_icon(base, radius):
    w, h = base.size
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    out = base.convert('RGBA')
    out.putalpha(mask)
    return out

def spark(draw, cx, cy, R, r, color):
    pts = []
    for i in range(8):
        ang = math.pi / 2 + i * math.pi / 4
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    draw.polygon(pts, fill=color)

def bg_icon(S):
    base = gradient((S, S), INDIGO, VIOLET)
    return rounded_icon(base, int(S * 0.22))

# ---- concept 1: paper plane + spark ----
def concept_plane(S):
    img = bg_icon(S); d = ImageDraw.Draw(img)
    p = lambda x, y: (x * S, y * S)
    nose, tail, center, wing2 = p(0.82, 0.20), p(0.20, 0.80), p(0.46, 0.46), p(0.82, 0.82)
    d.polygon([nose, tail, center], fill=WHITE)
    d.polygon([nose, center, wing2], fill=LIGHT)
    spark(d, 0.74 * S, 0.30 * S, 0.135 * S, 0.05 * S, AMBER)
    return img

# ---- concept 2: envelope + spark ----
def concept_envelope(S):
    img = bg_icon(S); d = ImageDraw.Draw(img)
    p = lambda x, y: (x * S, y * S)
    x0, y0, x1, y1 = p(0.22, 0.34)[0], p(0.22, 0.34)[1], p(0.78, 0.70)[0], p(0.78, 0.70)[1]
    d.rounded_rectangle([x0, y0, x1, y1], radius=S * 0.06, fill=WHITE)
    lw = max(2, int(S * 0.035))
    d.line([p(0.22, 0.34), p(0.50, 0.55), p(0.78, 0.34)], fill=LIGHT, width=lw, joint='curve')
    spark(d, 0.74 * S, 0.30 * S, 0.135 * S, 0.05 * S, AMBER)
    return img

# ---- concept 3: reply loop arrow + spark ----
def concept_loop(S):
    img = bg_icon(S); d = ImageDraw.Draw(img)
    cx, cy, R = 0.5 * S, 0.52 * S, 0.26 * S
    lw = max(3, int(S * 0.10))
    # clockwise open arc from 150 to 30 (open at top, ~240deg)
    d.arc([cx - R, cy - R, cx + R, cy + R], start=150, end=30, fill=WHITE, width=lw)
    # arrowhead at 30deg, pointing clockwise (down-left) like a reply arrow
    a = math.radians(30)
    ex, ey = cx + R * math.cos(a), cy + R * math.sin(a)
    ah = S * 0.12
    dir_a = a + math.pi / 2
    tip = (ex + S * 0.03 * math.cos(dir_a), ey + S * 0.03 * math.sin(dir_a))
    left = (ex + ah * math.cos(dir_a + 0.8), ey + ah * math.sin(dir_a + 0.8))
    right = (ex + ah * math.cos(dir_a - 0.8), ey + ah * math.sin(dir_a - 0.8))
    d.polygon([tip, left, right], fill=WHITE)
    spark(d, 0.74 * S, 0.30 * S, 0.13 * S, 0.05 * S, AMBER)
    return img

# ---- concept 4: RP monogram + spark ----
def concept_monogram(S):
    img = bg_icon(S); d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_B, int(S * 0.46))
    txt = 'RP'
    bb = d.textbbox((0, 0), txt, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((S - tw) / 2 - bb[0], (S - th) / 2 - bb[1] - S * 0.02), txt, font=f, fill=WHITE)
    spark(d, 0.80 * S, 0.24 * S, 0.10 * S, 0.04 * S, AMBER)
    return img

# ---- concept 5: chat bubble (typing dots) + spark ----
def concept_chat(S):
    img = bg_icon(S); d = ImageDraw.Draw(img)
    p = lambda x, y: (x * S, y * S)
    x0, y0, x1, y1 = p(0.20, 0.24)[0], p(0.20, 0.24)[1], p(0.80, 0.60)[0], p(0.80, 0.60)[1]
    d.rounded_rectangle([x0, y0, x1, y1], radius=S * 0.12, fill=WHITE)
    d.polygon([p(0.30, 0.60), p(0.30, 0.78), p(0.48, 0.60)], fill=WHITE)
    for i, fx in enumerate((0.36, 0.50, 0.64)):
        d.ellipse([p(fx, 0.40)[0] - S * 0.035, p(fx, 0.40)[1] - S * 0.035,
                   p(fx, 0.40)[0] + S * 0.035, p(fx, 0.40)[1] + S * 0.035], fill=INDIGO)
    spark(d, 0.78 * S, 0.26 * S, 0.12 * S, 0.045 * S, AMBER)
    return img

CONCEPTS = [
    ('1', 'Paper Plane + Spark', concept_plane),
    ('2', 'Envelope + Spark', concept_envelope),
    ('3', 'Reply Loop + Spark', concept_loop),
    ('4', 'RP Monogram + Spark', concept_monogram),
    ('5', 'Chat Bubble + Spark', concept_chat),
]

# save individual 16/48/128 pngs
for cid, name, fn in CONCEPTS:
    for sz in (16, 48, 128):
        fn(sz).save(os.path.join(CONC, f'concept{cid}_{sz}.png'))

# ---- combined preview sheet ----
cols, cell, pad = 3, 180, 28
rows = math.ceil(len(CONCEPTS) / cols)
sheet_w = cols * cell + pad * (cols + 1)
sheet_h = pad + 54 + rows * (cell + 56) + pad
sheet = Image.new('RGB', (sheet_w, sheet_h), BG)
sd = ImageDraw.Draw(sheet)
title_f = ImageFont.truetype(FONT_B, 30)
sub_f = ImageFont.truetype(FONT_R, 17)
name_f = ImageFont.truetype(FONT_B, 18)

sd.text((pad, pad), 'ReplyPilot Logo Concepts', font=title_f, fill=(31, 41, 55))
sd.text((pad, pad + 38), 'Gradient rounded-square · indigo→violet · amber AI spark', font=sub_f, fill=(107, 114, 128))

for idx, (cid, name, fn) in enumerate(CONCEPTS):
    r, c = divmod(idx, cols)
    x = pad + c * (cell + pad)
    y = pad + 54 + r * (cell + 56)
    icon = fn(128).resize((cell, cell), Image.LANCZOS)
    sheet.paste(icon, (x, y), icon)
    bb = sd.textbbox((0, 0), name, font=name_f)
    tw = bb[2] - bb[0]
    sd.text((x + (cell - tw) / 2, y + cell + 10), name, font=name_f, fill=(31, 41, 55))

sheet.save(os.path.join(OUT, 'concepts_sheet.png'))
print('done:', os.path.join(OUT, 'concepts_sheet.png'))
print('individual:', os.listdir(CONC))

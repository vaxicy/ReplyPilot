# Generate ReplyPilot icons (chat-bubble concept 5) at 16/48/128.
import os, math
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')
os.makedirs(OUT, exist_ok=True)

INDIGO = (99, 102, 241)
VIOLET = (139, 92, 246)
WHITE  = (255, 255, 255)
AMBER  = (251, 191, 36)


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


def icon_chat(S):
    base = gradient((S, S), INDIGO, VIOLET)
    img = rounded_icon(base, int(S * 0.22))
    d = ImageDraw.Draw(img)
    p = lambda x, y: (x * S, y * S)

    x0, y0 = p(0.20, 0.24)
    x1, y1 = p(0.80, 0.60)
    d.rounded_rectangle([x0, y0, x1, y1], radius=S * 0.12, fill=WHITE)
    d.polygon([p(0.30, 0.60), p(0.30, 0.78), p(0.48, 0.60)], fill=WHITE)

    for fx in (0.36, 0.50, 0.64):
        cx, cy = p(fx, 0.40)
        r = S * 0.035
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INDIGO)

    spark(d, 0.78 * S, 0.26 * S, 0.12 * S, 0.045 * S, AMBER)
    return img


if __name__ == '__main__':
    for sz in (16, 48, 128):
        icon_chat(sz).save(os.path.join(OUT, f'icon{sz}.png'))
    print('icons written to:', OUT, os.listdir(OUT))

"""Draws the app icons (a sun over a battery) with Pillow. Usage: python make_icons.py OUTDIR"""
import sys, os
from PIL import Image, ImageDraw

def icon(size, pad):
    im = Image.new('RGBA', (size, size), (31, 58, 46, 255))
    d = ImageDraw.Draw(im)
    s = size * (1 - 2 * pad) / 512.0; o = size * pad
    P = lambda x, y: (o + x * s, o + y * s)
    cx, cy, r = 256, 190, 80
    d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=(244, 196, 48))
    import math
    for k in range(12):
        a = k * math.pi / 6
        d.line([P(cx + 105 * math.cos(a), cy + 105 * math.sin(a)), P(cx + 140 * math.cos(a), cy + 140 * math.sin(a))], fill=(244, 196, 48), width=max(2, int(18 * s)))
    d.rounded_rectangle([P(136, 330), P(376, 450)], radius=int(16 * s), fill=(246, 244, 239))
    d.rectangle([P(376, 365), P(396, 415)], fill=(246, 244, 239))
    for i in range(3):
        d.rectangle([P(156 + i * 72, 350), P(212 + i * 72, 430)], fill=(76, 160, 92))
    return im

out = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(out, exist_ok=True)
icon(192, 0.04).save(os.path.join(out, 'icon-192.png'))
icon(512, 0.04).save(os.path.join(out, 'icon-512.png'))
icon(512, 0.14).save(os.path.join(out, 'icon-512-maskable.png'))
print('icons written to', out)

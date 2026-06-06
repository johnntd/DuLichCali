#!/usr/bin/env python3
"""
Driver Portal icon generator — Du Lich Cali.

Renders a shuttle/sedan-themed app icon on the DuLichCali navy→ocean gradient with
gold accents, matching the family look of generate_icons.py (main site) and the
Mobile Barber icon set. Theme color: driver navy #0d2f50 + gold #ffcc44.

Renders DIRECTLY at each target size (no downscaling), mirroring generate_icons.py.
Outputs to assets/icons/:
  driver-180.png            apple-touch-icon (iOS Home Screen)
  driver-192.png            manifest icon (any)
  driver-512.png            manifest icon (any)
  driver-maskable-512.png   manifest icon (maskable; inner art in 72% safe zone)

Excluded from hosting deploy via firebase.json ignore (like generate_icons.py).
Run:  python3 generate_driver_icons.py
"""
import os
from PIL import Image, ImageDraw

# ── DuLichCali brand palette (driver portal) ──────────────────────────────────
C_NAVY  = (13, 47, 80)      # #0d2f50 driver navy (theme color)
C_OCEAN = (22, 80, 135)     # California ocean blue
C_DEEP  = (8, 27, 51)       # deep navy (top)
C_GOLD  = (255, 204, 68)    # #ffcc44 accent gold
C_GOLD2 = (240, 180, 40)    # gold shade
C_CREAM = (255, 250, 235)   # warm cream (glass / lights)
C_GLASS = (150, 200, 235)   # window glass tint


def _lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def make_bg(S):
    """Vertical gradient deep-navy → navy → ocean (full-bleed)."""
    img = Image.new('RGB', (S, S), C_NAVY)
    px = img.load()
    for y in range(S):
        t = y / max(S - 1, 1)
        if t < 0.55:
            col = _lerp(C_DEEP, C_NAVY, t / 0.55)
        else:
            col = _lerp(C_NAVY, C_OCEAN, (t - 0.55) / 0.45)
        for x in range(S):
            px[x, y] = col
    return img


def _rrect(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)


def draw_shuttle(img, S, x0, y0, w, h):
    """Draw a clean side-profile shuttle/van in gold/cream within (x0,y0,w,h)."""
    d = ImageDraw.Draw(img)
    # Body
    body_top = y0 + int(h * 0.30)
    body = (x0, body_top, x0 + w, y0 + int(h * 0.82))
    _rrect(d, body, r=int(h * 0.18), fill=C_GOLD)
    # Cabin / roof (slightly inset, rounded front)
    roof = (x0 + int(w * 0.06), y0 + int(h * 0.06),
            x0 + int(w * 0.88), body_top + int(h * 0.14))
    _rrect(d, roof, r=int(h * 0.20), fill=C_GOLD2)
    # Windows (two glass panes)
    win_y0 = y0 + int(h * 0.14)
    win_y1 = body_top + int(h * 0.05)
    gap = int(w * 0.03)
    w1 = (x0 + int(w * 0.12), win_y0, x0 + int(w * 0.45) - gap, win_y1)
    w2 = (x0 + int(w * 0.45) + gap, win_y0, x0 + int(w * 0.80), win_y1)
    _rrect(d, w1, r=int(h * 0.05), fill=C_GLASS)
    _rrect(d, w2, r=int(h * 0.05), fill=C_GLASS)
    # Headlight (cream dot, front-right)
    hl_r = int(h * 0.05)
    hy = body_top + int(h * 0.16)
    d.ellipse((x0 + w - hl_r * 2 - int(w * 0.02), hy,
               x0 + w - int(w * 0.02), hy + hl_r * 2), fill=C_CREAM)
    # Wheels (navy tyres, gold hubs) sitting on the body baseline
    wy = y0 + int(h * 0.74)
    wr = int(h * 0.16)
    for cx in (x0 + int(w * 0.26), x0 + int(w * 0.74)):
        d.ellipse((cx - wr, wy - wr, cx + wr, wy + wr), fill=C_DEEP)
        d.ellipse((cx - int(wr * 0.45), wy - int(wr * 0.45),
                   cx + int(wr * 0.45), wy + int(wr * 0.45)), fill=C_GOLD)


def create_icon(S):
    img = make_bg(S)
    # Soft gold ground arc under the vehicle for grounding
    d = ImageDraw.Draw(img)
    # Shuttle centered, ~64% width
    w = int(S * 0.64)
    h = int(S * 0.42)
    x0 = (S - w) // 2
    y0 = int(S * 0.30)
    draw_shuttle(img, S, x0, y0, w, h)
    return img


def create_maskable(S):
    """Full-bleed gradient with the icon art rendered into the 72% safe zone."""
    bg = make_bg(S)
    pad = int(S * 0.14)  # 14% padding -> 72% center safe zone
    inner = create_icon(S - 2 * pad)
    bg.paste(inner, (pad, pad))
    return bg


if __name__ == '__main__':
    root = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(root, 'assets', 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    jobs = [
        (512, 'driver-512.png',          False),
        (192, 'driver-192.png',          False),
        (180, 'driver-180.png',          False),
        (512, 'driver-maskable-512.png', True),
    ]
    for size, name, maskable in jobs:
        out = os.path.join(icons_dir, name)
        im = create_maskable(size) if maskable else create_icon(size)
        im.save(out, 'PNG', optimize=True)
        print(f'  OK  assets/icons/{name} ({size}x{size})')
    print('Driver icon set generated.')

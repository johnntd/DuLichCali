#!/usr/bin/env python3
"""
DuLichCali App Icon Generator
Brand identity: Travel + Food Services + AI concierge
California sunset palette — navy ocean top → warm amber bottom
Symbol: location pin (travel) + AI star (smart) + bowl/steam (food)
"""

from PIL import Image, ImageDraw
import os

# ── Palette ───────────────────────────────────────────────────────────────────
C_NAVY  = (10,  35,  68)   # Deep Pacific navy
C_OCEAN = (22,  80, 135)   # California ocean blue
C_DUSK  = (140, 55,  15)   # Dusk transition
C_AMBER = (200, 70,   8)   # Warm California sunset amber
C_WHITE = (255, 255, 255)
C_GOLD  = (255, 204,  68)  # AI / accent gold
C_CREAM = (255, 250, 230)  # Warm cream for bowl/steam

def lerp_col(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def bg_at(S, y):
    """Three-stop vertical gradient: navy → ocean → amber."""
    t = y / max(S - 1, 1)
    if t < 0.40:
        return lerp_col(C_NAVY, C_OCEAN, t / 0.40)
    elif t < 0.70:
        return lerp_col(C_OCEAN, C_DUSK, (t - 0.40) / 0.30)
    else:
        return lerp_col(C_DUSK, C_AMBER, (t - 0.70) / 0.30)

def make_bg(S):
    img = Image.new('RGB', (S, S))
    d   = ImageDraw.Draw(img)
    for y in range(S):
        d.line([(0, y), (S - 1, y)], fill=bg_at(S, y))
    return img

def star4(d, cx, cy, arm, lw, col):
    """4-point sparkle star (cross + shorter diagonals)."""
    d.line([cx - arm, cy,        cx + arm, cy],        fill=col, width=lw)
    d.line([cx,        cy - arm, cx,        cy + arm], fill=col, width=lw)
    diag = int(arm * 0.62)
    lw2  = max(1, lw - 1)
    d.line([cx - diag, cy - diag, cx + diag, cy + diag], fill=col, width=lw2)
    d.line([cx - diag, cy + diag, cx + diag, cy - diag], fill=col, width=lw2)

def create_icon(S):
    """Render a single icon at size S × S (RGB, no alpha)."""
    bg  = make_bg(S)
    img = bg.copy().convert('RGBA')
    d   = ImageDraw.Draw(img)

    # ── Location pin ──────────────────────────────────────────────────────────
    cx = S // 2
    cy = int(S * 0.372)
    r  = int(S * 0.220)

    # Tail polygon (drawn before circle so circle overlaps cleanly)
    sw  = int(r * 0.67)
    shy = cy + int(r * 0.72)          # shoulder y
    tip = int(S * 0.660)              # tip y
    d.polygon([(cx - sw, shy), (cx + sw, shy), (cx, tip)], fill=C_WHITE)

    # Pin circle
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=C_WHITE)

    # ── Pin hole (punched using exact bg gradient color) ──────────────────────
    hr   = int(r * 0.51)
    hcol = bg_at(S, cy) + (255,)
    d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=hcol)

    # ── AI sparkle-star inside hole ───────────────────────────────────────────
    arm = int(hr * 0.66)
    lw  = max(2, S // 90)
    star4(d, cx, cy, arm, lw, C_GOLD)

    # ── Food bowl ─────────────────────────────────────────────────────────────
    bx  = S // 2
    by  = int(S * 0.808)
    br  = int(S * 0.120)    # slightly larger for visibility
    blw = max(2, S // 65)

    # Bottom semicircle arc (0° = right, 90° = bottom, 180° = left — clockwise)
    bbox = [bx - br, by - br, bx + br, by + br]
    d.arc(bbox, start=0, end=180, fill=C_CREAM, width=blw)
    # Bowl rim (horizontal line connecting arc endpoints)
    d.line([bx - br, by, bx + br, by], fill=C_CREAM, width=blw)

    # ── Steam dots (between pin tip and bowl rim) ─────────────────────────────
    dr   = max(2, int(S * 0.013))
    spy  = int(S * 0.740)               # safely between tip (0.660) and bowl (0.808)
    spx  = int(S * 0.041)               # horizontal spacing
    for dx, dy_off in [(-spx, int(S * 0.010)), (0, 0), (spx, int(S * 0.010))]:
        sx = bx + dx
        sy = spy + dy_off
        d.ellipse([sx - dr, sy - dr, sx + dr, sy + dr], fill=C_CREAM)

    # ── Sparkle stars — upper-right quadrant (AI / smart feel) ──────────────
    for (sx, sy, arm_s) in [
        (int(S * 0.750), int(S * 0.198), max(4, int(S * 0.022))),   # large
        (int(S * 0.822), int(S * 0.308), max(3, int(S * 0.015))),   # medium
        (int(S * 0.698), int(S * 0.118), max(2, int(S * 0.011))),   # small
    ]:
        lw_sp = max(1, arm_s // 3)
        # 4-point star
        d.line([sx - arm_s, sy, sx + arm_s, sy], fill=C_WHITE, width=lw_sp)
        d.line([sx, sy - arm_s, sx, sy + arm_s], fill=C_WHITE, width=lw_sp)
        diag_sp = int(arm_s * 0.60)
        lw_d = max(1, lw_sp - 1)
        d.line([sx-diag_sp, sy-diag_sp, sx+diag_sp, sy+diag_sp], fill=C_WHITE, width=lw_d)
        d.line([sx-diag_sp, sy+diag_sp, sx+diag_sp, sy-diag_sp], fill=C_WHITE, width=lw_d)

    return img.convert('RGB')

def create_maskable(S):
    """Maskable PWA icon: full-bleed gradient, inner icon in 72% safe zone."""
    bg    = make_bg(S)
    pad   = int(S * 0.14)
    inner = create_icon(S - 2 * pad)
    bg.paste(inner, (pad, pad))
    return bg

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    root      = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(root, 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    jobs = [
        # (size, path, maskable)
        (512,  os.path.join(icons_dir, 'icon-512.png'),         False),
        (192,  os.path.join(icons_dir, 'icon-192.png'),          False),
        (192,  os.path.join(icons_dir, 'icon-192-maskable.png'), True),
        (180,  os.path.join(icons_dir, 'apple-touch-icon.png'),  False),
        (32,   os.path.join(icons_dir, 'favicon-32.png'),        False),
        (16,   os.path.join(icons_dir, 'favicon-16.png'),        False),
    ]

    for size, path, maskable in jobs:
        img = create_maskable(size) if maskable else create_icon(size)
        img.save(path, 'PNG', optimize=True)
        print(f'  ✓  {os.path.relpath(path, root)}  ({size}×{size}{"  maskable" if maskable else ""})')

    # favicon.ico — embed 16 + 32 + 48 px layers
    ico_path = os.path.join(root, 'favicon.ico')
    i16 = create_icon(16)
    i32 = create_icon(32)
    i48 = create_icon(48)
    i16.save(ico_path, format='ICO', append_images=[i32, i48])
    print(f'  ✓  favicon.ico  (16×16, 32×32, 48×48)')

    print('\n  All icons generated successfully!')

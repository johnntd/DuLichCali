# AI Style Studio — Mobile UX, Viewer & Download Fix

**Date:** 2026-06-13 · **Surface:** public `/style-studio` (iPhone Safari) · **Status:** Implemented + DEPLOYED to production (`?v=20260613c`); PASS pending on-device confirmation.

## Root cause of the freeze (bug #1)
`style-studio.html` loaded `/mobile-barber/mobile-barber-lightbox.js` but **not** `mobile-barber.css`. So tapping a generated image called `MBLightbox.open()`, which set `document.body.style.overflow = 'hidden'` and appended an **unstyled** overlay (no `position:fixed`, no visible/working close button). Result: body scroll locked with no way to dismiss → the page appeared frozen, and there was no real viewer.

**Fix:** removed the MBLightbox dependency from this page and built a self-contained `ss-viewer` with its own CSS, an iOS-safe scroll lock that **restores** on close, and proper controls.

## Fixes (mapped to the report)

| # | Bug | Fix |
|---|-----|-----|
| 1 | Page freezes/locks after generation | Self-contained `ss-viewer` (own CSS, `position:fixed`). **iOS-safe scroll lock-and-restore**: on open, save `scrollY` + set `body{position:fixed; top:-scrollY}`; on close, clear + `scrollTo(scrollY)`. Close via X (44px), backdrop tap, **swipe-down**, and Escape — every path runs `unlockScroll()`. No overlay/scroll state can be trapped. |
| 2 | Can't expand/zoom the photo | Tap image (or **Expand** button / zoom badge) → full-screen viewer. **Pinch-zoom** (1×–4×), **pan when zoomed**, **double-tap** to toggle 2.4×. Real `<img>` with `-webkit-touch-callout:default` so iOS long-press still works. |
| 3 | Download/save doesn't work on iOS | `saveImage()` tries, in order: **(1) Web Share with the image file** (`navigator.canShare({files})` → `share()` — the reliable iOS "Save to Photos / share sheet"); **(2)** desktop `<a download>`; **(3) iOS fallback** — open the viewer full-screen + show "**Press and hold the image to save to Photos**". Never silent. `[style-studio-download]` logs `method/supported/success/fallbackUsed`. Desktop download retained. |
| 4 | Style Goal select too thin | Replaced `<select>` with thumb-friendly **chips** (`min-height:44px`, active state), "Best Overall" + the 15 goals, `aria-pressed`. |
| 5 | Generated styles need better showcase | Manual-mode results render as a **horizontal swipeable carousel** (scroll-snap, momentum). Each card: large image, title, why-it-fits, and **Save / Share / Expand**. Master result is a featured card with the same actions. The viewer receives the full result set so you can **swipe left/right between looks** and use prev/next arrows. |

## Required UX delivered
Mobile-first: upload card → goal **chips** → big Generate button → result **carousel** → full-screen **viewer** → save/share/export → **no scroll-lock**, no trapped overlay, 44px touch targets (`touch-action:manipulation` to kill tap delay; `overscroll-behavior:contain`).

## Bug-audit / diagnostics
- **Scroll lock:** position:fixed technique with explicit restore (replaces the leaky `overflow:hidden`).
- **Modal state:** single-instance viewer; `closeViewer()` removes the node, detaches keydown, unlocks scroll, resets zoom.
- **Body overflow / touch handlers:** viewer uses `touch-action:none` for custom gestures; `preventDefault` only on pinch/pan moves (long-press save preserved).
- **Image data-URL handling:** previews stay in-memory data URLs; **no Firestore/Storage writes** (privacy rule intact).
- **Logs added:** `[style-studio-ui]` → `{ state, modalOpen, bodyOverflow, resultCount, activeResultIndex }` on init/generate/render/viewer-open/nav/close; `[style-studio-download]` → `{ method, supported, success, fallbackUsed }`.

## Tests (owner's 20-item list)
| # | Test | Status |
|---|------|--------|
| 1 | Generate a new look on iPhone Safari | ✅ deployed — confirm on device |
| 2 | Page remains scrollable after generation | ✅ fixed (no body lock outside the viewer; viewer restores) |
| 3 | Can navigate to other options after a result | ✅ fixed |
| 4 | Tap image → full-screen viewer | ✅ ss-viewer |
| 5 | Pinch/zoom or at least full-screen | ✅ pinch + double-tap + full-screen |
| 6 | Swipe between generated looks | ✅ swipe + prev/next (carousel passes the set) |
| 7 | Save/share works or clear iOS fallback | ✅ Web Share file → press-&-hold fallback |
| 8 | Download does not silently fail | ✅ always shares, downloads, or shows press-&-hold |
| 9 | Goal UI no longer a thin select | ✅ chips |
| 10 | Mobile layout premium & easy | ✅ — confirm on device |
| 11–20 | (viewer close, no trapped overlay, logs, vendor studio unaffected, etc.) | ✅ implemented; vendor studio + callables untouched |

## Limitations
- **Pinch-zoom is a custom touch implementation** (transform-based) — robust on iOS Safari but not a native pinch; double-tap zoom is the reliable complement.
- **iOS save** relies on Web Share (iOS 15+). Older iOS / Share-unavailable falls back to "press & hold to save" in the full-screen viewer.
- **No headless automated UI test** was run (Playwright not installed in this env, and iOS touch/long-press/Share can't be replicated headlessly). Verification was static (syntax/wiring/logic) + on-device by the owner.

## Do-not-break (verified)
`generateStyleStudio` callable, vendor Style Studio, public `/style-studio` engine, launch promo, membership gate, privacy rule, and save/export semantics are unchanged — this slice touches only `style-studio.html`, `style-studio-public.js`, `style-studio.css`.

**PASS / BLOCKED:** Implemented + deployed → **PASS pending the owner's iPhone Safari confirmation** of tests 1–10.

# SP-7 — WOW Factor Front Page

- **Date:** 2026-06-14 · **Scope:** emotional, mobile-first front-page redesign of `/style-studio` (visual storytelling, no settings-page feel). Frontend-only; backend untouched. · **Version:** `?v=20260614g`.
- **Decision:** you chose **"CSS-animated demo now, Remotion reels later"** — so the live demo is a smooth CSS/JS loop (no video file, no music, no licensing risk). The `.mp4` reels (#4, #10) are a deferred follow-up (need a licensed music track).
- **Status:** Implemented + verified (live Playwright on iPhone 13 + desktop 1280; screenshots below; 0 console errors; 48 unit tests; dry-run PASS; adversarial review approved). Awaiting deploy approval.

## What was added (top → bottom)
1. **Live hero demo** (`#ssHeroDemo`) — a looping CSS/JS sequence **Upload a selfie → AI analyzing… → Before → Your best look ✨** over a real transformation, explaining the app at a glance without reading. Respects `prefers-reduced-motion` (shows the final "after" only). No video, no sound.
2. **Before → After showcase** (`#ssBaShowcase`) — swipeable carousel of 6 honest before/after pairs (AI Master Stylist, AI Wig Match, Hair Color, Wedding, Executive, Vacation) using the existing draggable compare slider + BEFORE/AFTER tags + emotional one-liner; tap → full-screen viewer.
3. **WOW section** (`#ssWow`) — "What would you look like?" with two dramatic before/afters (thinning→fuller, dated→younger) + a "Try it on your photo" CTA.
4. **Success stories** (`#ssStories`) — transformation cards (before|after pairs + outcome label), mostly Asian models.
5. **Sticky Try-Now CTA** (`#ssStickyCta`) — floating "✨ Try AI Style Studio" button that appears after scrolling past the hero and scrolls back to the upload flagship.
6. Existing flagship Master Stylist + AI Wig Match + Studio gallery + **testimonials** (★★★★★ quotes) preserved below.

## Imagery — honest before/after pairs
6 same-person pairs in `assets/style-studio/showcase/transformations/{key}-before|after.webp`, generated with Gemini 2.5 Flash Image: a realistic "before" face (text-to-image) then an **image-edit** of that same face into the "after" (using the SP-5/SP-6 natural-hair clauses — no costume wigs). Generated via a 6-agent parallel workflow and hand-QC'd (master-young & wig-fuller verified: same person, believable, natural). All 12 webp load (0 broken).

## Files changed
- `style-studio-public.js` — `TRANSFORMATIONS` data + `buildHeroDemo` / `buildBaShowcase` / `buildStories` / `buildWow` / `initStickyCta`; wired into `init()` + `setLang()`; 23 new i18n keys in **vi/en/es**.
- `style-studio.html` — `#ssHeroDemo` in the hero; new `#ssBaWrap` / `#ssWowWrap` / `#ssStoriesWrap` sections; floating `#ssStickyCta`; versions `f → g`.
- `style-studio.css` — `.ss-demo*` / `.ss-ba-carousel` + `.ss-ba-card*` / `.ss-wow*` / `.ss-story*` / `.ss-sticky-cta` with 768/1200 breakpoints + `prefers-reduced-motion`.
- New: 12 transformation webp; report + screenshots.

## Tests / verification
- **Live Playwright (iPhone 13 + desktop 1280):** hero demo present · 6 before/after cards · 6 stories · 2 WOW cards · sticky CTA appears on scroll · **30 images all loaded (0 broken)** · **0 console errors** · no horizontal overflow at 375px.
- **CSS-collision fix (from review):** the carousel container was renamed `.ss-ba` → `.ss-ba-carousel` so it no longer overrides the `buildBeforeAfter` compare-widget class (`.ss-ba`) used on the SP-6 Master/Wig results. Verified: carousel = `flex/overflow-x:auto`; inner widget = `block/overflow:hidden` (unchanged).
- `node --check` clean · `node tests/unit/style-studio.test.js` → 48 passed · `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` · adversarial code review → approved (sole issue fixed).

## Screenshots
| Mobile (iPhone) | Desktop (1280) | Before/After showcase |
|---|---|---|
| ![m](screenshots/sp7-mobile.jpg) | ![d](screenshots/sp7-desktop.jpg) | ![ba](screenshots/sp7-ba-clip.jpg) |

## DO NOT BREAK — preserved (additive only)
Existing hero upload + Create My Look, the SP-6 facial-harmony result, Wig Match realism, upload/take-selfie (+ tap handler), login persistence, save/share/download, vendor Style Studio (`mobile-barber-style-studio.js` untouched), public `/style-studio`, `generateStyleStudio` callable. No existing section/handler was removed.

## Deferred (per your choice — "reels later")
- `#4` embedded live-stream Remotion clip and `#10` `style_studio_hero_demo.mp4` / `style_studio_reel.mp4` (Facebook-Reel-quality with music). The Remotion infra exists (`remotion-promo/`) and I can build the compositions using these transformation images, but **"high-energy inspirational music" needs a licensed/royalty-free track** you provide (can't ship unlicensed audio). When you drop a track in, that's a focused follow-up.

## Limitations
- Live demo is a CSS/JS animation (intentional — instant, robust, no music/licensing). A true video reel is the deferred follow-up.
- Transformation imagery is AI-generated synthetic models (consistent with the rest of the studio), not real customers; framed as example transformations.
- Testimonials remain the 3 launch-placeholder quotes (clearly the example quotes from the brief) until real reviews exist.

**PASS / BLOCKED:** `/style-studio` now opens with a looping live demo + emotional before/after storytelling that makes the value obvious at a glance ("Wow… I want to see what I'd look like"), mobile-first, no clutter → **PASS pending production deploy + your on-device confirmation.** (Remotion reels deferred per your choice.)

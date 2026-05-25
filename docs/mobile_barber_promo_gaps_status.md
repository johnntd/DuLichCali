# Mobile Barber Promo & Booking Logic — Gap Status

Follow-up to the dev-loop patch. Three gaps were called out: canonical data
schema, AI image generation runtime, and Remotion video clips.

## Gap 1 — Canonical data schema (CLOSED)

`mobile-barber/mobile-barber-data.js` `SERVICE_IMAGE_TEMPLATES` now stores
every canonical field at the data layer:

```
id, title, category, displayOrder, imageUrl, clipUrl, imagePrompt,
imageAlt, isAIGenerated, active
```

Categories assigned per style: `classic`, `fade`, `taper`, `beard`, `kids`,
`senior`, `business`, `lineup`, `styling`, `family`. Display order is 1–13.

New `DATA.listStyleTemplates()` helper returns the ordered, active-only list
as a single source of truth. `mobile-barber/mobile-barber.js`
`promoContentItems()` now consumes that list first and only falls back to
synthesising from per-vendor services when the template registry is empty.
New landing-test asserts every canonical field is present in source.

Test count: **347 passed, 0 failed**.

## Gap 2 — AI image generation runtime (DEFERRED, plan below)

Status: Each of the 13 style records still points at a curated Unsplash URL.
They are all distinct images (no repetition) and a `imagePrompt` is stored
for every record, so re-generating them is a one-off offline batch.

Why not done in this pass:
- The banana skill MCP requires either Antigravity OAuth (browser flow,
  needs user) or `GOOGLE_AI_API_KEY` in the environment.
- The Firebase Functions Gemini secret cannot be read into the agent
  transcript (production credential boundary blocks it).

To close this gap (estimated 15–30 min):
1. Either:
   - Set `GOOGLE_AI_API_KEY` locally and run
     `python3 ~/.claude/skills/banana/scripts/generate.py --prompt "..." --aspect-ratio 4:3 --resolution 2K`
     once per `imagePrompt` value, OR
   - Run `/banana` from a session where Antigravity is authenticated.
2. Save each output as `assets/mobile-barber/styles/{styleId}.png`.
3. Replace each `imageUrl: 'https://images.unsplash.com/...'` in
   `SERVICE_IMAGE_TEMPLATES` with `imageUrl: '/assets/mobile-barber/styles/{styleId}.png'`.
4. `bash scripts/ai/targeted_dry_run.sh marketplace` then deploy.

The empty directory `assets/mobile-barber/styles/` is already created.

## Gap 3 — Video / Remotion clips (DEFERRED, plan below)

Status: No Remotion or video-rendering pipeline exists in the repo. The
landing page uses an animated CSS card track (`mb-promo-clips__track`) as
the fallback the dev loop documented. Each style record now has a `clipUrl`
field set to `''` so a future video pipeline can populate it without further
data migration.

Two viable paths to actually ship clips:

**Cheap path — Lottie / SVG animations** (1–2 hours of work):
- Use Lottiefiles for 8–13 generic haircut-themed animations.
- Host as `.lottie` or `.json` under `assets/mobile-barber/lotties/`.
- Add a `lottieUrl` field to the canonical schema OR repurpose `clipUrl`.
- Render with `<lottie-player>` web component.

**Full path — Remotion video pipeline** (1–2 days of work):
- Add `remotion/` package with React-based composition templates.
- Build a Functions-side renderer or local CLI that produces 8–15 s clips
  at 1080×1350 from each style's `imagePrompt`.
- Upload to Firebase Storage; populate `clipUrl` with the public URL.
- The promo clips section in `mobile-barber/mobile-barber.js` will
  auto-render `<video>` elements once `clipUrl` is non-empty.

## What was actually shipped in this pass

- `mobile-barber/mobile-barber-data.js`:
  every `SERVICE_IMAGE_TEMPLATES` entry expanded to full canonical schema +
  `listStyleTemplates()` helper exposed.
- `mobile-barber/mobile-barber.js`:
  `promoContentItems()` reads from canonical templates when available, falls
  back to per-vendor services for legacy compatibility.
- `mobile-barber/{index,vendor,dashboard}.html`:
  `mobile-barber-data.js` version bumped to `?v=20260525a`,
  `mobile-barber.js` bumped to `?v=20260525s`.
- `tests/lib/mobile-barber-landing.js`:
  new test asserts canonical schema fields + `DATA.listStyleTemplates` use.

347/347 tests pass. Targeted booking dry run pending the next deploy.

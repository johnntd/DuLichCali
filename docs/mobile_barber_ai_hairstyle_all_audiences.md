# Mobile Barber — All-Audience AI Hairstyle Generation

**Date:** 2026-05-30
**Scope:** Extend the AI hairstyle preview from men-only (3 hardcoded styles) to **men, women, and children** with **5 face-matched styles** and optional preferences (haircut / hair color / highlights / curly / straight + a vibe), plus full booking + vendor-portal integration.

---

## Summary

The AI hairstyle preview was previously hardcoded to **3 male styles** (Classic Professional / Skin Fade / Buzz Cut) with **no real face analysis** (`analysis: ''`). It now runs a **two-stage, audience-aware AI**:

1. **Stage 1 — Analyze + recommend.** Gemini 2.5 Flash (vision) analyzes the selfie (face shape, jawline, forehead, hair length/texture, current style, age category, masculine/feminine/neutral presentation, and skin tone when color/highlights are requested) honoring the customer's choices, and returns **exactly 5 distinct, audience-correct styles** with all required per-style fields. Customer-facing text is returned in the customer's language; the per-style image-edit prompt is returned in English and is identity-locked.
2. **Stage 2 — Generate 5 previews.** Gemini 2.5 Flash Image (Nano Banana) renders one image-to-image preview **per style from the same selfie**, preserving the same person / face / ethnicity / skin tone / age.

If the vision model is unreachable or returns malformed output, a **deterministic, audience-correct scaffold** pads/replaces the plan so **5 audience-appropriate styles are always offered** — and those previews are **still generated image-to-image from the customer's own selfie** (never a static catalog photo), so women and children **never** get a male-only fallback.

---

## Provider used

| Stage | Model | Endpoint | Notes |
|---|---|---|---|
| Vision analysis + 5-style plan | **Gemini 2.5 Flash** | `models/gemini-2.5-flash:generateContent` (`responseMimeType: application/json`) | Multimodal (selfie + text) → strict JSON. Customer-language text + English identity-locked image prompts. |
| Preview image generation (×5) | **Gemini 2.5 Flash Image (Nano Banana)** | `models/gemini-2.5-flash-image:generateContent` (`responseModalities: ['IMAGE']`) | Image-to-image from the selfie; preserves identity. Run in parallel. |

Single secret: `GEMINI_API_KEY` (already configured). Cost ≈ **$0.20/use** (1 vision call + 5 image edits at ~$0.039 each). Latency ≈ analysis (~3–6 s) then 5 parallel image edits (~8–20 s). Function `timeoutSeconds: 300`, `memory: 1GiB`.

**Non-fallback contract preserved:** if `GEMINI_API_KEY` is missing or **every** image generation fails, the Function returns `{ ok:false, vendorMessage, debugCode }` and the client shows an explicit "AI preview unavailable" notice — no static catalog substitution.

---

## Data model changes

### Function I/O contract (`functions/index.js → generateHaircutPreviews`)

**Input (all new params optional — older cached clients still work):**
```
{ selfieDataUrl, lang:'en'|'vi'|'es',
  audience:'man'|'woman'|'child'|'neutral',         // default 'neutral' (model infers from photo)
  explore:['haircut','color','highlights','curly','straight'],  // default ['haircut']
  preference:'professional'|'trendy'|'low_maintenance'|'natural'|'bold'|'' }
```

**Output (superset of the old shape — old field names retained):**
```
{ ok:true, analysis, audience, explore, preference,
  recommendations:[ {
    styleId, title, styleTitle, targetAudience, explanation, description, whyItFitsFace,
    maintenance, maintenanceLevel, barberNotes, haircutInstructionsForBarber,
    colorRecommendation, highlightRecommendation, curlStraightRecommendation,
    confidence, safetyNotes, previewKind:'your_preview'|'style_inspiration',
    previewDataUrl, error } × 5 ],
  provider, generationTimeMs, successCount }
```
`previewKind` is `style_inspiration` when per-style `confidence < 0.45` (or the image edit failed), so we never over-promise an exact match.

### Booking document (`mobile-barber-data.js` `BOOKING_FIELDS` + `mobile-barber-booking.js` `buildBooking`)

`validateBooking` **rejects unknown top-level fields**, so the 4 new fields were added to `BOOKING_FIELDS` *and* persisted by `buildBooking`:

| New field | Source |
|---|---|
| `selectedAudienceType` | selected style's `targetAudience` (man/woman/child/neutral) |
| `selectedColorRecommendation` | selected style's `colorRecommendation` |
| `selectedHighlightRecommendation` | selected style's `highlightRecommendation` |
| `selectedTexturePreference` | selected style's `curlStraightRecommendation` |

`booking.recommendedStyles[]` was enriched (still no image bytes) with `targetAudience`, `colorRecommendation`, `highlightRecommendation`, `curlStraightRecommendation`, `whyItFitsFace`, `safetyNotes` so the vendor can review all 5 options. All four selected fields default to `''` so bookings without the AI preview (or haircut-only bookings) stay valid. These fields flow through **all three** booking paths: inline "Book this style" card, manual booking form, and the chat/voice agent (`attachAiPreviewToBooking`), via shared helpers `mapRecommendedStyles()` / `aiSelectedStyleFields()`.

---

## UI changes

### Customer landing (`mobile-barber/index.html` + `mobile-barber.js` + `mobile-barber.css`)

Before generating, the customer answers 3 question groups (disabled until AI consent, defaults pre-selected so it's never a required step):

1. **Who is this style for?** — Man / Woman / Child / No preference (radio; default *No preference*).
2. **What do you want to explore?** — Haircut / Hair color / Highlights / Curly style / Straight style (checkboxes; *Haircut* pre-checked).
3. **Style preference** — No preference / Professional / Trendy / Low maintenance / Natural / Bold (radio).

Selections are read into `state.aiPreview.options` and forwarded to the Function. The result cards (5) now display, per style: an **audience chip**, the **why-it-fits** line, and **color / highlights / texture** recommendations (only when present), plus a **"style inspiration"** badge on the thumbnail when `previewKind === 'style_inspiration'`. Styles are rendered by iterating `recommendations` (supports 5, not a fixed 3). Mobile-first chip styling with `@media`-safe defaults; respects existing reduced-motion rules.

### Vendor dashboard (`mobile-barber-dashboard.js → buildAiPreviewSection`)

The barber's booking card now shows the selected style's **audience**, **color**, **highlights**, **texture**, **why-it-fits**, and **safety note** (plus the existing style name / maintenance / description / barber notes / selfie). New values are rendered with a safe text-node builder (label via `<strong>`, AI value via text node — never injecting AI HTML). Legacy bookings fall back to `recommendedStyles[]`.

### Multilingual (vi / en / es)

Every new string was added to all three language tables — customer keys in `mobile-barber.js` (`homeAiPreview*`) and vendor keys in `mobile-barber-dashboard.js` (`vendorAiPreview*`). No hardcoded runtime user-facing strings: the AI returns style text in the customer's language; the deterministic scaffold uses localized vi/en/es lookup tables; prompt instructions contain English teaching text only.

### Cache busting

All changed assets bumped to **`?v=20260530a`** across their HTML consumers: `mobile-barber.js` (index), `mobile-barber-ai-preview.js` / `mobile-barber-booking.js` / `mobile-barber-data.js` / `mobile-barber.css` (index + dashboard + vendor), `mobile-barber-dashboard.js` (dashboard). Unchanged files (`mobile-barber-vendor.js`, `-agent.js`, `-voice.js`) were **not** bumped.

---

## Test results

`node tests/runner.js` → **`ALL TESTS PASSED: 525 passed, 0 failed`** (baseline was 517; +8 new tests A9–A16).
`scripts/ai/full_system_dry_run.sh` → **`FINAL: PASS`** (PASS: 1, FAIL: 0).

New/updated source-pattern + data tests in `tests/lib/mobile-barber-ai-style-booking.js`:

| Test | Covers | Maps to acceptance criteria |
|---|---|---|
| A9 | `BOOKING_FIELDS` includes the 4 all-audience fields | 8 |
| A10 | `validateBooking` accepts the 4 fields populated | 8 |
| A11 | `buildBooking` persists the 4 fields off the draft | 8 |
| A12 | Function plans 5 audience-correct styles; legacy male table removed; man/woman/child/neutral scaffold; identity lock; child safety; color/highlight/texture; `style_inspiration` | 1,2,3,6,7,10 |
| A13 | Landing forwards audience/explore/preference; renders audience/color/highlight/texture + inspiration warning; all 3 booking paths attach fields; **every new customer key present in en+vi+es** | 4,5,6,7,8 |
| A14 | Vendor dashboard reads the 4 fields; **every new vendor key present in en+vi+es** | 9 |
| A15 | Client module forwards audience/explore/preference to the callable | 1–7 |
| A16 | Result cards loop over all recommendations (render 5) + audience chip | 1,2,3 |

### Adversarial review

A 5-dimension multi-agent review (spec coverage, CLAUDE.md compliance, backward-compat, identity/safety, correctness bugs — each finding independently verified by a second agent against the real code) ran against the change. **4 of 5 dimensions returned no confirmed findings.** One confirmed `high` correctness finding: the manual-booking path omitted `aiPreviewSessionId` (present on the inline-card path), which would lose the localStorage handle for the full-res preview. **Fixed** — `aiPreviewSessionId: aiSel.sessionId` added to the manual-form attachments for parity. Gate re-run after the fix: `525 passed, 0 failed`, `FINAL: PASS`.

### Acceptance criteria status

| # | Criterion | Status | How it's met |
|---|---|---|---|
| 1 | Man → 5 male styles | ✅ (code) | `audience:'man'` → analysis prompt restricts to men's styles; man scaffold has 5 |
| 2 | Woman → 5 women styles | ✅ (code) | `audience:'woman'` → women-only; woman scaffold has 5 |
| 3 | Child → 5 kid-appropriate styles | ✅ (code) | `audience:'child'` → kids-only + `CHILD_SAFETY_CLAUSE`; child scaffold has 5 |
| 4 | Woman + highlights → highlight recs | ✅ (code) | `explore` includes `highlights` → `highlightRecommendation` populated + shown + saved |
| 5 | Woman + color → color recs | ✅ (code) | `explore` includes `color` → `colorRecommendation` populated + shown + saved |
| 6 | Curly selected → curly options | ✅ (code) | `explore` includes `curly` → `curlStraightRecommendation` + image styled curly |
| 7 | Straight selected → straight options | ✅ (code) | `explore` includes `straight` → `curlStraightRecommendation` + image styled straight |
| 8 | Selected style saved into booking | ✅ (tested) | A9–A11; 4 new fields + canonical `selectedHaircut*` |
| 9 | Vendor portal shows selected style + notes | ✅ (tested) | A14; `buildAiPreviewSection` renders all fields |
| 10 | No male-only fallback for women/children | ✅ (code) | scaffold is audience-keyed; man/woman/child sets are disjoint; A12 asserts woman+child sets exist and legacy male table removed |

---

## Limitations

- **Criteria 1–7 / 10 are verified at the code/contract level**, not via live Gemini calls. The actual image quality, identity preservation, and per-audience appropriateness depend on Gemini 2.5 Flash + Flash Image runtime behavior and **require a live test with `GEMINI_API_KEY` after the Functions deploy**. The dry-run harness cannot call the live model.
- **Image generation is best-effort:** the customer sees every style whose image succeeded; if some of the 5 image edits fail, fewer than 5 previews render (the client filters to successful images). The 5-style *plan* is always produced.
- **Identity preservation is model-dependent.** The `previewKind: 'style_inspiration'` label + on-thumbnail warning surface low-confidence cases, but the model can still drift; the disclosure copy ("suggestions only — final result may differ") remains.
- **Requires deployment to take effect in production:** the client and Function must both be deployed. Until `firebase deploy --only functions` runs, the live `generateHaircutPreviews` still returns the old 3 male styles; until `firebase deploy --only hosting` runs, the new UI is not live. **Not deployed in this change** (held per local-first policy; needs explicit user confirmation).
- `vendor.html` (SEO/debug surface) was intentionally **not** updated to send the new params or render the new fields; it remains functional and falls back to neutral-audience generation.

---

## Deploy (not yet run — requires confirmation)

```
firebase deploy --only functions:generateHaircutPreviews
firebase deploy --only hosting
# verify: curl -s "https://www.dulichcali21.com/mobile-barber/mobile-barber.js?v=20260530a" | head
```

---

## Verdict

**PASS** — the AI hairstyle feature supports men, women, and children with 5 matched style options, optional color/highlights/curly/straight preferences, and full booking + vendor-portal integration. Existing male generation, mobile/manual/AI booking, and the vendor portal are preserved. Gate: `FINAL: PASS` (525/525 tests). Live image-quality verification is pending a Functions deploy + `GEMINI_API_KEY` runtime test.

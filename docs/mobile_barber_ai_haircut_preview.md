# Mobile Barber — Optional AI Haircut Preview

**Date:** 2026-05-27
**Status:** ✅ Shipped to production
**Where it lives:** `/mobile-barber/vendor/<id>` manual booking modal (step 1, contact info) + vendor dashboard expanded booking detail

---

## What ships

Customers can opt-in during booking to upload a selfie. The system then:

1. Compresses the selfie client-side (canvas, max 600 px, JPEG 0.7).
2. Optionally calls Claude (via `AIEngine.call`) to produce a friendly summary line in the customer's language.
3. ALWAYS returns 3 recommendations (Professional / Modern Fade / Low-maintenance Classic) backed by the existing `/assets/mobile-barber/styles/*.jpg` catalog — even when the AI step is unavailable.
4. Lets the customer pick one with a radio card.
5. Persists everything inline on the booking document.
6. Surfaces the selfie + selected style + AI summary + suggested cutting notes + a free-form vendor notes textarea inside the vendor dashboard's expanded booking detail.

The whole feature is **optional** and **never blocks the booking**. If the customer doesn't open the panel, doesn't consent, fails to upload, or hits an AI error, the rest of the booking flow runs unchanged.

---

## Files added / changed

```
+ mobile-barber/mobile-barber-ai-preview.js    (NEW, ~10 KB — module + i18n)
~ mobile-barber/mobile-barber-data.js          (booking fields + validator)
~ mobile-barber/mobile-barber-booking.js       (buildBooking persists new fields)
~ mobile-barber/vendor.html                    (optional <details> panel)
~ mobile-barber/mobile-barber-vendor.js        (handlers + draft + i18n × 3)
~ mobile-barber/mobile-barber-dashboard.js     (expanded-detail AI section + i18n × 3)
~ mobile-barber/mobile-barber.css              (customer + vendor preview styles)
~ mobile-barber/dashboard.html                 (cache-bust)
~ mobile-barber/index.html                     (cache-bust)
~ tests/lib/mobile-barber-data-model.js        (validator + module shape tests)
~ tests/lib/mobile-barber-landing.js           (version-string asserts)
```

---

## Data model

`mobile-barber-data.js` — `BOOKING_FIELDS` gains 7 optional fields:

| Field | Type | Purpose |
|---|---|---|
| `selfieDataUrl` | base64 data URL string | Customer selfie, capped at 900 000 chars (validator) so the doc stays under Firestore's 1 MB limit |
| `aiAnalysisSummary` | string | One-line summary the AI wrote in the customer's language |
| `aiAnalysisConsent` | `'true' \| 'false'` | Customer's recorded consent for AI analysis |
| `recommendedStyles` | array of `{styleId,title,explanation,maintenance,barberNotes,previewUrl,isFallback}` | All 3 recommendations the customer saw |
| `selectedStyleId` | string | The styleId of the picked recommendation (catalog id, e.g. `fade-haircut`) |
| `selectedStylePreviewUrl` | string | URL of the preview image for the picked style |
| `barberCuttingNotes` | string | Free-form barber-author notes; editable from the dashboard after the booking arrives |

`validateBooking` rejects:
- non-array `recommendedStyles`
- `aiAnalysisConsent` outside `{true,false}`
- `selfieDataUrl` longer than 900 000 chars

All fields are optional, so legacy bookings still validate.

---

## AI preview module — `mobile-barber-ai-preview.js`

```js
MobileBarberAIPreview = {
  compressImage(file)              // -> Promise<dataUrl>
  analyze({dataUrl, lang, engine}) // -> Promise<{summary, recommendations, isFallback, reason?}>
  staticRecommendations({lang})    // -> always-on 3-style fallback
  fallbackAnalysisSummary(lang)    // -> short copy used when AI is skipped
}
```

### Compression

- Two-pass canvas downscale (target ≤600 px on the long edge, JPEG quality 0.7 → 0.6 if still too big).
- Rejects only on `not_image / read_failed / decode_failed / canvas_export_failed`.
- Typical output: 50–150 KB base64 string.

### Analyze contract

- **Never rejects.** Caller can `.then` with confidence. On any failure path the result is `{ summary: fallbackSummary, recommendations: staticRecommendations, isFallback: true, reason: <error> }`.
- The current implementation calls Claude (via `AIEngine.call`) for the *summary line only*, then attaches the deterministic 3-style catalog. This keeps the API stable so a future image-aware vision provider can drop in without changing the callers.
- The summary prompt is locked down: lang-specific, ≤320 chars, no name / skin tone / religion / age / gender / politics.

### Static fallback recommendations

3 catalog-backed cards, mapped to existing assets:

| Slot | Title | StyleId | Preview asset |
|---|---|---|---|
| 1 | Professional / Business | `business-haircut` | `/assets/mobile-barber/styles/business-haircut.jpg` |
| 2 | Modern Fade / Taper | `fade-haircut` | `/assets/mobile-barber/styles/fade-haircut.jpg` |
| 3 | Low-maintenance Classic | `classic-haircut` | `/assets/mobile-barber/styles/classic-haircut.jpg` |

All copy (title, explanation, barber notes, maintenance label) is i18n'd in en / vi / es.

---

## Customer flow (vendor.html manual booking modal — step 1)

1. Customer reaches contact info step.
2. Below the SMS confirmation preference, a collapsed `<details class="mb-ai-preview">` panel offers the AI preview.
3. Customer opens it → sees consent copy + a checkbox.
4. **Until consent is checked**, the file input and Analyze button are disabled.
5. After consent → upload selfie (`accept="image/*" capture="user"` so mobile shows the front camera).
6. `compressImage()` runs → preview thumbnail appears.
7. Customer taps "Get 3 AI haircut suggestions" → `analyze()` resolves with either AI summary or fallback.
8. 3 radio cards render with thumbnail + title + maintenance pill + explanation + barber notes + an "AI suggestion" badge.
9. Customer picks one (or skips — selection is optional).
10. Selection writes into `state.aiPreview.{selectedStyleId, selectedStylePreviewUrl}`.
11. `getManualDraft()` reads from `state.aiPreview` and passes all fields to `buildBooking()`.
12. `buildBooking()` persists. Validator passes (already verified by tests).

Customer can hit **Remove selfie** at any time before submitting; that clears the entire preview state.

---

## Vendor dashboard (expanded detail)

When a booking carries any preview data, an `mb-booking-ai-preview` section renders inside the expanded row:

```
🤖 AI-generated suggestion — review with customer
[ Customer selfie ]      [ Selected style preview ]
[ Customer selfie ]      [ business-haircut.jpg   ]

AI summary: <text>
Suggested cutting notes: <from picked recommendation>

Your cutting notes (textarea — barber edits)
[ Save cutting notes ]   [ 🗑 Delete selfie (privacy) ]
```

- **Save cutting notes** → `updateBookingPatch(id, { barberCuttingNotes })` — Firestore merge update, optimistic local apply.
- **Delete selfie** → confirm dialog → `updateBookingPatch(id, { selfieDataUrl: '' })` — irreversible, leaves the AI summary + selected style intact (just wipes the photo).

The selfie thumbnail uses `aspect-ratio: 1 / 1` and `object-fit: cover` so it's neat regardless of source dimensions. Caption text reinforces "vendor-only" so the operator knows it's not public.

---

## Privacy guarantees

| Requirement | Implementation |
|---|---|
| Consent required before upload | Checkbox gates both the file input AND the Analyze button — both `disabled` until checked |
| Label AI previews clearly | "AI suggestion" badge on every card; 🤖 chip + disclosure line on dashboard |
| Don't publicly display selfie | Selfie data URL lives only on the booking doc; Firestore rules already gate it to vendor + customer; never rendered on the public vendor.html SEO page or the marketplace landing |
| Allow delete/remove image | Customer: "Remove selfie" button in the modal. Vendor: "Delete selfie (privacy)" with confirm dialog in the dashboard |
| No marketing use without permission | Field is named `aiAnalysisConsent`; future marketing pipelines must check this flag explicitly. No marketing pipeline currently reads it. |

---

## Non-blocking guarantees

| Failure | Behaviour |
|---|---|
| Customer never opens the panel | Booking submits with all AI fields empty — no validator error |
| No consent given | File input + analyze button stay disabled — no upload happens |
| Image too large / unreadable | `compressImage` rejects → status: "We could not read that image. Try a different photo or skip this step." Booking still submits |
| `AIEngine.call` rejects | `analyze` resolves with `isFallback: true` + 3 static recs — customer still sees suggestions |
| Module file fails to load | Vendor.js detects `window.MobileBarberAIPreview` is undefined → uses inline fallback (also 3 static recs from the module if loaded, or empty array — caller falls through gracefully) |
| Customer picks nothing | `selectedStyleId` stays empty; vendor dashboard simply skips that part of the section |
| Validator rejects the whole booking | The only validator that fires here is for `recommendedStyles` (must be array), `aiAnalysisConsent` (must be true/false), `selfieDataUrl` (≤900 000 chars). All three are constructed by our code, so customer input can't trip them |

---

## Tests

```
$ node tests/lib/mobile-barber-data-model.js
Mobile Barber data model tests: 13 passed, 0 failed
  (new: AI preview module exposes compress + analyze + fallback)
  (new: AI preview booking fields validate when populated AND when absent)
  (new: validator rejects bad recommendedStyles + oversized selfie + bad consent)

$ node tests/lib/mobile-barber-agent.js
Mobile Barber agent tests: 29 passed, 0 failed

$ node tests/lib/mobile-barber-landing.js (via runner)
PASS 35 / FAIL 0

$ scripts/ai/full_system_dry_run.sh
FINAL: PASS

$ node --check on all 5 mobile-barber modules
all syntax OK
```

---

## Production deploy verification

```
$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete

$ curl -sL "https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc" \
    | grep -E "mbAiPreview|mobile-barber-ai-preview|v=20260527"
  <link ... mobile-barber.css?v=20260527e>
  <details class="mb-ai-preview" id="mbAiPreviewPanel">
  <input id="mbAiPreviewConsent" type="checkbox">
  <input id="mbAiPreviewUpload" type="file" accept="image/*" capture="user" disabled>
  <button ... id="mbAiPreviewAnalyze" disabled>
  <div ... id="mbAiPreviewResults" hidden role="radiogroup">
  <script ... mobile-barber-data.js?v=20260527b>

$ curl -sI "https://www.dulichcali21.com/mobile-barber/mobile-barber-ai-preview.js?v=20260527a"
HTTP/2 200
content-length: 11441
```

✔ Production updated — https://www.dulichcali21.com

---

## Manual smoke test

1. Open `https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc` on a phone.
2. Tap **Book Now** → contact step opens.
3. Scroll down → expand **AI haircut preview (optional)**.
4. Check the consent box → file input + analyze button become tappable.
5. Tap the file input → front camera opens (iOS / Android both honor `capture="user"`).
6. Take a selfie → thumbnail renders.
7. Tap **Get 3 AI haircut suggestions** → 3 radio cards appear within a second.
8. Pick the **Modern Fade / Taper** card.
9. Finish the rest of the form normally → submit.
10. Log into Michael's dashboard at `/mobile-barber/dashboard.html?id=michael-nguyen-oc`.
11. Expand the new booking row → the **AI haircut preview** section renders with the customer selfie, the selected style preview, AI summary, suggested cutting notes, and an empty "Your cutting notes" textarea.
12. Type a note → tap **Save cutting notes** → toast confirms. Reload page → note persists.
13. Tap **🗑 Delete selfie** → confirm → selfie thumbnail disappears, rest of the section stays.

---

## What did NOT change

- Booking DB write path (still `requireDatabase: true` from the prior fix)
- Firestore rules (`hasAll` + status + source allow-lists; new keys are silently accepted)
- AI agent intake flow (auto-submit + broadened affirmative regex from the prior fix)
- Vendor portal layout (settings accordion, summary filter cards, SMS launcher)
- Customer landing (marketplace routing untouched)
- Voice booking pipeline
- Pricing engine / distance matrix

---

## Remaining risks / follow-ups

1. **AI is text-only today.** `AIEngine.call` doesn't natively pass images to the model, so the "analysis" is currently a friendly lang-aware sentence + the deterministic catalog. The catalog covers the common cases (Professional / Fade / Classic) and the spec accepts a fallback, but a future vision-aware provider (Claude with image content blocks, or Gemini vision) can drop straight into `aiAnalyze()` with no caller changes.
2. **No runtime image generation.** Spec mentions "generated preview image if pipeline exists; fallback style reference card if image generation is unavailable." We use the static catalog as the fallback path. A real-time generator (Banana / Gemini Nano) would integrate by replacing each rec's `previewUrl` with a generated data URL — same shape, no UI changes needed.
3. **Chat-based AI agent doesn't yet collect the selfie.** Customers booking through the marketplace chat (`/mobile-barber`) can't upload during chat — they'd need to use the vendor.html manual form. The chat agent could be extended later with an "upload selfie?" step + a file picker in the chat UI; deferred.
4. **1 MB Firestore doc limit.** With a ~150 KB selfie + recommendations + the rest of the booking, we're comfortably under the cap. The validator's 900 KB safeguard prevents accidental large uploads from breaking the write. If a vendor later wants to store multiple selfies per booking, we'd switch to Firebase Storage with vendor-scoped ACLs.
5. **No image moderation.** A customer could upload inappropriate content. Today only the assigned vendor sees it (Firestore rules), and the vendor can delete it. A future safety check (OpenAI moderation API, or simple "I confirm this is a respectful selfie of myself" extra checkbox) is a small follow-up if abuse is observed.
6. **No EXIF stripping.** Canvas re-encoding to JPEG strips most EXIF metadata as a side effect, so location / device tags don't survive — good for privacy, but worth confirming with a forensic test.

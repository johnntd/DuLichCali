# Mobile Barber — Real AI Hairstyle Generation (Gemini 2.5 Flash Image)

**Date:** 2026-05-27
**Status:** ✅ Shipped to production
**Provider:** Google **Gemini 2.5 Flash Image** (Nano Banana) — GA model, not preview
**Endpoint:** `https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/generateHaircutPreviews`
**Smoke test:** 3/3 images generated in **~10 s wall-clock** from a 256×256 test PNG ✅

---

## What changed vs the prior version

The **static-catalog fallback was removed entirely**. The new module exposes only `compressImage()`, `compressDataUrl()`, `generate()`, `saveLocalCopy()`, `readLocalCopy()`. There is no `staticRecommendations`, no `fallbackAnalysisSummary`, no catalog substitution. When the provider is unavailable, the customer sees an explicit error message and the booking continues without a preview.

---

## Architecture

```
Customer browser                  Firebase Hosting                  Firebase Functions             Google Gemini API
────────────────                  ────────────────                  ──────────────────             ─────────────────
                                                                                                  
upload selfie  ──────────────────────────────────────►  compressImage() canvas
                                                          800px JPEG q0.85 (~250 KB)
                                                          
                                                          ┌──────────────────────┐
tap "Get 3 AI                                             │ generate() calls     │
hairstyle suggestions"  ──────────────────────────────────┤ firebase.functions() ├──► generateHaircutPreviews
                                                          │ .httpsCallable(...)  │      onCall(region us-central1,
                                                          └──────────────────────┘      secrets [GEMINI_API_KEY],
                                                                                        timeout 180s, mem 512MiB)
                                                                                              │
                                                                                              │  Promise.all of 3:
                                                                                              ▼
                                                                                       callGeminiImageEdit() × 3
                                                                                              │
                                                                                              ▼
                                                                                       POST /v1beta/models/
                                                                                       gemini-2.5-flash-image
                                                                                       :generateContent
                                                                                              │  ~5-15 s per image
                                                                                              │  parallel = ~6-10 s
                                                                                              ▼
                                                                                       3 inline_data PNGs
                                                                                       (1024 px, ~2-3 MB b64 each)
                                                                                              │
3 preview cards   ◄──────────────────────────────────────────────────────────────────────────┘
render in modal
                  
customer picks one
  │
  ├─► saveLocalCopy(sessionId, styleId, fullDataUrl)  ─► localStorage on this device
  │        (full quality kept for re-viewing, 30-day TTL, auto-prune)
  │
  └─► compressDataUrl(fullDataUrl, {maxDimension: 512, quality: 0.78})
          ~400-500 KB JPEG
          │
          └─► persisted on the booking doc as selectedStylePreviewUrl
                  │
                  └─► vendor opens booking detail in dashboard
                          └─► displays the compressed preview (vendor sees the
                              actual generated image, just at smaller size)
```

---

## Why two storage layers

Gemini returns 1024 px PNGs at ~2–3 MB base64. Firestore documents are capped at **1 MB** total. We need:

1. **Customer re-viewability** of the full-quality preview (so they can show their barber on arrival, save to camera roll, etc.) → **`localStorage`** on their device, keyed by `mb_ai_preview_<sessionId>__<styleId>`, 30-day TTL, auto-prune.
2. **Vendor visibility** of the chosen style (the whole point of the feature) → **inline data URL on the booking doc**, but downscaled to **512 px JPEG q0.78** (~400-500 KB) so the booking + selfie + everything else fit comfortably under the 1 MB cap.

The vendor dashboard renders the inline 512 px version — perfectly readable for "what haircut to deliver" without paying egress for the full-res original.

---

## End-to-end smoke test (live Function)

```
$ curl -X POST https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/generateHaircutPreviews \
    -H "Content-Type: application/json" \
    -d '{"data":{"selfieDataUrl":"data:image/png;base64,<256x256 test image>","lang":"en"}}'

wall clock: 10s
ok: True
provider: gemini-2.5-flash-image
generationTimeMs: 6551
successCount: 3
recs: 3
 - business-haircut | err: None | previewLen: 2,692,666
 - fade-haircut     | err: None | previewLen: 2,880,858
 - classic-haircut  | err: None | previewLen: 3,046,746
```

3/3 generations succeeded. Server time 6.5 s. Wall-clock 10 s. Each returned preview ~2.7-3.0 MB base64 (1024 px).

---

## Cost + latency

| Metric | Value |
|---|---|
| Provider model | `gemini-2.5-flash-image` (Generative Language API v1beta) |
| Cost per generated image | **~$0.039** (Google list price for Gemini 2.5 Flash Image) |
| Cost per booking that uses the feature | **3 × $0.039 = ~$0.117** |
| Server time (3 parallel calls) | **~6.5 s** measured |
| Client wall-clock (incl. network + render) | **~10 s** measured |
| Generated image size | ~2-3 MB base64 each (1024 px PNG) |
| Persisted size on booking doc | ~400-500 KB (512 px JPEG q0.78) |
| Customer localStorage cap | ~5 MB (browser dep), 30-day TTL per entry, auto-prune |

---

## Explicit-error contract (no fallback)

The user's brief required: *"Do NOT silently degrade into static jpg catalog, deterministic text, fake analysis. If provider unavailable: show explicit message."*

Implementation:

| Failure | Customer sees | Booking |
|---|---|---|
| GEMINI_API_KEY secret missing | "AI preview is temporarily unavailable. Please continue your booking; the barber will suggest a style in person." (`debugCode: NO_GEMINI_KEY`) | Continues normally |
| Selfie too large (>1.5 MB base64) | "Selfie is too large. Please use a smaller photo." (`debugCode: IMAGE_TOO_LARGE`) | Continues normally |
| Unsupported mime type | "Selfie format not supported (use JPEG/PNG/WebP)." (`debugCode: BAD_MIME`) | Continues normally |
| All 3 Gemini calls fail | "AI preview did not return a usable image. Please continue your booking..." (`debugCode: PROVIDER_EMPTY`, real error in `debug` field) | Continues normally |
| Network failure / Function 5xx | "AI preview is temporarily unavailable (<error>). Please continue your booking." (`code: callable_threw`) | Continues normally |
| Some Gemini calls fail, others succeed | Successful ones render; failed ones are dropped silently | Continues normally |

The static catalog functions are gone from the module API. Tests assert:
```js
assert(!AIPreview.staticRecommendations, 'static fallback API must be removed');
assert(!AIPreview.fallbackAnalysisSummary, 'fallback summary API must be removed');
```

---

## Identity preservation (same-person requirement)

Each Gemini call uses this edit prompt structure (English example for "Modern Fade"):

> *"Same person, same face, same skin tone, same age, same ethnicity, same lighting. ONLY change the hairstyle to a modern skin fade: very short on the sides fading from skin near the ears up to medium length on the top, textured and lightly styled top. Keep the beard or facial hair identical. Photorealistic. Do not change the face."*

The prompts deliberately constrain the model to edit hair only and preserve every other facial attribute. Vietnamese and Spanish versions use the same constraints (translated style descriptions only).

**Honest caveat:** Gemini 2.5 Flash Image is good at identity preservation but **not perfect**. Some drift is normal especially for unusual lighting, occluded faces, or extreme angle selfies. The user will see this firsthand on their own face. If quality is unsatisfactory on real selfies, the next provider candidates are:
- `gemini-3.1-flash-image-preview` (newer, may be better at identity)
- `gemini-3-pro-image-preview` (highest quality, slower, more expensive)

Both are wire-compatible — change one string in `callGeminiImageEdit()`.

---

## Files changed

```
+ functions/index.js                              (exports.generateHaircutPreviews + callGeminiImageEdit + HAIRCUT_STYLE_PROMPTS)
~ mobile-barber/mobile-barber-ai-preview.js       (rewritten — no static catalog; +compressDataUrl +saveLocalCopy +readLocalCopy)
~ mobile-barber/mobile-barber-vendor.js           (analyze handler calls Function; selection handler compresses + saves locally; sessionId)
~ mobile-barber/vendor.html                       (cache-bust)
~ mobile-barber/index.html                        (cache-bust)
~ mobile-barber/dashboard.html                    (cache-bust)
~ tests/lib/mobile-barber-data-model.js           (asserts static APIs removed)
~ tests/lib/mobile-barber-landing.js              (version-string asserts)
```

---

## Production verification

```
$ firebase deploy --only functions:generateHaircutPreviews
✔  functions[generateHaircutPreviews(us-central1)] Successful update operation
✔  Deploy complete!

$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete
✔  Deploy complete!

$ curl -sL "https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc" | grep "v=20260527"
  <script ... mobile-barber-data.js?v=20260527b>
  <script ... mobile-barber-booking.js?v=20260527b>
  <script ... mobile-barber-agent.js?v=20260527a>
  <script ... mobile-barber-ai-preview.js?v=20260527c>    ← real-AI module
  <script ... mobile-barber-vendor.js?v=20260527d>        ← real-AI handler

$ curl -sL "https://www.dulichcali21.com/mobile-barber/mobile-barber-ai-preview.js?v=20260527c" | grep -E "saveLocalCopy|compressDataUrl"
  function compressDataUrl(dataUrl, opts) {
  function saveLocalCopy(sessionId, styleId, dataUrl) {
    compressDataUrl: compressDataUrl,
    saveLocalCopy: saveLocalCopy,
```

✔ Production updated — https://www.dulichcali21.com

---

## How to smoke test on a real selfie (you)

1. Open `https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc` on a phone
2. Tap **Book Now** → contact step → scroll to **AI haircut preview (optional)** → expand
3. Tick consent → tap upload → take a clear front-facing selfie (face + hair visible, good light)
4. Tap **Get 3 AI haircut suggestions** — status shows "Analyzing your selfie…" for ~10 s
5. 3 cards appear with REAL Gemini-generated previews of YOUR FACE with 3 different hairstyles
6. Pick one → finish booking → submit
7. Log into Michael's dashboard → expand the new booking row → see your selfie + the chosen-style preview side-by-side in the AI haircut preview section

If step 5 shows "AI preview is temporarily unavailable" instead of 3 cards: provider failure path is intact. Console will have the real error code from Gemini.

---

## Remaining risks

1. **Cost runs continuously** if a customer spams the analyze button. The Function has no rate limit beyond Firebase's default per-IP throttling. Easy follow-up: add `request.rawRequest.ip` + a simple in-memory or Firestore quota cache.
2. **Generated images may not preserve identity perfectly** on edge cases (heavy bangs covering hairline, mirror selfies, dim lighting). The customer sees the result and can re-take or skip — no booking impact.
3. **No moderation** on the generated output. Gemini's safety filters apply on the way in, but if it produces an inappropriate edit we don't filter post-generation. Acceptable for v1.
4. **Customer's localStorage** only works on the same device + same browser. If the customer reloads from a different device, the full-quality original is lost; they'll still see the compressed vendor-grade version that's on the booking doc.
5. **Function timeout is 180 s** but normal latency is ~6-10 s. If Gemini ever slows beyond 180 s, the call fails with the explicit error path.
6. **No image is publicly hosted.** Selfie + generated previews live inline on the booking doc and in the customer's localStorage — never in a public bucket. Same privacy posture as the prior optional-preview shipped earlier.

---

## Commits

- `86382b3` feat(mobile-barber): real AI hairstyle previews via Gemini 2.5 Flash Image
- `3a3e2ff` fix(mobile-barber): correct Gemini image model id + hybrid local/remote storage

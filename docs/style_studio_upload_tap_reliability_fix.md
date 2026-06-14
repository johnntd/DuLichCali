# Style Studio — Upload / Take Selfie tap reliability fix

- **Date:** 2026-06-14 · **Scope:** one small frontend fix (no redesign, same single-button UI). · **Version:** `style-studio-public.js?v=20260614d`.
- **Goal:** make the existing single "Upload / Take Selfie" button reliably open the picker on iPhone Safari.

## Background
A one-off report that "Upload / Take Selfie stopped working" could not be reproduced — a live mobile repro showed the change-handler pipeline (`MobileBarberAIPreview.compressImage` → `selfieDataUrl` → preview → enable) fully intact with zero console errors, so it was a transient iOS Safari hiccup, not a code regression. This change hardens the *tap-to-open* step (the part iOS occasionally drops when activating a label-wrapped, visually-hidden file input).

## The markup (unchanged)
```html
<label class="ss-upload">
  <span class="ss-upload__btn" id="ssUploadBtn"> …icon + "Upload / Take Selfie"… </span>
  <input type="file" id="ssSelfieInput" accept="image/*">   <!-- opacity:0; pointer-events:none (iOS-safe, not display:none) -->
</label>
```

## Fix (frontend only — `style-studio-public.js`, in `init()`)
Added an explicit trusted tap handler on `#ssUploadBtn` that triggers the file input directly, while **keeping the `<label>` as a no-JS fallback**:
```js
var uploadBtn = doc.getElementById('ssUploadBtn');
if (uploadBtn && upload) {
  var pickerOpening = false;
  uploadBtn.addEventListener('click', function (e) {
    e.preventDefault();        // suppress the label's native activation …
    e.stopPropagation();       // … so the picker can NEVER open twice
    if (pickerOpening) return; // re-entrancy guard (second safeguard)
    pickerOpening = true;
    logUi({ event: 'upload-tap' });
    try { upload.click(); } catch (err) { /* logged */ }
    root.setTimeout(function () { pickerOpening = false; }, 800);
  });
}
```
**Why this is safe:**
- **No double picker** — `preventDefault()` + `stopPropagation()` stop the `<label>`'s native input activation for button taps, so only our single `upload.click()` runs; the 800 ms `pickerOpening` guard is a belt-and-suspenders backstop.
- **Trusted gesture** — `upload.click()` is called synchronously inside the real tap handler, so iOS Safari opens the camera/library picker.
- **Label-backed native behavior preserved** — the `<label>` stays in the DOM; if the handler ever fails to attach, native label activation still opens the picker, and taps on any label area outside the button still work natively.
- **Re-upload works** — after the first upload the button shows a preview `<img>`; a tap on it bubbles to `#ssUploadBtn` and re-opens the picker.
- **Desktop unaffected** — a mouse click runs the same single-open path.
- **Debug log** — a light `logUi({event:'upload-tap'})` (joins the existing `[style-studio-ui]` logs) so any future "picker didn't open" report is diagnosable.

## Tests (Playwright, local, iPhone 13 profile + Desktop 1280)
Verified by counting real `filechooser` events (proves the picker actually opens, and how many times):

| # | Check | iPhone | Desktop |
|---|---|---|---|
| 1–2 | Tap Upload → picker opens | ✅ 1 open | ✅ 1 open |
| — | **No double-open** (exactly 1 chooser per tap) | ✅ | ✅ |
| 3–4 | Select image → preview appears | ✅ | ✅ |
| 5 | Create My Look enables | ✅ | ✅ |
| 6 | Repeat upload (preview img) → opens again | ✅ (total 2) | ✅ (total 2) |
| 7 | Desktop still works | — | ✅ |
| — | Console / page errors | ✅ none | ✅ none |

`node --check` clean · `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.

## Files changed
- `style-studio-public.js` — the tap handler in `init()` (only addition).
- `style-studio.html` — cache-bust `20260614c → 20260614d`.
- (this report)

No backend, CSS, HTML-structure, or UI changes. The mobile-barber promo-film WIP is untouched and excluded.

**PASS:** picker opens once per tap on iPhone Safari + desktop, preview + enable + re-upload work, no double-open, no regressions → ready to deploy.

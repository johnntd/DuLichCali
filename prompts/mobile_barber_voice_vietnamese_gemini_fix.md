# Patch Prompt — Mobile Barber Vietnamese Voice (Gemini-first + Stronger Language Detection)

## Problem
The Mobile Barber AI voice agent speaks poor Vietnamese because:

1. **TTS provider order is wrong for Vietnamese.** `mobile-barber/mobile-barber-voice.js` `speakReply()` always tries OpenAI TTS first, then Gemini, then the browser. Vietnamese sounds best on Gemini TTS, but Gemini is only reached when OpenAI fails.
2. **Provider keys never reach the voice controller.** `mobile-barber/mobile-barber-vendor.js` `openVoiceAssistant()` calls `MobileBarberVoice.open(...)` without passing any `openAiKey`, `geminiKey`, `platformGeminiKey`, `firestoreGeminiKey`, etc. The voice controller can only read `localStorage.dlc_gemini_key`, which real customers never have set.
3. **Language detection is weak.** `mobile-barber/vendor.html` does not load `ai-engine.js`, so `MobileBarberAgent` and the voice overlay rely on a diacritic-only fallback detector that misses unaccented Vietnamese (e.g. `toi muon cat toc ngay mai`).
4. **Selected language is not propagated through deep links.** `vendorUrl(service, mode)` in `mobile-barber/mobile-barber.js` does not include the customer’s currently selected language. The vendor page only reads `localStorage` for language, so a customer who clicks a service card while VI is selected loads the vendor page and may briefly render in EN before localStorage resolves.

Full read-only audit: `docs/mobile_barber_voice_vietnamese_gemini_audit.md` — read it before implementing.

This prompt implements **Option A (Minimal Routing Fix) + Option C (UI Language Propagation)** from the audit. Option B (shared voice provider selector) is intentionally out of scope.

---

## Objective

Make the Mobile Barber voice agent speak Vietnamese well by:

1. Routing Vietnamese TTS to Gemini first, with OpenAI as fallback and browser TTS as last resort.
2. Reading platform and per-vendor Gemini/OpenAI keys from Firestore and passing them through `MobileBarberVoice.open(...)`.
3. Loading `ai-engine.js` on the Mobile Barber vendor page so `AIEngine.detectLang()` handles unaccented Vietnamese.
4. Threading the currently selected language through `vendorUrl()` and the vendor page boot path.

English and Spanish keep their current TTS order (OpenAI first, Gemini second, browser third) unless Gemini key is the only key available.

Do **not** touch nail salon code. Lily must keep behaving exactly as today.

---

## Allowed files
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-agent.js
- tests/lib/mobile-barber-data-model.js
- docs/mobile_barber_voice_vietnamese_gemini_fix_report.md

---

## Strict Rules

1. **Do NOT modify any file in `nailsalon/`, `hairsalon/`, `marketplace/`, `functions/`, `firestore.rules`, `ai-engine.js`, `script.js`, `style.css`, or `notifications.js`.** Nail salon Vietnamese voice behavior must be byte-identical after this patch.
2. **Preserve fallback behavior:**
   - Vietnamese: Gemini → OpenAI → browser TTS.
   - English: OpenAI → Gemini → browser TTS (unchanged).
   - Spanish: OpenAI → Gemini → browser TTS (unchanged).
   - Whenever a preferred provider has no key or errors, the next must run. Browser TTS is the final guarantee.
3. **No hardcoded user-facing strings in any language.** Reuse existing i18n keys; add new keys in `en + vi + es` together if needed.
4. **No new Cloud Functions or new Firestore collections.** Reuse existing `config/platform` and `mobileBarberVendors/{id}` documents. The voice controller reads them client-side, same pattern as `nailsalon/receptionist.js:2991-3017`.
5. **No new external dependencies, libraries, or build steps.**
6. **Cache-bust all changed JS in all HTML consumers.** Use `?v=YYYYMMDD<letter>` higher than current `20260524f`.
7. **No security regressions.** Do not expose provider keys in `localStorage` writes for new users; only read existing keys the way nail salon already does.
8. **Mobile-first preserved.** No layout regressions on iPhone width (375 px) or Android width.
9. **Additive validation only.** If you add fields to `VENDOR_FIELDS`, the new fields must be optional; existing seed data must keep validating.

---

## Required Changes

### A1 — Vietnamese-first Gemini TTS routing
In `mobile-barber/mobile-barber-voice.js`:

- Update `speakReply()` so the provider order depends on language:
  - When the effective language is `vi`:
    1. Try `_speakViaGemini()` first.
    2. If Gemini has no key or fails, try `_speakViaOpenAi()`.
    3. If OpenAI also fails, fall back to browser `speechSynthesis`.
  - When the effective language is `en` or `es`: keep the current order (OpenAI → Gemini → browser).
- Effective language is determined by the existing `getLang()` controller hook plus the existing transcript-based language switch in the overlay. Do not introduce a separate hardcoded check.
- Preserve every existing return shape, callback, and error-logging path. If you need to log routing decisions, gate them behind the existing debug flag pattern in the file.

### A2 — Thread provider keys into the voice controller
In `mobile-barber/mobile-barber-vendor.js`:

- In `openVoiceAssistant()` (or its caller setup), read provider key fields from Firestore the same way nail salon does:
  - `mobileBarberVendors/{vendor.id}.geminiKey`
  - `mobileBarberVendors/{vendor.id}.openaiKey`
  - `config/platform.geminiKey`
  - `config/platform.openaiKey`
- Pass them into `MobileBarberVoice.open({ ..., geminiKey, openaiKey, platformGeminiKey, platformOpenAiKey, firestoreGeminiKey, firestoreOpenAiKey, vendorGeminiKey, vendorOpenAiKey })` using the same field names `MobileBarberVoice.getGeminiKey()` / `getOpenAiKey()` already accept (inspect the file before renaming anything).
- Keys are read lazily, after the vendor page has already loaded; do not block initial render.
- If Firebase or Firestore is unavailable (no `firebase` global, no project init), fail silent and let the controller fall back to `localStorage` as today.

In `mobile-barber/mobile-barber-data.js`:

- Extend `VENDOR_FIELDS` to allow optional `geminiKey` and `openaiKey` fields (do not seed them on Daniel/Michael/Tim — the fields must just be permitted by the validator).
- Do not add a new `mobileBarberPlatformConfig` collection; reuse `config/platform`.

### C1 — Load `ai-engine.js` on the Mobile Barber vendor page
In `mobile-barber/vendor.html`:

- Add a `<script src="/ai-engine.js?v=…">` tag **above** the existing mobile-barber script tags so `window.AIEngine` is available before `mobile-barber-agent.js`, `mobile-barber-voice.js`, and `mobile-barber-vendor.js` initialize.
- Do not bump `ai-engine.js` itself; use the highest currently deployed version string (`grep -rn "ai-engine.js?v=" --include="*.html"` to find it).

In `mobile-barber/mobile-barber-agent.js`:

- `buildPrompt()` / `mergeState()` already optionally consume `AIEngine.detectLang`. Verify the call site uses it when present and only falls back to the diacritic detector otherwise. No new detector needed if the existing pattern already does this.

### C2 — Propagate selected language through deep links
In `mobile-barber/mobile-barber.js`:

- `vendorUrl(service, mode)` must include `lang=<state.lang>` whenever `state.lang` is set. The order of params should be deterministic: `serviceId`, optional `assistant`, optional `lang`.

In `mobile-barber/mobile-barber-vendor.js`:

- `getLang()` already reads `?lang=` first; verify it accepts only `en`, `vi`, `es` (silently ignore other values) and falls through to localStorage otherwise. If the existing logic does not enforce the allowlist, tighten it. Do not change the rest of the language resolution chain.

### Cache-bust
Bump these JS files together because they are all changing:

- `mobile-barber/mobile-barber.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber-voice.js`
- `mobile-barber/mobile-barber-agent.js`
- `mobile-barber/mobile-barber-data.js`

Use the next version string after the current `20260524f` floor. Update every HTML consumer (`index.html`, `vendor.html`, `dashboard.html`) and update the test assertions in `tests/lib/mobile-barber-landing.js` accordingly. Do not bump `ai-engine.js` itself.

---

## Tests to add

### `tests/lib/mobile-barber-landing.js`

Add static assertions:

- `mobile-barber/vendor.html` loads `ai-engine.js?v=` somewhere above `mobile-barber-agent.js`.
- `mobile-barber/mobile-barber.js` contains the substring `params.set('lang'` (proves language is propagated through deep links).
- `mobile-barber/mobile-barber-voice.js` contains the substring `lang === 'vi'` (or equivalent) in `speakReply` so the Vietnamese-first Gemini path is statically present.
- `mobile-barber/mobile-barber-vendor.js` contains `MobileBarberVoice.open(` with at least one of `geminiKey:` or `platformGeminiKey:` near the call.
- Cache-bust assertions updated to the new version string for all bumped files.

### `tests/lib/mobile-barber-data-model.js`

Add:

- A test asserting `geminiKey` and `openaiKey` are accepted as optional fields on `mobileBarberVendors` records (e.g. validating a synthetic vendor that has those fields returns `{ valid: true }`).

### `tests/lib/mobile-barber-agent.js`

If the file already covers language detection, add (or extend) a test:

- An unaccented Vietnamese sentence (`toi muon cat toc ngay mai`) must resolve to `vi` when `AIEngine.detectLang` is available globally; the test can mock `global.AIEngine = { detectLang: function(t){ return ... } }`.

All existing tests must keep passing.

---

## Verification

After implementation:

1. Run `bash scripts/ai/full_system_dry_run.sh` — must end `FINAL: PASS`.
2. Run `bash scripts/ai/targeted_dry_run.sh ai-receptionist` — must end `FINAL: PASS` (nail salon path untouched).
3. Run `bash scripts/ai/targeted_dry_run.sh marketplace` — must end `FINAL: PASS`.
4. Run `node tests/lib/mobile-barber-agent.js` — must report 0 failed.

Manual verification (record results in the report):

1. **Mobile Barber Vietnamese voice** with `?lang=vi`: STT uses `vi-VN`; with a Gemini key configured, `speakReply` calls Gemini before OpenAI; without a Gemini key, OpenAI still speaks.
2. **Mobile Barber English voice**: OpenAI tried first, then Gemini, then browser. No regression.
3. **Mobile Barber Spanish voice**: same OpenAI-first order. No regression.
4. **Nail salon Vietnamese voice**: byte-identical behavior to before this patch (the file is not modified).
5. **Browser fallback** when both provider keys absent: page speaks via `speechSynthesis`, no console errors.
6. **Deep link**: `/mobile-barber/vendor/michael-nguyen-oc?serviceId=…&assistant=voice&lang=vi` opens the voice overlay in Vietnamese without flashing English.
7. **Unaccented Vietnamese**: typing `toi muon cat toc ngay mai` into the agent input switches the session to `vi`.

---

## Required Output Report

Create `docs/mobile_barber_voice_vietnamese_gemini_fix_report.md` with:

1. Files changed (full list)
2. Summary of routing change in `speakReply()`
3. Summary of key propagation change in `openVoiceAssistant()` + new validator fields
4. Summary of language propagation change in `vendorUrl()` + `getLang()`
5. New tests added
6. All dry runs run + their final status
7. Manual verification matrix (10 rows: 3 languages × 3 voice paths + the nail-salon no-regression check)
8. Risks
9. Remaining follow-ups (e.g. Option B — shared selector — explicitly deferred)
10. PASS / BLOCKED

---

## PASS Criteria

PASS only if all of the following are true:

- All listed allowed files (or a subset) are the only files modified. No files in `nailsalon/`, `hairsalon/`, `marketplace/`, `ai-engine.js`, or `functions/` are changed.
- `speakReply()` routes Vietnamese to Gemini first.
- `openVoiceAssistant()` passes platform + vendor provider keys into `MobileBarberVoice.open(...)`.
- `mobile-barber/vendor.html` loads `ai-engine.js`.
- `vendorUrl()` includes `lang=...` when language is set.
- All dry runs end `FINAL: PASS` and at least 312 tests still pass.
- The report `docs/mobile_barber_voice_vietnamese_gemini_fix_report.md` exists and ends with PASS.

If any of the above is not achievable safely, stop and write the report with BLOCKED + a precise explanation of what is missing (e.g. runtime keys, Firestore access, ambiguity about whether nail salon should also change).

# Mobile Barber Vietnamese Voice Gemini Fix Report

Prompt used: `prompts/mobile_barber_voice_vietnamese_gemini_fix.md`
Date: 2026-05-24
Status: BLOCKED

## 1. Files Changed

- `mobile-barber/mobile-barber-voice.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/mobile-barber.js`
- `mobile-barber/mobile-barber-agent.js`
- `mobile-barber/mobile-barber-data.js`
- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `mobile-barber/dashboard.html`
- `tests/lib/mobile-barber-landing.js`
- `tests/lib/mobile-barber-agent.js`
- `tests/lib/mobile-barber-data-model.js`
- `docs/mobile_barber_voice_vietnamese_gemini_fix_report.md`

No files in `nailsalon/`, `hairsalon/`, `marketplace/`, `functions/`, `firestore.rules`, `ai-engine.js`, `script.js`, `style.css`, or `notifications.js` were modified.

## 2. `speakReply()` Routing Change

`mobile-barber/mobile-barber-voice.js` now routes by the effective `lang` value used by the voice overlay:

- Vietnamese (`lang === 'vi'`): Gemini TTS first, OpenAI TTS fallback, browser `speechSynthesis` final fallback.
- English and Spanish: OpenAI TTS first, Gemini TTS fallback, browser `speechSynthesis` final fallback.

The existing callback style and final browser fallback were preserved.

## 3. Provider Key Propagation

`mobile-barber/mobile-barber-vendor.js` now lazily reads voice provider keys from:

- `mobileBarberVendors/{vendor.id}.geminiKey`
- `mobileBarberVendors/{vendor.id}.openaiKey`
- `config/platform.geminiKey`
- `config/platform.openaiKey`

The values are passed into `MobileBarberVoice.open(...)` as `geminiKey`, `openAiKey`, `platformGeminiKey`, `platformOpenAiKey`, `firestoreGeminiKey`, `firestoreOpenAiKey`, `vendorGeminiKey`, and `vendorOpenAiKey`. If Firebase/Firestore is unavailable, the loader resolves silently and the voice module keeps its existing localStorage fallback.

`mobile-barber/mobile-barber-data.js` now allows optional `geminiKey` and `openaiKey` fields in `VENDOR_FIELDS`; seed vendors were not given provider keys.

## 4. Language Propagation

`mobile-barber/mobile-barber.js` now appends `lang=<state.lang>` to vendor deep links after `serviceId` and optional `assistant`.

`mobile-barber/mobile-barber-vendor.js` already read `?lang=` before localStorage and only accepted keys present in `STRINGS` (`en`, `vi`, `es`); that allowlist behavior was preserved.

`mobile-barber/vendor.html` now loads `/ai-engine.js?v=20260523a` before Mobile Barber data, booking, agent, voice, and vendor scripts. `ai-engine.js` itself was not modified or cache-busted.

## 5. New Tests Added

- Static landing assertions for `ai-engine.js` load order before `mobile-barber-agent.js`.
- Static landing assertion that `vendorUrl()` includes `params.set('lang'`.
- Static landing assertion that `speakReply()` includes a Vietnamese-specific `lang === 'vi'` path.
- Static landing assertion that `MobileBarberVoice.open(...)` receives provider key fields.
- Cache-bust assertions updated to `v=20260524g` for changed Mobile Barber JS consumers.
- Data model test proving optional `geminiKey` and `openaiKey` validate on a synthetic vendor.
- Agent test proving unaccented Vietnamese (`toi muon cat toc ngay mai`) resolves to `vi` when `AIEngine.detectLang` is available globally.

## 6. Dry Runs And Commands

Pre-patch:

- `bash scripts/ai/targeted_dry_run.sh marketplace` — `FINAL: PASS`

Post-patch:

- `node --check mobile-barber/mobile-barber-voice.js && node --check mobile-barber/mobile-barber-vendor.js && node --check mobile-barber/mobile-barber.js && node --check mobile-barber/mobile-barber-agent.js && node --check mobile-barber/mobile-barber-data.js` — PASS
- `node tests/lib/mobile-barber-agent.js` — `10 passed, 0 failed`
- `node tests/lib/mobile-barber-data-model.js` — `10 passed, 0 failed`
- Mobile Barber landing static test harness — `24 passed, 0 failed`
- `bash scripts/ai/full_system_dry_run.sh` — `FINAL: PASS`, `314 passed, 0 failed`
- `bash scripts/ai/targeted_dry_run.sh ai-receptionist` — `FINAL: FAIL`
- `bash scripts/ai/targeted_dry_run.sh marketplace` — `FINAL: PASS`
- `node tests/lib/mobile-barber-agent.js` — `10 passed, 0 failed`

Blocking failure:

- `targeted_dry_run.sh ai-receptionist` failed only at `Syntax stability -- receptionist.js parses without syntax error`.
- This patch did not modify `nailsalon/receptionist.js`; full dry run reported `RX-030: receptionist.js parses without syntax errors` as passing.
- Because the required targeted dry run ended `FINAL: FAIL`, this task cannot be marked complete.

## 7. Manual Verification Matrix

Live browser/provider-key verification was not completed after the `ai-receptionist` targeted dry run returned `FINAL: FAIL`. Static/source verification results:

| Case | Expected Path | Result |
|---|---|---|
| Vietnamese + Gemini key | Gemini first | Static PASS: `lang === 'vi'` calls `_speakViaGemini()` before OpenAI |
| Vietnamese + no Gemini key + OpenAI key | OpenAI fallback | Static PASS: Gemini false path calls `_speakViaOpenAi()` |
| Vietnamese + no provider keys | Browser fallback | Static PASS: OpenAI false path calls `speakViaBrowser()` |
| English + OpenAI key | OpenAI first | Static PASS: non-`vi` path remains OpenAI first |
| English + no OpenAI key + Gemini key | Gemini fallback | Static PASS: OpenAI false path calls Gemini |
| English + no provider keys | Browser fallback | Static PASS: Gemini false path calls browser TTS |
| Spanish + OpenAI key | OpenAI first | Static PASS: non-`vi` path remains OpenAI first |
| Spanish + no OpenAI key + Gemini key | Gemini fallback | Static PASS: OpenAI false path calls Gemini |
| Spanish + no provider keys | Browser fallback | Static PASS: Gemini false path calls browser TTS |
| Nail salon Vietnamese voice | Byte-identical behavior | Source PASS: no `nailsalon/` files modified; targeted dry run BLOCKED by existing syntax-stability check result |

## 8. Risks

- Provider keys are still used client-side, matching the existing nail salon pattern, so browser exposure risk remains unchanged but expanded to Mobile Barber.
- The lazy Firestore read may complete after the first welcome utterance if a user opens voice immediately; later replies receive the loaded keys through the shared controller object.
- Real Gemini/OpenAI audio quality and browser STT behavior were not live-tested because validation stopped at the required `ai-receptionist` failure.
- The `ai-receptionist` targeted dry run reports a syntax failure in an untouched file while the full dry run reports the same syntax check passing; this inconsistency needs separate investigation.

## 9. Remaining Follow-Ups

- Investigate why `scripts/ai/targeted_dry_run.sh ai-receptionist` reports `receptionist.js parses without syntax error` as failing while `scripts/ai/full_system_dry_run.sh` passes the RX-030 syntax stability check.
- Perform live browser voice checks with configured Gemini/OpenAI keys after the targeted dry run is clean.
- Option B, a shared voice provider selector across verticals, remains intentionally deferred.

## 10. Final Status

BLOCKED

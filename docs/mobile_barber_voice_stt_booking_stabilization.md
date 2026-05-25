# Mobile Barber Voice, STT, Booking Stabilization

Date: 2026-05-25

## Scope

Target: `/mobile-barber`

Prompt used: `prompts/mobile_barber_voice_stt_booking_stabilization.md`

Files changed:

- `mobile-barber/mobile-barber-voice.js`
- `mobile-barber/mobile-barber-agent.js`
- `mobile-barber/mobile-barber.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `tests/lib/mobile-barber-agent.js`
- `tests/lib/mobile-barber-landing.js`
- `docs/mobile_barber_voice_stt_booking_stabilization.md`

## Root Cause: Voice Switching

Mobile barber TTS selected the output provider on every reply:

- Vietnamese attempted Gemini first.
- If Gemini failed for a turn, that reply fell through to OpenAI or browser TTS.
- English and Spanish attempted OpenAI first, then Gemini, then browser TTS.
- Browser TTS also re-selected voices from `speechSynthesis.getVoices()` per turn.

That meant one conversation could audibly move between Gemini, OpenAI, and browser voices. For Vietnamese, that surfaced as accent switching.

Nail salon comparison:

- `nailsalon/voice-mode.js` uses Web Speech API for STT.
- TTS is stable: OpenAI `nova` primary, Gemini `Aoede` fallback.
- Gemini voice selection is hardcoded, not pulled from Firestore.

## Voice Fix

`mobile-barber/mobile-barber-voice.js` now creates a voice session at conversation open:

```js
voiceSession = {
  sessionId,
  provider,
  model,
  voice,
  accent,
  language
}
```

It logs:

- `[voice-session]` with `sessionId`, `language`, `provider`, `model`, `voice`, `accent`, `vendorId`
- `[tts-turn]` with `sessionId`, `turn`, `provider`, `voice`, `accent`

Locked defaults:

- Vietnamese: Gemini `gemini-2.5-flash-preview-tts`, voice `Aoede`, accent marker `vi-stable`
- English: OpenAI `tts-1`, voice `nova`, accent marker `en-us`
- Spanish: OpenAI `tts-1`, voice `nova`, accent marker `es-us`

Fallback is only allowed before the first successful audible turn. After a session is underway, turns reuse the locked provider/voice/accent.

Iteration 2 follow-up:

- Replaced the fragile `voiceTurn > 1` fallback guard with `voiceHadSuccessfulAudio`, so first-turn async fallback can still lock the session even if another turn starts before the failed provider callback returns.
- Mark successful browser, OpenAI, and Gemini audio completion before blocking further provider mutation.
- Clear `voiceSession`, `voiceTurn`, and `voiceHadSuccessfulAudio` when the voice overlay closes so the next overlay session can select language normally.

## STT Comparison And Fix

Nail salon uses browser `SpeechRecognition` and the shared phone parser in `nailsalon/phone-intake.js`.

Mobile barber already loaded `nailsalon/phone-intake.js` on the landing page and passes `PhoneIntake` into the agent context. The agent now also has a built-in spoken phone parser so tests and vendor contexts are not dependent on the helper being present.

Phone parser now supports:

- `4085043684`
- `408-504-3684`
- `four zero eight five zero four three six eight four`
- `four oh eight ...`
- Vietnamese digit words such as `bốn không tám năm không bốn ba sáu tám bốn`

Low-confidence voice capture now uses conversational repair:

- Phone: asks for digit-by-digit retry.
- Address: asks for city first and street spelling, or confirms partial street/city if something useful was heard.

Address parser now extracts:

- street
- city
- ZIP
- partial address

It also strips date/time fragments before street matching so booking sentences like `2026-06-01 at 10:00 at 123 Brookhurst St` parse the address as `123 Brookhurst St`.

Iteration 2 follow-up:

- Tightened the preposition cleanup so it only strips `at` / `lúc` / `luc` / `a las` before known time phrases, avoiding accidental cleanup of valid address wording such as `apartment at 456 Oak Ave`.
- Documented the low-confidence repair threshold in `mobile-barber/mobile-barber-voice.js`.

## Booking Verification

Code-level booking verification passed:

- Manual booking validation tests pass.
- AI voice/chat booking state machine tests pass.
- `MobileBarberBooking.saveBooking` still writes to `MobileBarberData.COLLECTIONS.bookings`, which is `mobileBarberBookings`.
- Dashboard reads from the same `DATA.COLLECTIONS.bookings` collection.

Live Firestore write verification was not performed. The repository safety override says not to write production Firestore during validation/dry runs, and this session has restricted network/tooling. Therefore no real `mobileBarberBookings` document was created from this run.

## Commands Run

```bash
node --check mobile-barber/mobile-barber-agent.js
node --check mobile-barber/mobile-barber-voice.js
node --check mobile-barber/mobile-barber.js
node --check mobile-barber/mobile-barber-vendor.js
node tests/lib/mobile-barber-agent.js
node tests/lib/mobile-barber-booking.js
node tests/runner.js
bash scripts/ai/targeted_dry_run.sh booking
bash scripts/ai/full_system_dry_run.sh
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_voice_stt_booking_stabilization.md --max-loops 3 --allow-dirty --timeout 2400
node tests/lib/mobile-barber-landing.js
```

## Results

- `node tests/lib/mobile-barber-agent.js`: PASS, 28 passed
- `node tests/lib/mobile-barber-landing.js`: PASS
- `node tests/lib/mobile-barber-booking.js`: PASS, 21 passed
- `node tests/runner.js`: PASS, 337 passed
- `bash scripts/ai/targeted_dry_run.sh booking`: `FINAL: PASS`
- `bash scripts/ai/full_system_dry_run.sh`: `FINAL: PASS`
- requested `ai_dev_loop`: `FINAL: FAIL`

Iteration 2 validation:

- `node --check mobile-barber/mobile-barber-agent.js`: PASS
- `node --check mobile-barber/mobile-barber-voice.js`: PASS
- `node tests/lib/mobile-barber-agent.js`: PASS, 28 passed
- `node tests/lib/mobile-barber-landing.js`: PASS
- `node tests/runner.js`: PASS, 337 passed
- `bash scripts/ai/targeted_dry_run.sh booking`: `FINAL: PASS`
- `bash scripts/ai/full_system_dry_run.sh`: `FINAL: PASS`
- `bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_voice_stt_booking_stabilization.md --max-loops 3 --allow-dirty --timeout 2400`: `FINAL: FAIL`

`ai_dev_loop` failed before implementation/testing because nested `codex exec` could not access `/Users/johntd/.codex/sessions` in this sandbox:

```text
Fatal error: Codex cannot access session files at /Users/johntd/.codex/sessions (permission denied)
```

## PASS/BLOCKED

Status: BLOCKED

Code-level stabilization is implemented and dry-run validation passes, but final PASS is blocked by:

- requested `ai_dev_loop` command ending `FINAL: FAIL`
- no real production Firestore write performed
- no real device STT/TTS runtime session recorded

Next command:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_voice_stt_booking_stabilization.md --audit-only --allow-dirty --timeout 2400
```

## Iteration 3 Claude Follow-Up

Files changed:

- `mobile-barber/mobile-barber-voice.js`
- `mobile-barber/mobile-barber.js`
- `mobile-barber/mobile-barber-vendor.js`
- `mobile-barber/index.html`
- `mobile-barber/vendor.html`
- `tests/lib/mobile-barber-landing.js`
- `docs/mobile_barber_voice_stt_booking_stabilization.md`

Fixes applied:

- Moved mobile barber voice session creation until after the voice overlay is opened, so rapid language correction before the first TTS turn is not silently blocked.
- Changed landing and vendor voice controller `vendorId` values to runtime getters and updated voice-session/provider logs to call those getters.
- Assigned every `lockVoiceFallback(...)` return value back to the local session reference.
- Truncated STT-derived street/city fragments before interpolating them into repair prompts.
- Bumped modified mobile barber JS cache strings to `v=20260525f`.
- Added static coverage for delayed session creation, dynamic vendor ID logging, and STT repair truncation.

Commands run:

```bash
scripts/ai/targeted_dry_run.sh booking
node --check mobile-barber/mobile-barber-voice.js
node --check mobile-barber/mobile-barber.js
node --check mobile-barber/mobile-barber-vendor.js
node --check tests/lib/mobile-barber-landing.js
node tests/runner.js
scripts/ai/full_system_dry_run.sh
```

Dry run result:

- `scripts/ai/targeted_dry_run.sh booking`: `FINAL: PASS`
- `node tests/runner.js`: `337 passed, 0 failed`
- `scripts/ai/full_system_dry_run.sh`: `FINAL: PASS`

Remaining risks:

- Live Firestore booking write verification was not performed in this agent run. The repository safety override forbids production Firestore writes during validation/dry runs, so a human still needs to confirm a real `mobileBarberBookings` document is created and visible in the dashboard.
- No real mobile device STT/TTS session was recorded.

Next command:

```bash
scripts/ai/full_system_dry_run.sh
```

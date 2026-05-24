# Mobile Barber Phase 7 AI Voice Agent Report

Prompt used: `prompts/mobile_barber_phase7_ai_voice_agent.md`
Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite checked: `docs/mobile_barber_phase6_ai_chat_agent_report.md` reports `FINAL: PASS`.

## Summary

Added a Mobile Barber voice booking layer for the vendor page without modifying the shared salon voice module. The new voice overlay uses Web Speech recognition for input, sends transcripts through the existing `MobileBarberAgent.handleMessage()` path, saves bookings through the same `MobileBarberBooking.saveBooking()` gate, and speaks replies through the same DuLichCali TTS order: OpenAI TTS, then Gemini TTS, then browser `speechSynthesis`.

The voice path keeps the Phase 6 confirmation guard: complete booking details produce a spoken summary first, and only a later affirmative turn creates the booking. Mic permission failure or missing speech recognition opens the existing text chat fallback.

## Files Changed

- `mobile-barber/mobile-barber-voice.js`
  - New Phase 7 voice overlay module.
  - Adds large talk/close controls, language buttons, status states, transcript/response display, language detection, STT handling, text fallback, and TTS fallback chain.
- `mobile-barber/vendor.html`
  - Adds `Talk to Barber Assistant` controls on the vendor hero and booking panel.
  - Loads `mobile-barber-voice.js?v=20260523a`.
  - Bumps `mobile-barber-vendor.js` to `v=20260523e`.
- `mobile-barber/mobile-barber-vendor.js`
  - Adds translated voice CTA labels.
  - Exposes a small voice adapter that routes voice turns through the same chat agent and booking save path.
  - Marks voice-created bookings with `source: ai_voice`.
- `mobile-barber/mobile-barber.css`
  - Adds touch-friendly voice overlay styles and the voice CTA button.
- `mobile-barber/index.html`, `mobile-barber/dashboard.html`, `mobile-barber/vendor.html`
  - Bumps shared Mobile Barber CSS to `v=20260523e`.
- `tests/lib/mobile-barber-landing.js`
  - Adds static checks for the Phase 7 voice module, TTS chain, language controls, status states, text fallback, and versioned assets.

## Commands Run

- `scripts/ai/targeted_dry_run.sh marketplace`
  - Result: `FINAL: PASS`
- `node tests/lib/mobile-barber-agent.js`
  - Result: `9 passed, 0 failed`
- `node -e "const t=require('./tests/lib/mobile-barber-landing'); ..."`
  - Result: `17 passed, 0 failed`
- `node tests/runner.js`
  - Result: `289 passed, 0 failed`
- `scripts/ai/full_system_dry_run.sh`
  - Result: `FINAL: PASS`

## Verification Coverage

- Voice CTA exists on the vendor page.
- Voice module uses SpeechRecognition / webkitSpeechRecognition.
- TTS chain includes `_speakViaOpenAi`, `_speakViaGemini`, and browser `speechSynthesis`.
- OpenAI TTS uses `voice: 'nova'`.
- Gemini fallback uses `gemini-2.5-flash-preview-tts`.
- Text fallback is wired for denied/unsupported microphone access.
- Voice-created booking source is `ai_voice`.
- Full dry run passed.

## Remaining Risks

- Real microphone permission behavior requires manual browser/device testing.
- iOS Safari and Android Chrome runtime behavior is not proven by the static harness.
- Live OpenAI/Gemini TTS requires configured keys and network access.
- Firestore persistence remains covered only by existing safe local/fallback validation unless run in an approved configured environment.

## Next Command

`scripts/ai/full_system_dry_run.sh`

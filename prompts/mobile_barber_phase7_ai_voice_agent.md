# Mobile Barber — Phase 7: Smart AI Voice Booking Agent

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 6 PASS.

## Objective
Add voice/talk support for the Mobile Barber AI booking assistant using the existing DuLichCali AI voice pattern.

## Critical Trigger Area
Per CLAUDE.md: "Voice mode TTS chain (`nailsalon/voice-mode.js`)". Reuse the existing TTS chain (OpenAI → Gemini → browser). Per memory: TTS architecture has DO NOT REVERT rules — read `voice-mode.js` carefully in Phase 0 audit.

## Requirements
- Customer can tap "Talk to Barber Assistant"
- AI greets customer naturally
- AI detects language where possible
- AI asks booking questions by voice
- AI confirms booking summary before creating booking
- AI gives final confirmation
- Voice UI must be touch-friendly on mobile

## UI Requirements
- Large talk button
- Large exit/close button
- Manual language selection lower on screen if still needed
- Clear status:
  - listening
  - thinking
  - confirming
  - booked
- Fallback to text chat if mic permission fails

## Important
Do not break existing salon AI receptionist or ride AI assistant.

## Verification (Manual)
- mic permission allowed
- mic permission denied
- English booking
- Vietnamese booking
- Spanish booking
- customer changes time mid-conversation
- AI does not confirm unavailable slot
- iOS Safari (constraint per memory)
- Android Chrome

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

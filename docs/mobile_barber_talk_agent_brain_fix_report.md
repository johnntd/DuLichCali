# Mobile Barber Talk Agent Brain Fix Report

Date: 2026-05-25

## Root Cause Of Redirect

The general Mobile Barber landing page rendered its service-level chat and voice CTAs as links built by `vendorUrl(service, mode)`, which sent customers to `/mobile-barber/vendor/<vendorId>?assistant=voice` instead of starting the assistant on the current page. The hero `Talk to AI Barber Assistant` button only opened a placeholder assistant panel and did not launch the voice booking controller.

On vendor pages, `openVoiceAssistant()` already opened the voice overlay in place, so the confusing redirect was primarily from the general landing-page service CTA behavior.

## Root Cause Of Weak Conversation Flow

`mobile-barber/mobile-barber-agent.js` collected missing fields as a batch and could respond with combined requirements such as name, phone, service, date, time, address, city, and ZIP. It did not force phone lookup as the first booking step and did not have an explicit customer lookup phase before asking for service or address.

## Nail Salon Smart Agent Files Inspected

- `nailsalon/receptionist.js`
  - Stateful booking fields, `STATE` merge pattern, phone-first booking intercept, returning customer memory hook, availability gate, booking confirmation/write flow.
- `nailsalon/voice-mode.js`
  - Voice launch delegates to `biz._voiceSend`, preserving the full receptionist brain rather than a prompt-only voice path.
- `nailsalon/customer-memory.js`
  - Normalized phone lookup and safe returning-customer greeting pattern.
- `nailsalon/phone-intake.js`
  - Spoken phone normalization across English, Vietnamese, and Spanish.
- `ai-engine.js`
  - Provider routing pattern used by the salon receptionist.

## Mobile Barber Files Changed

- `mobile-barber/mobile-barber-agent.js`
  - Added phone-first state fields and state machine progression.
  - Added `handleMessageAsync()` and `serviceBookingAgentBrain()` adapter.
  - Added one-question-at-a-time prompts.
  - Added existing/new customer lookup handling.
- `mobile-barber/mobile-barber-booking.js`
  - Added `lookupReturningCustomer()` searching `mobileBarberCustomers` first, then `mobileBarberBookings`, with normalized phone matching.
- `mobile-barber/mobile-barber-vendor.js`
  - Routed text and voice messages through async lookup-aware agent handling.
  - Added vendor-specific voice initial prompt.
- `mobile-barber/mobile-barber-voice.js`
  - Changed voice welcome to phone-first prompt.
  - Allows controller-provided initial prompt for vendor-specific greetings.
- `mobile-barber/mobile-barber.js`
  - General `/mobile-barber` Talk CTA now starts voice in place.
  - Service-level talk buttons no longer redirect to vendor pages.
  - General page now wires the same booking brain and starts with phone lookup.
- `mobile-barber/index.html`
  - Loads booking, agent, voice, AI engine, and phone-intake scripts.
- `mobile-barber/vendor.html`
  - Bumped modified Mobile Barber JS version strings.
- `tests/lib/mobile-barber-agent.js`
  - Added phone-first, new customer, and existing customer scenario coverage.
- `tests/lib/mobile-barber-landing.js`
  - Updated asset/version and non-redirect voice checks.

## New Booking State Machine

Implemented sequence:

1. `START`
2. `ASK_PHONE`
3. `LOOKUP_CUSTOMER`
4. `IF_EXISTING_CUSTOMER_CONFIRM_PROFILE`
5. `IF_NEW_CUSTOMER_ASK_NAME`
6. `ASK_ADDRESS`
7. `VALIDATE_SERVICE_AREA`
8. `ASK_SERVICE`
9. `ASK_DATE_TIME`
10. `CHECK_AVAILABILITY`
11. `CONFIRM_SUMMARY`
12. `CREATE_BOOKING`
13. `DONE`

The agent asks one question at a time and does not request name, phone, address, service, date, and time in a single message.

## Customer Lookup Behavior

Phone numbers are normalized to digits, with leading US country code stripped when present. Lookup order:

1. `mobileBarberCustomers`
2. `mobileBarberBookings`
3. local fallback bookings when Firestore is unavailable

If a matching customer is found, the agent safely reuses name, city/address metadata, preferred barber, previous service, and safe notes fields only after asking the customer to confirm saved address reuse. If no match is found, the next question asks for the customer name.

## Voice Provider Verification

Vietnamese voice provider routing remains in `mobile-barber/mobile-barber-voice.js`:

- `lang === 'vi'` still tries `_speakViaGemini()` first.
- Gemini provider diagnostics still log through `_voiceProviderLog()`.
- OpenAI remains fallback after Gemini failure.
- Browser speech synthesis remains final fallback.

No Gemini/OpenAI key handling was removed.

## Tests Run

- `bash scripts/ai/targeted_dry_run.sh ai-receptionist`
  - Result: `FINAL: FAIL`
  - Note: the full `node tests/runner.js` portion passed, but the script's final static `require('./nailsalon/receptionist.js')` check failed. This was pre-existing behavior observed before the patch.
- `bash scripts/ai/targeted_dry_run.sh booking`
  - Result: `FINAL: PASS`
- `node -c mobile-barber/mobile-barber-agent.js`
- `node -c mobile-barber/mobile-barber-booking.js`
- `node -c mobile-barber/mobile-barber-vendor.js`
- `node -c mobile-barber/mobile-barber-voice.js`
- `node -c mobile-barber/mobile-barber.js`
- `node tests/lib/mobile-barber-agent.js`
  - Result: `13 passed, 0 failed`
- `node tests/runner.js`
  - Result: `322 passed, 0 failed`
- `bash scripts/ai/full_system_dry_run.sh`
  - Result: `FINAL: PASS`
- `bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_talk_agent_brain_fix.md --max-loops 3 --allow-dirty --timeout 2400`
  - Result: `FINAL: FAIL`
  - Blocker: nested `codex exec` could not access `/Users/johntd/.codex/sessions` due permission denial in this sandbox. The loop also flagged unrelated pre-existing untracked files as out of scope.

## Remaining Risks

- End-to-end microphone/STT/browser behavior still needs device/browser validation.
- Live Firestore security/query behavior for guest customer lookup needs production-like emulator or staging validation.
- The requested AI dev loop is blocked by local Codex session permissions and dirty-tree scope enforcement, even though `full_system_dry_run.sh` passes.

## Status

BLOCKED for final PASS because the requested `ai_dev_loop.sh` command ends `FINAL: FAIL` for environment/scope reasons outside this patch.

Next command:

```bash
bash scripts/ai/full_system_dry_run.sh
```

# Mobile Barber AI Brain Integration — Phase 2 Report

Date: 2026-05-25

## Goal

Replace the deterministic Mobile Barber conversation layer with the same
Claude conversational brain architecture the nail salon uses. Keep all
deterministic guards (phone lookup, service-area, availability, booking
write) as the source of truth.

## What Was Inspected

`nailsalon/receptionist.js` — the reference brain:

- `_buildPrompt(biz, lang)` builds a comprehensive system prompt (vendor
  identity, services, hours, staff, current time).
- `AIEngine.call('nails', apiKey, systemPrompt, messages, { intent })`
  is the single AI entry point. Uses `claude-sonnet-4-6`, 900 tokens.
- `AIEngine.saveHistory(key, arr)` / `restoreHistory(key)` use
  sessionStorage to persist conversation across reloads.
- Claude returns text + `[STATE:{...}]` JSON marker; `_parseStateMarker(reply)`
  extracts the JSON.
- `_mergeState(biz, update)` merges Claude's slot updates into
  `biz._bookingState`.
- `_stripAllMarkers(reply)` removes markers before the user sees the reply.
- Conversation history sent each turn = Claude maintains full context.

`ai-engine.js` — the proxy:

- `_callClaudeViaProxy` calls the `aiProxy` Firebase Function (server-side
  key), normalised to `{ content: [{ text }] }`.
- No client-side API key needed; the function uses `CLAUDE_API_KEY` secret.

## What Was Built

### Shared serviceBookingBrain pattern

`mobile-barber/mobile-barber-agent.js` now exposes the reusable brain
contract via `serviceBookingAgentBrain({ vertical })` (already present)
plus four new building blocks (`_buildAIBrainPrompt`, `_parseStateMarker`,
`_stripMarkers`, `_runAIBrain`). The deterministic state machine still
decides WHICH question to ask next; Claude is the NLU + NLG layer that
understands natural replies and paraphrases the next question.

### AI brain integration in `mobile-barber-agent.js`

- `_buildAIBrainPrompt(state, ctx, lang)` — assembles the per-turn system
  prompt containing:
  - Vendor identity, service catalog, service areas
  - Current collected slots (`customerName: …`, `phone: …`, etc.)
  - Next deterministic step + per-step guidance (e.g. "Ask for the service
    address — one question only")
  - STATE marker protocol with concrete English/Vietnamese/Spanish
    examples ("Customer: 'My name is John' → 'Nice to meet you, John.
    What address should the barber visit? [STATE:{\"customerName\":\"John\"}]'")
  - Allowed STATE keys + allowed serviceId values for safety
  - Banned behaviors: invent prices/services/availability, claim bookings
    are confirmed
- `_parseStateMarker(reply)` — extracts `[STATE:{...}]` JSON.
- `_stripMarkers(reply)` — strips STATE and ACTION markers before the
  reply is shown to the user.
- `_runAIBrain(session, message, ctx, baseResult)` — runs after the
  deterministic core. If `ctx.aiBrainProvider` is present:
  1. Builds the system prompt from current state.
  2. Appends user message (or `[SYSTEM: customer_lookup_miss|hit|error]`
     for the second handleMessage call after a lookup hop) to
     `session.history`.
  3. Calls `aiBrainProvider({ systemPrompt, history, state, vendor, lang })`.
  4. Parses STATE marker, re-merges into state (AI's understanding wins
     for fields it sets; regex-extracted slots remain unless AI updates them).
  5. Strips markers, uses AI reply as the user-visible response.
  6. Appends assistant reply to history.
  7. On error (proxy down, parse failure), keeps the deterministic reply
     and records `aiBrainError`.

History is bounded to the last 20 messages per call to limit token spend.

### Wiring

- `mobile-barber/mobile-barber-vendor.js`:
  - `_buildAIBrainProvider(vendorId)` wraps `AIEngine.call('nails', '', ...)`.
  - `agentContext()` now includes `vendorId`, `aiBrainProvider`.
  - `openAssistantPanel()` initialises `session.history` from
    `AIEngine.restoreHistory('mb_h_<vendorId>')` so history survives reloads.
  - After every turn, `AIEngine.saveHistory(historyKey, history.slice(-20))`.
- `mobile-barber/mobile-barber.js` (landing controller):
  - Same wire-in pattern, history key `mb_h_<vendorId|general>`.
- `mobile-barber/mobile-barber-voice.js`:
  - **Unchanged.** Voice already delegates to the controller's
    `sendAgentMessage`, which builds the ctx with `aiBrainProvider`. Voice
    flows through the same AI brain as text, automatically.

### Deterministic guards preserved

The AI brain does NOT bypass any guard:

- **Phone lookup**: still runs in `handleMessage`'s `LOOKUP_CUSTOMER`
  branch via `customerLookupProvider`. Result is fed to the AI as
  `[SYSTEM: customer_lookup_hit|miss|error]` so the AI reacts naturally.
- **Service-area, travel buffer, working hours, overlap**: still enforced
  by `MobileBarberBooking.checkAvailability` before any summary.
- **Booking write**: still requires `pendingAction: 'final_confirmation'`
  + affirmative reply before `BOOKING.buildBooking` is called. AI may
  not claim a booking is confirmed.

### Vietnamese Gemini voice routing preserved

`mobile-barber-voice.js` is unchanged. The TTS provider chain
(Gemini → Google → OpenAI) is unaffected. The AI brain reuses the same
text-mode AIEngine route; voice STT/TTS layers were never touched.

### Diagnostic logging

`[mobile-barber-agent-state]` log line (already added in the prior patch)
captures: `sessionId, vendorId, previousStep, lastQuestion, userInput,
understoodIntent, extractedSlots, nextStep, customerFound, missingSlots,
reply`. When the AI brain is used, `result.aiBrainUsed === true` and the
AI's STATE update is recorded on `session._aiStateUpdate`.

## Tests Added (8 new, total 26 in this file, 335 in full runner)

`tests/lib/mobile-barber-agent.js`:

| Test | Verifies |
|---|---|
| `parseStateMarker extracts JSON STATE marker` | Marker parsing handles valid JSON and rejects malformed |
| `stripMarkers removes STATE and ACTION markers from visible reply` | User never sees raw markers |
| `buildAIBrainPrompt includes vendor, services, current state, and STATE protocol` | System prompt has vendor, slots, guidance, marker contract |
| `handleMessageAsync calls aiBrainProvider and uses paraphrased reply` | When provider present, AI is invoked, reply replaces deterministic |
| `handleMessageAsync AI brain STATE marker overrides deterministic state` | AI's STATE update is merged correctly |
| `handleMessageAsync falls back to deterministic reply when AI brain throws` | aiProxy 500 → deterministic reply still surfaces, `aiBrainError` set |
| `handleMessageAsync accumulates history across multiple turns` | `session.history` grows correctly across turns |
| `handleMessageAsync sends customer_lookup_miss system context to AI after no-record` | After lookup miss, AI sees `[SYSTEM: customer_lookup_miss]` so it can react naturally |

The runner (`tests/runner.js`) gained minimal async-test support: tests
that return a Promise are queued and awaited at end-of-run via
`_drainPendingAsync()`.

## Verification

- `node tests/lib/mobile-barber-agent.js` → **26 passed, 0 failed**
- `node tests/runner.js` → **335 passed, 0 failed**
- `bash scripts/ai/full_system_dry_run.sh` → **FINAL: PASS**
- `node -c` on all 4 edited mobile-barber JS files → OK
- `node -c tests/runner.js` → OK

## Manual Smoke (mocked AI)

```
T1 user: "I want a haircut"
   → AI: "Sure, what is your phone number?"
   → state.step: ASK_PHONE, history: 2 msgs

T2 user: "408-555-1234"
   → lookup miss → AI sees [SYSTEM: customer_lookup_miss]
   → AI: "I do not have a record yet — what name should I use?"
   → state.step: IF_NEW_CUSTOMER_ASK_NAME

T3 user: "John Smith"
   → AI: "Nice to meet you John. What address should the barber visit?
          [STATE:{\"customerName\":\"John\"}]"
   → state.customerName: John (AI override), state.step: ASK_ADDRESS

T4 user: "123 Main St, San Jose, 95123"
   → state.address/city/zip bound by deterministic + AI confirms
   → state.step: ASK_DATE_TIME
```

## Files Changed

- `mobile-barber/mobile-barber-agent.js` — AI brain (\~180 lines added)
- `mobile-barber/mobile-barber-vendor.js` — wire `aiBrainProvider` + history persistence
- `mobile-barber/mobile-barber.js` — same wiring for general landing
- `mobile-barber/index.html` — `?v=20260525c`
- `mobile-barber/vendor.html` — `?v=20260525c`
- `tests/lib/mobile-barber-agent.js` — 8 new AI brain tests
- `tests/lib/mobile-barber-landing.js` — version assertions bumped to `c`
- `tests/runner.js` — minimal async-test support (drain queue)
- `docs/mobile_barber_ai_brain_phase2_report.md` — this report

**Note on `tests/runner.js`:** the runner was modified to await
Promise-returning tests. This is a shared test infrastructure change.
The existing 325+ synchronous tests are unaffected — they continue
through the same sync path. Only tests that explicitly return a Promise
go through the new `_pendingAsync` drain queue.

## How AI Brain Behaves in Production

Production path: browser → `AIEngine.call('nails', '', systemPrompt, history, { intent: 'booking' })` → `_callClaudeViaProxy(...)` → Firebase Functions `aiProxy` → Anthropic Claude `claude-sonnet-4-6`. No client-side API key. Server-side `CLAUDE_API_KEY` secret.

If `aiProxy` is unreachable or returns an error, `_runAIBrain` catches
the rejection and the deterministic reply surfaces (preserving the
working flow we shipped in Phase 1). The customer never sees a broken
chat.

## Follow-up Suggestions

1. Per-vertical service config: consider adding `mobile_barber:` to
   `SERVICE_CONFIG` in `ai-engine.js` (currently reusing `'nails'`).
   Skipped here to keep this patch scoped to the mobile-barber surface.
2. ACTION marker handling: the strip pattern handles them already but
   no ACTION semantics are wired (e.g. AI could emit `[ACTION:check_availability]`
   to trigger the availability check earlier). Phase 3.
3. Server-side prompt audit: `_buildAIBrainPrompt` runs client-side; if
   token budget becomes a concern, build it server-side in the proxy.

## Status

**PASS** — Mobile Barber now uses the AIEngine conversation path with
persistent history, STATE-marker driven state updates, and the same
Claude-backed brain pattern the nail salon uses. Deterministic guards
remain authoritative. All 335 tests pass. Full system dry run is
`FINAL: PASS`.

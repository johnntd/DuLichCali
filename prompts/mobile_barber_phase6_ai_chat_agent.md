# Mobile Barber — Phase 6: Smart AI Booking Agent (Chat)

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 5 PASS.

## Objective
Add a smart AI chat agent for mobile barber booking.

## Critical Trigger Area
Per CLAUDE.md: "AI receptionist prompt construction (`_buildPrompt`, `_mergeState`, `_earlyCheckReady`)" — slow down, audit current code in Phase 0, reuse existing patterns rather than building parallel logic.

## Agent Must Handle (English / Vietnamese / Spanish)
- "I need a haircut at home tomorrow"
- "Can someone come to San Jose today?"
- "How much for fade and beard?"
- "Book me after 5 PM"
- "I want John to cut my hair"
- "Do you speak Vietnamese?"
- "Can I upload a photo of the style I want?"

## Agent Must Collect
- customer name
- phone
- service
- preferred date/time
- address/city/zip
- barber preference if any
- notes/style preference
- photo if available

## Agent Must NOT
- invent availability
- invent prices
- confirm without checking calendar
- ignore travel radius
- book overlapping times
- reveal internal vendor data

## Agent Flow
1. Understand intent.
2. Ask missing questions.
3. Check service area.
4. Check services/prices.
5. Check availability.
6. Present booking summary.
7. Ask final confirmation.
8. Create booking.
9. Give confirmation message.

## Multilingual
- vi / en / es
- Detect from user input
- Respond in customer's language
- No hardcoded strings in any language — see CLAUDE.md RULE #2: route reasons through AI via `[SYSTEM: ...]` context

## Verification Scenarios
- successful booking
- missing address
- unavailable time
- out-of-service area
- customer changes time mid-conversation
- customer asks price only
- customer asks to cancel/reschedule
- Vietnamese conversation
- Spanish conversation

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

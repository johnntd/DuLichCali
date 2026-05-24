# Mobile Barber — Phase 10: Customer Account, Booking History, and Rebooking

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 9 PASS.

## Objective
Add customer-friendly booking history and rebooking.

## Customer Features
- see upcoming appointments
- see past haircut bookings
- rebook same service/barber
- save style preference
- save notes
- optionally upload style photos

## Vendor Features
- see customer cut history
- see notes/preferences
- see previous service

## Privacy (CRITICAL)
- Customer address must be protected.
- Only vendor involved in booking can see details.
- Public pages must not expose private data.
- Firestore security rules must enforce this — propose rule changes (do not deploy without explicit approval).

## Verification
- customer history loads by phone/account
- rebook creates a new pending flow (goes through full booking validation chain from Phase 4)
- previous notes do not auto-publish publicly
- security rules deny unauthorized reads (test with anonymous request)

## Multilingual
vi/en/es.

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

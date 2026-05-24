# Mobile Barber — Phase 4: Manual Booking Flow

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 3 PASS.

## Objective
Implement manual customer booking for in-home haircut appointments.

## Customer Form Rules
Apply CLAUDE.md "Customer Form UI/UX Rules" — 3-sub-step progressive disclosure, max 3 fields per step, mobile-first, AI-assisted feel.

## Flow
Customer must provide:
- name
- phone
- optional email
- selected service
- preferred date/time
- home/service address
- city/zip
- notes
- optional haircut reference photo

## Booking Logic (in order)
Before confirming:
1. Validate required customer fields.
2. Validate address/service area.
3. Load service duration.
4. Add cleanup buffer.
5. Add travel buffer if configured.
6. Check vendor availability.
7. Check existing bookings for overlap.
8. Show total estimated price and time.
9. Ask customer to confirm.
10. Only then create booking.

## Statuses
- `pending_confirmation`
- `confirmed`
- `vendor_review`
- `cancelled`
- `completed`
- `rescheduled`

## Critical Trigger Area
Per CLAUDE.md: "Booking availability check logic (nail salon, hair salon, airport/ride)". Add mobile barber to this list. Audit Phase 0 must have documented how existing availability logic is structured so this can reuse it additively.

## Verification (REQUIRED)
Tests must prove:
- double booking is blocked
- non-service-area address is blocked or marked `vendor_review`
- missing phone/address is blocked
- booking cannot confirm without availability check
- existing salon/ride/food bookings are not broken

## Multilingual
vi/en/es. No hardcoded strings in any language.

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

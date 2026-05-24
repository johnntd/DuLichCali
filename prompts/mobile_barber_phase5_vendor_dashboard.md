# Mobile Barber — Phase 5: Vendor Dashboard for Mobile Barbers

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 4 PASS.

## Objective
Add vendor dashboard support for mobile barbers.

## Vendor Can Manage
- profile
- phone/contact
- service area
- travel radius
- services
- prices
- duration
- cleanup/travel buffer
- working hours
- unavailable blocks
- bookings
- booking status
- customer notes/address
- customer reference photos

## Dashboard Must Include
- Today's appointments
- Upcoming bookings
- Pending confirmations
- Customer contact
- Address/map link if available
- Accept/reschedule/cancel actions

## Privacy Rules
- Do not expose private customer address publicly.
- Vendor-only view can show address.
- Customer-facing page should only show service area, not vendor private address unless vendor chooses to show it.

## Multilingual (CRITICAL)
Per CLAUDE.md and project memory: admin tools must support vi/en/es with no hardcoded strings in any language. Use `_LABELS` lookup or `SalonI18n.t()` pattern from salon-admin.html — confirm in Phase 0 audit which pattern fits best.

## Verification
- create/update service
- update hours
- view bookings
- accept booking
- cancel booking
- dashboard does not break existing vendor admin (vendor-admin.html, salon-admin.html, admin.html)

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

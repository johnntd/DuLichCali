# Mobile Barber — Phase 12: Final Integration, QA, and Regression

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phases 0–11 PASS.

## Objective
Run full integration and regression testing.

## Required Test Matrix

### Customer
- landing page
- vendor page
- manual booking
- AI chat booking
- AI voice booking
- booking confirmation
- unavailable slot
- out-of-service-area address
- reschedule/cancel if implemented

### Vendor
- dashboard
- services
- availability
- bookings
- status updates
- customer details

### Regression (do not break)
- homepage
- salon vendor page (Luxurious Nails reference surface)
- salon AI receptionist
- food vendor pages
- hair salon page
- ride/airport booking
- travel packages
- marketplace navigation
- mobile nav
- desktop nav

## Required Validation Gate
Per CLAUDE.md: run `scripts/ai/full_system_dry_run.sh` and confirm `FINAL: PASS` before marking complete.

## Deliverables
Create: `docs/mobile_barber_final_qa_report.md`

Include:
- what was implemented
- files changed (by phase)
- tests run
- pass/fail matrix
- known limitations
- recommended next upgrades

## PASS Criteria
The phase passes only if:
- Mobile barber customer flow works end-to-end
- Vendor flow works end-to-end
- AI chat does not invent bookings (verified by adversarial scenarios)
- Voice flow does not break existing AI flows
- No major existing DuLichCali feature is broken
- `scripts/ai/full_system_dry_run.sh` returns `FINAL: PASS`

## End-of-phase report (required)

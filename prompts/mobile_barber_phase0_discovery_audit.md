# Mobile Barber — Phase 0: Discovery and Baseline Audit

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`

## Objective
Audit the current DuLichCali app and identify the best additive integration points for a new Mobile Barber vertical. **No product code changes in this phase** unless needed for docs only.

## STRICT RULES (from master prompt — apply to every phase)
1. Do NOT break existing DuLichCali flows: salon, food, ride/airport, travel packages, vendor pages, AI receptionist.
2. No blind rewrites.
3. Prefer additive implementation.
4. Reuse existing app patterns, Firestore structure, AI agent utilities, vendor template logic, booking validation logic.
5. All customer and vendor flows must be mobile-first.
6. AI must never confirm a booking before checking: barber availability, service duration, travel buffer, customer address/service area, existing appointments.
7. Vendor page must be a real single-vendor service page, not a generic listing page.
8. Include tests or verification scripts for every phase.
9. Each phase must end with: files changed, tests run, screenshots/manual verification instructions, blockers if any.

## Tasks
1. Inspect current repo structure.
2. Identify:
   - routing system
   - vendor model
   - salon booking logic
   - AI receptionist logic
   - Firestore collections
   - customer booking forms
   - vendor dashboard
   - notification/SMS/email hooks if present
3. Find existing reusable pieces:
   - vendor profile page template
   - booking validation
   - availability logic
   - service menu model
   - AI chat/voice component
   - location-aware service logic
4. Produce an implementation map.

## Deliverables
Create: `docs/mobile_barber_audit.md`

Include:
- current architecture summary
- exact files to modify in later phases
- Firestore collection proposal
- non-breaking integration strategy
- risks and regression areas

## Verification
- No product code changes in this phase unless needed for docs only.
- PASS only if the audit clearly explains how to add Mobile Barber without breaking existing app flows.

## End-of-phase report (required)
- files changed
- tests run
- screenshots / manual verification instructions
- blockers if any

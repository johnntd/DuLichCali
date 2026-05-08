# Phase 0 — Nail Salon AI OS Audit + Implementation Plan

You are working on the DuLichCali webapp.

Goal:
Audit the current salon/vendor system and create a safe implementation plan for adding Nail Salon AI OS features beyond booking.

Important rules:
- Do NOT break existing salon booking logic.
- Do NOT remove existing vendor pages.
- Do NOT hardcode one salon only.
- Build reusable salon features for all nail/hair/beauty vendors.
- Preserve current Firestore data where possible.
- No blind patches. Inspect existing files first.
- Only proceed to Phase 1 after Phase 0 report is complete and verified.

Audit these areas:
1. Salon vendor page structure
2. Vendor admin dashboard
3. Booking system
4. Staff schedule and availability
5. AI receptionist logic
6. Firestore collections
7. Existing vendor service/menu data
8. Existing customer records
9. Existing notification/Twilio logic
10. Mobile UI behavior

Deliverables:
- Create `docs/salon_ai_os_phase0_audit.md`
- List current files involved
- List current Firestore collections
- Identify safe extension points
- Identify risks
- Recommend implementation order
- Add a checklist for all future phases

Do not implement features yet.

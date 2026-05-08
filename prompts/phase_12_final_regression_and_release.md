# Phase 12 — Full Salon AI OS Regression + Release

Goal:
Verify the complete Nail Salon AI OS before release.

Regression areas:
1. Customer booking
2. AI receptionist
3. Staff availability
4. Double-book prevention
5. Vendor admin
6. Inventory
7. Service material usage
8. Inventory deduction
9. Low stock alert
10. Restock recommendation
11. Supplier links
12. Cost/margin analytics
13. Upsell logic
14. Pricing recommendations
15. Design upload
16. Dashboard
17. Notifications
18. Mobile UI
19. Multilingual support
20. Firestore security rules

Required test scenarios:
- New customer books gel manicure
- Existing customer changes time
- Customer asks unavailable staff
- Customer asks for design from photo
- Vendor completes appointment
- Inventory deducts once
- Low stock alert appears
- Vendor marks restock ordered
- Cost dashboard updates
- AI suggests upsell
- AI suggests price change but does not auto-change
- Twilio disabled does not break app
- Mobile iPhone layout works

Deliverables:
- `docs/salon_ai_os_release_report.md`
- Screenshots of major pages
- List of bugs found/fixed
- Confirm no regression in existing salon booking

Do not mark complete until all tests pass.

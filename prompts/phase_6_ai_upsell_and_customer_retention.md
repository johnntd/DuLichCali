# Phase 6 — AI Upsell + Customer Retention

Goal:
Increase salon revenue through intelligent AI upsell and customer follow-up.

AI receptionist should suggest:
- Add design
- Add gel upgrade
- Add pedicure with manicure
- Add removal service
- Add nail art
- Add paraffin wax
- Book next appointment

Rules:
- Upsell must be polite, not pushy.
- Match customer language.
- Do not suggest unavailable services.
- Check staff/time availability before confirming.
- Respect vendor settings.

Vendor settings:
vendors/{vendorId}/aiSalesSettings

Fields:
- upsellEnabled
- maxUpsellSuggestions
- preferredUpsells[]
- disabledUpsells[]
- followupEnabled
- reminderEnabled

Customer retention:
Detect customers who have not booked in:
- 21 days
- 30 days
- 45 days

Generate suggested messages:
- SMS-ready
- Email-ready
- In-app message-ready

Acceptance tests:
- AI suggests relevant upsell
- AI does not double book
- AI does not suggest unavailable staff
- AI uses customer language
- Follow-up suggestion is generated but not auto-sent unless enabled

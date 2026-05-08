# Phase 10 — SMS / Notification Layer

Goal:
Add optional notification support for salon operations.

Notification types:
- Booking confirmation
- Booking reminder
- Cancellation
- Staff schedule reminder
- Low stock alert
- Restock reminder
- Customer follow-up message

Important:
- Respect Twilio/A2P compliance.
- Do not send SMS unless vendor/customer consent exists.
- STOP/HELP language must be supported.
- If Twilio is not ready, keep notification draft mode.

Vendor notification settings:
vendors/{vendorId}/notificationSettings

Fields:
- smsEnabled
- emailEnabled
- lowStockSmsEnabled
- bookingSmsEnabled
- marketingSmsEnabled
- consentRequired

Acceptance tests:
- Notification draft can be generated
- SMS not sent without consent
- Low stock notification appears
- Booking notification still works
- Twilio unavailable does not break app

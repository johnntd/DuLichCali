# Mobile Barber — Customer Accounts + PWA + Notifications

Implement Mobile Barber customer account + PWA + notification system.

Goal:
Customers should be able to create a secure account using their phone number, stay logged in on iPhone Home Screen app, use logged-in-only AI hairstyle features, track bookings, receive booking notifications, and get future haircut reminders.

==================================================
CUSTOMER ACCOUNT
==================================================

Add customer signup/login:

Primary identity:
phone number

Password:
highly secure
minimum 12 characters
require strength meter
prevent common passwords
support forgot/reset password if current auth supports it

Customer profile fields:
- customerId
- phone
- normalizedPhone
- name
- email optional
- preferredLanguage
- preferredAddress
- savedAddresses
- bookingHistory
- preferredBarber
- haircutPreferences
- notificationPreferences
- createdAt
- updatedAt

Do not expose customer data publicly.

==================================================
AUTH REQUIREMENTS
==================================================

Use existing Firebase/Auth system if available.

Set persistent auth:
- LOCAL persistence
- stay logged in after refresh
- stay logged in inside iOS Home Screen PWA after first login there
- logout only when customer taps logout

Important iOS note:
Safari and Home Screen PWA may use separate storage.
Customer may need to log in once from the Home Screen app.
After that, they should stay logged in.

==================================================
AI HAIRSTYLE FEATURE GATING
==================================================

AI hairstyle generation should require customer login.

Public page:
- show teaser
- button: "Log in to try AI hairstyle preview"

Logged-in customer:
- can upload/take selfie
- generate styles
- save generated styles
- view saved styles
- optionally use style in booking

Do not allow anonymous users to generate unlimited AI hairstyles.

==================================================
CUSTOMER HOME SCREEN PWA
==================================================

Add customer PWA support.

Manifest:
- name: DuLichCali Mobile Barber
- short_name: Mobile Barber
- start_url: /mobile-barber
- scope: /mobile-barber/
- display: standalone
- theme_color: #061b33
- background_color: #061b33
- icons:
  - 180x180 apple-touch-icon
  - 192x192
  - 512x512
  - maskable icon

Create app icon:
Mobile Barber branding
scissors/barber pole/home-service feel
readable on iPhone Home Screen

Add iOS meta tags:
- apple-mobile-web-app-capable
- apple-mobile-web-app-title
- apple-mobile-web-app-status-bar-style
- apple-touch-icon

==================================================
CUSTOMER NOTIFICATIONS
==================================================

Customer should get notified when:

- booking is confirmed
- vendor needs more information
- booking is rejected
- booking is rescheduled
- booking is cancelled
- appointment reminder is due
- future haircut reminder is due

Add customer notification center:
- bell icon
- unread badge count
- notification list
- mark read
- click notification opens booking detail

iOS PWA:
- Add "Enable Notifications" button
- Request permission only after user taps
- If push unsupported, show fallback:
  "Keep app open or check notifications here."

In-app notifications:
- toast/popup when app open
- unread badge count
- persistent notification records

==================================================
BOOKING STATUS UPDATES
==================================================

When vendor confirms booking:
customer receives notification:

"Your haircut appointment is confirmed."

When vendor needs info:
"Your barber needs more information about your appointment."

When vendor reschedules:
"Your appointment time has changed."

When cancelled/rejected:
explain clearly.

==================================================
FUTURE HAIRCUT REMINDERS
==================================================

After completed haircut, schedule reminder.

Default options:
- 3 weeks
- 4 weeks
- 6 weeks
- custom

Customer profile should store:
- reminderPreferenceWeeks
- lastHaircutDate
- nextReminderDate
- preferredBarber
- lastService

Reminder message:
"It may be time for your next haircut. Would you like to book again?"

Allow:
- book again
- remind me later
- turn off reminders

==================================================
BOOKING HISTORY
==================================================

Logged-in customer can view:
- upcoming bookings
- past bookings
- booking status
- selected service
- barber assigned
- address
- price/promo
- payment method
- saved AI hairstyle if used

==================================================
SECURITY
==================================================

Customers:
- can only read their own profile
- can only read their own bookings
- can create booking requests
- cannot set vendor-only statuses
- cannot modify price/promo/status after submission
- cannot read other customers

AI hairstyle:
- rate limit per user if possible
- require login
- do not expose API keys in frontend

Notifications:
- customer notifications scoped to customerId
- vendor notifications scoped to vendor/ownerId

==================================================
DATABASE
==================================================

Create/update collections:

mobileBarberCustomers
customerNotifications
customerSavedStyles
customerReminderPreferences

Booking records should link:
- customerId
- normalizedPhone
- customerProfileSnapshot

==================================================
DO NOT BREAK
==================================================

- anonymous/manual booking if still allowed
- vendor portal
- vendor notifications
- AI chat booking
- voice booking
- Tim/Michael routing
- promotion logic
- booking conflict guard
- smart duplicate / spam intent guard (createMobileBarberBookingGuarded)

If anonymous booking remains allowed:
After phone entry, ask:
"Create an account to track this booking and receive updates?"

==================================================
TESTS
==================================================

1. Customer signs up with phone/password.
2. Weak password rejected.
3. Strong password accepted.
4. Customer logs in.
5. Customer stays logged in after refresh.
6. Customer PWA Home Screen opens standalone.
7. Customer stays logged in after reopening PWA.
8. Anonymous user cannot generate AI hairstyle.
9. Logged-in user can generate AI hairstyle.
10. Generated style saves to profile.
11. Customer books appointment.
12. Booking links to customer profile.
13. Vendor confirms booking.
14. Customer notification appears.
15. Customer badge count increments.
16. Customer opens notification and sees booking.
17. Completed haircut schedules reminder.
18. Reminder appears at configured future interval.
19. Customer can book again from reminder.
20. Firestore rules block access to other customer data.

==================================================
REPORT
==================================================

Create:

docs/mobile_barber_customer_accounts_pwa_notifications.md

Include:
- auth approach
- PWA implementation
- notification flow
- reminder design
- security rules
- tests run
- PASS / BLOCKED

PASS only if customer can create secure account, stay logged in on iOS PWA, receive booking notifications, and AI hairstyle generation is gated behind login.

==================================================
JS VERSION STRINGS
==================================================

Any edited `.js`/`.css` must have its `?v=` query bumped in every HTML consumer
(mobile-barber/index.html, dashboard.html, vendor.html). Current safe floor:
v=20260531h or later for mobile-barber-booking.js and mobile-barber.js. Never reuse a
previously deployed version string.

==================================================
DELIVERY
==================================================

- Do NOT push, deploy, or commit (the loop never does this; a human deploys).
- Run `scripts/ai/full_system_dry_run.sh` after changes; it must end `FINAL: PASS`.
- Multilingual: every new user-facing string must exist in vi + en + es (no hardcoded
  strings in any language, customer- or admin-facing).

## Allowed files
- mobile-barber/index.html
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber.css
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-ai-preview.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber-customer.js
- mobile-barber/mobile-barber-pwa.js
- mobile-barber/sw.js
- mobile-barber/manifest.webmanifest
- mobile-barber/manifest-customer.webmanifest
- functions/index.js
- firestore.rules
- assets/icons/mobile-barber-customer-180.png
- assets/icons/mobile-barber-customer-192.png
- assets/icons/mobile-barber-customer-512.png
- assets/icons/mobile-barber-customer-maskable-512.png
- tests/lib/mobile-barber-customer.js
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-landing.js
- tests/runner.js
- docs/mobile_barber_customer_accounts_pwa_notifications.md

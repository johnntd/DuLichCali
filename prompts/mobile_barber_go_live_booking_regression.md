GO-LIVE BLOCKER REGRESSION — Mobile Barber Booking Safety

We are planning to go live tomorrow.

Before deploy, run an exhaustive booking regression.

Do NOT mark PASS unless all booking paths are safe.

==================================================
CORE REQUIREMENT
==================================================

Every booking path must:

1. Use LIVE database data
2. Route to correct barber
3. Check vendor schedule
4. Check unavailable blocks
5. Check existing bookings
6. Check owner-wide conflicts
7. Prevent duplicate customer bookings
8. Prevent invalid/out-of-area address bookings
9. Prevent spam/repeated bookings
10. Apply active promotion correctly
11. Write booking to database
12. Show booking in vendor portal
13. Notify vendor
14. Confirm customer only after booking write succeeds

==================================================
BOOKING PATHS TO TEST
==================================================

Test all:

1. Manual booking from service card
2. AI chat booking
3. Voice/smart agent booking
4. AI-generated hairstyle booking
5. Promotion booking
6. Returning customer booking
7. New customer booking

==================================================
REGION ROUTING
==================================================

Tim Nguyen: Bay Area only
Michael Nguyen: Orange County only

Tests:
1. San Jose address → Tim
2. Santa Clara address → Tim
3. Sunnyvale address → Tim
4. Garden Grove address → Michael
5. Westminster address → Michael
6. Irvine address → Michael
7. Unknown/ambiguous address → ask for city/ZIP
8. Out-of-area address → block or vendor_review
9. Missing ZIP but known city → route if confident
10. Conflicting city/ZIP → ask clarification

==================================================
LIVE DATABASE TESTS
==================================================

Before offering or confirming time, load fresh: vendor active status, services,
pricing, promotions, working hours, unavailable blocks, existing bookings,
owner-wide conflicts, service radius, customer history.

Tests:
1. Add new service in vendor portal → booking sees it
2. Change service price → booking uses new price
3. Enable promotion → booking mentions/apply it
4. Disable promotion → booking stops applying it
5. Change working hours → booking respects it
6. Add unavailable block → booking blocks that time
7. Add existing booking → overlapping slot blocked

==================================================
TIME / SCHEDULE CONFLICT TESTS
==================================================

Blocking: pending, pending_confirmation, confirmed, accepted, vendor_review, in_progress, traveling
Non-blocking: cancelled, rejected, completed, expired

Tests:
1. Exact same time blocked
2. Partial overlap blocked
3. Back-to-back blocked if travel/cleanup buffer overlaps
4. Back-to-back allowed only if buffer satisfied
5. Owner-wide barber booking blocks ride/tour if same owner
6. Ride/tour booking blocks barber if same owner
7. Cancelled booking does not block
8. Completed booking does not block
9. Pending booking blocks until resolved
10. Unavailable block overrides everything
11. Outside working hours blocked
12. Same-day past time blocked
13. "All day today" returns real available slots only
14. "Earliest available" returns first real valid slot
15. "After 5" only searches after 5PM
16. No available slots → suggest next available dates

==================================================
DOUBLE BOOKING / SPAM TESTS
==================================================

Customer duplicate checks by: normalized phone, email, userId, same address+name fallback.

Tests:
1. Same customer same time blocked
2. Same customer overlapping time blocked
3. Same customer multiple pending requests same day limited
4. Repeating submit button does not create duplicates
5. Browser refresh after submit does not duplicate
6. Double-click submit does not duplicate
7. Two tabs submit same booking → only one created
8. AI repeats "OK" after booking → no duplicate
9. Voice retry after booking → no duplicate
10. Same customer different non-overlapping time allowed if rules allow

Implement idempotency key: customerPhone + vendorId + serviceId + requestedStart, or stronger bookingRequestId.

==================================================
ADDRESS VALIDATION TESTS
==================================================

1. Valid full address accepted
2. City-only address asks for street or sends vendor_review per policy
3. Missing city asks clarification
4. Missing ZIP but known city accepted if confident
5. Invalid city blocked
6. Out-of-service-region blocked
7. Outside 30-mile radius blocked
8. Address cannot geocode → city/ZIP fallback
9. Unknown address not silently accepted as confirmed
10. Apartment/unit captured when provided

==================================================
PROMOTION TESTS
==================================================

1. Active promo appears on landing page
2. Active promo mentioned by AI
3. Active promo applied to manual booking
4. Active promo applied to AI booking
5. Active promo applied to voice booking
6. Promo stores snapshot in booking
7. Expired promo not applied
8. Disabled promo not applied
9. Max redemption limit respected
10. Selected-service promo applies only to selected service
11. All-service promo applies to all services
12. Price never $0 unless explicitly free
13. Original + discounted price both shown
14. Vendor portal shows promo applied

Booking stores: promotionId, promotionName, discountPercent, originalPrice, discountedPrice, promoSnapshot

==================================================
AI CHAT / VOICE TESTS
==================================================

1. Phone asked first
2. Returning customer found by phone
3. Previous address offered for reuse
4. New customer asks name then address
5. Address not asked again after routing
6. AI does not over-confirm every step
7. AI never says confirmed before DB write
8. AI says vendor_review when unsure
9. AI suggests alternate times when unavailable
10. AI handles: "all day today", "after 5", "tomorrow afternoon", "earliest available", "same address", "cash", "Zelle"
11. Vietnamese path works
12. English path works
13. Spanish path works if supported

==================================================
AI HAIRSTYLE BOOKING TESTS
==================================================

1. Service-list haircut → booking stores service image/notes
2. AI-generated style → booking stores selected image
3. Barber portal shows selected hairstyle image
4. Barber portal shows barber notes
5. Image URL is durable, not temporary
6. Selected style not lost during booking
7. Women/men/children style options work
8. Eyebrow/beard/color/highlight notes stored if selected

Booking includes: selectedHaircutSource, selectedHaircutTitle, selectedHaircutImageUrl,
selectedHaircutImageStoragePath, selectedHaircutBarberNotes, selectedColorRecommendation,
selectedHighlightRecommendation (+ eyebrow/beard if available).

==================================================
BOOKING WRITE / FIRESTORE RULES TESTS
==================================================

Recent live test showed: AI built booking but Firestore write failed. Must stay fixed.

1. Anonymous customer can create pending booking
2. Authenticated customer can create pending booking
3. Booking write succeeds from manual path
4. Booking write succeeds from AI chat path
5. Booking write succeeds from voice path
6. Conflict guard can read required bookings (server-side via Admin SDK)
7. Firestore rules allow safe create only
8. Firestore rules block unsafe edits
9. Vendor can update assigned bookings
10. Booking appears in mobileBarberBookings
11. Booking appears in unified owner portal
12. No "could not save booking" dead end

If write fails: show exact reason, do not tell customer booking submitted, log error.

==================================================
VENDOR PORTAL / NOTIFICATION / PAYMENT / SECURITY
==================================================

Vendor portal: Michael=OC, Tim=Bay Area; unified portal shows barber/ride/tour;
pending appears immediately; accept/reject/reschedule/in-progress/complete; shows
address, selected haircut image, payment method, confirmation preference, promo info.

Notifications: new booking triggers portal notification; sound after iOS unlock;
appears in drawer; no duplicate on refresh; click opens booking; mark read works.

Payment (cash/Zelle): selection stored; vendor portal shows method; Zelle info appears
if configured; vendor can mark paid; missing Zelle shows setup warning.

Security/abuse: cannot book inactive vendor/service; cannot force discount; cannot edit
status to confirmed; cannot overwrite another booking; cannot violate schema; duplicate
guard prevents spam; public pages hide inactive; admin/vendor portals show inactive for mgmt.

==================================================
REQUIRED AUTOMATED TEST OUTPUT
==================================================

Create/update automated tests covering as many as possible:
- unit tests for routing
- unit tests for conflict guard
- unit tests for duplicate prevention
- unit tests for promo pricing
- unit tests for address validation
- integration tests for booking write
- Playwright tests for manual booking
- Playwright tests for AI booking happy path

==================================================
LIVE SMOKE TESTS (with cleanup)
==================================================

1. Manual booking all the way → delete test booking
2. AI chat booking all the way → delete test booking
3. Conflict attempt → verify blocked
4. Promo booking → verify promo snapshot
5. Vendor portal appearance → verify then delete

Use test name: Smoke Test. Use test phone: 408-555-0199. Clean up all created docs.

==================================================
GO-LIVE REPORT
==================================================

Create: docs/mobile_barber_go_live_booking_regression.md
Include: all tests run; passed/failed matrix; Firestore write verification; conflict guard
verification; promotion verification; vendor portal verification; AI chat verification;
voice verification; remaining risks; Go / No-Go recommendation.

==================================================
PASS CRITERIA
==================================================

Do NOT mark PASS unless: no double booking possible; invalid address cannot confirm; spam
duplicate submissions blocked; all paths use live DB; promotions apply correctly; bookings
write successfully; vendor portal receives bookings; AI does not invent availability;
selected haircut reference visible to barber; test bookings cleaned up; report says GO.

Run `scripts/ai/full_system_dry_run.sh` after every patch and require `FINAL: PASS`.

==================================================
## Allowed files
==================================================

- tests/runner.js
- tests/lib/mobile-barber-agent.js
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-ai-style-booking.js
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-promotion-visibility.js
- tests/lib/mobile-barber-data-model.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber.js
- booking-conflict-guard.js
- functions/index.js
- firestore.rules
- docs/mobile_barber_go_live_booking_regression.md

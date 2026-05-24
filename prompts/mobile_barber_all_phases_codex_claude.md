# Codex-Claude Loop Prompt — Implement Mobile Barber In-Home Haircut Web App

## GOAL

Implement a full mobile barber web app inside DuLichCali where customers can book in-home haircut services and vendors/barbers can manage services, availability, bookings, and customer communication.

This must support:
- Customer booking
- Vendor/barber dashboard
- In-home service address collection
- Travel/service area logic
- Smart AI chat/voice booking agent
- Availability checking before confirmation
- No double booking
- Multilingual support
- Mobile-first UI
- Future expansion for payments, reminders, reviews, and multiple barbers

Modern barber apps commonly include real-time availability, service durations, barber selection, reminders, client history, and AI/online booking flows, so implement this with those production expectations in mind.

---

## STRICT RULES

1. Do NOT break existing DuLichCali flows:
   - salon
   - food
   - ride/airport
   - travel packages
   - vendor pages
   - AI receptionist

2. No blind rewrites.
3. Prefer additive implementation.
4. Reuse existing app patterns, Firestore structure, AI agent utilities, vendor template logic, and booking validation logic.
5. All customer and vendor flows must be mobile-first.
6. AI must never confirm a booking before checking:
   - barber availability
   - service duration
   - travel buffer
   - customer address/service area
   - existing appointments
7. Vendor page must be a real single-vendor service page, not a generic listing page.
8. Include tests or verification scripts for every phase.
9. Each phase must end with:
   - files changed
   - tests run
   - screenshots/manual verification instructions
   - blockers if any

---

# PHASE ORDER

Run each phase using:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_phaseX_<name>.md --max-loop 3
```

Do not start the next phase unless the current phase reaches PASS or has a clear blocker report.

---

## PHASE 0 — Discovery and Baseline Audit
File: `prompts/mobile_barber_phase0_discovery_audit.md`

### Objective
Audit the current DuLichCali app and identify the best additive integration points for a new Mobile Barber vertical.

### Tasks
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

### Deliverables
Create: `docs/mobile_barber_audit.md`

Include:
- current architecture summary
- exact files to modify in later phases
- Firestore collection proposal
- non-breaking integration strategy
- risks and regression areas

### Verification
No product code changes in this phase unless needed for docs only.
PASS only if the audit clearly explains how to add Mobile Barber without breaking existing app flows.

---

## PHASE 1 — Data Model and Firestore Schema
File: `prompts/mobile_barber_phase1_data_model.md`

### Objective
Add the Mobile Barber data model.

### Required Collections
Add or document Firestore collections such as:
- `mobileBarberVendors`
- `mobileBarberServices`
- `mobileBarberAvailability`
- `mobileBarberBookings`
- `mobileBarberCustomers`
- `mobileBarberAgentSessions`

### Vendor Fields
```
{
  id,
  businessName,
  barberName,
  phone,
  email,
  profilePhoto,
  heroImage,
  serviceAreas,
  travelRadiusMiles,
  baseTravelFee,
  addressOptional,
  languages,
  active,
  rating,
  createdAt,
  updatedAt
}
```

### Service Fields
```
{
  id,
  vendorId,
  name,
  description,
  durationMinutes,
  price,
  cleanupBufferMinutes,
  travelBufferMinutes,
  category,
  active,
  imageUrl
}
```

### Booking Fields
```
{
  id,
  vendorId,
  customerName,
  customerPhone,
  customerEmail,
  serviceId,
  serviceName,
  servicePrice,
  address,
  city,
  zip,
  requestedDate,
  startTime,
  endTime,
  status,
  source,
  notes,
  photoUrls,
  aiConversationSummary,
  createdAt,
  updatedAt
}
```

### Tasks
1. Add schema/types/config files consistent with current project style.
2. Add seed data for one sample mobile barber vendor.
3. Add validation helpers.
4. Do not hardcode future production values into logic.
5. Keep the model extensible for multiple barbers.

### Verification
Add tests or scripts to confirm:
- sample vendor loads
- services load
- bookings validate required fields
- schema does not affect existing vendors

---

## PHASE 2 — Customer Mobile Barber Landing Page
File: `prompts/mobile_barber_phase2_customer_landing.md`

### Objective
Add a mobile-first customer landing page for in-home barber services.

### Route
Add route such as: `/mobile-barber`

### Page Must Include
- Hero section: "Mobile Barber — In-Home Haircuts"
- Service cards
- Barber/vendor profile cards
- Price/duration display
- Service area display
- CTA:
  - "Book Now"
  - "Chat with AI Barber Assistant"
  - "Talk to AI Barber Assistant"
- Mobile-first layout
- Desktop responsive layout
- No duplicated global navigation

### Tasks
1. Reuse existing DuLichCali design language.
2. Make it feel iOS/mobile friendly.
3. Add customer trust elements:
   - in-home service
   - verified barber
   - transparent pricing
   - appointment confirmation
4. Add fallback empty state if no mobile barber vendors exist.

### Verification
Test:
- iPhone width
- Android width
- desktop width
- route refresh
- existing home page still works
- other verticals still work

---

## PHASE 3 — Single Mobile Barber Vendor Page
File: `prompts/mobile_barber_phase3_vendor_page.md`

### Objective
Create a single-vendor page for each mobile barber.

### Route Example
`/mobile-barber/vendor/:vendorId` (or compatible with the existing route style)

### Page Must Show
- Real vendor/barber name
- Real phone/contact
- Hero image
- Profile photo
- Service area
- Travel radius
- Services with prices and durations
- Availability preview
- AI booking assistant button
- Manual booking button
- Customer notes/photo upload option if available

### Important
This page must NOT become a generic marketplace listing page.
It must behave like a real vendor page, similar to the Luxurious Nails vendor standard:
- vendor identity first
- services second
- booking third
- AI assistant tied to this vendor

### Verification
Test:
- valid vendor ID
- invalid vendor ID
- missing image fallback
- mobile rendering
- service list
- booking CTA

---

## PHASE 4 — Manual Booking Flow
File: `prompts/mobile_barber_phase4_manual_booking.md`

### Objective
Implement manual customer booking for in-home haircut appointments.

### Flow
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

### Booking Logic
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

### Statuses
Support:
- `pending_confirmation`
- `confirmed`
- `vendor_review`
- `cancelled`
- `completed`
- `rescheduled`

### Verification
Tests must prove:
- double booking is blocked
- non-service-area address is blocked or marked vendor_review
- missing phone/address is blocked
- booking cannot confirm without availability check
- existing salon/ride/food bookings are not broken

---

## PHASE 5 — Vendor Dashboard for Mobile Barbers
File: `prompts/mobile_barber_phase5_vendor_dashboard.md`

### Objective
Add vendor dashboard support for mobile barbers.

### Vendor Can Manage
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

### Dashboard Must Include
- Today's appointments
- Upcoming bookings
- Pending confirmations
- Customer contact
- Address/map link if available
- Accept/reschedule/cancel actions

### Rules
- Do not expose private customer address publicly.
- Vendor-only view can show address.
- Customer-facing page should only show service area, not vendor private address unless vendor chooses to show it.

### Verification
Test:
- create/update service
- update hours
- view bookings
- accept booking
- cancel booking
- dashboard does not break existing vendor admin

---

## PHASE 6 — Smart AI Booking Agent: Chat
File: `prompts/mobile_barber_phase6_ai_chat_agent.md`

### Objective
Add a smart AI chat agent for mobile barber booking.

### Agent Must Handle
Customer can say:
- "I need a haircut at home tomorrow"
- "Can someone come to San Jose today?"
- "How much for fade and beard?"
- "Book me after 5 PM"
- "I want John to cut my hair"
- "Do you speak Vietnamese?"
- "Can I upload a photo of the style I want?"

### Agent Must Collect
- customer name
- phone
- service
- preferred date/time
- address/city/zip
- barber preference if any
- notes/style preference
- photo if available

### Agent Must Not
- invent availability
- invent prices
- confirm without checking calendar
- ignore travel radius
- book overlapping times
- reveal internal vendor data

### Agent Flow
1. Understand intent.
2. Ask missing questions.
3. Check service area.
4. Check services/prices.
5. Check availability.
6. Present booking summary.
7. Ask final confirmation.
8. Create booking.
9. Give confirmation message.

### Multilingual
Support at least:
- English
- Vietnamese
- Spanish

Agent should respond in the customer's language when detected.

### Verification
Create scenario tests:
- successful booking
- missing address
- unavailable time
- out-of-service area
- customer changes time
- customer asks price only
- customer asks to cancel/reschedule
- Vietnamese conversation
- Spanish conversation

---

## PHASE 7 — Smart AI Voice Booking Agent
File: `prompts/mobile_barber_phase7_ai_voice_agent.md`

### Objective
Add voice/talk support for the Mobile Barber AI booking assistant using the existing DuLichCali AI voice pattern.

### Requirements
- Customer can tap "Talk to Barber Assistant"
- AI greets customer naturally
- AI detects language where possible
- AI asks booking questions by voice
- AI confirms booking summary before creating booking
- AI gives final confirmation
- Voice UI must be touch-friendly on mobile

### UI Requirements
- Large talk button
- Large exit/close button
- Manual language selection lower on screen if still needed
- Clear status:
  - listening
  - thinking
  - confirming
  - booked
- Fallback to text chat if mic permission fails

### Important
Do not break existing salon AI receptionist or ride AI assistant.

### Verification
Manual tests:
- mic permission allowed
- mic permission denied
- English booking
- Vietnamese booking
- customer changes time mid-conversation
- AI does not confirm unavailable slot

---

## PHASE 8 — Availability, Travel Buffer, and Service Area Engine
File: `prompts/mobile_barber_phase8_availability_travel_engine.md`

### Objective
Create a robust mobile-service scheduling engine.

### Must Handle
- service duration
- cleanup buffer
- travel buffer
- vendor working hours
- unavailable blocks
- existing bookings
- same-day booking cutoff
- city/zip/service area validation
- future support for distance-based price

### Functions
Implement reusable helpers such as:
- `isWithinServiceArea(vendor, address)`
- `calculateAppointmentWindow(service, requestedTime, vendor)`
- `checkMobileBarberAvailability(vendorId, start, end)`
- `findNextAvailableSlots(vendorId, serviceId, dateRange)`
- `calculateMobileBarberPrice(vendor, service, address)`

Use project's existing style and naming.

### Verification
Tests:
- overlap detection
- back-to-back appointments with cleanup buffer
- travel buffer between appointments
- outside working hours
- unavailable day
- out-of-area address
- next available slot suggestions

---

## PHASE 9 — Notifications and Confirmation Messages
File: `prompts/mobile_barber_phase9_notifications.md`

### Objective
Add confirmation and reminder messaging hooks.

### Support
Use existing app notification pattern if available.
Booking confirmation should include:
- customer name
- barber/vendor
- service
- date/time
- estimated duration
- price
- address summary
- contact phone
- cancellation/reschedule note

### Channels
Implement safely:
- in-app confirmation
- vendor dashboard alert
- optional SMS/email hook if existing infrastructure exists
- do not require Twilio if not currently approved

### STOP/HELP Compliance
If SMS is used, follow existing DuLichCali SMS compliance copy.

### Verification
Test:
- confirmation generated
- vendor sees new booking
- customer sees final booking summary
- no duplicate notification spam

---

## PHASE 10 — Customer Account, Booking History, and Rebooking
File: `prompts/mobile_barber_phase10_customer_history.md`

### Objective
Add customer-friendly booking history and rebooking.

### Features
Customer can:
- see upcoming appointments
- see past haircut bookings
- rebook same service/barber
- save style preference
- save notes
- optionally upload style photos

Vendor can:
- see customer cut history
- see notes/preferences
- see previous service

### Privacy
- Customer address must be protected.
- Only vendor involved in booking can see details.
- Public pages must not expose private data.

### Verification
Test:
- customer history loads by phone/account
- rebook creates a new pending flow
- previous notes do not auto-publish publicly

---

## PHASE 11 — Reviews, Ratings, and Barber Portfolio
File: `prompts/mobile_barber_phase11_reviews_portfolio.md`

### Objective
Add trust-building features.

### Customer-Facing
- Barber portfolio/gallery
- Before/after haircut images if vendor uploads them
- Reviews
- Ratings
- Service badges:
  - fade
  - beard trim
  - kids cut
  - senior cut
  - Vietnamese-speaking
  - Spanish-speaking

### Vendor-Facing
Vendor can:
- upload portfolio images
- manage display order
- hide inappropriate images
- respond to reviews if existing pattern supports it

### Verification
Test:
- portfolio loads
- missing gallery fallback
- reviews display
- vendor can hide/show images
- page remains mobile-friendly

---

## PHASE 12 — Final Integration, QA, and Regression
File: `prompts/mobile_barber_phase12_final_qa.md`

### Objective
Run full integration and regression testing.

### Required Test Matrix

Customer:
- landing page
- vendor page
- manual booking
- AI chat booking
- AI voice booking
- booking confirmation
- unavailable slot
- out-of-service-area address
- reschedule/cancel if implemented

Vendor:
- dashboard
- services
- availability
- bookings
- status updates
- customer details

Regression:
- homepage
- salon vendor page
- salon AI receptionist
- food vendor pages
- ride/airport booking
- travel packages
- marketplace navigation
- mobile nav
- desktop nav

### Deliverables
Create: `docs/mobile_barber_final_qa_report.md`

Include:
- what was implemented
- files changed
- tests run
- pass/fail matrix
- known limitations
- recommended next upgrades

### PASS Criteria
The phase passes only if:
- Mobile barber customer flow works
- Vendor flow works
- AI chat does not invent bookings
- Voice flow does not break existing AI flows
- No major existing DuLichCali feature is broken

---

## Recommended invocation

Save each phase into its own prompt file (done) and run Phase 0 first:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_phase0_discovery_audit.md --max-loop 3
```

Only proceed to the next phase after the current one reaches PASS or has a clear blocker report.

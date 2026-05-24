# Mobile Barber Phase 0 Discovery Audit

Date: 2026-05-23

Prompt source of truth: `prompts/mobile_barber_phase0_discovery_audit.md`

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`

## Phase 0 Result

PASS for discovery scope. This phase made no product code changes. The safest Mobile Barber path is additive: add a new customer route, data module, availability validator, and vendor-admin surface while reusing the existing static-hosted page pattern, marketplace vendor model shape, salon AI/receptionist UI, vendor-scoped Firestore subcollections, and notification/email queue infrastructure.

Mobile Barber must not reuse the salon availability checker as-is. It can reuse its overlap, staff schedule, service duration, booking-state, and prompt-contract ideas, but mobile in-home service also needs address/service-area validation and travel buffers before any booking is confirmed.

## Current Architecture Summary

DuLichCali is a static Firebase Hosting app with plain HTML, CSS, and browser JavaScript. There is no frontend build step in `package.json`; pages load scripts directly with cache-busted `?v=YYYYMMDDx` strings.

Primary routes are static files or folders:

- Homepage: `index.html`, `style.css`, `script.js`, `desktop.css`
- Marketplace hub and vendor rendering: `marketplace/index.html`, `marketplace/marketplace.js`, `marketplace/services-data.js`, `marketplace/marketplace.css`
- Salon category routes: `nailsalon/index.html`, `hairsalon/index.html`
- Food route: `foods/index.html`
- Generic vendor detail route: `vendor-detail.html`
- Ride/airport booking: `airport.html`, `ride-intake.js`, `ride-booking.js`, `ride-avail.js`, `workflowEngine.js`
- Travel booking: `travel.html`, `travel-packages.js`, `travel-booking.js`, `destinations.js`
- Admin surfaces: `vendor-admin.html`, `salon-admin.html`, `driver-admin.html`
- Cloud Functions: `functions/index.js`, `functions/travelDispatch.js`

`marketplace/marketplace.js` is the main marketplace SPA renderer. It initializes by category, renders directories when no `?id=` is present, and renders single-vendor pages when `?id=<vendorId>` is present. Salon vendors use a shared premium detail template through `renderSalonVendorDetail`, `loadSalonVendorFirestore`, and `_renderSalonDetailContent`.

## Routing System

Existing routing is file/folder based:

- `/marketplace/` renders the hub and category views.
- `/nailsalon/?id=luxurious-nails` and `/hairsalon/?id=beauty-hair-oc` render salon vendor detail pages through `Marketplace.init('nails')` or `Marketplace.init('hair')`.
- `vendor-detail.html?id=<vendorId>` fetches a vendor, rewrites history to the category path, then delegates to `Marketplace.init(biz.category)`.

Recommended Mobile Barber route:

- Add `mobile-barber/index.html` for `/mobile-barber/`, matching the Phase 2 and Phase 3 prompts.
- If Firebase Hosting rewrites are needed later, add a route rewrite in `firebase.json`; otherwise keep the static-folder route so refresh works without a frontend router.
- For vendor detail, prefer `/mobile-barber/vendor.html?id=<vendorId>` or `/mobile-barber/?id=<vendorId>` unless a later Firebase rewrite explicitly supports `/mobile-barber/vendor/:vendorId`.
- Use `Marketplace` patterns, but do not force Mobile Barber into existing `nails` or `hair` category behavior unless later refactoring makes service-area validation category-aware.

## Vendor Model

Current static vendor model lives in `marketplace/services-data.js` under `window.MARKETPLACE`:

- `categories` includes `nails`, `hair`, and `food`.
- `businesses` contains vendor records with fields such as `id`, `category`, `active`, `featured`, `region`, `city`, `address`, `phone`, `phoneDisplay`, `staff`, `services`, `hours`, `bookingEnabled`, `bookingType`, and `aiReceptionist`.
- Salon service entries use `name`, `category`, `price`, `duration`, `durationMins`, `desc`, `assignedStaff`, and `active`.
- Salon staff entries use `name`, `role`, `specialties`, `assignedServices`, `schedule`, and `active`.

Live vendor data overlays static data through Firestore:

- `vendors/{vendorId}` for profile/settings/hours.
- `vendors/{vendorId}/services/{serviceId}` for active public services.
- `vendors/{vendorId}/staff/{staffId}` for staff schedules and service assignments.
- `vendors/{vendorId}/bookings/{bookingId}` for salon/food vendor bookings.
- `vendors/{vendorId}/notifications/{notificationId}` for vendor alerts.
- `vendors/{vendorId}/emailQueue/{emailId}` for email Cloud Function delivery.

Recommended Mobile Barber vendor model should follow the same vendor-scoped pattern. A top-level `vendors/{vendorId}` document with `category: "mobile_barber"` keeps admin membership, notifications, emailQueue, and future vendor tooling aligned with current rules.

## Salon Booking Logic

Reusable concepts:

- `nailsalon/receptionist.js` has `NailAvailabilityChecker.check(biz, draft)`, exposed as `window.NailAvailabilityChecker`.
- It checks selected staff schedule, service duration, closing time, staff booking conflicts, customer duplicate conflicts, pending escalations, and parallel service rules.
- It writes confirmed AI bookings to `vendors/{vendorId}/bookings/{bookingId}` through `_submitDirectBooking`.
- It writes vendor notifications to `vendors/{vendorId}/notifications`.
- It optionally writes confirmation emails to `vendors/{vendorId}/emailQueue`.
- `salon-admin.html` has manual booking validation through `_checkManualAvail`, `saveManualBooking`, and `_mbDoSave`.

Important limitation:

- Current salon AI direct booking writes `status: "confirmed"` after availability passes. Mobile Barber must not confirm until barber availability, service duration, travel buffer, customer address/service area, and existing appointments all pass.
- `NailAvailabilityChecker` only understands salon staff schedules and same-location appointment overlap. It does not calculate drive time, service radius, ZIP eligibility, address completeness, or travel buffers.

Recommended later-phase approach:

- Extract or mirror the useful overlap and schedule logic into a new `mobile-barber/mobile-barber-availability.js`.
- Add explicit checks for `serviceArea`, `travelRadiusMiles`, `baseTravelFee`, `travelBufferMinutes`, `cleanupBufferMinutes`, and existing mobile barber bookings.
- AI and manual booking must call the same Mobile Barber availability validator.

## AI Receptionist Logic

Primary AI files:

- `ai-engine.js`: model routing client. Appointment prompts use `AIEngine.call('appointment' | 'nails' | 'food' | 'translation', ...)` style dispatch.
- `nailsalon/receptionist.js`: vendor AI widget, prompt builder, language detection, booking state machine, voice-mode integration, availability guard, direct booking writer, email prompt, image upload.
- `nailsalon/voice-mode.js`: salon voice mode.
- `nailsalon/phone-intake.js` and `nailsalon/customer-memory.js`: supporting salon intake/memory behavior.
- `aiOrchestrator.js` and `functions/index.js`: server-side AI orchestration/proxy paths.
- `chat.js` and `workflowEngine.js`: global assistant and structured workflows for ride, tour, nail, and hair intake.

Reusable AI patterns:

- Vendor-specific `aiReceptionist` config in `services-data.js`.
- Prompt sections for language, business info, services, hours, real-time clock, staff schedule, and booking-state JSON markers.
- Non-bypassable guard in `nailsalon/receptionist.js` that prevents the AI from claiming it cannot check availability or prematurely confirming without system validation.
- Voice-mode integration can be reused conceptually, but barber voice copy and booking fields need their own prompt contract.

Recommended Mobile Barber AI:

- Add a dedicated Mobile Barber assistant module rather than adding barber-specific conditionals deep inside `nailsalon/receptionist.js`.
- Reuse the widget shell/UI and state-machine structure, but require extra fields: service, address, city/ZIP, date, time, barber preference, customer name, phone, optional notes/photo.
- The AI should produce a booking draft only. The Mobile Barber availability validator must be the only path that can return a confirmable result.

## Firestore Collections Observed

Current rules and code reference these collections:

- `vendors/{vendorId}`
- `vendors/{vendorId}/staff/{doc}`
- `vendors/{vendorId}/services/{doc}`
- `vendors/{vendorId}/bookings/{doc}`
- `vendors/{vendorId}/notifications/{doc}`
- `vendors/{vendorId}/emailQueue/{doc}`
- `vendors/{vendorId}/menuItems/{doc}`
- `vendors/{vendorId}/inventory/{doc}`
- `vendors/{vendorId}/serviceMaterials/{doc}`
- `vendors/{vendorId}/staffCompensation/{doc}`
- `vendors/{vendorId}/payrollPeriods/{doc}`
- `vendorUsers/{uid}`
- `bookings/{bookingId}` for ride/global workflow bookings
- `drivers/{driverId}`
- `driverUsers/{uid}`
- `driver_compliance/{driverId}`
- `rideNotifications/{notifId}`
- `dispatchQueue/{docId}`
- `bookingOffers/{docId}`
- `travel_packages/{pkgId}`
- `travel_bookings/{bookingId}`
- `travel_drivers/{driverId}`
- `travel_drivers/{driverId}/assigned_dates/{dateId}`
- `travel_dispatch/{bookingId}`
- `travelAssignments/{docId}`
- `travel_vehicles/{vehicleId}`
- `escalations/{escalationId}`
- `vendor_signups/{signupId}`
- `pending_signups/{docId}`
- `videoRenderJobs/{jobId}`
- `rideRatings/{bookingId}`

Current `firestore.rules` has public reads for `vendors`, `vendors/{vendorId}/staff`, and `vendors/{vendorId}/services`; vendor-member writes for those top-level salon resources; and broad authenticated access for other vendor subcollections. This supports additive mobile barber vendor subcollections, but privacy rules should be tightened before exposing customer address-heavy bookings.

## Firestore Collection Proposal

Prefer vendor-scoped collections for consistency with existing admin and notification infrastructure:

- `vendors/{vendorId}` with `category: "mobile_barber"` and mobile barber profile fields.
- `vendors/{vendorId}/services/{serviceId}` for public service catalog.
- `vendors/{vendorId}/staff/{barberId}` for barber profiles, skills, weekly schedule, active state, and service assignments.
- `vendors/{vendorId}/availability/{availabilityId}` for overrides, blackouts, service-area windows, and travel rules if staff schedule is not enough.
- `vendors/{vendorId}/bookings/{bookingId}` for customer in-home appointments.
- `vendors/{vendorId}/customers/{customerId}` for customer history, consent, notes, and preferences.
- `vendors/{vendorId}/agentSessions/{sessionId}` for AI summaries and draft state if persistent sessions are needed.
- `vendors/{vendorId}/notifications/{notificationId}` for vendor alerts.
- `vendors/{vendorId}/emailQueue/{emailId}` for email delivery using existing Cloud Function infrastructure.

If later phases require separate top-level reporting or query isolation, add mirrored index collections:

- `mobileBarberBookings/{bookingId}` as a denormalized mirror for admin analytics or dispatch-style queries.
- `mobileBarberServiceAreas/{areaId}` if multiple vendors share configured cities/ZIPs.

Do not store customer home addresses in publicly readable documents. Booking documents with address fields should require authenticated vendor access for reads, or use a public-create/server-owned write path with restricted reads.

## Customer Booking Forms

Current customer booking surfaces:

- Homepage/ride booking uses `script.js`, `ride-intake.js`, `ride-booking.js`, `ride-avail.js`, and `workflowEngine.js`.
- Food vendor order form in `marketplace/marketplace.js` writes `vendors/{vendorId}/bookings` and notifications after capacity checks.
- Salon public pages use `renderNailsBookingSection` plus `nailsalon/receptionist.js`; older form-style appointment submit still uses Formspree in `initBookingForm`.
- Travel booking uses `travel-booking.js` and `travel_bookings`.

Recommended Mobile Barber booking form:

- Add a dedicated form in `mobile-barber/index.html` or a Mobile Barber vendor detail renderer.
- Required fields: service, customer name, phone, service address, city, ZIP, requested date, requested time.
- Optional fields: barber preference, email, notes, reference photo, access/parking notes.
- Submit path must call `MobileBarberAvailability.check()` before writing a confirmed or pending booking.
- Status should be `pending_confirmation` unless the validation and vendor policy explicitly allow immediate confirmation.

## Vendor Dashboard

Current vendor/admin options:

- `vendor-admin.html` is a mobile food/menu admin surface.
- `salon-admin.html` is the most relevant admin for service businesses. It manages services, staff, availability, bookings, inbox, customers, settings, payments, inventory, AI OS modules, and manual booking.
- Vendor membership is represented through `vendorUsers/{uid}` and `isVendorMember(vendorId)` in Firestore rules.

Recommended Mobile Barber dashboard:

- Add a Mobile Barber mode to `salon-admin.html` only if the change can be kept category-driven and non-breaking.
- Safer Phase 5 path: create `mobile-barber/admin.html` using the same Firestore pattern, then refactor shared admin pieces later.
- Reuse service/staff/booking concepts, but add address, map/service-area display, travel buffer, travel fee, and customer communication fields.

## Notification, SMS, and Email Hooks

Current notification hooks:

- `notifications.js` queues ride emails and in-app notifications.
- `functions/index.js` has `onEmailQueue` triggered by `vendors/{vendorId}/emailQueue/{emailId}`.
- `functions/index.js` has `onVendorNotification` and `onRideNotification` Twilio paths, but SMS is disabled through `SMS_ENABLED = false`.
- `salon-admin.html` manual SMS buttons open the local SMS app via `sms:` links rather than sending server-side SMS.
- `nailsalon/receptionist.js` writes vendor notifications and optional confirmation email queue docs after appointment booking.

Recommended Mobile Barber notifications:

- Reuse `vendors/{vendorId}/notifications` for vendor dashboard alerts.
- Reuse `vendors/{vendorId}/emailQueue` after adding `bookingType: "mobile_barber"` handling in `functions/index.js`.
- Do not enable server-side SMS in Mobile Barber phases unless Twilio is intentionally reprovisioned and approved.
- Use manual `sms:` links in admin as a safe initial confirmation path.

## Existing Reusable Pieces

Vendor profile/template:

- `marketplace/services-data.js` for vendor and service data shape.
- `marketplace/marketplace.js` salon detail sections: hero, info strip, services, AI section, staff/inspiration/trust sections.
- `nailsalon/salon.css` and `marketplace/marketplace.css` for mobile-first salon-style layouts.

Booking validation:

- `nailsalon/receptionist.js` `NailAvailabilityChecker.check()` as a reference implementation.
- `salon-admin.html` `_checkManualAvail()` as the manual booking counterpart.
- `ride-avail.js` for route-style conflict checking and buffer concepts.
- `functions/travelDispatch.js` for server-side assignment and race-condition guard ideas.

Availability logic:

- Staff weekly schedules in `vendors/{vendorId}/staff`.
- Service durations in `vendors/{vendorId}/services`.
- Existing appointment overlap in `vendors/{vendorId}/bookings`.
- Driver availability pattern in `ride-avail.js` for future conflict windows.

Service menu model:

- `services-data.js` salon service fields and category arrays.
- Firestore `vendors/{vendorId}/services` live overrides loaded by `loadSalonVendorFirestore`.

AI chat/voice:

- `nailsalon/receptionist.js` widget/state machine/guard.
- `ai-engine.js` model routing.
- `nailsalon/voice-mode.js` voice UI behavior.
- `chat.js` and `workflowEngine.js` for global assistant routing awareness.

Location-aware logic:

- `location.js` and `regions.js` for region detection.
- `ride-booking.js` for normalized ride objects and region/location concepts.
- `ride-avail.js` for availability checks with duration and buffer.
- Mobile Barber still needs a new customer-address/service-radius validator.

## Implementation Map For Later Phases

Phase 1, data model:

- Add `mobile-barber/mobile-barber-data.js`.
- Add `mobile-barber/mobile-barber-availability.js`.
- Add seed data script or static sample vendor entry.
- Update `firestore.rules` for safe public create/private read patterns if using address-bearing booking docs.
- Add focused tests under `tests/` for schema validation and availability helpers.
- Exact likely files: `mobile-barber/mobile-barber-data.js`, `mobile-barber/mobile-barber-availability.js`, `tests/mobile-barber-*.js`, `firestore.rules`.

Phase 2, customer landing:

- Add `mobile-barber/index.html`.
- Add `mobile-barber/mobile-barber.css`.
- Add `mobile-barber/mobile-barber.js`.
- Optionally update `index.html`, `marketplace/index.html`, `landing-nav.js`, and `manifest*.json` only for entry points/navigation.
- Exact likely files: `mobile-barber/index.html`, `mobile-barber/mobile-barber.css`, `mobile-barber/mobile-barber.js`, plus entry-point links in `index.html` or `marketplace/index.html` only after the page is stable.

Phase 3, single-vendor page:

- Either extend `marketplace/services-data.js` with `category: "mobile_barber"` and a sample `mobile-barber` vendor, or keep Mobile Barber data in its own module and render independently.
- If extending marketplace, update `marketplace/marketplace.js` category handling and route mapping carefully.
- Reuse salon template sections only after verifying address/service-area controls fit without touching nails/hair behavior.
- Exact safer files: `mobile-barber/vendor.html`, `mobile-barber/mobile-barber.js`, `mobile-barber/mobile-barber.css`, `mobile-barber/mobile-barber-data.js`. Defer `marketplace/marketplace.js` unless shared marketplace listing is explicitly required.

Phase 4, manual booking:

- Add customer booking submit logic to `mobile-barber/mobile-barber.js`.
- Add shared validator tests for barber schedule, service duration, travel buffer, address, and conflicts.
- Write bookings to `vendors/{vendorId}/bookings` with `type: "mobile_barber_appointment"` and explicit address fields.
- Exact likely files: `mobile-barber/mobile-barber.js`, `mobile-barber/mobile-barber-availability.js`, `tests/mobile-barber-availability*.js`, `firestore.rules`.

Phase 5, vendor dashboard:

- Prefer `mobile-barber/admin.html` and `mobile-barber/mobile-barber-admin.js` first.
- Later consider category-driven reuse in `salon-admin.html` after the standalone admin proves the fields.
- Exact safer files: `mobile-barber/admin.html`, `mobile-barber/mobile-barber-admin.js`, `mobile-barber/mobile-barber.css`. Avoid `salon-admin.html` unless the implementation is strictly category-gated.

Phase 6 and 7, AI chat/voice:

- Add `mobile-barber/mobile-barber-receptionist.js`.
- Optionally add `mobile-barber/mobile-barber-voice.js` if `nailsalon/voice-mode.js` is too salon-specific.
- Update `ai-engine.js` only if a new service type key is needed.
- Exact likely files: `mobile-barber/mobile-barber-receptionist.js`, `mobile-barber/mobile-barber-voice.js`, `mobile-barber/index.html`, `mobile-barber/vendor.html`, maybe `ai-engine.js`.

Phase 8, availability/travel engine:

- Harden `mobile-barber/mobile-barber-availability.js`.
- Consider server-side callable validation in `functions/index.js` before final confirmation if race conditions become likely.
- Exact likely files: `mobile-barber/mobile-barber-availability.js`, `functions/index.js`, `tests/mobile-barber-availability*.js`.

Phase 9, notifications:

- Add `bookingType: "mobile_barber"` email templates in `functions/index.js`.
- Reuse vendor notifications.
- Keep server SMS disabled unless explicitly approved.
- Exact likely files: `functions/index.js`, `mobile-barber/mobile-barber.js`, `mobile-barber/mobile-barber-receptionist.js`, notification tests if added.

Phase 10+, customer history/reviews/final QA:

- Add `vendors/{vendorId}/customers`.
- Add customer lookup by normalized phone.
- Add review/portfolio subcollections only after booking core is stable.
- Exact likely files: `mobile-barber/mobile-barber-customer-history.js`, `mobile-barber/mobile-barber-reviews.js`, `mobile-barber/vendor.html`, `firestore.rules`, focused tests.

## Non-Breaking Integration Strategy

1. Keep Mobile Barber in its own folder first: `mobile-barber/`.
2. Avoid changing `nailsalon/receptionist.js`, `salon-admin.html`, and `marketplace/marketplace.js` until a later phase has a clear scoped need.
3. Reuse data shapes and helper ideas, not salon-specific files directly.
4. Store Mobile Barber bookings under the vendor namespace to preserve existing vendor membership and notification patterns.
5. Gate every booking creation through a Mobile Barber validator that checks schedule, duration, travel buffer, address/service area, and existing bookings.
6. Keep initial booking status as `pending_confirmation` if any check is inconclusive.
7. Add tests before wiring UI submit buttons.
8. Update HTML cache-busting strings only when `.js` files are actually modified.

## Risks And Regression Areas

- Privacy risk: home service addresses must not be readable through the broad authenticated `vendors/{vendorId}/{sub=**}` fallback without a deliberate decision.
- Booking risk: current salon AI can direct-confirm after its validator passes; copying this blindly would violate Mobile Barber rules.
- Travel-time risk: existing salon availability does not account for drive time between appointments.
- Race-condition risk: client-only validation can double-book if two customers book the same barber/time at once. Later phases should consider transaction/callable validation for final confirmation.
- Admin scope risk: modifying `salon-admin.html` is high-blast-radius because it is large and powers existing salon operations.
- Marketplace risk: changing `marketplace/marketplace.js` category rendering can affect nails, hair, and food pages.
- Firestore rules risk: top-level public booking collections and broad vendor subcollection access are permissive; address-bearing data needs tighter rules.
- Notification risk: Twilio paths exist but are disabled. Do not rely on SMS delivery for booking confirmation.
- Asset/version risk: any modified `.js` file must have every corresponding HTML `?v=YYYYMMDDx` string bumped.

## Verification Plan For Later Phases

Recommended automated checks:

- Unit test Mobile Barber schema validation.
- Unit test availability overlap with service duration plus cleanup/travel buffers.
- Unit test service-area acceptance/rejection by city/ZIP/radius.
- Unit test AI booking draft cannot become confirmed without validator success.
- Dry run existing flows after each implementation phase with `scripts/ai/full_system_dry_run.sh`.

Manual verification:

- Mobile 375px customer booking page.
- Desktop 1280px customer booking page.
- Vendor page shows one real mobile barber vendor, not a generic directory.
- AI assistant asks for missing address/service-area details before offering a slot.
- Existing nails, hair, food, ride, travel, and vendor admin pages still load.

## End-of-Phase Report

Files changed:

- `docs/mobile_barber_audit.md`

Tests run:

- `bash scripts/ai/full_system_dry_run.sh` — `FINAL: PASS` with 251 passed, 0 failed.

Screenshots/manual verification instructions:

- No screenshots required for this docs-only phase.
- Review this audit and later use it as the implementation map for `prompts/mobile_barber_phase1_data_model.md`.

Blockers:

- No implementation blocker for Phase 0.
- Phase 1 should decide whether Mobile Barber bookings are stored only under `vendors/{vendorId}/bookings` or mirrored to a top-level collection for reporting.
- Firestore privacy rules must be revisited before saving customer home addresses in production.

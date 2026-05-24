# Mobile Barber — Phase 1: Data Model and Firestore Schema

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 0 (`docs/mobile_barber_audit.md`) must be PASS.

## Objective
Add the Mobile Barber data model.

## Required Collections
- `mobileBarberVendors`
- `mobileBarberServices`
- `mobileBarberAvailability`
- `mobileBarberBookings`
- `mobileBarberCustomers`
- `mobileBarberAgentSessions`

## Vendor Fields
```
{
  id, businessName, barberName, phone, email,
  profilePhoto, heroImage, serviceAreas, travelRadiusMiles,
  baseTravelFee, addressOptional, languages, active, rating,
  createdAt, updatedAt
}
```

## Service Fields
```
{
  id, vendorId, name, description, durationMinutes, price,
  cleanupBufferMinutes, travelBufferMinutes, category,
  active, imageUrl
}
```

## Booking Fields
```
{
  id, vendorId, customerName, customerPhone, customerEmail,
  serviceId, serviceName, servicePrice,
  address, city, zip,
  requestedDate, startTime, endTime,
  status, source, notes, photoUrls, aiConversationSummary,
  createdAt, updatedAt
}
```

## Tasks
1. Add schema/types/config files consistent with current project style (reference Phase 0 audit for which files).
2. Add seed data for one sample mobile barber vendor.
3. Add validation helpers.
4. Do not hardcode future production values into logic.
5. Keep the model extensible for multiple barbers.

## Verification
Tests or scripts must confirm:
- sample vendor loads
- services load
- bookings validate required fields
- schema does not affect existing vendors

## STRICT RULES — apply (see master prompt)
- Additive only. No modifications to existing vendor/booking models.
- Do not touch Firestore security rules without explicit approval; propose updated rules in the audit instead.

## End-of-phase report (required)
- files changed
- tests run
- blockers if any

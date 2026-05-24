# Mobile Barber — Phase 8: Availability, Travel Buffer, and Service Area Engine

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 7 PASS.

## Objective
Create a robust mobile-service scheduling engine.

## Critical Trigger Area
Per CLAUDE.md: "Booking availability check logic (nail salon, hair salon, airport/ride)". This phase adds the engine; reuse and extend existing availability primitives identified in Phase 0 — do not duplicate.

## Must Handle
- service duration
- cleanup buffer
- travel buffer
- vendor working hours
- unavailable blocks
- existing bookings
- same-day booking cutoff
- city/zip/service area validation
- future support for distance-based price

## Functions to Implement
Reusable helpers (names per master plan; align to project conventions identified in Phase 0):
- `isWithinServiceArea(vendor, address)`
- `calculateAppointmentWindow(service, requestedTime, vendor)`
- `checkMobileBarberAvailability(vendorId, start, end)`
- `findNextAvailableSlots(vendorId, serviceId, dateRange)`
- `calculateMobileBarberPrice(vendor, service, address)`

## Verification (REQUIRED)
- overlap detection
- back-to-back appointments with cleanup buffer
- travel buffer between appointments
- outside working hours
- unavailable day
- out-of-area address
- next available slot suggestions
- existing salon/ride availability still works (regression)

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

# Mobile Barber — Phase 3: Single Mobile Barber Vendor Page

Master plan: `prompts/mobile_barber_all_phases_codex_claude.md`
Prerequisite: Phase 2 PASS.

## Objective
Create a single-vendor page for each mobile barber.

## Route Example
`/mobile-barber/vendor/:vendorId` (or compatible with existing route style — confirm in Phase 0 audit).

## Page Must Show
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

## Critical Requirement
This page must NOT become a generic marketplace listing page.
It must behave like a real vendor page, similar to the Luxurious Nails vendor standard:
- vendor identity first
- services second
- booking third
- AI assistant tied to this vendor

See CLAUDE.md Critical Trigger Areas: "Vendor page data loading and context injection (who gets which services, staff, hours)".

## Verification
- valid vendor ID
- invalid vendor ID (404 / friendly error)
- missing image fallback
- mobile rendering (375px)
- desktop rendering (1280px)
- service list correct
- booking CTA opens correct flow
- AI assistant scoped to this vendor only

## Multilingual
vi/en/es from day one.

## STRICT RULES — apply (see master prompt)

## End-of-phase report (required)

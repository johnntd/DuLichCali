# Codex Review Request

Paste this as a comment on the GitHub PR, then type `@codex review` to trigger.

---

@codex review

Please review this PR for the DuLichCali project (dulichcali21.com).

## What to check

- Regressions against existing working behavior
- Broken routes or broken HTML page loading
- Firebase/Firestore read/write mistakes (wrong collection names, missing fields, schema drift)
- Booking logic bugs (availability not checked before confirmation, wrong pricing, wrong vehicle capacity)
- AI receptionist behavior regressions (real-time clock, staff schedule, multi-language, language detection)
- Vendor page rendering bugs (vendor-specific data missing, replaced by directory data)
- Mobile responsiveness issues (mobile is primary platform — check 375px viewport)
- Auth/session issues (vendor login PIN, driver login, admin access)
- Missing or broken JS version string bumps (`?v=YYYYMMDD` in HTML script tags)
- Incorrect data assumptions (hardcoded strings, wrong Firestore field names)
- Accidental secret exposure (API keys, Firebase credentials, customer data)
- Broken deployment/build behavior (firebase.json, functions/index.js startup errors)

## Project-specific risk areas

**Vendor pages:**
- Luxurious Nails (`/nailsalon`) is the reference standard for all salon/vendor pages.
- Beauty Hair OC (`/hairsalon`) must show vendor-specific contact info, services, staff, hours, address, phone, and AI receptionist.
- Vendor pages must NOT become city-wide directory pages.
- Each vendor page must show that vendor's actual data only.

**Booking:**
- AI booking must check driver/vehicle availability before confirming.
- Manual booking and AI booking should share the same validation path.
- Airport/ride booking must not assign a 4-seat vehicle to 7 or 12 passengers.
- Pricing must match the published rate table in destinations.js.

**Travel packages:**
- Remotion/YouTube promo video embedding must not break image carousels.
- Travel package carousel and showcase behavior must be preserved.

**AI receptionist:**
- Must use real-time clock + staff schedule + open/closed state.
- Must respond in the customer's detected language (vi / en / es).
- Must NOT hardcode strings in any language in source files.
- Voice mode must not be accidentally disabled.

**Location-aware logic:**
- Must not overwrite valid host/vendor data with incorrect inferred data.

**Multi-language:**
- Every new customer-facing string must exist in vi + en + es in the same commit.
- Never ship a string that only works in one language.

**JS version strings:**
- Every modified `.js` file must have its `?v=YYYYMMDD` bumped in ALL HTML files that load it.
- Failure to bump causes browsers to serve cached old version indefinitely.

**Security:**
- Do not expose API keys, Firebase credentials, customer booking data, or vendor private config.

## Output requested

1. **Critical issues** — must fix before merge
2. **High-priority issues** — strongly recommended
3. **Medium-priority issues** — worth noting
4. **Test gaps** — missing coverage
5. **Suggested verification steps** — exact flows to manually QA

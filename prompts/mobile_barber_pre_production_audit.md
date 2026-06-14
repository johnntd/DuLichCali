# Mobile Barber — Pre-Production Readiness Audit + Critical-Blocker Fix

## Mode
Audit-and-fix. Audit every Mobile Barber booking path for production readiness, then
fix **only confirmed critical blockers**. Do NOT deploy. Do NOT commit. Do NOT push.
Do NOT polish UI or refactor beyond what a confirmed blocker requires.

Classify every finding before acting: `CONFIRMED_BUG` / `VALID_IMPROVEMENT` /
`FALSE_POSITIVE` / `OUT_OF_SCOPE` / `NEEDS_HUMAN_DECISION`. Fix only `CONFIRMED_BUG`
that blocks safe production booking. Everything else → document, do not change.

---

## Primary goal
Customers must be able to book appointments safely, with no double-booking, across all
four booking paths, and every booking must use LIVE vendor database data (not stale
static seed data) and land in the correct barber's portal:

- Manual booking (modal)
- AI chat booking (`mobile-barber-agent.js`)
- Smart voice agent booking (`mobile-barber-voice.js`)
- AI hairstyle-preview booking (`mobile-barber-ai-preview.js`)

## Active barbers (currently two — the system MUST support future barbers, never a demo)
The two barbers active today are:
- **Tim Nguyen** — `tim-nguyen-bay` — serves the **Bay Area**
  (San Jose, Santa Clara, Sunnyvale, Milpitas, Campbell, Cupertino, Mountain View,
  Los Gatos, Fremont).
- **Michael Nguyen** — `michael-nguyen-oc` — serves **Orange County**
  (Irvine, Garden Grove, Westminster, Santa Ana, Fountain Valley, Huntington Beach,
  Costa Mesa, Anaheim, Tustin, Orange).

**Generic multi-vendor requirement (do NOT hardcode "exactly two"):** routing and data
loading MUST iterate over ALL active vendors loaded live from Firestore and match by each
vendor's own `serviceAreas`. Adding a third/fourth barber later (a new vendor doc with its
own service areas) MUST work with zero code changes — no `if vendorId === 'michael...' ||
'tim...'` branching, no two-element hardcoded arrays in the routing/booking path. Michael
and Tim are simply the two active rows today.

The customer should NOT have to pick a barber unless they explicitly request a favorite.
The system routes by the customer's address / city / ZIP against the live active-vendor set.

There is NO demo vendor and there must never be one. Do not introduce, reference, seed, or
leave any `demo` / `oc-mobile-barber-demo` / `demo-*` vendor or doc in code, data, or tests.

---

## Confirmed current state (read this before auditing — do not redo settled work)
A read-only pre-audit already established the following. Verify, do not assume, but do
not waste loops re-implementing what is already done:

1. **Firebase is already loaded + initialized** on `index.html`, `vendor.html`, and
   `dashboard.html` (v9.22.0 compat). Booking writes already reach the
   `mobileBarberBookings` Firestore collection. Do NOT re-add Firebase init.
2. **The booking-create Firestore rule `isValidMobileBarberBookingCreate()` uses
   `keys().hasAll([...])`, NOT `hasOnly`.** Adding new fields to the booking document
   (e.g. haircut-reference fields) does NOT violate the rule. **Do not change
   `firestore.rules`.** It is intentionally out of scope.
3. **Haircut-reference fields do NOT exist anywhere** in `mobile-barber/*.js`
   (no `selectedHaircut*`, `customerSelfie*`, `haircutImage*`). This is the single
   largest genuine gap: the barber currently has no reliable record of WHICH haircut
   the customer selected, especially for AI-generated styles. Treat capturing and
   displaying the haircut reference as a CONFIRMED critical blocker.
4. **Version-string high-water mark** for all `mobile-barber-*.js` on date `20260529`
   is `?v=20260529k`. The next safe version is `?v=20260529l` (then `m`, `n`, ...).
   Never reuse a string ≤ `20260529k`.
5. Existing diagnostic log namespaces already present:
   `[mobile-barber-agent-booking-write]`, `[mobile-barber-agent-schedule]`,
   `[mobile-barber-manual-booking]`, `[mobile-barber-dashboard]`, `[mobile-barber-promo]`,
   `[mobile-barber-ai-preview]`, `[mobile-barber-distance]`. The exact tags this audit
   requires (below) do NOT yet exist — add them.

---

## Allowed files
Only these files may be modified. Touching anything else is an automatic scope failure.

- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber-ai-preview.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/owner-bookings.js
- firestore.indexes.json  (ONLY if a new composite query is introduced; declaration-only, never deployed by this loop)
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-manual-booking.js
- tests/lib/mobile-barber-agent.js
- tests/lib/mobile-barber-ai-style-booking.js
- tests/lib/mobile-barber-data-model.js
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-promotions.js
- tests/lib/mobile-barber-promotion-activation.js
- tests/lib/mobile-barber-promotion-visibility.js
- tests/lib/mobile-barber-zero-price.js
- docs/mobile_barber_pre_production_audit.md

Do **NOT** touch:
- `firestore.rules` (rule already permits the new fields; changing it risks breaking the live booking path)
- `functions/` (Cloud Functions are deployed separately; not deployable from this loop — document any function-side gap as a risk instead of editing)
- `nailsalon/`, `hairsalon/`, `foods/`, `marketplace/`, `script.js`, `style.css`,
  `desktop.css`, `ai-engine.js`, `chat.js`, `workflowEngine.js`
- Any auth, driver, ride, food, or travel surface.
- The revoked service-account key or any credential file.

---

## Strict rules
1. **No deploy. No commit. No push.** End state is local edits + report only.
2. Additive, minimal patches. Fix confirmed blockers; do not refactor working code.
3. **Live database first (NON-NEGOTIABLE).** Every booking path MUST load fresh data
   from Firestore before booking: active vendors, active services, current prices,
   active promotions, barber working hours, unavailable blocks, existing bookings,
   customer history, service-area/ZIP coverage. Static `DATA.sample*` constants are a
   fallback ONLY when Firestore is unavailable, and that fallback MUST be logged
   (`source: 'static-fallback'`). Do not silently book off stale constants.
4. **Conflict check before every write** (all four paths). Block the write and offer
   alternates when any conflict exists. Never create a booking that overlaps an
   existing pending/confirmed/in-progress booking for the same barber.
5. **No hardcoded user-facing strings in any language** (vi/en/es). New strings go in
   the existing i18n tables for all three languages in the same change. Backend reasons
   route to the AI brain via `[SYSTEM: ...]` context, never as hardcoded customer text.
6. **Mobile-first.** Verify behavior at 375px before 1280px. No layout regressions.
7. **Cache-bust:** any `mobile-barber-*.js` you edit must have its `?v=` bumped to
   `?v=20260529l` (or the next free letter) in every HTML file that loads it
   (`index.html`, `vendor.html`, `dashboard.html`). Update the version assertions in
   `tests/lib/mobile-barber-landing.js` to match.
8. Preserve all existing passing behavior. Keep the localStorage fallback.
9. Do not break Luxurious Nails, hair salon, or any other vendor surface.

---

## Audit areas (classify each; fix only confirmed blockers)
1. Manual booking — reads live data? conflict-checked? writes real doc to correct portal?
2. AI chat booking — same.
3. Smart voice booking — same.
4. AI hairstyle-preview booking — same, PLUS captures the selected/generated haircut reference.
5. Promotions — applied from LIVE database, not static.
6. Services / pricing — LIVE current price at booking time.
7. Vendor schedule / working hours — LIVE; bookings outside hours blocked.
8. Unavailable blocks — LIVE; overlapping an unavailable block blocked.
9. Existing bookings — LIVE; loaded before conflict check.
10. Duplicate customer bookings — same customer/phone double-booking blocked.
11. Cross-service owner conflicts — if `ownerId` applies, owner-wide overlap blocked.
12. Vendor portal visibility — booking appears in the assigned barber's portal.
13. Confirmation flow — no "waiting for system" dead end; no UI-only booking.
14. Notification flow — new-booking notification fires (or document the Cloud-Function gap as a risk).

---

## Routing rules
- Bay Area address/city/ZIP → `tim-nguyen-bay`.
- Orange County address/city/ZIP → `michael-nguyen-oc`.
- Ambiguous address (no resolvable city/ZIP) → ask the customer for city/ZIP; do not guess.
- Clearly outside both service areas → show "service unavailable" OR create a
  `vendor_review` request (status `vendor_review`), never a confirmed booking.
- Possibly serviceable but unsure → create a `vendor_review` request, not a confirmed booking.
- Emit `[booking-route]` (see logs) on every routing decision.

---

## Haircut-reference requirement (CONFIRMED critical blocker)
The barber must know exactly which haircut the customer chose. The booking document MUST
carry a durable haircut reference. Add these fields to the built booking object in
`mobile-barber-booking.js` (`buildBooking` / equivalent), populated by each path:

```
selectedHaircutSource           // 'service_list' | 'ai_generated' | 'customer_uploaded'
selectedHaircutTitle
selectedHaircutDescription
selectedHaircutImageUrl
selectedHaircutImageStoragePath
selectedHaircutThumbnailUrl
selectedHaircutBarberNotes
selectedHaircutMaintenanceLevel
selectedHaircutGeneratedAt
selectedHaircutPromptSnapshot
customerSelfieUrl               // only if the customer consented
customerSelfieStoragePath       // only if the customer consented
```

Path-specific population:
- **Service-list booking:** copy `serviceId`, `serviceName`, `serviceDescription`,
  `serviceImageUrl`, `barberNotes` into the matching haircut-reference fields with
  `selectedHaircutSource = 'service_list'`.
- **AI-generated booking:** store BOTH (1) the generated hairstyle image URL/data and
  (2) snapshot metadata (`selectedHaircutPromptSnapshot`, `selectedHaircutGeneratedAt`,
  title/description). `selectedHaircutSource = 'ai_generated'`.

**Durability:** do NOT store only a temporary/expiring link. If the AI-preview already
yields a persistent URL, store it. If it only yields a transient/data URL, persist it to
Firebase Storage and store both the download URL and `selectedHaircutImageStoragePath`.
**If Firebase Storage is not wired up on these pages, do NOT invent it** — store the
reference metadata you do have, set a clear flag, and document the durable-storage gap as
a remaining risk + NEEDS_HUMAN_DECISION. Persisting the AI image to Storage may be a
follow-up if it can't be done safely within the allowed files.

**Vendor portal (`mobile-barber-dashboard.js`) appointment detail MUST show:**
customer, phone, address, date/time, service, price/promo, selected haircut image,
haircut/AI style name, barber notes, customer notes, original customer selfie (if
consented), the selected AI preview image, confirmation preference, payment method,
status, and accept/reject/reschedule controls. Add only what is missing.

Emit `[haircut-reference]` (see logs) whenever a haircut reference is attached to a booking.

---

## Booking-write requirement
Every completed booking on every path creates a REAL Firestore document and appears in
the correct portal: Bay Area → Tim's portal, Orange County → Michael's portal. No
UI-only "saved" state that never reaches the database. No "waiting for system" dead end.
If a write must fall back to localStorage (offline), the customer must see an honest
"queued on this device" status (i18n vi/en/es), never a fake confirmation.

---

## Diagnostic logs (add or verify — use these EXACT tags)
- `[booking-live-data]` — `vendorId, servicesLoaded, promotionsLoaded, scheduleLoaded, source`
- `[booking-route]` — `address, city, zip, assignedVendorId, reason`
- `[booking-conflict-check]` — `requestedStart, requestedEnd, conflicts, result`
- `[booking-write]` — `bookingId, vendorId, status, source`
- `[haircut-reference]` — `bookingId, source, imageUrl, storagePath, barberNotes`

---

## Tests to add / update (headless — these are the loop's PASS evidence)
Put assertions in the `tests/lib/mobile-barber-*.js` files (the runner requires each lib
and runs it). Cover every TEST-MATRIX item that is verifiable without a live browser:

- Routing: Bay address → `tim-nguyen-bay`; OC address → `michael-nguyen-oc`;
  out-of-area → `vendor_review` (not a confirmed booking); ambiguous → asks for city/ZIP.
- Live-data source: each path selects Firestore data when available and logs
  `source: 'static-fallback'` only when not.
- Conflict check: same-barber overlap blocked + alternates offered; duplicate
  same-customer booking blocked; outside working hours blocked; unavailable-block
  overlap blocked; cancelled/completed bookings do NOT block; pending/confirmed/
  in-progress DO block; owner-wide conflict blocked when `ownerId` applies.
- Haircut reference: built booking from a service-list selection carries
  `selectedHaircutSource='service_list'` + image/title/notes; AI-generated path carries
  `selectedHaircutSource='ai_generated'` + generated image + prompt snapshot.
- Promotions/services/schedule: a promotion/service/hours value changed in the
  (stubbed) live data is reflected in the next booking (proves live read, not constant).
- Cache-bust assertions in `tests/lib/mobile-barber-landing.js` match the bumped `?v=`.

Items that REQUIRE a live browser, real Firestore writes, screenshots, or a real
Claude/Gemini brain (e.g. real notification delivery, on-device manual smoke,
screenshots) are NOT achievable in this headless loop — list each as
"manual verification required" in the report rather than faking it.

---

## Verification (MANDATORY — this is an audit-type prompt, so the loop will NOT auto-run the gate; run it explicitly)
1. `node tests/runner.js` — must report 0 failed.
2. `bash scripts/ai/full_system_dry_run.sh` — must end `FINAL: PASS`. Paste the final
   summary line into the report. Test count must be ≥ the current baseline (you are
   adding tests, not removing).
3. `node --check` every `.js` file you edited.

If `FINAL: PASS` is not achieved, the audit result is BLOCKED — write the report with the
exact failing test(s) and stop. Do not mark complete on a failing dry run.

---

## Required report — `docs/mobile_barber_pre_production_audit.md`
Follow the CLAUDE.md review format and include:
- Verdict (Approve / Request changes / Block) + deployment recommendation (and an explicit
  "DO NOT DEPLOY" reminder — deploy is the user's call, not this loop's).
- Per-area findings table with classifications (CONFIRMED_BUG / VALID_IMPROVEMENT /
  FALSE_POSITIVE / OUT_OF_SCOPE / NEEDS_HUMAN_DECISION) and root cause for each blocker.
- Files changed (full list) and what each change fixes.
- Test matrix results: the 18 items, marked PASS / BLOCKED(manual) / FAIL, with the
  automated test name backing each PASS.
- Live-database confirmation: which paths read Firestore vs fall back, with the
  `[booking-live-data]` evidence.
- Routing confirmation: Bay→Tim, OC→Michael, out-of-area→vendor_review.
- Haircut-reference confirmation: fields populated per source; vendor-portal display;
  durable-storage status (and the gap, if Storage isn't wired).
- Conflict-matrix confirmation: which states block, which don't.
- Diagnostic-log confirmation: the five tags present and where.
- Commands run with exact output excerpts; dry-run final line.
- Screenshots: state "manual verification required — headless loop cannot capture" for
  any UI screenshot the user asked for.
- Remaining risks (durable image storage, notification Cloud-Function delivery, real-brain
  paraphrasing, live-write smoke) as explicit bullets.

## PASS criteria
Mark PASS only if ALL of the following hold:
- All four booking paths create REAL Firestore bookings (verified by headless tests +
  code review; live-write smoke noted as manual).
- No conflicting booking can be created (overlap/duplicate/outside-hours/unavailable/
  owner-wide all blocked; cancelled/completed do not block) — proven by tests.
- Every booking path reads LIVE vendor data, with logged static fallback only.
- Tim/Michael routing works; out-of-area → vendor_review.
- Promotions / services / schedule changes are read live (proven by tests).
- Selected haircut image/reference is attached to the booking and shown in the vendor
  portal (durable-storage gap, if any, documented as a risk, not a silent failure).
- `node tests/runner.js` 0 failed AND `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.
- Only allowed files were modified.

If any criterion cannot be met safely within the allowed files, STOP, write the report as
BLOCKED, and state exactly which criterion is blocked and why. Do not deploy under any
circumstances.

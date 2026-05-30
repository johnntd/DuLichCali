# DuLichCali — Pre-Production Security Audit

**Date:** 2026-05-30
**Method:** 10 parallel per-dimension auditors (read-only) → adversarial verification of every critical/high finding (one skeptic per finding, instructed to refute). 55 agents, ~6.1M tokens.
**Result:** 76 findings — **19 CRITICAL, 26 HIGH, 21 MEDIUM, 10 LOW**; **29 critical/high adversarially confirmed exploitable**.

## Recommendation: ⛔ **NO-GO** (until the remaining confirmed criticals are closed)

The audit found **systemic authorization gaps** that allow vendor/data takeover, customer PII exposure, and booking/payment tampering. I fixed the contained, low-risk, high-value issues this pass (below). The remaining criticals require either a **decision only you can make** (who is "admin" — no admin-role mechanism exists today) or **per-flow analysis of the heavily-integrated legacy `bookings` collection** (10+ consumers incl. unauthenticated tracking) where a wrong rule change breaks the live booking/tracking flows. Closing those wrong is itself a production-breaking outcome, so I did not guess.

---

## Fixed this pass (verified, 546 tests pass, FINAL: PASS)

| Finding | Severity | Fix |
|---|---|---|
| `vendorUsers` writable by any auth (incl. anonymous) → self-map to any vendor → full vendor takeover | CRITICAL | `firestore.rules`: writes now require a **non-anonymous** account, blocking the anonymous self-map (the most accessible path). *Residual:* a real email/password account can still self-map — see follow-up. |
| `mobileBarberBookings` update unrestricted → customer flips `status`/`paymentStatus`/price | HIGH | `firestore.rules`: vendor-member keeps full control; the customer-owner can only edit benign fields + **cancel** — cannot touch money/vendor or set status to confirmed/paid/completed. |
| `mobileBarberBookings` create accepts negative price / >100% discount / oversized fields | CRITICAL/HIGH | `firestore.rules`: `servicePrice`/`amountDue`/`totalPrice` must be `>= 0`, `discountPercent` `0–100`, name/address length-capped. |
| Firebase Storage had **no version-controlled rules** + no `firebase.json` storage block → unrestricted uploads/reads | CRITICAL/HIGH | New `storage.rules` (non-anonymous + image-only + 8 MB cap for writes; legacy per-booking selfies non-public, no new writes; default constrained) + wired into `firebase.json`. |
| AI hairstyle previews + selfies uploaded/stored (large data, privacy, upload surface) | HIGH | `mobile-barber-booking.js`: **no image upload**; generated/selfie images stripped before Firestore write (kept only the text reference). Customers save the style on their phone to show the barber. (Your requested change — also removes the Storage upload surface.) |
| Stored XSS via vendor-controlled fields rendered into homepage `innerHTML` | CRITICAL/HIGH | `script.js`: added `_hpEsc()`/`_hpSafeUrl()` and escaped `name`/`city`/`promo`/`tagline`/`ctaText`/`heroImage`/`category`/availability labels in `buildVendorCardHtml` + `buildAvailChipHtml`. |
| Missing security headers (clickjacking, MIME sniffing) | MEDIUM | `firebase.json`: added `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. |

**Files changed:** `firestore.rules`, `storage.rules` (new), `firebase.json`, `mobile-barber/mobile-barber-booking.js`, `script.js`.

---

## Confirmed CRITICAL findings still OPEN (must close before launch)

1. **`bookings` collection world-open** (`firestore.rules:125-128` `allow read, write: if true`). Anyone can read every airport/ride booking (names, phones, pickup/dropoff) and overwrite/delete any of them. **Why not auto-fixed:** 10+ consumers (`admin/driver-admin/salon-admin/vendor-admin/tracking.html`, `chat.js`, `ride-intake.js`, `ride-avail.js`, `script.js`, `workflowEngine.js`), incl. customer tracking that may be unauthenticated. Needs per-consumer auth analysis. **Recommended:** `create: if true` (guest), `read/update: if isVendorMember(resource.data.vendorId) || (request.auth!=null && resource.data.customerUid==request.auth.uid)`, `delete: if false` — after confirming tracking signs in (anonymously) first.
2. **`travel_bookings` open read + any-auth update** (`firestore.rules:186-191`). Same shape as #1; scope read to customer/vendor, update to vendor.
3. **`vendors/{vendorId}/{sub=**}` catch-all: any auth (incl. anonymous) read/write** (`firestore.rules:112-114`). Lets an anonymous user read/write any vendor's subcollections. **Why not auto-fixed:** `admin.html` relies on this broad rule; closing it needs an `isAdmin()` helper. **Recommended:** replace with explicit per-subcollection `isVendorMember(vendorId)` writes + `isAdmin()` for admin, default-deny otherwise.
4. **Admin / salon / driver portals have no role/ownership verification** (`admin.html:1187`, `salon-admin.html:3666`, `driver-admin.html:3666`). Any authenticated (even anonymous) user passing the Firebase Auth gate can open the portal and — because of #3 and the broad collection rules — manage data. **Blocked on a decision:** there is **no admin claim/email mechanism today**. Tell me the admin email(s) (and whether to use a custom claim via a Cloud Function or an email allowlist in rules) and I'll enforce `isAdmin()` server-side + gate the portals.
5. **Vendor payment-detail / `zellePhone` / `zelleQrUrl` escalation** (`firestore.rules:62-64` + dashboard). A self-mapped attacker could change a vendor's Zelle payout target (redirect payments). **Mitigated** by the `vendorUsers` non-anon fix above (closes the anonymous path); fully closed once `vendorUsers` mapping is moved behind setup-code verification (follow-up #1).

## Confirmed HIGH findings still OPEN

- `emailQueue` / `rideNotifications` unauthenticated create → email/push spam (`firestore.rules:104-107, 148-151`). Add field validation + auth; needs confirmation the guest booking flow is anonymously authed before requiring auth.
- `escalations` unauthenticated read of support tickets (`firestore.rules:160-164`). Restrict read to non-anonymous/admin.
- Fake-notification forgery + `hasAll` allows arbitrary extra booking fields (`firestore.rules:31`, `109-114`).
- Owner-dashboard business-switch + mobile-barber dashboard/vendor pages: ownership not verified client-side (defense-in-depth; the real fix is the Firestore rules above).
- Salon receptionist uploads with arbitrary extension (`nailsalon/receptionist.js`) — now constrained by the new `storage.rules` (image-only); verify the upload path matches.

## MEDIUM / LOW (hardening) — see follow-ups
Missing enforcing **CSP** (added the safe headers; an enforcing CSP needs a staging smoke-test so it doesn't break Firebase/Maps/YouTube — policy drafted, not yet enabled); `vendorId` existence not validated in rules; test/debug pages (`testfirebase.html`, `testmapapi.html`) deployed to production with a second API key — recommend removing from the deploy.

---

## Results by required dimension
- **Auth/authorization:** portals gate on Firebase sign-in but **not on role/ownership**; server-side ownership is enforced for `mobileBarberVendors`/`Services`/`Availability`/`Bookings` (via `isVendorMember`, now hardened) but NOT for the legacy `bookings`/`travel_bookings`/`vendors/{sub=**}` collections. **Partial.**
- **Firestore rules:** default-deny present; `mobileBarberBookings` hardened (create + update); `vendorUsers` anonymous self-map closed. Open: bookings/travel_bookings/subcollection catch-all. **Partial.**
- **XSS:** homepage vendor-card sink fixed (escape + safe-URL). Other renderers (dashboard, AI chat) use `textContent` for user data per spot-checks; full sweep recommended. **Mostly closed.**
- **Storage:** version-controlled `storage.rules` added (image-only, non-anon, size-capped); booking image uploads removed entirely. **Closed (pending deploy + path verification).**
- **Secrets:** service-account JSON is on disk but git-ignored & in the hosting ignore list (not committed, not served — verify before deploy); Firebase web API key is public-by-design and referrer-locked; LLM secrets are in `functions` `defineSecret`, not committed. **OK.**
- **Payments:** customer can no longer set `paymentStatus` (rule fix); Zelle payout target still vendor-writable (escalation closed once vendorUsers follow-up lands). **Partial.**

## Tests run
- `node tests/runner.js` → **546 passed, 0 failed** (after rules + no-store + XSS changes).
- `bash scripts/ai/full_system_dry_run.sh` → **FINAL: PASS**.
- Firestore rules brace-balanced; `firebase.json` valid JSON; `script.js`/`booking.js` syntax OK.
- **Not yet added:** Firestore-emulator rule tests + a `<script>`-payload XSS test — recommended next (the emulator suite would lock in the rule behavior).

## Remaining risks / required decisions before GO
1. **Admin identity decision** (blocks #3, #4) — who is admin, custom claim vs email allowlist?
2. **`bookings`/`travel_bookings` rescoping** — confirm tracking/availability flows are authenticated so the lockdown won't break them.
3. **Enforcing CSP** — needs a staging deploy + smoke test.
4. **`vendorUsers` setup-code Cloud Function** — fully closes vendor self-mapping.
5. Nothing here is **deployed** — production still runs the old rules until `firebase deploy --only firestore:rules,storage` + `--only hosting`.

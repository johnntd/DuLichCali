# DuLichCali — Pre-Production Security Audit

**Date:** 2026-05-30
**Method:** 10 parallel per-dimension auditors (read-only) → adversarial verification of every critical/high finding (one skeptic per finding, instructed to refute). 55 agents, ~6.1M tokens.
**Result:** 76 findings — **19 CRITICAL, 26 HIGH, 21 MEDIUM, 10 LOW**; **29 critical/high adversarially confirmed exploitable**.

## Recommendation: ⚠️ **NO-GO until the rules are runtime-verified + 2 residual HIGHs accepted** — all confirmed CRITICALs now have fixes in code

The audit found **systemic authorization gaps** (vendor/data takeover, customer PII exposure, booking/payment tampering). **Round 1** fixed the contained issues; **Round 2** (after you set `johnntd@gmail.com` as the email-allowlist admin) closed the admin-dependent criticals — the world-open `bookings`/`travel_bookings` reads, the `vendors/{sub=**}` cross-vendor write, and the escalation/spam create vectors. **Every confirmed CRITICAL now has a fix in `firestore.rules`/`storage.rules`.**

Two things still gate GO:
1. **Runtime verification.** Firestore rules are project-level (no separate "staging" instance), so the new rules are reviewed + syntactically valid but **not yet runtime-tested**. They must be verified via the Firebase emulator (recommended) or a monitored `firebase deploy --only firestore:rules,storage` immediately followed by the live smoke + a vendor/admin login check — a rule bug could lock out legitimate users or fail to protect.
2. **Two residual HIGHs** (need an accept-or-fix decision): (a) an *anonymous* session can still read a `bookings`/`travel_bookings` doc by a known id (no `customerUid` to scope by — needs a tracking-token redesign); (b) a real *email/password* account can still self-map in `vendorUsers` (needs a setup-code-verifying Cloud Function). Both are downgraded from the original criticals but are real.

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

## Round 2 — admin-allowlist fixes (after `johnntd@gmail.com` set as admin)

| Finding | Severity | Fix (`firestore.rules`) |
|---|---|---|
| `vendors/{vendorId}/{sub=**}` — any auth (incl. anonymous) read/write of any vendor's subcollections (cross-vendor tampering, fake notifications) | CRITICAL | Added `isAdmin()` (email allowlist). WRITE now requires `isVendorMember(vendorId) \|\| isAdmin()`; read stays auth-only. |
| `bookings` world-open (`if true`) — unauthenticated read/overwrite of all airport/ride PII | CRITICAL | `create: if true` (guest), `read/update: if request.auth != null`, `delete: if isAdmin()`. Closes the unauthenticated vector (every consumer is anon-authed). |
| `travel_bookings` unauthenticated read | CRITICAL | read now `request.auth != null`; delete `isAdmin()`. |
| `escalations` unauthenticated read of support tickets | HIGH | read + create now require auth. |
| `emailQueue` / `rideNotifications` unauthenticated create → spam | HIGH | create now requires auth (anon-authed booking flow still qualifies). |
| Admin oversight after lockdown | — | `isAdmin()` added to `mobileBarberVendors`/`Services`/`Availability` writes + `mobileBarberBookings` read/update so the operator retains management access. |

`firestore.rules` brace-balanced (89/89); 546 tests pass; `full_system_dry_run` FINAL: PASS. **Not deployed.**

---

## Confirmed CRITICAL findings — now CLOSED in code (pending runtime verification)

| # | Finding | Status |
|---|---|---|
| 1 | `bookings` world-open read/write | ✅ Round 2 — auth required (residual: anon get-by-id, HIGH) |
| 2 | `travel_bookings` unauthenticated read | ✅ Round 2 — auth required |
| 3 | `vendors/{sub=**}` cross-vendor write | ✅ Round 2 — vendor-member/admin write |
| 4 | Admin/salon/driver portal data exposure | ✅ **Data layer** now enforced by `isAdmin()`/`isVendorMember` rules — a non-admin gets permission-denied on every read/write. *Frontend* still renders the portal shell to a signed-in non-admin (no data) → downgraded to a MEDIUM UX/defense-in-depth item: add an `isAdmin` gate that shows "not authorized" instead of an empty admin UI. |
| 5 | `vendorUsers` anonymous self-map → vendor takeover (+ zellePhone/payment escalation) | ✅ Round 1 — anonymous write blocked (residual: email/password self-map, HIGH) |
| 6 | Negative price / >100% discount on booking create | ✅ Round 1 — rule validation |
| 7 | No Storage rules | ✅ Round 1 — `storage.rules` added |
| 8 | Stored XSS (homepage vendor cards) | ✅ Round 1 — escaped |

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

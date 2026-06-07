# Owner / Admin Access Regression — Audit & Remediation

**Date:** 2026-06-07
**Project:** `dulichcali-booking-calendar` (project number `623460884698`)
**Branch audited:** `feat/unified-vendor-portal` (HEAD `9ec30db`)
**Status:** Root cause CONFIRMED · Fix APPLIED in code & emulator-verified · **Production deploy PENDING user decision**
**Method:** Read-only audit (git history + source) by 5 parallel investigators, cross-corroborated. No production data was read or mutated.

---

## TL;DR

The owner account **`johnntd21@icloud.com` was never in the admin allowlist** — not in the current rules, and not in any commit in git history. Admin authorization is gated entirely by an **email allowlist in `firestore.rules` → `isAdmin()`** that contained only `johnntd@gmail.com`. The allowlist was introduced by commit **`0495929`** (2026-05-30) and deployed to production the same day. Before that commit, vendor writes were open to *any authenticated user*, so the icloud account worked; the security lockdown closed that path and never added icloud.

Compounding it: **`admin.html` logs in with email/password only (no Google sign-in)**, and you reported the `gmail` account has no password set — so you were locked out *both* ways (icloud excluded by the allowlist; gmail unusable for lack of a credential).

**Chosen fix (per owner):** add `johnntd21@icloud.com` to the `isAdmin()` allowlist. Applied in code, emulator-verified (36/36 rules tests pass). **Not yet deployed** — see the deploy-scope decision in §7.

---

## 1. Answers to the five questions

### Q1 — Which account currently has owner privileges?
**`johnntd@gmail.com`** — the sole entry in the `isAdmin()` email allowlist (`firestore.rules:28`). It is the only account that can perform **global admin** operations (create/delete vendors, enable/disable drivers, write `config/aiSecrets`, delete bookings, etc.).

Separately, **vendor-scoped "owner" power is role-based, not email-based**: any account whose UID has a `vendorUsers/{uid}` document can manage that vendor's services/staff/promotions/payroll/bookings via `isVendorMember()` / `isPortalVendorUser()` — independent of the email allowlist. (`salon-admin.html`/`vendor-admin.html` read `role: 'owner'` from that doc; it is a UI-level distinction, not a rules boundary.)

### Q2 — Which Firebase UID is considered the owner?
**The rules gate on the email claim, not on a UID.** There is no hardcoded "owner UID" anywhere in code (no custom claims, no UID allowlist). The effective owner UID is simply *whichever Firebase Auth account carries `request.auth.token.email == "johnntd@gmail.com"`*.
The literal UID string is **live-only** (not in the repo). Firebase CLI is authenticated on this machine (v14.12.0) — retrieve it with the command in §6.

### Q3 — Does `johnntd21@icloud.com` still map to the owner record?
**No — for admin purposes it never did.** Git pickaxe (`git log -S'johnntd21@icloud.com' -- firestore.rules admin.html security-alerts.html`) returns **zero** auth-related hits across all history. The icloud address appears in the codebase only in **PayPal / payment-form** contexts, never in an admin gate.
Whether it retains *vendor-scoped* access depends on whether a `vendorUsers/{icloud-uid}` doc exists — **live-unknown** (see §6).

### Q4 — Did the recent rules deployment break owner access?
**Yes.** Commit `0495929` ("security(pre-prod): round 2 — isAdmin email allowlist", 2026-05-30 15:21:53) both (a) introduced the gmail-only `isAdmin()` allowlist and (b) changed the catch-all vendor rule from `allow write: if request.auth != null` (any signed-in user) to `allow write: if isVendorMember(vendorId) || isAdmin()`. It was deployed to production on **2026-05-30 18:30:54** via the go-live commit `116fe5c`. If the owner had been operating as `johnntd21@icloud.com`, that deploy is the moment access was lost.

### Q5 — Which commit introduced the regression?
- **Primary (deployed):** `0495929` — 2026-05-30 — introduced `isAdmin()` allowlist + closed the open vendor-write rule. **On `main`; live in production.**
- **Secondary (NOT deployed):** `9ec30db` — 2026-06-06 — "admin-only ride enablement (remove driver self-enable)" makes `drivers.active` / `rideServiceEnabled` writable only via `isAdmin()`. **Only on `feat/unified-vendor-portal`; not on `main`, not deployed.** It further narrows driver enable/disable to the gmail-only admin.

---

## 2. Root cause (code-confirmed)

`firestore.rules` (before fix):
```
function isAdmin() {
  return request.auth != null
      && request.auth.token.firebase.sign_in_provider != 'anonymous'
      && request.auth.token.email in ['johnntd@gmail.com'];   // ← only gmail
}
```
This single function gates ~25 rules: `vendors/{id}` create/delete + subcollection writes, `drivers/{id}` writes (incl. enable/disable), `config/aiSecrets` write, `mobileBarberVendors/Services/Availability/Bookings`, `escalations`, `travel_bookings`, `emailQueue`, audit logs. Any account not matching the email is denied (HTTP 403 `PERMISSION_DENIED`) on every one.

`johnntd21@icloud.com` fails the `in [...]` test → `isAdmin()` is false → all admin-gated writes denied.

---

## 3. The two lockout layers

| Layer | Mechanism | Effect on `johnntd21@icloud.com` |
|---|---|---|
| **Authorization** | `firestore.rules` `isAdmin()` allowlist = gmail only | Can authenticate, but every admin write is `PERMISSION_DENIED` |
| **Authentication** | `admin.html` uses `signInWithEmailAndPassword` only — **no Google/SSO** (`admin.html:1139`; login modal `:849-859`; no `GoogleAuthProvider`) | Can't fall back to gmail: it reportedly has no password set, so it can't sign in at all |

Net: icloud logs in but is powerless; gmail is authorized but (per owner) cannot log in.

---

## 4. Audit coverage (8 requested areas)

| # | Area | Finding |
|---|---|---|
| 1 | **Firebase Auth users** | Auth is email/password. Mapping of email→UID is live-only (CLI authed; see §6). No UID is hardcoded anywhere. |
| 2 | **Owner/admin mapping** | Purely the `isAdmin()` email allowlist in `firestore.rules`. No roles/claims server-side. |
| 3 | **`vendorUsers` collection** | `vendorUsers/{uid}` maps a UID to a vendor via `vendorId` (singular) or `vendorIds[]` (array). Grants vendor-scoped writes via `isVendorMember()`. Read allowed to any authed user; write requires `isAdmin()` or existing same-vendor membership (chicken-and-egg — initial doc must be created by admin or the `claimVendorMembership` function). |
| 4 | **`ownerId` assignments** | `ownerId` is **booking metadata** (e.g. travel/mobile-barber bookings), **not** an authorization gate. `role:'owner'` on a `vendorUsers` doc is a **UI-level** label (`salon-admin.html:3705`), not a rules condition. |
| 5 | **Firestore rules** | `isAdmin()` gmail-only allowlist is the single authorization chokepoint. (`firestore.rules:22-28`) |
| 6 | **`isAdmin()` logic** | `auth != null && sign_in_provider != 'anonymous' && email in ['johnntd@gmail.com']`. Case-sensitive exact email match. |
| 7 | **`isPortalVendorUser()` logic** | `auth != null && non-anonymous && exists(vendorUsers/{uid})` (`firestore.rules:37-41`). No email check — UID-presence based. Load-bearing for vendor portals (e.g. Michael's owner portal). |
| 8 | **Hardcoded admin email checks** | Two client-side allowlists found: **`security-alerts.html:73`** `ADMIN_EMAILS = ['johnntd@gmail.com']` (hard gate — non-admins see "This account is not an admin"). **`admin.html`** has **no** client-side email gate — it shows the full UI to any authed user and only surfaces an error *after* a write is denied (`admin.html:2607` tells the user to "Re-login … with the admin account (johnntd@gmail.com)"). Cloud Functions (`functions/index.js`) perform **no** email/UID/custom-claim admin check — `firestore.rules` is the sole gate. |

### Per-capability impact for `johnntd21@icloud.com` (pre-fix)

| Capability | Gate | icloud result |
|---|---|---|
| Enable/disable drivers | `isAdmin()` only (no vendor fallback) | **BROKEN — hard** |
| Create/delete vendors | `isAdmin()` only | **BROKEN — hard** |
| Write AI keys (`config/aiSecrets`) | `isAdmin()` only | **BROKEN — hard** |
| Manage services | `isVendorMember() \|\| isAdmin()` | Works **iff** a `vendorUsers` doc exists; else broken |
| Manage promotions (vendor subcollection) | `isVendorMember() \|\| isAdmin()` | Works **iff** `vendorUsers` doc exists; else broken |
| Manage vendor bookings | `isVendorMember() \|\| isPortalVendorUser() \|\| isAdmin()` | Works vendor-scoped **iff** `vendorUsers` doc exists |
| Security Alerts dashboard | `security-alerts.html` client allowlist | **BROKEN** (gmail-only client gate) |

---

## 5. Remediation applied (code only — NOT yet deployed)

Per the owner's decision ("add icloud to the allowlist"):

| File | Change |
|---|---|
| `firestore.rules` | `isAdmin()` allowlist → `['johnntd@gmail.com', 'johnntd21@icloud.com']` |
| `security-alerts.html` | `ADMIN_EMAILS` → `['johnntd@gmail.com', 'johnntd21@icloud.com']` (kept in sync per its own comment) |
| `tests/rules/firestore-rules.test.js` | Added an iCloud admin context + assertion that it can enable a driver |

**Verification:** `npm run test:rules` (Firestore emulator) → **36 passed, 0 failed**, including the new
`iCloud owner (admin allowlist) CAN enable a driver` assertion. All prior isolation and gmail-admin tests still pass.

---

## 6. Live verification still required (not knowable from code)

Firebase CLI is authenticated here (`firebase` v14.12.0, project `dulichcali-booking-calendar` current). All commands below are **read-only**.

1. **Confirm UID ↔ email** (and the exact stored casing of the icloud email — the rule match is **case-sensitive**):
   ```bash
   firebase auth:export /tmp/auth.json --project dulichcali-booking-calendar
   # then search /tmp/auth.json for "johnntd21@icloud.com" and "johnntd@gmail.com" → note each "localId" (UID)
   ```
   *(Exports all users' PII to disk — left for the owner to run rather than done unprompted.)*
2. **Does the icloud account have a vendorUsers doc?** (decides vendor-scoped access):
   ```bash
   gcloud firestore documents get "vendorUsers/<ICLOUD_UID>" --project dulichcali-booking-calendar
   # inspect: vendorId / vendorIds[] / role
   ```
3. **Confirm currently-deployed rules** still show gmail-only (i.e. the fix isn't live yet): Firebase Console → Firestore → Rules.

> ⚠️ **Casing caveat:** `firestore.rules` compares `request.auth.token.email` **case-sensitively**. If the Auth account was registered with different casing than `johnntd21@icloud.com`, the allowlist entry must match it exactly. (`security-alerts.html` lowercases before comparing, so that side is safe.)

---

## 7. Deploy-scope decision (BLOCKING — owner must choose)

The production rules are from **`main`** (`0495929`-era, deployed 2026-05-30). This branch is **ahead of `main` by 2 undeployed rules commits** — `8d9151d` (Phase 4 driver isolation + owner-safe + push subs) and `9ec30db` (admin-only ride enablement) — a 41-line delta.

**Therefore `firebase deploy --only firestore:rules` from this branch would ship the icloud fix PLUS all of Phase 4 + admin-only-ride.** Two options:

- **Option A — Minimal hotfix (recommended):** apply only the one-line icloud allowlist change on top of the live (`main`) rules and deploy that. Smallest production change; restores access without shipping un-reviewed Phase 4 rules. Branch reconciles cleanly later (identical line).
- **Option B — Deploy this branch's rules:** ships icloud fix + Phase 4 (which was emulator-tested) in one go. Larger surface; makes driver enable/disable admin-only in prod immediately. Valid only if Phase 4 is intended to go live now.

No deploy will run without explicit owner confirmation of A or B.

---

## 8. Follow-up recommendations (not blocking restore)

1. **Move admin identity off a hardcoded email allowlist** to **Firebase custom claims** (`admin:true`) or an `admins/{uid}` collection. Then admins can be added without a rules redeploy, and there's a single source of truth (rules + `security-alerts.html` + tests currently duplicate the list in 3 places).
2. **Add a password (or Google sign-in) for the gmail admin** so there is always a working break-glass admin credential independent of icloud.
3. **`admin.html` should gate the UI client-side** (mirror `security-alerts.html`) so a non-admin sees a clear "not authorized" message instead of silent write failures.

---

## Appendix — key evidence locations

- `firestore.rules:22-28` — `isAdmin()` allowlist · `:37-41` — `isPortalVendorUser()` · `:12-20` — `isVendorMember()`
- `firestore.rules` driver enable rule (admin-only): ~`:245-251`
- `admin.html:1139` — email/password sign-in · `:849-859` — login modal · `:2607` — gmail re-login hint · `:2594-2611` — `toggleDriverEnabled` direct Firestore write
- `security-alerts.html:73` — `ADMIN_EMAILS` · `:86-90` — client gate
- `salon-admin.html:3705` — `_userRole` from `vendorUsers` doc (role-based, not email)
- Regression: `0495929` (2026-05-30, introduced allowlist; deployed via `116fe5c` 2026-05-30 18:30) · `9ec30db` (2026-06-06, admin-only ride; undeployed)
- Tests: `tests/rules/firestore-rules.test.js:69` (gmail admin) + new icloud context/assertion

# Unified Vendor Portal Framework — Pre-Implementation Design Review

**Date:** 2026-06-06
**Status:** Design verification complete — **NO code written yet**
**Author:** Claude (reviewer / safety auditor, per CLAUDE.md role)
**Method:** 9-agent code audit + 6-agent adversarial verification against the *actual* codebase (not summaries). Each verifier was tasked to **break** a design claim, not confirm it.

> **Bottom line:** **GO, with conditions.** The architecture is sound and reusable. Verification overturned one scary claim (Michael's portal does **not** break), confirmed the PWA/auth approach, and surfaced **one genuinely critical risk** (the 35-second ride-offer window vs. web-push latency) plus several concrete correctness items that must be handled during implementation. The Portal Kit is **trimmed** from 7 modules to a leaner, less speculative set based on the simplicity critique.

---

## 1. Architecture summary

**Goal:** A reusable PWA portal framework, applied first to the **Driver portal**, kept compatible with the **Mobile Barber** vendor portal and **Michael's unified owner portal**, with a documented migration path for food / nails / tour.

**Shape (revised after verification):**

```
/portal-kit/                      ← NEW shared, portal-agnostic, themable
  portal-kit.css                  design tokens (--pk-accent, --pk-bg…) + shell/counter/chip/card/drawer/accordion CSS
  portal-pwa.js                   SW registration (scoped) + VAPID subscribe + setAppBadge wrapper + install/standalone helpers
  portal-auth.js                  SMALL: enableLocalPersistence() + transient-tolerant guard(); NOT credential UI
  portal-notify.js                CLIENT Notification Center: N onSnapshot listeners → popup/sound/two-badges/drawer/mark-read/dedup
  portal-shell.js                 HEADLESS UI primitives: summaryCounters(), filterChips(), cardList({renderCollapsed,renderExpanded})
  portal-sw-core.js               SW core: versioned cache + push + notificationclick (imported by each portal's sw.js)

/driver/                          ← NEW reference implementation, scope /driver/
  dashboard.html, login.html      thin HTML on Portal Kit; theme navy #0d2f50 + gold
  driver-portal.js                driver glue only: ride/tour data model, listeners, card field-maps, actions, settings, inline STRINGS (vi/en/es)
  manifest.webmanifest, sw.js     scope /driver/, no name/title (each driver names their own icon)
  (reuse) driver-calendar.js, driver-compliance.js, ride-booking.js

driver-admin.html, driver-login.html   → become redirect stubs to /driver/ (existing links + QR keep working; no driver PWA is installed today)
/assets/icons/driver-{180,192,512,maskable-512}.png   ← NEW car/shuttle icon set
firestore.rules                   ← driver/owner isolation, emulator-tested, NOT deployed without explicit OK
functions/index.js                ← NEW sendDriverRidePush (best-effort web push), gated on a Functions deploy
```

**What changed vs. the originally proposed kit (per the simplicity critique):**

| Module | Original | Revised | Why |
|---|---|---|---|
| `portal-i18n.js` | new generic i18n | **DROPPED** | Duplicates the proven `salon-ai-os/i18n.js` (1300+ keys). The Mobile Barber reference itself uses an **inline `STRINGS` table** — the driver portal will do the same (vi/en/es), documented as the pattern. |
| `portal-auth.js` | full parameterized credential+gate abstraction | **SLIMMED** | Credential UI (phone+PIN vs. email+password) is too divergent to unify cleanly; abstracting it leaks. Keep only the correctness-critical, currently-**broken** bit: `LOCAL` persistence + transient-tolerant gate. |
| `portal-shell.js` | full domain-aware renderer | **HEADLESS primitives** | MB's card renderer is heavily barber-coupled and not cleanly extractable. Instead, ship generic primitives that take **render callbacks** (domain lives in the callbacks, not the framework) — this satisfies the explicit "shared counters/filters/cards/accordions" requirement without a leaky abstraction. |
| `portal-pwa.js`, `portal-sw-core.js`, `portal-kit.css`, `portal-notify.js` | kept | **kept** | Genuinely low-coupling, high-reuse. |

This still satisfies the **PASS bar** ("reusable pattern shared across portals, not a one-off"): the Driver portal is built *on* the shared kit (CSS + PWA + SW + notify + headless shell) and follows the documented dashboard pattern; future portals adopt the same kit + pattern.

---

## 2. Risks

Ordered by severity.

### 🔴 R1 — 35-second ride-offer window vs. web-push latency (CRITICAL)
Ride dispatch creates a `bookingOffers/{id}` doc with **`expiresAt = now + 35s`** (`functions/index.js` `onDispatchQueue` ~4083); expired offers are reclaimed and re-dispatched. Web Push delivery on **iOS PWA** typically takes **5–30s+** (and longer on mobile networks). Realistic failure: driver receives the push at t≈40s, taps it, app cold-starts, `acceptOffer` runs at t≈42s → offer already expired → **"offer_not_pending"** error. Mobile Barber never had this because barber bookings don't expire.
**Mitigation (no dispatch-lifecycle change required):**
- Foreground `onSnapshot` listeners remain the **primary** notification path (they already work while the app is open).
- Treat background web push as a **best-effort bonus**, and make the notification deep-link to the **driver dashboard** (the live offer/pool view), **not** an auto-accept of a specific 35s offer.
- Handle expired offers gracefully in the accept path (already returns a clean error; surface it as "this ride was taken — watching for the next one").
- **Decision needed from you:** whether to *also* lengthen the offer window (e.g., 60–120s) — that touches the ride dispatch lifecycle (which I'm told not to break), so I will **not** change it without explicit approval.

### 🟠 R2 — `isAssignedDriver()` must match the REAL field name
The current portal queries assigned rides via **nested `driver.driverId`** (`driver-admin.html:2229, 2622`), not a top-level `driverId`. If the new `isAssignedDriver()` rule checks the wrong field, it **denies every legitimate driver**. Must confirm the exact field(s) written by `acceptOffer` (`functions/index.js` ~4140–4157) and match the rule to it (likely `resource.data.driver.driverId`, possibly also a top-level mirror). **Emulator test is the gate.**

### 🟠 R3 — Driver `update` has no field-level guard
With `update: … || isAssignedDriver()`, an assigned driver could write **any** field on their booking (e.g., forge `status='completed'` / `paymentStatus='paid'`). Not a regression (today any non-anon can update any booking — strictly worse), but since we're hardening, mirror the Mobile Barber barber-booking rule which **pins** sensitive fields. Validate transitions in the emulator.

### 🟡 R4 — iOS web-push requires an installed PWA + permission
On plain iOS Safari (tab, not installed) there is **no service worker** → push and `setAppBadge` are no-ops. Many drivers may just keep a tab open and never "Add to Home Screen." Mitigation: an in-app "Add to Home Screen for instant ride alerts" prompt; foreground listeners cover the open-tab case.

### 🟡 R5 — Custom alert chime is lost when backgrounded
Background notifications use the OS/browser default sound, not the AudioContext chime (which can only play while the app is open). Document for drivers; keep the distinctive chime for the foreground path.

### 🟡 R6 — `drivers/{id}/pushSubscriptions` has no rule
Subcollection currently falls through to default-deny, so client-side subscription writes fail. Must add a rule (or write via the Admin SDK). See §4.

### 🟢 R7 — get-by-id capability leak (pre-existing)
`get` stays `request.auth != null`, so any authenticated user can read a single booking by **exact** id (ids are unguessable; this is the existing customer-tracking capability model). Not worsened; documented; optional future tightening.

### 🟢 R8 — In-app navigation must stay within `/driver/` scope
Links/QR pointing at the root redirect stubs (`/driver-admin.html`) opened *inside* the installed PWA would leave scope. Constraint: all in-app nav targets `/driver/*`; stubs are entry redirects only.

---

## 3. Compatibility concerns

### Mobile Barber vendor portal — ✅ NOT touched
No Mobile Barber file is edited. The kit is extracted *alongside* it; MB keeps its inline implementation. Zero regression surface from the framework itself. (The only shared dependency MB and Driver both touch is `firestore.rules` — see §4.)

### Michael's unified owner portal — ✅ survives (verification adjudicated a disagreement)
Two verifier agents **disagreed**, which is exactly the subtlety that demanded review:

- **`owner-portal-breaker` claimed it BREAKS** — reasoning that the new `list` rule never mentions `resource.data.ownerId`, so Michael's `where('ownerId','==',…)` queries would be denied.
- **`rules-model-verifier` (correct) showed it SURVIVES** — Michael **is** a `vendorUsers` member (via his barber vendor `michael-nguyen-oc`). The proposed `exists(/vendorUsers/$(uid))` branch is **resource-independent**: when true, it authorizes the list **regardless of `resource.data`**, so `ownerId`-filtered queries *and* the legacy unfiltered compat scan (`owner-bookings.js:248`) are allowed. This is the same mechanism by which the *current* rule (`sign_in_provider != 'anonymous'`) already allows owner list queries.

**Adjudication:** the breaker's conclusion is a **false alarm** rooted in a misread of Firestore list-rule semantics. **However**, the breaker did surface a real invariant: the `vendorUsers`-exists branch is **mandatory** — removing it (e.g., switching to a strict `ownerId`-scoped rule) *would* break Michael's ride/tour tabs and the compat scan. **Because the agents disagreed, the Firestore emulator is the arbiter** — implementation will not proceed to deploy until the emulator proves Michael's three query classes (barber by `vendorId`, ride by `ownerId`, tour by `ownerId` + compat) all still pass.

Michael's queries that must keep working (from `owner-bookings.js` + `mobile-barber-dashboard.js`):

| Collection | Query | Survives because |
|---|---|---|
| `mobileBarberBookings` | `where('vendorId','==',vid)` | unchanged rule, `isVendorMember` |
| `bookings` | `where('ownerId','==','michael-nguyen')` | `vendorUsers`-exists branch (resource-independent) |
| `travel_bookings` | `where('ownerId','==','michael-nguyen')` | `vendorUsers`-exists branch |
| `travel_bookings` | `.get()` unfiltered (compat) | `vendorUsers`-exists branch (resource-independent → unconstrained list allowed) |
| `bookings`/`travel_bookings` alert listeners | `where('ownerId','==',…)` onSnapshot | same |

### Ride dispatch lifecycle — ✅ preserved
The current dispatch model is **broadcast pool + targeted offer**: drivers see all `rideNotifications` (`status in ['new','accepted']`) **and** their own `bookingOffers` (`where('driverId','==',uid) && status=='pending'`), and assigned rides via `bookings.where('driver.driverId','==',uid)`. The new portal will **preserve all of these feeds** (reskinned via the kit). Isolation therefore applies to **assigned rides** (the `bookings`/`travel_bookings` collections), **not** the intentionally-shared offer pool. The 35s offer mechanic and `acceptOffer` callable are **unchanged**.

### Other broad readers found (census) — ✅ none newly broken

| Reader | Query | Verdict under new rules |
|---|---|---|
| `admin.html:1179` | `bookings` unfiltered list | OK — `isAdmin()` |
| `script.js:916, 2806` | `bookings` unfiltered list by **anonymous** customer | **Already denied today** (current rule requires non-anonymous) and wrapped in try/catch "non-critical" — no regression |
| `vendor-admin.html:3934` | `vendors/{id}/bookings` subcollection | OK — different path, untouched |
| `travel-booking.js:765` | `travel_bookings` scoped by package+date | OK — public conflict check; **verify** in emulator it isn't blocked (it's a constrained list by non-driver) |
| Cloud Functions | all booking/offer reads | OK — Admin SDK bypasses rules |

> ⚠️ **One item to confirm in the emulator:** `travel-booking.js:765` is a *public* constrained list (`where('packageId',…).where('date',…)`) used for tour conflict-checking. Under the new `travel_bookings` list rule it would be denied for a plain customer. Need to confirm current behavior (is the customer anonymous-authed? does it already fail-soft?) and, if it must keep working, add an allowance for that specific constrained query. **This is a must-resolve before deploying the `travel_bookings` rule.**

---

## 4. Firestore impact

**Current behavior (baseline):**
- `bookings`/`travel_bookings`: `create: true`; `get: auth != null`; `list`/`update`: `isAdmin() || non-anonymous`. → any non-anon (incl. every driver) can list/update **all** bookings.
- `travelAssignments`: `read: auth != null`; `write: false`.
- `drivers/{id}/pushSubscriptions`: **no rule → default deny**.

**Proposed diff (to be emulator-validated, NOT deployed without explicit OK):**
```firestore
function isAssignedDriver() {
  // MUST match the real assigned-driver field — verify against acceptOffer (R2)
  return request.auth != null && (
       resource.data.driver.driverId == request.auth.uid
    || resource.data.driverId == request.auth.uid           // top-level mirror, if present
  );
}

match /bookings/{doc=**} {
  allow create: if true;
  allow get:    if request.auth != null;                    // unchanged (customer tracking, R7)
  allow list:   if isAdmin()
             || (request.auth != null
                 && request.auth.token.firebase.sign_in_provider != 'anonymous'
                 && exists(/databases/$(database)/documents/vendorUsers/$(request.auth.uid)))  // owners/vendors (Michael)
             || isAssignedDriver();                          // drivers: only their own (query must filter the driver field)
  allow update: if isAdmin()
             || (… vendorUsers branch …)
             || isAssignedDriver();                          // + consider field-level pinning (R3)
  allow delete: if isAdmin();
}
// /travel_bookings: same pattern (plus resolve the travel-booking.js:765 public-list allowance, §3)
// /travelAssignments:
match /travelAssignments/{docId} {
  allow read:  if isAdmin()
            || exists(/databases/$(database)/documents/vendorUsers/$(request.auth.uid))
            || resource.data.travel_driver_id == request.auth.uid;
  allow write: if false;
}
// NEW — driver push subscriptions (R6):
match /drivers/{driverId}/pushSubscriptions/{subId} {
  allow read, write: if request.auth != null && request.auth.uid == driverId;
}
```

**Post-change behavior (intended, to be proven):**

| Principal | create | get-by-id | list (unconstrained) | list (own filter) | update own | update other |
|---|---|---|---|---|---|---|
| Anonymous customer | ✅ | ✅ (tracking) | ❌ (already) | n/a | ❌ | ❌ |
| Driver (driverUsers) | – | ✅ (leak R7) | ❌ ✅win | ✅ `driver.driverId==uid` | ✅ | ❌ |
| Owner/vendor (vendorUsers, Michael) | – | ✅ | ✅ (by `ownerId`/compat) | ✅ | ✅ | ✅ (unchanged scope) |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Firestore semantics that make-or-break this (must be respected):**
1. *Rules are not filters.* An **unconstrained** driver list is denied; a `where(driverField,'==',uid)` list is allowed (rule evaluated per returned doc). A `where(driverField,'==',otherUid)` list is denied (each doc fails `isAssignedDriver`; driver isn't a vendorUser). ✅ isolation.
2. *Resource-independent OR branch wins.* `exists(vendorUsers/{uid})` authorizes Michael's list **regardless of `resource.data`** → owner mode + compat scan survive.
3. *`get` unchanged* → tracking works; capability-by-id leak persists (R7, accepted).

**Deploy posture:** rules are a Critical Trigger Area. Implementation will (a) edit `firestore.rules`, (b) write emulator tests asserting the full matrix incl. Michael + customer tracking + `travel-booking.js:765`, (c) report results — and **stop**. No `firebase deploy` of rules without your explicit confirmation.

---

## 5. Notification impact

**Foreground (app open) — works with zero backend, primary path:**
client `onSnapshot` listeners (rideNotifications pool, bookingOffers, assigned bookings, travelAssignments) → in-app popup + AudioContext chime (after "Enable Alerts" gesture) + in-app badge (`#…NotifBadge`) + `navigator.setAppBadge` + drawer with mark-read / mark-all / click-to-open. De-dup via initial-snapshot suppression + a localStorage `notified` set (mirrors MB exactly).

**Background (app closed) — best-effort, new `sendDriverRidePush` Cloud Function:**
mirrors `sendMobileBarberBookingPush`: reads `drivers/{id}/pushSubscriptions`, sends VAPID push `{title, body, url:'/driver/', badgeCount}`, prunes dead subs (404/410). SW `push` + `notificationclick` handlers live in `portal-sw-core.js`.

**Reality matrix (verified):**

| Platform / state | Foreground listener | Background push |
|---|---|---|
| iOS Safari tab (not installed) | ✅ popup+chime (open only) | ❌ no SW → no push, no badge |
| iOS installed PWA | ✅ (open) | ✅ system notification + system sound + badge (⚠️ 35s race, R1) |
| Android Chrome/PWA | ✅ (open) | ✅ reliable (tab or closed) |

**Required additions:** `pushSubscriptions` rule (R6); badge reconciliation on app open; an "unsubscribe / disable push" control in driver settings; the "Add to Home Screen" prompt (R4). **Functions deploy is gated on your OK.**

---

## 6. PWA impact

**Reusable from Mobile Barber — confirmed, no architectural blocker.**
- Manifest pattern (scope `/driver/`, `standalone`, no `name`/`short_name`/`apple-mobile-web-app-title` so each driver names their own Home-Screen icon), apple meta tags, theme-color — all reusable.
- SW at `/driver/sw.js`, scope `/driver/`, cleanly isolated from `/mobile-barber/`.
- **`firebase.json` changes required:** add a header block for `/driver/sw.js` (`no-cache` + `Service-Worker-Allowed: /driver/`) — **without it the global `**/*.@(js|css)` 1-year-immutable header would cache the SW and freeze updates**; add rewrites for `/driver` routes. Root HTML stays `no-cache`, so redirect stubs update fine.
- **Auth persistence — the bug to fix:** current `driver-admin.html` (~1310–1327) has **no `setPersistence`** and is **not transient-tolerant** — it signs out / redirects to login on *any* Firestore read failure (cold start, network blip, offline). The new portal adopts the Mobile Barber **transient-tolerant gate** (`setPersistence(LOCAL)` + `runGate` with backoff; sign out only on a *successful* read that's definitively bad). `driver-login.html` already sets `LOCAL` correctly — keep that, port the gate to the dashboard.
- **Login UX stays driver-specific:** phone+PIN → derived email `d{digits}@dlc.app`. The in-scope PWA login must convert phone+PIN (cannot reuse MB's email+password overlay verbatim).
- **iOS facts to document:** Safari vs. Home-Screen storage are separate (log in once inside the installed app); icon art is cached at install (re-add to refresh); keep in-app nav within `/driver/*`.

---

## 7. Simpler alternatives (considered)

| Alternative | Verdict |
|---|---|
| **Fork Mobile Barber into a driver copy** (minimal extraction) | ❌ Fails the PASS bar ("not a one-off"). Rejected. |
| **Refactor Mobile Barber onto the kit now** (true DRY immediately) | ❌ High regression risk on a live 177KB portal; you asked for *compatible*, not *rewritten*. Rejected. |
| **Full 7-module kit** (original proposal) | ⚠️ Over-built: duplicate i18n, leaky auth abstraction, speculative shell renderer. |
| **Lean kit + documented pattern** (this review's recommendation) | ✅ Adopted: 6 low-coupling modules (drop `portal-i18n`, slim `portal-auth`, headless `portal-shell`), inline `STRINGS` per portal like MB, pattern guide for future portals. |
| **CSS + docs only, no shell JS** (simplicity critic's minimum) | ➖ Viable but under-delivers on the explicit "shared counters/filters/cards" requirement; the headless-primitives middle path is better. |

---

## 8. Migration strategy (phased, each independently testable)

> Scope per your decision: **implement Phases 1–4 for the Driver portal now; Phase 5 is documentation only.**

**Phase 0 — Pre-flight (no app risk):** baseline `scripts/ai/full_system_dry_run.sh` (expect `FINAL: PASS`, 211/211); confirm `acceptOffer`'s exact assigned-driver field (R2); confirm `travel-booking.js:765` behavior (§3); confirm Python/PIL availability for icons.
*Testable:* dry-run green; field names documented.

**Phase 1 — Portal Kit (no consumer yet):** `portal-kit.css`, `portal-pwa.js`, `portal-auth.js`, `portal-notify.js`, `portal-shell.js`, `portal-sw-core.js` + driver icon set.
*Testable:* a throwaway harness page loads each module without error; lint/console clean; icons render at all sizes.

**Phase 2 — Driver portal on the kit:** `/driver/dashboard.html`, `/driver/login.html`, `/driver/driver-portal.js`, `manifest.webmanifest`, `sw.js`; root redirect stubs; `firebase.json` rewrites + SW header; full vi/en/es STRINGS; transient-tolerant gate; counters/filters/expand-act cards/settings accordions; reuse calendar/compliance/ride-booking.
*Testable:* local `http://localhost:8080/driver/` — login persists across refresh; counters/filters/cards/actions work; **all existing dispatch feeds still function**; no Mobile Barber/owner regression.

**Phase 3 — Notifications:** foreground popup/sound/badge/drawer (no backend); then `sendDriverRidePush` + `pushSubscriptions` write + SW push handler + best-effort handling of the 35s race (R1).
*Testable:* foreground popup+chime+badge locally; push payload shape unit-checked; expired-offer path returns a clean message.

**Phase 4 — Firestore rules:** `isAssignedDriver()` (correct field), `bookings`/`travel_bookings` list+update, `travelAssignments` read, `pushSubscriptions` write, optional field-level pinning.
*Testable:* **emulator** asserts the full matrix incl. Michael (3 query classes), driver isolation (own ✅ / other ❌ / unconstrained ❌), customer create + tracking, `travel-booking.js:765`. **No deploy without explicit OK.**

**Phase 5 — Future portals (DOCUMENT ONLY):** `docs/unified_vendor_portal_pwa_framework.md` — how food (`vendor-admin.html`), nails (`salon-admin.html`), tour adopt the kit (per-portal scope folder + manifest + SW + STRINGS + the transient-tolerant gate), with the Driver portal as the worked example.

**Deploy:** Hosting + Functions + rules are **all gated** on your explicit confirmation, after Phases 1–4 are locally + emulator verified and `full_system_dry_run.sh` is `FINAL: PASS`.

---

## 9. Test plan (validation matrix)

**Driver (primary):**
| # | Test | Pass criterion |
|---|---|---|
| D1 | Login → refresh | still logged in |
| D2 | Close Safari → reopen | still logged in (LOCAL persistence) |
| D3 | Transient Firestore failure while active | **stays logged in** (no redirect) — fixes current bug |
| D4 | Add to Home Screen → login once → reopen | still logged in (separate storage understood) |
| D5 | New assigned ride / offer (app open) | popup appears |
| D6 | Sound after "Enable Alerts" | chime plays (foreground) |
| D7 | Badge increments; refresh | unread badge persists |
| D8 | Mark read | badge decrements; mark-all clears |
| D9 | Counters Today/Upcoming/Pending/In-Progress/Completed | each filters the list |
| D10 | Expand ride card | shows phone/pickup/dropoff/datetime/flight/pax/fare + map/navigate/accept/reject/in-progress/complete/call/text |
| D11 | Isolation | driver sees only own assigned rides; cannot list another driver's |
| D12 | Background push (installed PWA) | notification + badge; tap opens `/driver/` (best-effort; expired-offer handled) |

**Barber (no regression):** B1 Mobile Barber dashboard loads + lists by `vendorId`; B2 booking popup/sound/badge/drawer unchanged; B3 settings accordions intact; B4 SW/manifest at `/mobile-barber/` unaffected.

**Owner / Michael (no regression):** O1 owner mode loads barber+ride+tour; O2 `ownerId` ride/tour queries return data (emulator + live); O3 compat unfiltered `travel_bookings` scan still returns legacy tours; O4 owner alert listeners fire; O5 owner status updates route to correct collection.

**Customer (no regression):** C1 create airport/ride/tour booking succeeds; C2 tracking page (`get`-by-id) works; C3 tour conflict-check (`travel-booking.js:765`) works; C4 mobile-barber customer booking unaffected.

**Gates:** `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`; new Firestore emulator rules suite → all green; manual matrix above on mobile (375px) **and** desktop (1280px).

---

## 10. GO / NO-GO recommendation

### ✅ GO (with conditions)

| Area | Decision | Conditions |
|---|---|---|
| Portal Kit (lean, 6 modules) | **GO** | drop `portal-i18n`; slim `portal-auth`; headless `portal-shell` |
| Driver portal `/driver/` + redirects | **GO** | preserve all existing dispatch feeds; in-app nav stays in-scope |
| PWA + transient-tolerant auth gate | **GO** | fix the persistence bug; `firebase.json` SW header carve-out |
| Foreground notifications | **GO** | mirrors Mobile Barber |
| Background web push (`sendDriverRidePush`) | **CONDITIONAL GO** | best-effort only; foreground primary; deep-link to dashboard not auto-accept; handle 35s race (R1); **do not change the dispatch window without approval**; Functions deploy gated |
| Firestore rules hardening | **GO to implement + emulator-test** | correct `driver.driverId` field (R2); keep `vendorUsers`-exists branch (Michael); resolve `travel-booking.js:765` (§3); consider field-level pinning (R3); **no prod deploy without explicit OK** |
| Migrate food/nails/tour now | **NO-GO this pass** | documentation only (per your scope choice) |

### Open decisions for you
1. **R1 / 35s window:** keep the offer window as-is and treat push as best-effort (recommended), **or** authorize lengthening the offer window (touches dispatch lifecycle)?
2. **R3:** add field-level update pinning for drivers now (recommended), or accept driver full-field update on own bookings (still better than today) and pin later?

### Conditions that block "complete" (not "start")
- Emulator proves the §4 matrix incl. **Michael's 3 query classes** and customer tracking.
- `full_system_dry_run.sh` → `FINAL: PASS`.
- Manual driver matrix passes on mobile + desktop.
- No deploy (Hosting / Functions / rules) without explicit confirmation.

**Recommendation: proceed to write the implementation spec + plan for Phases 0–4 (Driver portal), with R1 handled as best-effort and the rules emulator suite as the hard gate.** No production deploy until you sign off.

---

### Appendix — Verification provenance
- Audit: 9 agents (PWA/auth, notifications, dashboard UX, current driver portal, ride lifecycle, notification backend, Firestore rules, other portals, icons).
- Adversarial verification: 6 agents (owner-portal-breaker, bookings-reader-census, rules-model-verifier, notification-reality, pwa-ios-limits, portal-kit-simplicity-critic).
- Notable adjudication: owner-portal-breaker (BREAKS) vs. rules-model-verifier (SURVIVES) → **SURVIVES**, pending emulator confirmation (Firestore resource-independent OR-branch semantics).

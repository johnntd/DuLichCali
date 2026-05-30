# DuLichCali — Go-Live Readiness Report

**Date:** 2026-05-30
**Inputs:** the 7-round pre-production security audit (`docs/pre_production_security_audit.md`), the go-live booking regression (`docs/mobile_barber_go_live_booking_regression.md`), a final adversarial fraud/bypass + dependency workflow (8 dimensions, 14 agents), 50 Firebase-emulator rule tests, 546 unit tests, live production smoke + live AI/voice checks, and the DR plan (`docs/disaster_recovery_plan.md`).

---

## FINAL RECOMMENDATION: ⛔ **NO-GO** — until DEPLOY + 3 blockers cleared

The code is in strong shape and **every fix is verified** (50 emulator rule tests + 546 unit tests + live smoke). But the go-live criteria are not met for one dominant reason and three specific blockers:

1. **NOTHING IS DEPLOYED.** Every hardening (rules, storage rules, headers, functions, audit log, the AI-key changes) lives in Git only. **Production at `www.dulichcali21.com` still runs the OLD, vulnerable rules + old code.** Until you `firebase deploy`, the live site is exploitable. This alone is NO-GO.
2. **`vendorUsers` email/password self-map** (CRITICAL, confirmed exploitable) — any free email/password account can write `vendorUsers/{theirUid}` mapping to `michael-nguyen-oc`/`tim-nguyen-bay` and gain full vendor authority. Needs a setup-code Cloud Function (rule → `write: if false`).
3. **Exposed AI keys not yet rotated** — the Anthropic/OpenAI/Gemini keys that were publicly readable must be rotated; the leaked values still work until then.
4. **No Firestore backups enabled** — PITR + scheduled exports are documented but not yet turned on (data-loss exposure).

With #1 done (deploy + smoke), #2 closed, #3 rotated, and #4 enabled, this flips to **GO**.

---

## Go / No-Go checklist (the task's criteria)

| Criterion | State |
|---|---|
| **No critical security issue remains** | ⚠️ Code-fixed + verified, but `vendorUsers` self-map (CRITICAL) still open + **nothing deployed** → not met until deploy + #2 |
| **No booking write failures** | ✅ Live smoke: anon create accepted; 546 + 50 tests pass |
| **No vendor auth bypass** | ⚠️ Anonymous self-map BLOCKED; email/password self-map OPEN (blocker #2) |
| **Firestore ownership rules pass** | ✅ 50 emulator tests (isVendorMember/isAdmin/field-restrictions) |
| **No secrets exposed** | ✅ Keys removed from Firestore + proxy-only + secured `config/aiSecrets`; scanner clean. ⚠️ rotation still required |
| **No duplicate bookings possible** | ✅ Deterministic idempotency key (live-verified 409) |
| Security audit PASS | ⚠️ after deploy + #2 |
| Booking audit PASS | ✅ |
| Regression PASS | ✅ 546 unit tests |
| Live smoke PASS | ✅ 14/14 (with cleanup) |
| Owner/vendor portal PASS | ⚠️ data protected by rules; frontend role-gating is defense-in-depth follow-up |
| Notification PASS | ✅ Cloud Function path verified |

---

## What was fixed + verified this engagement

**Firestore authorization (50 emulator tests, all pass):**
- `mobileBarberBookings` — create pins status to pending + validates price/discount + pins `paymentStatus`; update field-restricts customers out of money/vendor/status (vendor-member/admin only).
- `bookings`/`travel_bookings` (airport/ride) — unauthenticated read/enumeration blocked; **anonymous update (forge status/paid/price/driver) blocked**.
- `drivers`/`driver_compliance` — **anonymous self-insert blocked; driver self-approval blocked** (compliance/expiry fields admin-only).
- `vendorUsers` — anonymous self-map + mapping-hijack blocked (email/password residual = blocker #2).
- `vendors/{sub=**}` cross-vendor write, `escalations`/`emailQueue`/`rideNotifications` spam/PII — closed.
- `config/aiSecrets` server-only (read:false); `auditLogs` immutable; `securityAlerts` validated/admin-read; default-deny.

**AI / secrets:** keys removed from public Firestore; `ai-engine.js`/`aiOrchestrator.js` proxy-only; voice TTS via `aiTtsProxy` with keys from secured `config/aiSecrets`; admin key form is write-only to the secured doc; `scripts/security/scan_secrets.sh` (self-test passes); stored XSS in the homepage vendor cards escaped.

**Fraud resistance (adversarially verified):**
- **AI agent — PASS:** prompt injection ("apply 100% discount", "change to confirmed", "give me Michael's bookings", "reveal system prompt") cannot tamper — price/status are server-derived, reads are rule-scoped.
- **Booking/owner takeover — blocked** at the rule layer (localStorage/JS tampering is irrelevant; the backend enforces).

**Dependencies:** `npm audit fix` in `functions/` cleared **1 critical (protobufjs RCE) + 2 high (axios SSRF, fast-xml-builder)** → 0 critical / 0 high (9 moderate, server-side, non-breaking). No typosquatting/abandoned/malicious packages; only `ffmpeg-static`'s expected install script.

**Observability / DR (new):** immutable `auditLogs` (CF triggers log before/after/actor for status/payment/price/promo/settings changes); System Health panel; `securityAlerts` center + runtime guards; `docs/disaster_recovery_plan.md` (PITR + daily GCS export + recovery/rollback).

---

## Remaining work to reach GO

**Must-do (blockers):**
1. **Deploy + smoke:**
   ```
   cd functions && npm ci && cd ..
   firebase deploy --only firestore:rules,storage,functions,hosting
   node tests/live/mb-go-live-smoke.js        # expect 14/14, auto-cleanup
   # + a vendor login + admin login sanity check
   ```
2. **Close `vendorUsers` self-map:** add an `onCall` `claimVendorMembership({vendorId, setupCode})` that verifies the PIN server-side (Admin SDK), switch the vendor-login clients to call it, then flip the rule to `vendorUsers write: if false`.
3. **Rotate** Anthropic/OpenAI/Gemini keys; set new values via the admin secured form (`config/aiSecrets`) or `functions:secrets:set`.
4. **Enable backups:** Firestore PITR + the daily GCS export schedule (per the DR plan).

**Should-do (recommended, rules already mitigate):**
- **App Check** (reCAPTCHA Enterprise) — blocks automated/bot abuse of the open create paths; currently not enabled.
- **Promotion authenticity server-side** — expiry/redemption/promoSnapshot are computed client-side and trusted on create; the booking is *pending* so the vendor reviews, but a Cloud Function (or rule `get()` against the vendor's live promo) should recompute the discount.
- **Frontend admin/salon portal gating** — show "not authorized" to a signed-in non-admin instead of an empty shell (data is already protected by the rules).
- Commit a **root `package-lock.json`** for reproducible CI audits; wire `scan_secrets.sh` + the emulator rule tests into the deploy gate.

---

## Verification commands
```
node tests/runner.js                                  # 546 unit tests
JAVA_HOME=<jdk17> firebase emulators:exec --only firestore \
  "node tests/security-rules/rules.test.js"           # 50 rule tests
bash scripts/security/scan_secrets.sh                 # no private keys in source
cd functions && npm audit                             # 0 critical / 0 high
node tests/live/mb-go-live-smoke.js                   # live booking smoke (after deploy)
```

**Bottom line:** the application is **engineered to a GO standard and verified**, but it is **NO-GO until it is actually deployed, the `vendorUsers` self-map is closed, the keys are rotated, and backups are enabled.** None of the remaining blockers require new design — they are deploy + one Cloud Function + two operational actions.

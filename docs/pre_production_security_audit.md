# DuLichCali — Pre-Production Security Audit

**Date:** 2026-05-30
**Method:** 10 parallel per-dimension auditors (read-only) → adversarial verification of every critical/high finding (one skeptic per finding, instructed to refute). 55 agents, ~6.1M tokens.
**Result:** 76 findings — **19 CRITICAL, 26 HIGH, 21 MEDIUM, 10 LOW**; **29 critical/high adversarially confirmed exploitable**.

## Recommendation: ⛔ **NO-GO — live private API keys are exposed (rotate immediately)**

**Round 4 found a CRITICAL live exposure:** 10 real private AI keys (Anthropic `sk-ant`, OpenAI `sk-proj`, Gemini `AIza`) are stored in **publicly-readable** Firestore docs and pulled into the browser. They must be **rotated now** and the storage model changed (keys → Functions secrets only). See the "API Key Exposure Audit" section below. The rules/fix progress from rounds 1-3 still stands, but this supersedes the verdict until the keys are rotated + removed.

<details><summary>(round 3 verdict — superseded by round 4)</summary>

### ⚠️ CONDITIONAL GO — deploy + verify, then close 1 residual + frontend gating

**Update (round 3):** the rules are now **runtime-verified** — `tests/security-rules/rules.test.js` runs against the Firebase emulator and **24/24 pass** (unauthenticated/anonymous lockdowns, customer field restrictions, vendor isolation, admin allowlist, price validation, booking get-by-id-but-no-list). Residual HIGH #1 (booking enumeration) is **fixed** (get/list split). Residual HIGH #2 (`vendorUsers`) is **hardened** — anonymous self-map and mapping-hijack are blocked and verified; the last sliver (a non-anonymous account self-mapping its *own* uid) needs a setup-code Cloud Function + login-client switch (a critical-auth change that must be deploy-verified). Remaining before launch: **(1)** `firebase deploy --only firestore:rules,storage,hosting` + post-deploy smoke; **(2)** the `vendorUsers` setup-code CF; **(3)** frontend admin/salon portal gating (MEDIUM — data is already protected server-side). With (1) done and (2)+(3) scheduled, this is launch-ready.
</details>

---

## API Key Exposure Audit (round 4)

**Critical requirement:** no private API keys in the frontend/public surface.

### Finding — CRITICAL: private AI keys stored in public Firestore + used client-side
A runtime scan of production Firestore (Admin SDK) found **10 real private keys**:

| Doc (publicly readable) | Keys |
|---|---|
| `vendors/beauty-hair-oc` | `aiKey` (Anthropic `sk-ant`, 108 ch) |
| `vendors/beauty-nails-oc` | `aiKey` (`sk-ant`), `openaiKey` (`sk-proj`, 164 ch), `geminiKey` (`AIza`) |
| `vendors/luxurious-nails` | `aiKey`, `openaiKey`, `geminiKey` |
| `config/platform` | `aiKey`, `openaiKey`, `geminiKey` |

The `vendors/{vendorId}` rule is `allow read: if true`, so **anyone can read these docs and harvest the keys**, then bill the owner's Anthropic/OpenAI/Google accounts. `admin.html` (`platAiKey`/`platOpenAiKey`/`vendorAiKeyVal`) writes them there, and `ai-engine.js`/`aiOrchestrator.js`/`marketingEngine.js`/voice modes read them to call the providers **directly from the browser**.

### Classification
- **Private-secret (must rotate + remove):** the `sk-ant`, `sk-proj`, and `geminiKey` `AIza` values above.
- **Public-safe (allowed):** the Firebase web `apiKey` `AIzaSyCo1Fz…71SQ` (referrer-locked) and `AIzaSyAqed…` on `testfirebase.html`.

### Files scanned / deployed-page scan
- `scripts/security/scan_secrets.sh` over all git-tracked source → **no private keys in files** (the leak is runtime Firestore data, not source).
- Deployed pages — `https://www.dulichcali21.com/`, `/mobile-barber/`, `/ai-engine.js`, `/aiOrchestrator.js` → **no private key in the served bytes** (only the public Firebase web key).

### Secrets found / removed
- **Found:** 10 keys (above). **Removed:** with owner authorization, the `aiKey`/`openaiKey`/`geminiKey` fields were deleted from all 4 docs (Admin SDK) — **verified 0 remain**. Public Firestore exposure is stopped.
- **STILL REQUIRED — rotation:** the removed keys were exposed and must be assumed compromised. The owner must rotate Anthropic/OpenAI/Gemini in their consoles and store the new values only in Functions secrets. Until rotated, the leaked values remain valid for an attacker who already copied them.

### Keys that MUST be rotated (urgent — assume compromised)
1. **Anthropic** (`sk-ant…`) · 2. **OpenAI** (`sk-proj…`) · 3. **Gemini / Google AI Studio** (`AIza…`). Rotate in each provider console **now**; put the new values **only** in Functions secrets (`firebase functions:secrets:set CLAUDE_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`).

### Storage-model fix (complete)
Keys now live **only** in Cloud Functions secrets; the browser never stores or uses one.
- **`admin.html`** — the key-entry UI (`platAiKey`/`platOpenAiKey`/`platGeminiKey`/`vendorAiKeyVal`) and the `savePlatformSettings`/`saveVendorAiKey` Firestore writes are **removed**; replaced with a server-side-only notice + the `functions:secrets:set` instructions. Keys can no longer be written to Firestore. (verified 0 residual key-UI/write refs.)
- **`ai-engine.js`** — Claude path is **proxy-only** via `aiProxy` (no client-direct fallback).
- **`aiOrchestrator.js`** — `executeProvider` now routes **every** task through `aiProxy` (server-side); the legacy `callClaude/callOpenAI/callGemini` + localStorage key accessors are unreachable.
- **`marketingEngine.js`** — already proxy-first in production (`aiProxy`); direct provider calls are gated to `localhost` dev only. No change needed.
- **Voice (Gemini/OpenAI TTS) — now always server-side via `aiTtsProxy`.** The mobile-barber voice client already routes TTS through `aiTtsProxy` first; its client-direct keyed fallback (`getOpenAiKey`/`getGeminiKey`) is now neutered to `''`, so it's proxy → browser only (no client key). `aiTtsProxy`/`aiProxy`/`aiOrchestrate` now read the Gemini/OpenAI/Claude keys from a **secured Firestore doc `config/aiSecrets`** (Admin SDK, 5-min cache) with the Functions-secret as fallback.
- **Secured key store `config/aiSecrets`** — Firestore rules `read: if false` (NEVER client-readable — verified for admin + anon in the emulator) + `write: if isAdmin()`. Admin sets/rotates keys via a **write-only** form in `admin.html`; the keys live in "secured firestore" and are never served to a browser. (5 new emulator rule tests.)
- **Firestore key fields deleted** from the old public docs (owner-authorized) — verified 0 remain.
- `scripts/security/scan_secrets.sh` clean; `ai-engine.js`/`aiOrchestrator.js` ?v=20260530m.

### Pre-deploy secret-scan command
```
bash scripts/security/scan_secrets.sh            # fails (exit 1) on any private key in source
bash scripts/security/scan_secrets.sh --selftest # proves detection on planted fake keys
```
Wire into `npm test`, the Codex-Claude loop, and the deploy checklist.

### Security alert feature (built + emulator-verified)
- **`securityAlerts` collection + rules:** client runtime guards (incl. anonymous) may **create** a validated alert (severity ∈ critical/high/medium/low, type/message length-capped, `resolved=false`); **read + mark-resolved** are restricted to `isAdmin()` or the vendor the alert is scoped to; never public; delete admin-only. Verified by 8 emulator rule tests (anon create ok; bad severity / `resolved=true` denied; anon read denied; admin + vendor read ok; admin resolve ok; anon resolve denied).
- **`security-alerts.js`** — best-effort logger `SecurityAlerts.log({severity,type,message,route,vendorId,ownerId,userId,metadata})` writing the spec'd alert schema, plus guards: `looksLikeXss`, `scanInput` (logs `xss_payload_detected`), `guardProtectedFields` (logs `protected_field_modify` if a client tries to set status/price/payment/vendorId/etc.), `guardVendorOwnerMismatch`.
- **Runtime guard wired:** the mobile-barber customer chat scans input via `SecurityAlerts.scanInput` (defense-in-depth; the message is still rendered with `textContent`).
- **Admin alert center:** `security-alerts.html` (route `/security-alerts`, `noindex`) — admin-email-gated, live `onSnapshot` feed, filters (Critical/High/Medium/Low/Unresolved/Resolved/All), unread+critical badge, **Mark resolved**. Not visible to public users.
- **Alert types covered:** `xss_payload_detected`, `protected_field_modify`, `vendor_owner_mismatch`, plus the schema for `unauthorized_portal_access`, `permission_denied_spike`, `failed_vendor_login`, `booking_spam`, `ai_prompt_injection`, `storage_upload_rejected`, `device_booking_flood`, `secret_exposure_suspected` (wire additional emitters as a follow-up). Email/SMS for critical alerts: follow-up (the report's notification infra exists).

---

### (superseded) earlier verdict

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

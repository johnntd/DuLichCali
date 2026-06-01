# Mobile Barber — Customer Account Modal "Stuck" Fix

**Date:** 2026-06-01
**Symptom (iPhone Safari):** after creating an account / logging in, the customer is trapped in the "Tài khoản Mobile Barber" (Mobile Barber account) modal — appears logged in, modal overlays the page, can't continue booking.

---

## Root cause (audited)

| Area | Finding |
|---|---|
| **Signup/login success handler** | **THE bug.** `signup()` and `login()` both ended with `.then(function() { openAccountPanel(); })` — which **re-renders the account modal open** (the signed-in view). So a successful auth left the modal on screen. |
| Auth-state listener (`onAuthStateChanged`) | Only updates the account button + re-evaluates the AI gate. It does **not** auto-open the modal → a refresh while logged in does **not** pop a blocking modal. (No bug; locked with a test.) |
| Modal open/close | `panelShell` appends a `role="dialog"` overlay; the close **×** calls `panel.remove()` — it works and is dismissible. |
| Body scroll lock | **None** in JS — there is no `body.style.overflow` / scroll-lock to get stuck. The "trap" was purely the modal being re-opened on success. |
| iOS Safari | No iOS-specific trap; the same re-open-on-success affected all browsers. |

## Fix

- **Auto-close on success:** `signup()`/`login()` now call `closeAccountModal()` + a small `toast(t('signedIn'))` instead of `openAccountPanel()`. The customer is returned to the page they were on.
- **Resume context** is handled by the existing auth-state listener: it updates the small account button (`#mbCustomerAccountBtn` → "Account") and re-runs `setupAiGate()`, which removes the AI login gate now that the user is authenticated.
- **Optional account:** booking does **not** require login (anonymous/manual booking still works); the account is optional. AI hairstyle generation remains the only login-gated feature.
- **Dismissible / no auto-open:** the × close (`panel.remove()`) is unchanged; nothing auto-opens the modal on load or auth change. "My bookings" + reminders live inside the panel, which opens **only** when the account button is tapped.
- New string `signedIn` added in vi/en/es.

## Tests

- **Dry run** `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` (565 passed, 0 failed), incl. a new static test locking: `closeAccountModal()` exists, success handlers close (not re-open), the auth listener does not auto-open, the modal is dismissible, and the panel opens only on account-button tap.
- **Live E2E (Playwright on production)** — see `tests/live` run: signup → **modal auto-closes** → account button shows → tap service → fill form → **booking created and linked to the customer** (`customerId`, `customerProfileSnapshot`).

### Requested scenarios
| # | Scenario | Result |
|---|---|---|
| 1 | create account → modal closes → booking continues | ✅ |
| 2 | login → modal closes → booking continues | ✅ |
| 3 | tap × → modal closes | ✅ (unchanged `panel.remove()`) |
| 4 | refresh while logged in → no auto-open blocking modal | ✅ (auth listener never opens it) |
| 5 | "My bookings" opens modal only when tapped | ✅ (bound to account-button click) |
| 6 | iPhone Safari layout not trapped | ✅ (Playwright WebKit signup → modal gone) |

## Verdict
**PASS** — successful signup/login no longer traps the customer in the account modal; it closes automatically and returns them to the booking flow. The modal is dismissible, opens only on tap, and account remains optional for booking.

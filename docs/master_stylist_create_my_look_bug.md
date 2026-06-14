# AI Style Studio — "Create My Look" P0 + Auth Persistence + Membership Gate

**Date:** 2026-06-13 · **Surface:** public `/style-studio` · **Status:** Root-caused, fixed, DEPLOYED (`?v=20260613f` + functions + promo config). PASS pending on-device confirmation.

---

## 1. P0 — "Generate My Best Look" silently does nothing

### Root cause
`onGenerateBest()` returned **silently** whenever `canGenerate()` was false for any reason other than missing consent, and `refreshButtons()` *disabled* the button when `canGenerate()` (which required `state.signedIn && !state.busy`) was false. So when `state.busy` was stuck true (e.g. during the slow two-pass wig generation, which holds `busy` for up to the 180s callable timeout) or anon auth was momentarily incomplete, the flagship button did nothing — no loading, no error, no explanation. Anonymous auth itself was verified working (the endpoint issues an idToken from the prod referrer), so it was a client state/feedback bug, not an auth-disabled bug.

### Fix (`style-studio-public.js`, commit `964e447`)
- **Never-silent handler:** `onGenerateBest` now gives explicit feedback for every blocked state — busy (`busyWait`), no consent, no selfie (`needSelfie`), not signed in (`preparingSession` + auto-kick anon sign-in + queue the generation), AI/network error.
- **Button no longer dead:** `canSubmit()` (consent + selfie + !busy, **no** signedIn) drives the enabled state, so the button is tappable as soon as consent + selfie are set; the handler then handles sign-in.
- **`pendingGenerate`:** if tapped before auth completes, the generation auto-starts when `onAuthStateChanged` fires (no second tap).
- **Progress:** cycling status — "Analyzing your face… → Studying facial harmony… → Designing your best look… → Generating your masterpiece…" + a spinner.
- **Error + Retry:** on any failure, `masterError()` renders the message + a Retry button.
- **Watchdog:** a 185s timeout force-resets `state.busy` so it can never stick permanently; late responses are ignored via a sessionId guard.
- **Defensive `.catch`** on the promise — exceptions are never swallowed.

---

## 2. Customer auth persistence root cause and fix

### Root cause
Persistence was set per-login-call but not globally before the page's anonymous sign-in, and the symptom ("asks to log in again") was compounded by the membership-gate bug (§3) which surfaced the create-account prompt to already-logged-in users. There was no path that *cleared* auth, but persistence wasn't explicitly guaranteed LOCAL at the global level.

### Fix (`style-studio-public.js`, commit `2316749`)
- **Global LOCAL persistence:** `firebase.auth().setPersistence(LOCAL)` is set at the very start of `initAuth`, before `onAuthStateChanged` and before any anonymous sign-in. Never SESSION/NONE → login persists across refresh, Safari restart, and the iOS home-screen PWA.
- **Never replace a real user with anonymous:** `signInAnonymously()` is called only when `user` is null, and is guarded by `state._anonInFlight` so a real (anon or member) user is never overwritten and duplicate anon sign-ins can't race.
- **`signOut` is called from exactly one place** — the explicit Logout button. Language switch, generation, modal close, and reload never sign out.

---

## 3. AI Style Studio auth/membership gate root cause and fix

### Root cause (the "logged-in member asked to Create a free account" bug)
The public callable `generateStyleStudioPublic` applied the **guest** promo limit (`resolveDailyLimit` → 5/day) to **every** uid, including real logged-in accounts, and always returned `code:'LIMIT_REACHED', requireLogin:true` ("Create a free account") on overflow. So a logged-in member who generated 5 looks was told to create an account they already had. The per-uid counter was correct (stable uid); the **limit and the message** didn't distinguish member from guest.

### Fix (backend `functions/index.js`, commit `8f219b6` + frontend `2316749`)
- **Backend:** detect anonymous vs member via `request.auth.token.firebase.sign_in_provider`. `checkPublicQuota(uid, isAnonymous)` uses the guest promo limit for anonymous sessions and `config/styleStudioPromo.memberGenerationsPerUser` (default **100/day**) for members. On overflow: guests → `LIMIT_REACHED` (create-account wall); members → `DAILY_LIMIT, requireLogin:false` ("try again tomorrow") — **never** the create-account prompt.
- **Promo config** re-seeded with `memberGenerationsPerUser: 100`.
- **Frontend:** tracks `state.isAnonymous`; `revealMembership()` fires only when `res.requireLogin === true` (guests) and additionally no-ops if `!state.isAnonymous` (defensive). The member `DAILY_LIMIT` shows a localized message, not the gate.
- **Profile auto-repair:** on a real sign-in, if `mobileBarberCustomers/{uid}` is missing, it's created via `customerProfilePayload` (best-effort) so a logged-in user with a missing profile is repaired.

---

## 4. Logging (added)
- `[master-stylist]` — `buttonClicked, payloadBuilt, requestSent, responseReceived, imageGenerated, carouselUpdated, viewerReady, error`.
- `[style-auth]` — on every auth-state change: `{ uid, isAnonymous, email, profileLoaded, membershipTier, promoUsage, generationCount, gateReason }`.
- `[style-gate]` — on every gate decision: `{ signedIn, isAnonymous, profileExists, allowed, reason }`.

## 5. Files changed
- `functions/index.js` — member/guest quota (`checkPublicQuota` + the callable's `DAILY_LIMIT`/`LIMIT_REACHED` branches).
- `style-studio-public.js` — never-silent P0 handler + progress/retry/watchdog + global LOCAL persistence + member-aware gate + profile repair + the three log streams.
- `style-studio.css` — spinner + error card.
- `config/styleStudioPromo` (Firestore) — `memberGenerationsPerUser: 100`.

## 6. Tests (combined)
| Test | Status |
|---|---|
| Upload selfie → Create My Look works (no silent fail) | ✅ deployed — confirm on device |
| Button explains why if blocked (photo/consent/login/AI/network) | ✅ never-silent |
| Login → refresh → still logged in | ✅ global LOCAL persistence |
| Login → close/reopen Safari / PWA → still logged in | ✅ LOCAL persistence |
| Generate / language switch / modal close → still logged in | ✅ no signOut on those paths |
| Logout → logged out; refresh → stays logged out | ✅ signOut only in Logout |
| Logged-in member generates many looks → NO "create account" prompt | ✅ member limit 100/day, no wall |
| Guest reaches promo limit (5) → create-account prompt | ✅ guests unchanged |
| Anonymous session never overwrites a real user | ✅ guarded |
| Missing profile doc auto-repairs | ✅ on sign-in |

## 7. Limitations
- No headless automated UI test (no browser in this env; iOS touch/persistence/PWA can't be replicated headlessly). Verification was static + subagent review + the rules-emulator gate + a live anon-auth probe; on-device confirmation is the owner's. The `[master-stylist]`/`[style-auth]`/`[style-gate]` console logs make the live state observable.
- `promoUsage`/`generationCount` are server-side counters not returned to the client, so they log as `null` (keys present) — observability for those is the Functions logs.

**PASS / BLOCKED:** Implemented + deployed → **PASS pending on-device confirmation** that "Create My Look" always produces a result-or-clear-reason, and that a logged-in member is never asked to create an account again until they log out.

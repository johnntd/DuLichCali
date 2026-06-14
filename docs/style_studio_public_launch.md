# AI Style Studio — Public Launch Report

> Report for slice `c3b918f`→`7b07b2d` (commits: `aa20c16`, `92ea647`, `5e8d30d`, `aac0279`, `822bf5a`, `7b07b2d`)

---

## Public Page (`/style-studio`)

### URL and routing

Firebase Hosting rewrites `/style-studio` → `/style-studio.html` (added to the `rewrites`
array in `firebase.json`). The page is a standalone scrollable HTML document (not inside the
SPA shell), sharing `style.css` and `desktop.css` with the rest of the site.

### Page structure

```
ss-page
  ├── app-bar          (brand wordmark + email link)
  ├── ss-lang          (EN / VI / ES buttons — persists to localStorage('dlc_lang'))
  ├── ss-hero          (AI Master Stylist flagship card)
  │     ├── consent checkbox
  │     ├── #ssSelfieInput  (file input — upload or camera capture)
  │     ├── #ssGoal         (style goal select — 15 goals + auto)
  │     ├── #ssGenerateBest (CTA button — disabled until signed-in + consent + selfie)
  │     ├── #ssStatus       (status / error line)
  │     └── #ssMasterResult (rendered masterpiece card)
  ├── #ssLaunchBanner  (promo banner — always visible during launch period)
  ├── #ssModes         (9 manual mode accordion)
  │     ├── #ssAudience     (audience select: neutral/man/woman/child)
  │     ├── #ssAccordion    (details/summary panels for each mode)
  │     └── #ssModesResults (rendered 5-card grids per mode)
  ├── #ssMembershipPrompt  (hidden; revealed on LIMIT_REACHED)
  ├── ss-privacy       (privacy note)
  └── ss-back          (← Back to Du Lich Cali)
```

### Hero: AI Master Stylist

The flagship hero generates **one masterpiece** (not 5 options). The customer:
1. Accepts the consent checkbox.
2. Uploads or captures a selfie.
3. Optionally picks a style goal from 15 options (defaults to "most flattering overall").
4. Taps "Generate My Best Look".

The result card shows: the generated image, the AI title, the 2-3 sentence explanation (in the
visitor's language), and present attributes (haircut, color, texture, bangs, eyebrows, beard,
wig/hair system) as chips. Actions: save to phone (`<a download>`), share (native
`navigator.share` if available, image file preferred).

### 9 Manual modes (accordion)

Each mode expands into option controls (selects for type/shape/length/etc.) and a "Generate
looks" button that calls the same `generateStyleStudioPublic` callable with the mode name.
Results are rendered as a 5-card grid matching the vendor dashboard studio output. Actions per
card: save, favorite (localStorage), share.

The modes and their options mirror `STUDIO_MODES` in `functions/style-studio-lib.js`:

| Mode | Option controls |
|---|---|
| haircut | (none — auto) |
| color | type: highlight / balayage / ombre / gray_blend / fashion |
| texture | texture: curly / straight / wavy |
| eyebrow | shape (5 options), thickness (3 options) |
| beard | length (4), density (2), shape (3) |
| wig | family (11 options) |
| hairsystem | type (5 options) |
| event | occasion (8 options) |
| vacation | destination (5 options) |

---

## Promo Config (`config/styleStudioPromo`)

### Document shape

```json
{
  "active": true,
  "startDate": "2026-06-13",
  "endDate":   "2026-06-27",
  "freeGenerationsPerUser": 5
}
```

### How it works

The Cloud Function reads this document via the Admin SDK (5-min cache in `_promoCache`) and
resolves the daily free-generation limit with `resolveDailyLimit(promo, todayISO)`:

- `active !== true` → limit 0.
- `todayISO < startDate` → limit 0.
- `todayISO > endDate` → limit 0.
- Otherwise → `Math.floor(freeGenerationsPerUser)`, minimum 1.

The `limit` is compared against the per-uid daily counter in
`styleStudioUsage/{uid}/days/{YYYY-MM-DD}`. Counter is incremented AFTER a successful
generation (`result.ok === true`) via `incrementPublicUsage`, using
`FieldValue.increment(1)` (non-transactional, best-effort — a hiccup in the counter write
does not fail the response).

### CRITICAL OPERATIONAL NOTE — seed the promo doc before launch

The Firestore rules deny all client reads of `config/styleStudioPromo`
(`allow read: if false`). The Function reads it via Admin SDK. **If the document does not
exist**, `getStyleStudioPromo()` catches the missing-doc and returns `{}` (empty object).
`resolveDailyLimit({}, today)` evaluates `promo.active !== true` → returns `0`.
`checkPublicQuota` then computes `allowed: used < 0` → `false`.

**Result: with no promo doc, every single visitor hits the login wall on their first
generation attempt, regardless of whether they have used any previews.**

Before exposing the page to real users, seed the promo doc in Firestore:

```
Collection: config
Document:   styleStudioPromo
Fields:
  active:                  true
  startDate:               "2026-06-13"   (or the actual launch date)
  endDate:                 "2026-06-30"   (or your desired window)
  freeGenerationsPerUser:  5              (per-uid per-day)
```

Set this via Firebase Console → Firestore → config → styleStudioPromo, or via:

```javascript
// run once from admin.html or a one-time script
await db.collection('config').doc('styleStudioPromo').set({
  active: true, startDate: '2026-06-13', endDate: '2026-06-30', freeGenerationsPerUser: 5
});
```

To close the promo: set `active: false` in Firestore — the 5-min cache means the change
takes effect within 5 minutes without a redeploy.

---

## Anonymous Auth + Login Wall Flow

### Anonymous auth

On page load, `style-studio-public.js` calls `firebase.auth().onAuthStateChanged`. If no user
is signed in, it calls `firebase.auth().signInAnonymously()`. The CTA buttons remain
`disabled` until `onAuthStateChanged` fires with a user (state `signedIn = true`).

Anonymous users get a real Firebase Auth UID. The per-uid daily counter is keyed to this UID.
An anonymous session persists across page reloads on the same browser/device (Firebase
persistence default). A user who clears cookies/data or opens a private window gets a new anon
UID and a fresh daily counter — the login wall is therefore a **soft gate**, not a hard
enforcement. The login wall is the real conversion point.

### Login wall trigger

When `generateStyleStudioPublic` returns `{ ok: false, code: 'LIMIT_REACHED', requireLogin: true }`,
the client:
1. Reveals `#ssMembershipPrompt` (scrolls into view).
2. Shows the localized `loginWall` string in the status line (error style).

`#ssMembershipPrompt` contains a CTA linking to `/mobile-barber/` (the customer account
portal). Future slices (Slice D) will implement membership tiers and profiles here.

### Function-side enforcement

`requireAuthedGuest(request)` throws `HttpsError('unauthenticated')` only if
`request.auth` is entirely absent (the page was somehow called without any Firebase auth
context). An anonymous UID is fully accepted. This means a determined user can rotate their
anon UID by clearing browser data — acceptable for a launch promo. Post-launch the gate
requires a logged-in account, which is the membership prompt's purpose.

---

## Privacy

No images are stored server-side at any point:

- The selfie is compressed in-browser by `MobileBarberAIPreview.compressImage` and transmitted
  to the Function as a base64 data URL in the callable payload.
- The Function passes the base64 to Gemini; Gemini returns the edited image as base64.
- The Function returns the edited image to the client as `previewDataUrl` in the response.
- **No Firestore or Firebase Storage write of any image occurs** — confirmed by the unit test
  static-source scan:
  ```js
  assert.ok(!/\.set\(|\.add\(|\.update\(|uploadBytes|putString/.test(
    studioSrc.replace(/setItem|setLang|setTimeout|setAttribute|addEventListener/g, '')
  ), 'studio module performs no Firestore/Storage write');
  ```
- The only server-side state written is the integer counter
  `styleStudioUsage/{uid}/days/{YYYY-MM-DD} = { count, updatedAt }`.
- The client caches the generated image in `localStorage` via
  `MobileBarberAIPreview.saveLocalCopy` (on-device only). Favorites are stored as
  `{ styleId, title, sessionId }` text references in `localStorage('ss_public_favorites')` —
  no images.

The privacy note on the page (vi/en/es) reads:
> "Your selfie is used only to generate your style preview. We do not store your photo or the
> result — you can save the look to your phone yourself."

---

## Plan's 20 PASS Items — Traceability

The plan spec listed 20 required pass items. Where each is satisfied in the committed code:

| # | Item | Where satisfied |
|---|---|---|
| 1 | `STUDIO_GOALS` expanded (executive, business, glamorous + 12 total → 15) | `style-studio-lib.js` line 31 |
| 2 | `buildMasterStylistPrompt` exported | `style-studio-lib.js` + module.exports |
| 3 | Master prompt asks for ONE bestLook (not 5) | prompt text: "SINGLE BEST look" + `bestLook` key |
| 4 | `imageEditPrompt` + `explanation` in prompt contract | prompt lines 6-7 |
| 5 | Safety: positive language, never balding/medical | prompt line 2 |
| 6 | `normalizeMasterpiece` null-safe (null → `{}` attrs) | `style-studio-lib.js` `normalizeMasterpiece` |
| 7 | `normalizeMasterpiece` coerces title/explanation/imageEditPrompt | same function |
| 8 | `MASTER_STYLIST_CLAUSE` defined in `index.js` | `index.js` line 2592 |
| 9 | `runStudioGeneration` extracted (shared core) | `index.js` line 3100 |
| 10 | Vendor `generateStyleStudio` intact (no regression) | `index.js` line 3190; unit test |
| 11 | `master` branch in `runStudioGeneration` | `index.js` line 3104 |
| 12 | Master response shape: `{analysis, masterpiece:{previewDataUrl,title,explanation,attributes}}` | `index.js` lines 3128-3135 |
| 13 | `resolveDailyLimit` pure, exported | `style-studio-lib.js` + module.exports |
| 14 | `resolveDailyLimit` returns 0 for null/inactive/out-of-window | unit tests (4 cases) |
| 15 | `generateStyleStudioPublic` callable (anon-auth OK, promo gate, login wall) | `index.js` lines 3288-3350 |
| 16 | Counter incremented AFTER `ok:true` (user-friendly split helper) | `checkPublicQuota` (read-only) + `incrementPublicUsage` after result |
| 17 | Firestore rules: `config/styleStudioPromo` read:false / write:isAdmin | `firestore.rules` lines 547-550 |
| 18 | Firestore rules: `styleStudioUsage/{uid}/days/{day}` owner-read / write:false | `firestore.rules` lines 558-566 |
| 19 | Public page `style-studio.html` with consent, selfie, goal, master CTA, 9 modes | `style-studio.html` |
| 20 | Public client `style-studio-public.js` vi/en/es, anon-auth, masterpiece render, login wall, no Firestore image writes | `style-studio-public.js` |

All 20 items are present in the committed code. Items 1–4 and 6–7 are verified by unit tests.
Items 8–11 are verified by static source guards. Items 13–14 are verified by unit tests.
Items 17–18 are verified by rules tests. Items 15–16, 19–20 require a deployed + promo-seeded
environment for live verification.

---

## Limitations

### Promo banner is always-visible

`#ssLaunchBanner` is always rendered. The client cannot read `config/styleStudioPromo`
(Firestore rules deny). The plan noted two options: return a `promo:{active}` flag from the
callable, or show the banner by default. The committed implementation shows it by default
during launch. To hide it post-launch, set `#ssLaunchBanner { display: none }` via a
CSS deploy or a flag returned in the callable response.

### Anonymous UID rotation

A visitor who clears cookies, opens incognito, or switches devices gets a new anon UID and
a fresh daily counter. The free-preview limit is therefore per-browser-session, not per-person.
This is intentional for a launch promo. The login wall is the conversion mechanism.

### Membership tiers / profiles

The `#ssMembershipPrompt` CTA links to `/mobile-barber/` as a placeholder. Full membership
account creation, profile storage, and tier management are deferred to Slice D (per the plan's
"Limitations" section).

### Style-studio-only promo cache

`_promoCache` is a module-level variable in `functions/index.js`. It caches the promo doc for
5 minutes per Cloud Function instance. Under concurrent traffic, multiple instances may each
maintain their own cache — this is the same pattern as `_aiKeyCache` and is acceptable.

### `mb-style-studio-smoke.js` not extended

The plan listed the live smoke test as a modify target. The committed diff does not extend it
with master/public cases. A manual smoke against the deployed callable is the recommended
pre-launch verification step (see `ai_master_stylist_mode.md` Tests section).

---

## PASS / BLOCKED

**PASS** — all implementation items for this slice (Tasks 1–7) are committed and unit/rules
tests pass.

**BLOCKED for public exposure until:**

1. **Promo doc seeded** — `config/styleStudioPromo` must exist in Firestore with
   `active:true` and a valid date window. Without it, every visitor hits the login wall
   on their first attempt (see "CRITICAL OPERATIONAL NOTE" above).

2. **Functions deployed** — `firebase deploy --only functions,hosting,firestore:rules`
   (requires explicit go-ahead per CLAUDE.md).

3. **Live smoke** — confirm `generateStyleStudioPublic` returns `ok:true` with a
   non-empty `masterpiece.previewDataUrl` for a real selfie in master mode.

4. **Membership CTA** — `/mobile-barber/` customer account portal must accept and register
   the user coming from the login wall, or the CTA destination should be updated before launch.

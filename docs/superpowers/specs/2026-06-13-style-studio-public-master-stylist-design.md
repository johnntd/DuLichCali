# Public AI Style Studio + AI Master Stylist — Design Spec

- **Date:** 2026-06-13
- **Status:** Approved design — pending spec review, then plan → build
- **Sub-project:** Slice B + C of the public AI Style Studio platform, **led by the AI Master Stylist flagship**. (Slice A wig fix already shipped. Slice D membership tiers/cross-device history deferred.)
- **Public name:** "AI Style Studio" · flagship feature "AI Master Stylist" · public URL `/style-studio`
- **Owner decisions:** build B+C now · guests = Firebase anonymous-auth uid + login-wall after the free limit · masterpiece = exactly ONE image · page carries the Master Stylist hero AND the 9 manual modes · privacy-first (no stored images) · reuse `generateStyleStudio`, don't rewrite · hold prod deploy for explicit go-ahead.

---

## 1. Background — verified current state

- **Vendor studio (live):** `generateStyleStudio` callable (`functions/index.js`) is vendor-gated (`requireMobileBarberVendor`), reuses Gemini vision (`gemini-2.5-flash`) + image edit (`gemini-2.5-flash-image`) via `callGeminiHaircutAnalysis` / `callGeminiImageEdit`, returns `{ analysis{features,scores,strategy,thinning}, recommendations[5] }`. Client: `mobile-barber/mobile-barber-style-studio.js` in `mobile-barber/dashboard.html`. **Stays as-is.**
- **Wig fix (shipped this session):** `normalizeHaircutStyle(s, audience, idx, mode)` selects `REPLACE_HAIR_CLAUSE` for `wig`/`hairsystem`, `IDENTITY_CLAUSE` otherwise; `generateHaircutPreviews` pins `mode='haircut'` (unchanged).
- **Public-callable blueprint:** `generateHaircutPreviews` (`functions/index.js`) is already a **public, unauthenticated, CORS, validated** `onCall` (data:image mime + 1.5 MB cap). The public Style Studio callable copies THIS structure, **not** the vendor gate.
- **Config pattern:** `getAiKey()` / `_loadFirestoreAiKeys()` reads a `config/*` doc via Admin SDK with a 5-min cache; rules deny client read of `config/aiSecrets`. Clone for `config/styleStudioPromo`.
- **Customer accounts (reuse later, Slice D):** `isCustomerUser()`, `mobileBarberCustomers/{uid}`, `customerSavedStyles`, derived-email auth in `mobile-barber/mobile-barber-customer.js`.
- **Homepage + landing pattern:** category pages (`hair.html`, `nails.html`, `airport.html`) load `/style.css` + `/desktop.css`, inline scroll override + hero carousel. Homepage cards render via `script.js` `renderHomepageVendors()`/`buildVendorCardHtml()` into `#hpFeatured`; `?entry=` routing in `script.js` DOMContentLoaded. `firebase.json` has `cleanUrls:true` + a `rewrites` array. **Flag:** `_hpCatLabel`/`_hpCatAccent` (`script.js`) are hardcoded English — adding the card will route the label through a vi/en/es lookup (fixing that RULE #2 debt).
- **Version high-water:** `20260613a`. New files start at **`20260613b`**.

---

## 2. Confirmed decisions

1. Build **Slice B (public page) + Slice C (public callable + 14-day promo + guest limits)** now, led by the **AI Master Stylist** flagship. Defer Slice D (membership tiers, cross-device profiles, saved history).
2. Guests: **Firebase anonymous auth → uid**; per-uid daily free-generation counter; **login wall** when the promo free limit is hit.
3. **AI Master Stylist** = the hero of `/style-studio`; produces **exactly ONE** masterpiece image + a "why" explanation. Reuses `generateStyleStudio`'s engine via a shared core; does NOT rewrite it.
4. The public page carries the Master Stylist hero **AND** the 9 manual modes below it.
5. Privacy-first: no selfie or generated image stored unless the user explicitly saves; session/local + native download only.
6. Hold the production deploy for explicit go-ahead.

---

## 3. Goals / Non-goals

### Goals
- A public, premium, mobile-first `/style-studio` page whose hero is the one-click **AI Master Stylist** (selfie → single best look + explanation), with the 9 manual modes below.
- A new **public** callable (guest-allowed during the promo via anonymous auth, per-uid daily cap, login wall) reusing the studio engine + the shipped wig fix.
- A new **`master`** mode in the studio engine that returns ONE identity-preserving masterpiece + analysis + explanation.
- Homepage "AI Style Studio" card → `/style-studio`.
- Honor every guardrail: no stored images, no broken vendor studio / `generateHaircutPreviews` / booking / accounts, vi/en/es, version bumps, positive language.

### Non-goals (this slice)
- No payment (Premium is a future tier).
- No membership tiers / cross-device profiles / persistent saved-history (Slice D).
- No glasses / accessories / makeup / celebrity / aging — **design hooks only** (Section 11).
- No change to the vendor `generateStyleStudio` access model, `generateHaircutPreviews`, or `mobile-barber/index.html` behavior.

---

## 4. Architecture

```
script.js (homepage)            firebase.json
  └─ "AI Style Studio" card        └─ rewrite /style-studio → style-studio.html
       → /style-studio
                                 style-studio.html  (NEW public page, mirrors hair.html)
                                   ├─ HERO: AI Master Stylist  ("Generate My Best Look")
                                   ├─ 9 manual modes (public variant of the studio UI)
                                   └─ style-studio-public.js (NEW client; anon-auth + render + privacy)
                                                 │ httpsCallable('generateStyleStudioPublic')
functions/index.js                               ▼
  ├─ runStudioGeneration(params)   ← NEW shared core (analysis + per-mode OR master generation)
  │     reused by BOTH callables; built by refactoring the body of generateStyleStudio
  │     WITHOUT changing its external behavior (regression-guarded)
  ├─ generateStyleStudio (vendor)  → requireMobileBarberVendor → runStudioGeneration
  └─ generateStyleStudioPublic     → requireAuthedGuest (anon ok) → promo+counter gate → runStudioGeneration
functions/style-studio-lib.js
  ├─ STUDIO_MODES + 'master'        ← add master mode + buildMasterStylistPrompt
  └─ STUDIO_GOALS (expanded list)
config/styleStudioPromo (Firestore) + styleStudioUsage/{uid}/days/{YYYY-MM-DD} (counters)
```

**Shared-core refactor (low-risk, regression-guarded):** extract the analysis+generation body currently inside `generateStyleStudio` into `runStudioGeneration({mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey})`. `generateStyleStudio` becomes: vendor-auth → validate → `runStudioGeneration`. The new public callable becomes: guest-auth → promo/counter gate → validate → `runStudioGeneration`. A test asserts `generateStyleStudio`'s response shape is unchanged.

---

## 5. AI Master Stylist mode (the flagship)

### Mode contract — `mode: 'master'`
`runStudioGeneration` with `mode:'master'` runs ONE vision pass (`buildMasterStylistPrompt`) that returns:
- the full **analysis** block (features, scores, strategy, thinning) — the deep facial analysis + facial-harmony + feature-enhancement engines, positive language only;
- a single **bestLook**: `{ title, attributes:{ haircut, color, texture, bangs, eyebrows, beard?, wigOrSystem? }, explanation, imageEditPrompt }` — AI auto-chooses every attribute (no user selection); `wigOrSystem` only when clearly beneficial (e.g. advanced thinning).

Then ONE `callGeminiImageEdit(bestLook.imageEditPrompt + MASTER_STYLIST_CLAUSE)`.

**Response:**
```jsonc
{ "ok": true, "mode": "master", "audience": "...",
  "analysis": { "features":{...}, "scores":{...6 0-100...}, "strategy":{emphasize,balance}, "thinning":{level,note} },
  "masterpiece": { "previewDataUrl": "data:image/...", "title": "...",
                   "explanation": "This look was selected because it adds volume near the crown, balances proportions, softens the jawline, and emphasizes the eyes; the warm chestnut complements your skin tone for a youthful, professional appearance.",
                   "attributes": { "haircut":"", "color":"", "texture":"", "bangs":"", "eyebrows":"", "beard":"", "wigOrSystem":"" } },
  "provider": "gemini-2.5-flash-image", "generationTimeMs": 0 }
```
Exactly ONE image. On image failure: `ok:false` shaped error (no static substitute).

### `MASTER_STYLIST_CLAUSE` (new constant)
Preserve identity — same person, eyes, nose, lips, age range, ethnicity, skin tone, facial bone structure; do not swap the person or alter facial features. You MAY enhance the hair (cut, color, texture, bangs), the eyebrows, and facial hair/beard, and add a natural-looking wig or hair system **only if it clearly improves fullness or harmony**. Produce the single most flattering, harmonious, youthful, confident, and natural result. Photorealistic, natural lighting, head-and-shoulders portrait. (Contains "IDENTITY LOCK" so the dedup guard recognizes it.)

### Style goals (optional bias)
`STUDIO_GOALS` expands to: professional, youthful, elegant, executive, natural, confident, wedding, vacation, party, business, soft, masculine, feminine, cute, glamorous. Passed as `goal` and woven into `buildMasterStylistPrompt`.

### Safety
Positive language only — never "large forehead / balding / old / unattractive"; instead "create balance", "draw attention to the eyes", "fuller appearance", "youthful-looking". No attractiveness scoring; no medical claims (thinning uses soft language). Child selfies → wholesome, age-appropriate; child-safety clause applies.

---

## 6. Public callable + promo + guest limits (Slice C)

### `generateStyleStudioPublic` (new public `onCall`)
Mirrors `generateHaircutPreviews` infra (region us-central1, `secrets:[GEMINI_API_KEY]`, 300s, 1GiB, cors). Flow:
1. **`requireAuthedGuest`** — require `request.auth` (anonymous OK); reject only fully-unauthenticated calls. (The page signs the visitor in anonymously before the first call.)
2. **Promo + counter gate** (`checkPublicQuota(uid)`): read `config/styleStudioPromo` (cached) → if `active` and within `[startDate,endDate]`, daily limit = `freeGenerationsPerUser`, else limit = 0 (login/membership required). Read `styleStudioUsage/{uid}/days/{today}` count; if `>= limit` → return `{ ok:false, code:'LIMIT_REACHED', requireLogin:true, vendorMessage:'…' }` (page shows the membership/login prompt). Anonymous users always hit a login wall after the free count (real accounts are Slice D; for this slice the wall routes to "create a free account — coming soon" or the existing customer login).
3. Validate selfie (reuse the mime + 1.5 MB checks).
4. `runStudioGeneration(...)` (mode may be `master` or any of the 9).
5. On success, **increment** `styleStudioUsage/{uid}/days/{today}` (Admin SDK, transactional/`FieldValue.increment`).

### Promo config
`config/styleStudioPromo = { active:true, startDate:'2026-06-..', endDate:'2026-06-..'(start+14d), freeGenerationsPerUser:5 }`. Admin-seeded; server reads it cached. **Flag:** per-IP is not a real limit (CORS only governs origin); the per-uid counter + login wall is the genuine gate; anonymous uids can be rotated, so the login wall is the meaningful control.

### Firestore rules
- `config/styleStudioPromo` — `allow read: if false; allow write: if isAdmin();` (server reads via Admin SDK, bypassing rules).
- `styleStudioUsage/{uid}/days/{day}` — `allow read: if request.auth.uid == uid; allow write: if false;` (only the Function writes via Admin SDK).
No image data in either collection.

---

## 7. Public page `/style-studio` (Slice B)

`style-studio.html` (mirrors `hair.html`): `/style.css` + `/desktop.css`, inline scroll-override, premium hero, vi/en/es. Loads Firebase compat SDK + `style-studio-public.js?v=20260613b` + `style-studio-public.css?v=20260613b` (or appended to an existing CSS).

**Sections (mobile-first):**
1. **Hero — AI Master Stylist (flagship, first thing seen):** "✨ AI Master Stylist / Upload a selfie and let AI create your best look" + optional **goal** selector + **[Generate My Best Look]** → shows the ONE masterpiece (before/after), the explanation, harmony talking points, and save/export.
2. **Launch banner:** "Free AI style preview during launch" (shown while promo `active`).
3. **Manual modes:** the 9 studios (Hair / Color / Texture / Eyebrows / Beard / Wig / Hair Systems / Event / Vacation) — public variant reusing the studio render/lightbox/compare componentry (extract shared pieces from `mobile-barber-style-studio.js` where clean, or a public sibling module).
4. **Save / export / share** (local + native download; share = device share sheet / link).
5. **Membership prompt** (appears at the login wall): "Create a free account to keep generating" (wires to existing customer login; full tiers = Slice D).
6. **Privacy explanation:** "Your selfie is used only to generate your style preview. We do not save it unless you choose to save the result."

**Homepage card** (`script.js`): a static `MARKETPLACE.businesses`-style entry (or a dedicated render) → `/style-studio`; category label "AI Style Studio" added through a vi/en/es lookup (not the hardcoded `_hpCatLabel`). `firebase.json` rewrite `{ "source":"/style-studio", "destination":"/style-studio.html" }`. `?entry=style-studio` handled in `script.js` (or the card links directly to `/style-studio`).

---

## 8. Privacy + Security

- **No stored images:** selfie + generated previews never written to Firestore/Storage; the public callable returns data URLs and persists only the per-uid **count** (an integer) — no image bytes. Save/export = user-controlled local + native download.
- **Keys server-side only** (`getAiKey`); validate mime + 1.5 MB cap; reject non-image / oversized.
- **Auth:** anonymous-auth for guests; login wall after the free quota.
- Abuse: per-uid daily counter is the real gate; document that anonymous uids are rotatable (login wall is the control). No selfie logging.

---

## 9. i18n + versioning + reuse/don't-break

- **i18n:** every new user-facing string (page, hero, banner, explanation labels, privacy text, homepage card label) in **vi + en + es**; AI natural-language fields (`explanation`, analysis) returned in the user's `lang`. No hardcoded strings.
- **Versioning:** new JS/CSS start at **`20260613b`**, bump every HTML consumer; never reuse a deployed string.
- **Reuse:** `runStudioGeneration` shared core, `callGeminiImageEdit`/`callGeminiHaircutAnalysis`/`getAiKey`, the wig fix's clause logic, the studio render/lightbox/compare componentry, the `config/*` cache pattern, the `hair.html` landing template.
- **Don't break:** vendor `generateStyleStudio` (regression-guarded shape), `generateHaircutPreviews`, mobile-barber booking, customer accounts, vendor dashboard.

---

## 10. Future hooks (design-only this slice)

`buildMasterStylistPrompt` + the `analysis`/`attributes`/`bestLook` schema are designed so later additions plug in as new optional attributes / prompt sections without re-architecting: **glasses, accessories, makeup, celebrity-inspired, aging simulation, look-younger**. None are built now; the schema reserves space (e.g. `attributes.glasses?`, `attributes.accessories?`).

---

## 11. Tests (the 20 PASS items + master-specific)

Unit/static (`tests/unit/`): master mode wiring (`MASTER_STYLIST_CLAUSE`, `buildMasterStylistPrompt`, `runStudioGeneration` shared core), `generateStyleStudio` shape unchanged, `generateHaircutPreviews` unchanged, promo/quota pure logic (date-window + limit resolution), no-image-persist guard.
Rules (`tests/rules`): `config/styleStudioPromo` + `styleStudioUsage` read/write rules.
Live/opt-in (`tests/live/`): per-mode + master smoke against the deployed public callable (asserts ok, one masterpiece for master, 5 for manual, identity preserved by eyeball).
Page checks: `/style-studio` loads (clean URL), homepage links to it, render at 375px + 1280px, anon-auth guest can generate, promo limit triggers the login wall, vendor studio still works.
Gate: `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.

Maps to the owner's 20 PASS items (page loads; homepage link; guest promo; promo limit; login required after limit; account persists [Slice D stub]; each mode generates 5 image previews; wig/hairsystem generate the person wearing it [wig fix shipped]; color/eyebrow/beard visibly change; event/vacation looks; save/export; no images stored unless saved; keys not exposed; iPhone + desktop layout; vendor studio still works).

---

## 12. Files

**New:** `style-studio.html` (repo root, like `hair.html`), `style-studio-public.js` (repo root — public page client; not under `mobile-barber/`), `style-studio.css` (repo root), `docs/ai_master_stylist_mode.md`, `docs/style_studio_public_launch.md`, plus tests.
**Modified:** `functions/index.js` (`runStudioGeneration` extraction + `generateStyleStudioPublic` + promo/quota helpers), `functions/style-studio-lib.js` (master mode + goals), `firestore.rules` (promo + usage), `firebase.json` (rewrite), `script.js` (homepage card + i18n label).
**Untouched:** vendor `generateStyleStudio` access model, `generateHaircutPreviews`, `mobile-barber/index.html` behavior, vendor dashboard studio.

---

## 13. Acceptance / PASS criteria

PASS only if: the **AI Master Stylist** is the prominent flagship/hero of `/style-studio` and produces a single identity-preserving "best look" image + explanation; the public page loads at `/style-studio` and is linked from the homepage; the 14-day promo grants guests free generations then enforces a login wall; all 9 manual modes work (wig/hairsystem visibly apply); no images are stored unless the user saves; keys are not exposed; iPhone + desktop layouts work; and the vendor Style Studio + all existing Mobile Barber features still work. `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`. Reports written.

---

## 14. Limitations

- Anonymous-uid counters are rotatable → the login wall (not the counter) is the real abuse control; documented.
- Master-mode image fidelity depends on `gemini-2.5-flash-image`; quality documented per the live smoke, never faked.
- Membership tiers/persistent history are deferred (Slice D) — the login wall routes to the existing customer login as a stub.
- Latency: master = 1 vision + 1 image (~fast); manual modes = 1 vision + 5 images (existing envelope).

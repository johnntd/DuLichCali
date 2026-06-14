# Public AI Style Studio + AI Master Stylist — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a public `/style-studio` page whose flagship hero is the one-click **AI Master Stylist** (selfie → single best look + explanation), with the 9 manual modes below — powered by a new public, anon-auth, promo-gated callable that reuses the studio engine.

**Architecture:** Refactor the body of the vendor `generateStyleStudio` into a shared `runStudioGeneration` core (vendor callable behavior unchanged, regression-guarded). Add a `master` mode (one vision pass → ONE masterpiece + explanation, `MASTER_STYLIST_CLAUSE`). Add a public callable `generateStyleStudioPublic` (anonymous-auth OK, `config/styleStudioPromo` window, per-uid daily counter, login wall). New public page `style-studio.html` + `style-studio-public.js` + `style-studio.css` mirroring `hair.html`. Homepage card + `firebase.json` rewrite. Privacy-first: no stored images, only an integer counter.

**Tech Stack:** Firebase Functions v2 (`onCall`), Gemini 2.5 Flash (vision) + 2.5 Flash Image, Firebase JS SDK 9.22 compat (+ anonymous auth), vanilla browser JS (IIFE), CSS mobile-first. No build step.

**Spec:** `docs/superpowers/specs/2026-06-13-style-studio-public-master-stylist-design.md`

---

## Reference (verified)

- `functions/index.js`: `generateStyleStudio` callable (vendor, `requireMobileBarberVendor`) + `runStudioPlan`; `normalizeHaircutStyle(s,audience,idx,mode)` (wig fix shipped); `IDENTITY_CLAUSE`/`REPLACE_HAIR_CLAUSE`/`CHILD_SAFETY_CLAUSE`; `callGeminiHaircutAnalysis`/`callGeminiImageEdit`/`getAiKey`/`httpsPost`; `generateHaircutPreviews` (public blueprint); `_loadFirestoreAiKeys()`/`getAiKey()` config-cache pattern; `const db = admin.firestore()`; `HttpsError`, `FieldValue` (verify import).
- `functions/style-studio-lib.js`: `STUDIO_MODES`, `STUDIO_GOALS`, `buildStudioAnalysisPrompt`, `normalizeStudioScores`, `normalizeStudioMode/Options/Audience/Pref/Goal`.
- `firestore.rules`: `isAdmin()`, `isCustomerScopedCreate()`, `config/aiSecrets` (read:false) pattern.
- `firebase.json`: `cleanUrls:true`, `rewrites` array (lines ~57-71).
- `hair.html`: landing template — `/style.css` + `/desktop.css`, `.hc` hero carousel, `.svc-grid`, `.lp-ai`, `.lp-contact`, `.lp-back`, inlined carousel IIFE.
- `script.js`: `renderHomepageVendors()`/`buildVendorCardHtml()` → `#hpFeatured`; `_hpCatLabel`/`_hpCatAccent` (hardcoded English — to fix); `?entry=` routing in DOMContentLoaded.
- Versions: high-water `20260613a` → new files **`20260613b`**.

---

## File Structure

| File | New/Mod | Responsibility |
|---|---|---|
| `functions/style-studio-lib.js` | Modify | expand `STUDIO_GOALS`; add `buildMasterStylistPrompt`, `normalizeMasterpiece` |
| `functions/index.js` | Modify | `MASTER_STYLIST_CLAUSE`; extract `runStudioGeneration`; `master` branch; `generateStyleStudioPublic` + `requireAuthedGuest` + `getStyleStudioPromo` + `checkAndCountPublicQuota` |
| `firestore.rules` | Modify | `config/styleStudioPromo` + `styleStudioUsage/{uid}/days/{day}` |
| `firebase.json` | Modify | rewrite `/style-studio → /style-studio.html` |
| `style-studio.html` | **New** | public page (hero Master Stylist + 9 modes + banner + save/export + membership prompt + privacy) |
| `style-studio-public.js` | **New** (`?v=20260613b`) | anon-auth, master generate+render, manual modes, save/export/share, login wall, vi/en/es |
| `style-studio.css` | **New** (`?v=20260613b`) | page + hero + masterpiece + modes styles (mobile-first + 768/1200) |
| `script.js` | Modify | homepage "AI Style Studio" card → `/style-studio` + vi/en/es label lookup |
| `tests/unit/style-studio.test.js` | Modify | master-mode + quota pure-logic + shared-core + regression guards |
| `tests/rules/*` | Modify | promo + usage rules cases |
| `tests/live/mb-style-studio-smoke.js` | Modify | add master + public-callable smoke |
| `docs/ai_master_stylist_mode.md`, `docs/style_studio_public_launch.md` | **New** | reports |

**Untouched:** vendor `generateStyleStudio` access model + response shape, `generateHaircutPreviews`, `mobile-barber/index.html`, vendor dashboard studio.

---

## Task 1: Backend — expand goals + `buildMasterStylistPrompt` (pure, TDD)

**Files:** Modify `functions/style-studio-lib.js`; Test `tests/unit/style-studio.test.js`

- [ ] **Step 1: Failing tests** — append to the test file before the final `console.log`:

```js
// Master Stylist: expanded goals + the master prompt builder.
assert.ok(S.STUDIO_GOALS.includes('executive') && S.STUDIO_GOALS.includes('business') && S.STUDIO_GOALS.includes('glamorous'), 'goals expanded'); ok('goals expanded');
const mp = S.buildMasterStylistPrompt('man', 'professional', 'en');
assert.ok(/single best look|ONE/i.test(mp) && /bestLook/.test(mp), 'master prompt asks one best look'); ok('master prompt one look');
assert.ok(/imageEditPrompt/.test(mp) && /explanation/.test(mp), 'master prompt requests edit + explanation'); ok('master prompt edit+why');
assert.ok(/positive/i.test(mp) && /never.*(balding|medical)/i.test(mp), 'master prompt safety'); ok('master prompt safety');
// normalizeMasterpiece coerces a partial model object into the masterpiece shape.
const m = S.normalizeMasterpiece({ title:'X', explanation:'Y', imageEditPrompt:'Z', attributes:{ haircut:'a' } });
assert.strictEqual(m.title,'X'); assert.strictEqual(m.imageEditPrompt,'Z'); assert.strictEqual(m.attributes.haircut,'a'); ok('normalizeMasterpiece ok');
assert.deepStrictEqual(S.normalizeMasterpiece(null).attributes, {}); ok('normalizeMasterpiece null-safe');
```

- [ ] **Step 2: Run → FAIL** (`node tests/unit/style-studio.test.js`) — `STUDIO_GOALS`/`buildMasterStylistPrompt` missing/short.

- [ ] **Step 3: Implement** in `functions/style-studio-lib.js`:
  - Replace `STUDIO_GOALS` with: `['professional','youthful','elegant','executive','natural','confident','wedding','vacation','party','business','soft','masculine','feminine','cute','glamorous']`.
  - Add (and export) `MASTER_ATTR_KEYS = ['haircut','color','texture','bangs','eyebrows','beard','wigOrSystem']`.
  - Add `normalizeMasterpiece(raw)`:
```js
function normalizeMasterpiece(raw) {
  raw = raw || {};
  const attrsIn = (raw.attributes && typeof raw.attributes === 'object' && !Array.isArray(raw.attributes)) ? raw.attributes : {};
  const attributes = {};
  MASTER_ATTR_KEYS.forEach((k) => { if (attrsIn[k]) attributes[k] = String(attrsIn[k]).trim(); });
  return {
    title: String(raw.title || raw.styleTitle || 'Your best look').trim(),
    explanation: String(raw.explanation || raw.whyItFitsFace || '').trim(),
    imageEditPrompt: String(raw.imageEditPrompt || raw.editPrompt || '').trim(),
    attributes,
  };
}
```
  - Add `buildMasterStylistPrompt(audience, goal, lang)`:
```js
function buildMasterStylistPrompt(audience, goal, lang) {
  const langName = STUDIO_LANG_NAME[lang] || 'English';
  return [
    'You are an elite celebrity stylist + personal image consultant. Analyse ONE selfie and design the SINGLE BEST overall look for this person — not random options. Output is shown to the customer.',
    'SAFETY (absolute): POSITIVE language only. Never say ugly/bad/balding/old-looking/unattractive or make a medical claim. Use "balance", "soften", "emphasize", "enhance", "fuller appearance", "youthful-looking". Children: wholesome, age-appropriate only.',
    'Customer audience: ' + audience + '. Style goal: ' + (goal || 'most flattering overall') + '.',
    '',
    'First produce an "analysis" object: features { faceShape, forehead, eyes, eyelids, brows, nose, lips, cheeks, jawChin, ears, hairline, hairDensity, beardDensity, skinToneBand, approxAgeRange } (short positive phrases in ' + langName + '); scores { symmetry, youthfulness, professional, confidence, softness, maintenance } as integer 0..100 PROPORTION/HARMONY metrics (not a rating of the person); strategy { emphasize:[], balance:[] } positive phrasing; thinning { level (none|mild|moderate|advanced), note } soft language.',
    '',
    'Then choose THE SINGLE BEST look ("bestLook"): auto-decide haircut, color, texture, bangs, eyebrows, beard (men only), and a wig/hair-system ONLY if it clearly improves fullness or harmony. Return:',
    '{ "title":"", "attributes":{ "haircut":"","color":"","texture":"","bangs":"","eyebrows":"","beard":"","wigOrSystem":"" }, "explanation":"", "imageEditPrompt":"" }',
    'explanation: 2-3 sentences in ' + langName + ' on WHY this look suits them (what it emphasizes/balances), e.g. "adds volume near the crown, balances proportions, softens the jawline, emphasizes the eyes; the warm chestnut complements your skin tone for a youthful, professional appearance."',
    'imageEditPrompt: ONE precise ENGLISH instruction to render the FULL transformation on the SAME person (preserve identity/eyes/nose/lips/age/ethnicity/skin tone/bone structure; enhance hair, color, eyebrows, beard, and wig/hair-system if chosen).',
    '',
    'Return STRICT JSON only: {"analysis":{...},"bestLook":{...}}',
  ].join('\n');
}
```
  - Add `MASTER_ATTR_KEYS, normalizeMasterpiece, buildMasterStylistPrompt` to `module.exports`.

- [ ] **Step 4: Run → PASS.** - [ ] **Step 5: Commit** `feat(style-studio): master-stylist prompt builder + expanded goals (pure + tests)`

---

## Task 2: Backend — `runStudioGeneration` shared core + `master` mode + `MASTER_STYLIST_CLAUSE`

**Files:** Modify `functions/index.js`, `functions/style-studio-lib.js` (require), `tests/unit/style-studio.test.js`

- [ ] **Step 1: Failing regression/wiring test** — append:
```js
assert.ok(/const MASTER_STYLIST_CLAUSE\s*=/.test(src), 'MASTER_STYLIST_CLAUSE present'); ok('master clause present');
assert.ok(/async function runStudioGeneration\(/.test(src), 'runStudioGeneration extracted'); ok('shared core present');
assert.ok(/exports\.generateStyleStudio\s*=\s*onCall\(/.test(src), 'vendor studio intact'); ok('vendor studio intact');
assert.ok(/mode === 'master'/.test(src), 'master branch present'); ok('master branch');
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**
  - Add near `REPLACE_HAIR_CLAUSE`:
```js
// Master Stylist composite edit: lock facial identity but allow hair/color/
// eyebrow/beard enhancement (+ wig/hair-system if beneficial).
const MASTER_STYLIST_CLAUSE = 'CRITICAL — IDENTITY LOCK: keep the EXACT SAME PERSON — same face, eyes, nose, lips, age range, ethnicity, skin tone and facial bone structure; do NOT swap the person or alter facial features. You MAY enhance the hair (cut, color, texture, bangs), eyebrows and facial hair/beard, and add a natural wig or hair system ONLY if it clearly improves fullness or harmony. Produce the single most flattering, harmonious, youthful, confident and natural result. Photorealistic, natural lighting, head-and-shoulders portrait, sharp focus.';
```
  - **Extract `runStudioGeneration`** from the current `generateStyleStudio` body. New signature:
```js
// Shared studio core used by BOTH the vendor and public callables. Performs
// the analysis + per-mode (5 recs) OR master (1 masterpiece) generation.
// Returns the response object (without ok/auth concerns).
async function runStudioGeneration(params) {
  const { mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey } = params;
  const t0 = Date.now();
  if (mode === 'master') {
    const prompt = StudioLib.buildMasterStylistPrompt(audience, goal, lang);
    const plan = await callGeminiHaircutAnalysis(geminiKey, base64, mimeType, prompt);
    const analysis = normalizeStudioAnalysis(plan && plan.analysis); // see below
    const best = StudioLib.normalizeMasterpiece(plan && plan.bestLook);
    if (!best.imageEditPrompt) return { ok:false, vendorMessage:'Master Stylist could not design a look. Try a clearer photo.', debugCode:'MASTER_EMPTY' };
    let edit;
    try { edit = await callGeminiImageEdit(geminiKey, base64, mimeType, best.imageEditPrompt + ' ' + MASTER_STYLIST_CLAUSE + (audience==='child'?CHILD_SAFETY_CLAUSE:'')); }
    catch (e) { return { ok:false, vendorMessage:'Master Stylist could not render the look. Please try again.', debugCode:'MASTER_EDIT_ERROR' }; }
    return { ok:true, mode:'master', audience, analysis,
             masterpiece: { previewDataUrl: edit.dataUrl, title: best.title, explanation: best.explanation, attributes: best.attributes },
             provider:'gemini-2.5-flash-image', generationTimeMs: Date.now()-t0 };
  }
  // per-mode path (the existing studio behavior, moved verbatim from the callable)
  let plan;
  try { plan = await runStudioPlan(geminiKey, base64, mimeType, { mode, options, audience, preference, goal, lang }); }
  catch (e) { return { ok:false, vendorMessage:'Style Studio analysis failed. Please try again.', debugCode:'PLAN_ERROR' }; }
  const styles = (plan && plan.styles) || [];
  if (!styles.length) return { ok:false, vendorMessage:'Style Studio returned no styles. Try a clearer photo.', debugCode:'PLAN_EMPTY' };
  let recommendations;
  try { recommendations = await Promise.all(styles.map(async (style) => { /* MOVE the existing baseRec + callGeminiImageEdit map body here verbatim */ })); }
  catch (e) { return { ok:false, vendorMessage:'Style Studio could not render previews. Please try again.', debugCode:'EDIT_ERROR' }; }
  return { ok:true, mode, audience, options, preference, goal, analysis: plan.analysis, recommendations, provider:'gemini-2.5-flash-image', generationTimeMs: Date.now()-t0 };
}
```
  - Factor the analysis normalization currently inside `runStudioPlan` into `normalizeStudioAnalysis(rawAnalysis)` (so master reuses it). Keep `runStudioPlan` calling it. Move the per-style `baseRec`+image-edit map from the callable into `runStudioGeneration` verbatim.
  - **Rewrite `generateStyleStudio` body** to: `await requireMobileBarberVendor(request);` → normalize inputs (mode/audience/options/preference/goal/lang) → validate selfie → `getAiKey('gemini')` → `return runStudioGeneration({...})`. **No behavior change** for the 9 modes (regression test guards the shape).
- [ ] **Step 4: Run unit tests → PASS** (incl. the existing `generateStyleStudio added`/shape guards). `node --check functions/index.js`.
- [ ] **Step 5: Commit** `refactor(style-studio): shared runStudioGeneration core + master mode (vendor callable unchanged)`

---

## Task 3: Backend — public callable `generateStyleStudioPublic` + promo/quota

**Files:** Modify `functions/index.js`, `tests/unit/style-studio.test.js`

- [ ] **Step 1: Failing pure-logic test** — the quota resolver is pure and unit-testable. Add a pure helper to `style-studio-lib.js` and test it:
```js
// resolveDailyLimit(promo, todayISO) → number of free generations allowed today
assert.strictEqual(S.resolveDailyLimit({active:true,startDate:'2026-06-13',endDate:'2026-06-27',freeGenerationsPerUser:5},'2026-06-20'),5); ok('promo active → limit');
assert.strictEqual(S.resolveDailyLimit({active:true,startDate:'2026-06-13',endDate:'2026-06-27',freeGenerationsPerUser:5},'2026-07-01'),0); ok('after window → 0');
assert.strictEqual(S.resolveDailyLimit({active:false,freeGenerationsPerUser:5},'2026-06-20'),0); ok('inactive → 0');
assert.strictEqual(S.resolveDailyLimit(null,'2026-06-20'),0); ok('no config → 0');
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**
  - In `style-studio-lib.js`, add + export pure `resolveDailyLimit(promo, todayISO)`:
```js
function resolveDailyLimit(promo, todayISO) {
  if (!promo || promo.active !== true) return 0;
  const t = String(todayISO || ''); const s = String(promo.startDate || ''); const e = String(promo.endDate || '');
  if (s && t < s) return 0;
  if (e && t > e) return 0;
  const n = Number(promo.freeGenerationsPerUser);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
```
  - In `functions/index.js`, add the config cache (clone the `getAiKey` pattern):
```js
let _promoCache = null, _promoCacheAt = 0;
async function getStyleStudioPromo() {
  if (_promoCache && (Date.now() - _promoCacheAt) < 300000) return _promoCache;
  try { const snap = await db.collection('config').doc('styleStudioPromo').get(); _promoCache = snap.exists ? (snap.data()||{}) : {}; }
  catch (e) { _promoCache = {}; }
  _promoCacheAt = Date.now(); return _promoCache;
}
function requireAuthedGuest(request) { // anonymous OK; reject only fully-unauthenticated
  if (!request.auth || !request.auth.uid) throw new HttpsError('unauthenticated', 'Open the page so we can start a free session.');
  return request.auth.uid;
}
async function checkAndCountPublicQuota(uid) { // returns {allowed, limit, used} or throws nothing
  const promo = await getStyleStudioPromo();
  const todayISO = new Date().toISOString().slice(0,10);
  const limit = StudioLib.resolveDailyLimit(promo, todayISO);
  const ref = db.collection('styleStudioUsage').doc(uid).collection('days').doc(todayISO);
  const used = await db.runTransaction(async (tx) => {
    const d = await tx.get(ref); const cur = (d.exists && Number(d.data().count)) || 0;
    if (cur >= limit) return cur; // do not increment when over
    tx.set(ref, { count: cur + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return cur + 1;
  });
  return { allowed: used <= limit && limit > 0, limit, used };
}
```
  - Add the callable `exports.generateStyleStudioPublic = onCall({region,secrets:[GEMINI_API_KEY],timeoutSeconds:300,memory:'1GiB',cors:true}, async (request) => { ... })`:
    1. `const uid = requireAuthedGuest(request);`
    2. normalize inputs (mode incl. `master`; audience/options/preference/goal/lang).
    3. validate selfie (mime + 1.5MB) → shaped errors.
    4. `const q = await checkAndCountPublicQuota(uid); if (!q.allowed) return { ok:false, code:'LIMIT_REACHED', requireLogin:true, vendorMessage:'You have used your free previews. Create a free account to keep going.', limit:q.limit };`
    5. `const geminiKey = await getAiKey('gemini'); if(!geminiKey) return {...NO_GEMINI_KEY}`.
    6. `return await runStudioGeneration({ mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey });`
  - **Note:** the counter increments BEFORE generation; on a generation error the user still consumed a count (acceptable for promo; or increment after success — pick increment-after-success to be user-friendly: move the `tx.set` to run only after `runStudioGeneration` returns `ok:true`. RECOMMENDED: count after success — restructure so `checkAndCountPublicQuota` is split into `checkQuota` (read-only) before, and `incrementUsage(uid)` after `ok:true`).
- [ ] **Step 4: Run unit tests → PASS; `node --check`.**
- [ ] **Step 5: Commit** `feat(style-studio): public generateStyleStudioPublic callable + promo/quota (anon-auth + login wall)`

---

## Task 4: Firestore rules — promo config + usage counters

**Files:** Modify `firestore.rules`; Test `tests/rules/*`

- [ ] **Step 1: Add failing rules tests** (mirror existing `config/aiSecrets` + customer-scoped tests): a client cannot read `config/styleStudioPromo`; a client cannot write `styleStudioUsage/{uid}/days/{day}`; the owner uid can read its own usage; admin can write promo.
- [ ] **Step 2: Run `npm run test:rules` → FAIL.**
- [ ] **Step 3: Implement** in `firestore.rules`:
```
match /config/styleStudioPromo { allow read: if false; allow write: if isAdmin(); }
match /styleStudioUsage/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // Functions Admin SDK only
  match /days/{day} {
    allow read: if request.auth != null && request.auth.uid == uid;
    allow write: if false;
  }
}
```
- [ ] **Step 4: `npm run test:rules` → PASS (all cases).**
- [ ] **Step 5: Commit** `feat(style-studio): firestore rules for promo config + per-uid usage counters`

---

## Task 5: Public page `style-studio.html` + `firebase.json` rewrite

**Files:** New `style-studio.html`; Modify `firebase.json`

- [ ] **Step 1:** Create `style-studio.html` mirroring `hair.html`'s skeleton (copy its `<head>` — `/style.css?v=...` + `/desktop.css`, fonts, meta — and the standalone scroll override). Replace the body with the AI Style Studio sections, ALL text via `data-ss-i18n` attributes (populated by `style-studio-public.js`):
  - Hero `.hc` (1 slide is fine) with chip "✨ AI Master Stylist", title, sub "Upload a selfie and let AI create your best look", and the **flagship card**: a consent checkbox, selfie upload/camera input (`#ssSelfieInput`), optional **goal** `<select id="ssGoal">`, and **[Generate My Best Look]** `<button id="ssGenerateBest">`. A `#ssMasterResult` container (masterpiece image + `#ssExplanation` + before/after + save/export).
  - `#ssLaunchBanner` (shown when promo active) — "Free AI style preview during launch".
  - `#ssModes` section — the 9 manual modes (accordion) + `#ssModesResults`.
  - `#ssMembershipPrompt` (hidden; shown at the login wall).
  - Privacy `<p data-ss-i18n="privacyNote">`.
  - Firebase compat SDK (app, auth, firestore, functions) + `firebaseConfig` (copy from `mobile-barber/dashboard.html`) + `<link rel="stylesheet" href="/style-studio.css?v=20260613b">` + `<script src="/style-studio-public.js?v=20260613b">`.
- [ ] **Step 2:** Add to `firebase.json` `rewrites`: `{ "source": "/style-studio", "destination": "/style-studio.html" }`.
- [ ] **Step 3:** `python3 -m http.server 8080` then `curl -s http://localhost:8080/style-studio.html | grep -E "ssGenerateBest|AI Master Stylist|style-studio-public.js\?v=20260613b"` → present.
- [ ] **Step 4: Commit** `feat(style-studio): public style-studio.html page shell + firebase rewrite`

---

## Task 6: Public client `style-studio-public.js` + `style-studio.css`

**Files:** New `style-studio-public.js`, `style-studio.css`

- [ ] **Step 1:** Create `style-studio-public.js` (IIFE). Responsibilities (real code; reuse patterns from `mobile-barber-style-studio.js`):
  - `SS_STRINGS` `{en,vi,es}` for every UI key (hero, goal labels, generate button, explanation labels, banner, privacy, membership prompt, mode labels). No hardcoded user-facing text. `t()` + `applyI18n()` over `[data-ss-i18n]`; lang from `?lang`/localStorage/navigator.
  - **Anonymous auth:** on load, `firebase.auth().onAuthStateChanged`; if no user, `firebase.auth().signInAnonymously()`. Gate generate buttons until signed in.
  - **Master flow:** on `#ssGenerateBest`, compress the selfie (reuse a local `compressImage` like the studio module, or load `mobile-barber-ai-preview.js`), call `firebase.functions().httpsCallable('generateStyleStudioPublic',{timeout:180000})({ selfieDataUrl, lang, mode:'master', goal })`. Render ONE masterpiece (`#ssMasterResult`): image + `explanation` + attributes + save/export. On `{requireLogin:true}` → reveal `#ssMembershipPrompt` (login wall).
  - **Manual modes:** the 9 modes (audience + per-mode options) calling the same public callable with the mode; render 5 cards (mirror the studio `renderResults`).
  - **Save/export/share:** native `<a download>` + `navigator.share` if available. localStorage cache only. **No Firestore writes of images.**
  - **Promo banner:** read `config/styleStudioPromo`? No — client can't read it (rules deny). Instead show the banner by default during launch, or have the callable return a `promo` flag in its response; SIMPLEST: show `#ssLaunchBanner` always for now and hide post-launch via a build flag. (Document.)
  - Privacy: never upload/store images server-side.
- [ ] **Step 2:** Create `style-studio.css` — hero flagship card, masterpiece before/after, modes accordion, banner, membership prompt; mobile-first + `@media (min-width:768px)` + `@media (min-width:1200px)` (`max-width:1280px;margin:auto`).
- [ ] **Step 3:** `node --check style-studio-public.js`; confirm all 3 languages present; confirm no `.set(`/`.add(`/`.update(`/`uploadBytes`/`putString` image writes.
- [ ] **Step 4: Commit** `feat(style-studio): public client (anon-auth + Master Stylist + 9 modes + privacy) + css`

---

## Task 7: Homepage card + i18n label

**Files:** Modify `script.js`

- [ ] **Step 1:** Add an "AI Style Studio" card to the homepage Marketplace panel (`#hpFeatured`) linking to `/style-studio`, with subtitle "Try hairstyles, wigs, colors, eyebrows, beards, and event looks with AI." Add the card via the same mechanism as other static cards (a `MARKETPLACE.businesses`-style entry or a dedicated prepend in `renderHomepageVendors`).
- [ ] **Step 2:** Route the category label through a vi/en/es lookup instead of the hardcoded `_hpCatLabel`/`_hpCatAccent` English literals — add `style-studio` (and migrate the existing keys) to a translated label table so the card label respects the language switcher (fixes the RULE #2 debt for this card; do not regress the others — keep their English as the `en` entry).
- [ ] **Step 3:** Bump `script.js?v=` in every HTML consumer (`grep -rln "script.js" . --include="*.html"`) to the next version (e.g. `20260613b`). Verify single version via `grep -rhoE "script\.js\?v=[0-9a-z]+"`.
- [ ] **Step 4: Verify** homepage renders the card (local server + grep). - [ ] **Step 5: Commit** `feat(style-studio): homepage AI Style Studio card → /style-studio (i18n label)`

---

## Task 8: Reports

**Files:** New `docs/ai_master_stylist_mode.md`, `docs/style_studio_public_launch.md`

- [ ] **Step 1:** `docs/ai_master_stylist_mode.md` — architecture, prompt strategy (`buildMasterStylistPrompt` + `MASTER_STYLIST_CLAUSE`), facial-analysis/harmony/enhancement engines, files changed, tests, limitations, PASS/BLOCKED.
- [ ] **Step 2:** `docs/style_studio_public_launch.md` — public page, promo config, anon-auth + login wall, privacy, the 20 PASS items mapped to tests, limitations.
- [ ] **Step 3: Commit** `docs(style-studio): master-stylist + public launch reports`

---

## Task 9: Final gate + verification

- [ ] `node tests/unit/style-studio.test.js` → all pass.
- [ ] `node --check` on every touched JS.
- [ ] `npm run test:rules` → pass (incl. new promo/usage cases).
- [ ] `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` (update any landing fixtures the bumps touch; pre-existing failures noted).
- [ ] Regression: `git diff` shows vendor `generateStyleStudio` response shape unchanged, `generateHaircutPreviews` untouched, `mobile-barber/index.html` only `?v=` bumps (if any).
- [ ] Manual: `/style-studio` at 375px + 1280px — hero Master Stylist generates one look + explanation; a manual mode generates 5; login wall appears after the promo limit (set `config/styleStudioPromo.freeGenerationsPerUser` low to test); vendor dashboard studio still works.
- [ ] **Final report** (CLAUDE.md format). **Hold deploy** for explicit go-ahead; deploying needs `firebase deploy --only functions,hosting,firestore:rules`.

---

## Self-Review notes
- **Spec coverage:** Master Stylist (T1-2), public callable+promo+anon-auth (T3), rules (T4), page (T5-6), homepage (T7), reports (T8), 20 PASS items (T9). Covered.
- **Type consistency:** master response `{analysis, masterpiece:{previewDataUrl,title,explanation,attributes}}` consumed by `style-studio-public.js`; per-mode `{recommendations[]}` shape identical to vendor studio; `resolveDailyLimit`/`checkAndCountPublicQuota` integers only (no images).
- **Counter timing:** increment AFTER `ok:true` (user-friendly) — implement the split-helper variant in T3.
- **Promo banner visibility:** client can't read the promo config (rules deny) — return a `promo:{active}` flag from the callable OR show the banner during launch by default; T6 documents the choice.

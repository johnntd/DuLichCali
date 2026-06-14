# AI Style Studio (Vendor Portal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a vendor-only "AI Style Studio" tab to `mobile-barber/dashboard.html` that drives 9 generative studios + a facial-analysis consultation layer off one selfie, reusing the existing Gemini pipeline without touching the customer feature.

**Architecture:** A new isolated Firebase callable `generateStyleStudio` (vendor-authed) reuses the already-module-scoped Gemini helpers (`getAiKey`, `callGeminiHaircutAnalysis`, `callGeminiImageEdit`, `IDENTITY_CLAUSE`, `CHILD_SAFETY_CLAUSE`) to return `{ analysis(features+0–100 scores+strategy+thinning), recommendations[5] }` per `mode`. A new self-initializing client module `mobile-barber-style-studio.js` renders an accordion of 9 studios + a Consultation panel into a new dashboard section, reusing `MobileBarberAIPreview` (compression/local-cache) and `MBLightbox`. No images persist to Firestore/Storage; favorites/save are localStorage/session only.

**Tech Stack:** Firebase Functions (Node, `onCall` v2), Google Gemini 2.5 Flash (vision) + 2.5 Flash Image (Nano Banana), vanilla ES5-style browser JS (IIFE module pattern), Firebase JS SDK 9.22 compat, CSS (mobile-first). No build step.

---

## Reference map (verified line numbers)

**`functions/index.js`** — reuse, do NOT modify these:
- `GEMINI_API_KEY` secret — `:44`
- `getAiKey(provider)` — `:83`
- `httpsPost(hostname, path, headers, bodyObj)` — `:1709`
- `HAIRCUT_LANG_NAME` `{en,vi,es}` — `:2551`
- `HAIRCUT_AUDIENCES` Set — `:2552`
- `normalizeHaircutAudience` `:2556`, `normalizeHaircutExplore` `:2564`, `normalizeHaircutPref` `:2575`
- `IDENTITY_CLAUSE` `:2581`, `CHILD_SAFETY_CLAUSE` `:2582`
- `extractHaircutJson(text)` `:2755`
- `callGeminiHaircutAnalysis(geminiKey, base64, mimeType, promptText)` → parsed JSON `:2766`
- `normalizeHaircutStyle(s, audience, idx)` `:2792`
- `callGeminiImageEdit(geminiKey, base64, mimeType, editPrompt)` → `{dataUrl}` `:2848`
- `exports.generateHaircutPreviews` (public, anon) `:2881` — **must stay byte-for-byte unchanged**

**`mobile-barber/mobile-barber-booking.js`**:
- `STORED_IMAGE_FIELDS` `:1609`, `isPersistedImageValue` `:1614`, `stripUnstoredImages` `:1622`, `saveBooking` `:1647`

**`mobile-barber/mobile-barber-dashboard.js`** (self-init hooks; we add NOTHING here — the studio module self-wires):
- `STRINGS{en,vi,es}` `:19`, `t(key)` `:995`, `setTranslatedText()` `:1413`, `setLang(lang)` `:3739`, `bind()` `:3749`, `initLang()` `:3807`, `init()` `:3818`, `getVendorId()` `:1045`, `firestoreDb()` `:1068`
- lang localStorage keys: `dlcLang` + `dlc_lang`; vendor id: `?vendor=` param or `dlc_mb_vendor_id`

**`mobile-barber/mobile-barber-ai-preview.js`** (reuse via `window.MobileBarberAIPreview`):
- `compressImage(file)`, `compressDataUrl(url,{maxDimension,quality})`, `saveLocalCopy(sessionId,styleId,url)`, `readLocalCopy(...)`

**`mobile-barber/mobile-barber.js`** — `renderAiResults()` `:2681` is the card-render reference (mirror, don't import).

**`mobile-barber/dashboard.html`** — script includes `:327–338`, `mobile-barber.css?v=` `:28`. CSS consumers: `index.html`, `dashboard.html`, `vendor.html` (all at `20260601a`).

**Version strings:** highest is `20260602a`. New strings start at **`20260613a`**.

---

## File Structure

| File | New/Mod | Responsibility |
|---|---|---|
| `functions/index.js` | Modify (append region after `:~2999`) | `STUDIO_MODES` config, `buildStudioAnalysisPrompt`, `normalizeStudioStyle`, `runStudioPlan`, `requireMobileBarberVendor`, `exports.generateStyleStudio`. No edits to existing functions. |
| `mobile-barber/mobile-barber-style-studio.js` | **New** (`?v=20260613a`) | Self-init vendor studio: `STUDIO_STRINGS{en,vi,es}`, `STUDIO_DEFS` (9 modes + Favorites + Consultation), accordion build, selfie→callable, results render, lightbox+compare, save/local + favorites(session/local), consultation panel (features+scores+strategy). Exposes `window.MobileBarberStyleStudio`. |
| `mobile-barber/dashboard.html` | Modify | New `<section id="mbStyleStudioSection">` + `<script src=".../mobile-barber-style-studio.js?v=20260613a">`; bump `mobile-barber.css?v=` → `20260613a`. |
| `mobile-barber/index.html` | Modify | Bump `mobile-barber.css?v=` → `20260613a` (CSS content changed). No other change. |
| `mobile-barber/vendor.html` | Modify | Bump `mobile-barber.css?v=` → `20260613a`. No other change. |
| `mobile-barber/mobile-barber.css` | Modify (append) | `.mb-studio-*` accordion/cards/consultation/compare styles + `@media (min-width:768px)` + `@media (min-width:1200px)`. |
| `mobile-barber/mobile-barber-booking.js` | Modify (1 line + comment) | Add studio field names to `STORED_IMAGE_FIELDS` defensively. |
| `tests/unit/style-studio.test.js` | **New** | Pure-node assertions: input normalization, mode validation, no-image-persist guard, response-shape contract. |
| `tests/live/mb-style-studio-smoke.js` | **New** | Opt-in live smoke: calls deployed `generateStyleStudio` once per mode; asserts `ok:true`, 5 recs, scores present, identity preserved (manual eyeball). |
| `docs/ai_style_studio_master_plan.md` | **New** | Per-phase report deliverable (files changed / tests / limitations). |

**Untouched (hard rule):** `generateHaircutPreviews`, `mobile-barber-ai-preview.js`, `mobile-barber/index.html` body (only its CSS `?v=` bumps), `firestore.rules` (no new collection).

---

## Task 1: Backend — studio config + input normalizers (pure, TDD)

**Files:**
- Modify: `functions/index.js` (append a `// ── AI STYLE STUDIO ──` region after the `generateHaircutPreviews` block, ~line 2999)
- Test: `tests/unit/style-studio.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/style-studio.test.js`:

```js
'use strict';
// Pure-function tests for the AI Style Studio backend helpers. No Gemini calls.
// Run: node tests/unit/style-studio.test.js  (exit 0 = pass, 1 = fail)
const assert = require('assert');
const S = require('../../functions/style-studio-lib.js'); // extracted pure lib (see Step 3)

let n = 0; const ok = (m) => { n++; console.log('  ok -', m); };

// normalizeStudioMode
assert.strictEqual(S.normalizeStudioMode('haircut'), 'haircut'); ok('mode haircut');
assert.strictEqual(S.normalizeStudioMode('WIG'), 'wig'); ok('mode upper->wig');
assert.strictEqual(S.normalizeStudioMode('nonsense'), 'haircut'); ok('mode fallback->haircut');

// normalizeStudioOptions clamps to the mode's allowed enums
assert.deepStrictEqual(S.normalizeStudioOptions('color', { type: 'balayage' }), { type: 'balayage' }); ok('color balayage kept');
assert.deepStrictEqual(S.normalizeStudioOptions('color', { type: 'bogus' }), { type: 'highlight' }); ok('color bad->default');
assert.deepStrictEqual(S.normalizeStudioOptions('hairsystem', { type: 'crown' }), { type: 'crown' }); ok('hairsystem crown kept');

// beard forces audience=man at the orchestrator boundary (helper exposes the rule)
assert.strictEqual(S.audienceForMode('beard', 'woman'), 'man'); ok('beard forces man');
assert.strictEqual(S.audienceForMode('haircut', 'woman'), 'woman'); ok('haircut keeps audience');

console.log(`\nstyle-studio pure tests: ${n} passed`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/unit/style-studio.test.js`
Expected: FAIL — `Cannot find module '../../functions/style-studio-lib.js'`.

- [ ] **Step 3: Write minimal implementation — extract a pure lib**

Create `functions/style-studio-lib.js` (pure, no Firebase — so it is unit-testable and reusable by `index.js`):

```js
'use strict';
// Pure, dependency-free helpers for the AI Style Studio callable.
// Kept separate from index.js so it can be unit-tested with plain node.

// The 9 studios. Each: allowed option enum (+ default), and a prompt-guidance
// string injected into the vision prompt. `audience` is the customer audience.
const STUDIO_MODES = {
  haircut:    { options: {}, guidance: 'Recommend 5 haircut styles only.' },
  color:      { options: { type: ['highlight', 'balayage', 'ombre', 'gray_blend', 'fashion'] },
                guidance: 'Recommend 5 hair-color looks of the requested type. Keep the cut natural.' },
  texture:    { options: { texture: ['curly', 'straight', 'wavy'] },
                guidance: 'Recommend 5 looks showing the requested hair texture.' },
  eyebrow:    { options: { shape: ['natural', 'arched', 'straight', 'rounded', 'soft_angled'],
                           thickness: ['natural', 'fuller', 'refined'] },
                guidance: 'Recommend 5 eyebrow shaping/grooming looks. Change ONLY the brows; do not alter hair, eyes, or skin.' },
  beard:      { options: { length: ['stubble', 'short', 'medium', 'full'],
                           density: ['natural', 'fuller'], shape: ['rounded', 'angular', 'tapered'] },
                guidance: 'Men only. Recommend 5 beard styles that flatter the jaw and face proportions.' },
  wig:        { options: { family: ['natural', 'business', 'modern', 'long', 'layered', 'curly', 'elegant', 'glamorous', 'cute', 'simple', 'school'] },
                guidance: 'Recommend 5 realistic WIG looks appropriate to the audience. Render as a natural-looking wig on the same person.' },
  hairsystem: { options: { type: ['frontal', 'partial', 'full', 'topper', 'crown'] },
                guidance: 'Recommend 5 hair-system looks that restore natural fullness. Frame as before/after fullness. NEVER a medical claim.' },
  event:      { options: { occasion: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] },
                guidance: 'Recommend 5 special-occasion looks suited to the requested event.' },
  vacation:   { options: { destination: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] },
                guidance: 'Recommend 5 low-maintenance, climate-appropriate vacation looks for the requested destination.' },
};

const STUDIO_AUDIENCES = ['man', 'woman', 'child', 'neutral'];
const STUDIO_PREFS = ['professional', 'trendy', 'low_maintenance', 'natural', 'bold'];
const STUDIO_GOALS = ['professional', 'youthful', 'elegant', 'masculine', 'feminine', 'soft', 'confident', 'vacation', 'wedding', 'party'];

function normalizeStudioMode(v) {
  const m = String(v || '').toLowerCase().trim();
  return STUDIO_MODES[m] ? m : 'haircut';
}
function normalizeStudioOptions(mode, opts) {
  const def = STUDIO_MODES[normalizeStudioMode(mode)].options;
  const out = {};
  opts = opts || {};
  Object.keys(def).forEach((key) => {
    const allowed = def[key];
    const val = String(opts[key] || '').toLowerCase().trim();
    out[key] = allowed.indexOf(val) >= 0 ? val : allowed[0];
  });
  return out;
}
function normalizeStudioAudience(v) {
  const a = String(v || '').toLowerCase().trim();
  return STUDIO_AUDIENCES.indexOf(a) >= 0 ? a : 'neutral';
}
function normalizeStudioPref(v) {
  const p = String(v || '').toLowerCase().trim();
  return STUDIO_PREFS.indexOf(p) >= 0 ? p : '';
}
function normalizeStudioGoal(v) {
  const g = String(v || '').toLowerCase().trim();
  return STUDIO_GOALS.indexOf(g) >= 0 ? g : '';
}
// Beard is men-only; the studio forces audience=man for that mode.
function audienceForMode(mode, audience) {
  return normalizeStudioMode(mode) === 'beard' ? 'man' : normalizeStudioAudience(audience);
}

module.exports = {
  STUDIO_MODES, STUDIO_AUDIENCES, STUDIO_PREFS, STUDIO_GOALS,
  normalizeStudioMode, normalizeStudioOptions, normalizeStudioAudience,
  normalizeStudioPref, normalizeStudioGoal, audienceForMode,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/unit/style-studio.test.js`
Expected: PASS — `style-studio pure tests: 8 passed`.

- [ ] **Step 5: Commit**

```bash
git add functions/style-studio-lib.js tests/unit/style-studio.test.js
git commit -m "feat(style-studio): pure backend config + input normalizers + unit tests"
```

---

## Task 2: Backend — analysis prompt + style normalizer (pure, TDD)

**Files:**
- Modify: `functions/style-studio-lib.js`
- Test: `tests/unit/style-studio.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/style-studio.test.js` before the final `console.log`:

```js
// buildStudioAnalysisPrompt embeds mode guidance, scores schema, safety, lang
const p = S.buildStudioAnalysisPrompt('beard', { length: 'short', density: 'natural', shape: 'tapered' }, 'man', 'professional', 'masculine', 'en');
assert.ok(/symmetry/i.test(p) && /youthfulness/i.test(p), 'prompt has score keys'); ok('analysis prompt has scores');
assert.ok(/EXACTLY 5/i.test(p), 'prompt asks for 5'); ok('analysis prompt asks 5');
assert.ok(/positive/i.test(p) && /never.*medical/i.test(p), 'prompt has safety'); ok('analysis prompt has safety');

// normalizeStudioScores clamps 0..100 ints, fills missing with null
const sc = S.normalizeStudioScores({ symmetry: 87.4, youthfulness: 200, professional: -3, confidence: '70' });
assert.strictEqual(sc.symmetry, 87, 'symmetry rounded'); ok('scores rounded');
assert.strictEqual(sc.youthfulness, 100, 'over clamps to 100'); ok('scores clamp high');
assert.strictEqual(sc.professional, 0, 'under clamps to 0'); ok('scores clamp low');
assert.strictEqual(sc.confidence, 70, 'string coerced'); ok('scores coerce string');
assert.strictEqual(sc.softness, null, 'missing -> null'); ok('scores missing null');
```

- [ ] **Step 2: Run to verify fail**

Run: `node tests/unit/style-studio.test.js`
Expected: FAIL — `S.buildStudioAnalysisPrompt is not a function`.

- [ ] **Step 3: Implement**

Add to `functions/style-studio-lib.js` (before `module.exports`, and add the names to exports):

```js
const STUDIO_LANG_NAME = { en: 'English', vi: 'Vietnamese (tiếng Việt)', es: 'Spanish (Español)' };
const SCORE_KEYS = ['symmetry', 'youthfulness', 'professional', 'confidence', 'softness', 'maintenance'];

function normalizeStudioScores(raw) {
  raw = raw || {};
  const out = {};
  SCORE_KEYS.forEach((k) => {
    const v = Number(raw[k]);
    out[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
  });
  return out;
}

function buildStudioAnalysisPrompt(mode, options, audience, preference, goal, lang) {
  const langName = STUDIO_LANG_NAME[lang] || 'English';
  const m = normalizeStudioMode(mode);
  const guidance = STUDIO_MODES[m].guidance;
  const optsLine = Object.keys(options || {}).length ? JSON.stringify(options) : '(none)';
  return [
    'You are a professional barber/stylist consultant analysing ONE customer selfie for a vendor-only studio tool. The OUTPUT IS READ ONLY BY THE BARBER, never shown to the customer.',
    'SAFETY (absolute): use POSITIVE, respectful language only. Do NOT diagnose any medical condition, do NOT judge attractiveness, do NOT make ethnicity assumptions, NEVER make a medical claim (e.g. about hair loss — say "appears thinner", never "balding"). Children: wholesome, age-appropriate only.',
    '',
    'STUDIO MODE: ' + m + '. ' + guidance,
    'Options: ' + optsLine + '. Customer audience: ' + audience + '. Preference: ' + (preference || 'none') + '. Goal: ' + (goal || 'none') + '.',
    '',
    'First, analyse the face and return a structured "analysis" object with:',
    '- features: { faceShape (oval|round|square|diamond|heart|triangle|oblong), forehead, eyes, eyelids, brows, nose, lips, cheeks, jawChin, ears, hairline, hairDensity, beardDensity, skinToneBand, approxAgeRange } — each a SHORT positive phrase in ' + langName + '.',
    '- scores: integer 0..100 for symmetry, youthfulness, professional, confidence, softness, maintenance. These are PROPORTION/HARMONY metrics, NOT a rating of the person.',
    '- strategy: { emphasize: [..], balance: [..] } — positive phrasing only, in ' + langName + '.',
    '- thinning: { level (none|mild|moderate|advanced), note } — soft language, never a medical claim.',
    '',
    'Then recommend EXACTLY 5 styles for this mode. Each style:',
    '{ "styleId":"kebab-id","styleTitle":"","targetAudience":"man|woman|child|neutral","description":"","whyItFitsFace":"","maintenanceLevel":"","haircutInstructionsForBarber":"","colorRecommendation":"","highlightRecommendation":"","curlStraightRecommendation":"","confidence":0.0,"safetyNotes":"","imageEditPrompt":"" }',
    'imageEditPrompt: precise ENGLISH instruction to render THIS look on the SAME person (preserve identity, face, ethnicity, skin tone, age, gender presentation; change only what this mode targets).',
    '',
    'LANGUAGE: write every customer-facing field AND the analysis in ' + langName + '. Write imageEditPrompt in ENGLISH only.',
    'Return STRICT JSON only (no markdown) of the form:',
    '{"analysis":{"features":{},"scores":{},"strategy":{"emphasize":[],"balance":[]},"thinning":{"level":"","note":""}},"styles":[ ... 5 items ... ]}',
  ].join('\n');
}
```

Add `STUDIO_LANG_NAME, SCORE_KEYS, normalizeStudioScores, buildStudioAnalysisPrompt` to the `module.exports` object.

- [ ] **Step 4: Run to verify pass**

Run: `node tests/unit/style-studio.test.js`
Expected: PASS — count increased (16 passed).

- [ ] **Step 5: Commit**

```bash
git add functions/style-studio-lib.js tests/unit/style-studio.test.js
git commit -m "feat(style-studio): analysis prompt builder + score normalizer + tests"
```

---

## Task 3: Backend — the `generateStyleStudio` callable (vendor-authed, reuses Gemini helpers)

**Files:**
- Modify: `functions/index.js` — append after the `generateHaircutPreviews` block (find the closing `);` of `exports.generateHaircutPreviews`, insert below it)

- [ ] **Step 1: Add the require for the pure lib near the other requires at top of `functions/index.js`**

Find the top-of-file requires (near `:1`–`:50`, after `const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');` at `:44`). Add:

```js
const StudioLib = require('./style-studio-lib.js');
```

- [ ] **Step 2: Append the vendor-auth guard + callable**

Insert after `exports.generateHaircutPreviews = onCall(...)` closes (~line 2999). This reuses the EXISTING module-scoped helpers — `getAiKey`, `callGeminiHaircutAnalysis`, `callGeminiImageEdit`, `extractHaircutJson`, `normalizeHaircutStyle`, `IDENTITY_CLAUSE`, `CHILD_SAFETY_CLAUSE`, `HAIRCUT_LANG_NAME`:

```js
// ────────────────────────────────────────────────────────────────────────
// AI STYLE STUDIO — vendor-only expansion of the AI hairstyle engine.
// Isolated from generateHaircutPreviews (which stays public + unchanged).
// Reuses the same Gemini vision + image-edit helpers. No images persist.
// ────────────────────────────────────────────────────────────────────────

// Require an authenticated mobile-barber VENDOR. Customers (anonymous on the
// /mobile-barber landing) must NOT be able to call the studio.
async function requireMobileBarberVendor(request) {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in as a vendor to use the Style Studio.');
  }
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Anonymous users cannot use the Style Studio.');
  }
  // vendorUsers/{uid} maps an authed user to a vendor (same rule as the portal).
  // If your portal uses a different mapping, confirm against firestore.rules
  // isPortalVendorUser() before changing this.
  const snap = await admin.firestore().collection('vendorUsers').doc(auth.uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'This account is not a registered vendor.');
  }
  return snap.data() || {};
}

// Plan analysis + 5 styles for a studio mode. Mirrors planHaircutStyles but
// with the richer analysis schema (features + scores + strategy + thinning).
async function runStudioPlan(geminiKey, base64, mimeType, opts) {
  const prompt = StudioLib.buildStudioAnalysisPrompt(
    opts.mode, opts.options, opts.audience, opts.preference, opts.goal, opts.lang
  );
  const plan = await callGeminiHaircutAnalysis(geminiKey, base64, mimeType, prompt); // reused vision call
  const rawAnalysis = (plan && plan.analysis) || {};
  const analysis = {
    features: (rawAnalysis.features && typeof rawAnalysis.features === 'object') ? rawAnalysis.features : {},
    scores: StudioLib.normalizeStudioScores(rawAnalysis.scores),
    strategy: {
      emphasize: Array.isArray(rawAnalysis.strategy && rawAnalysis.strategy.emphasize) ? rawAnalysis.strategy.emphasize.slice(0, 6) : [],
      balance: Array.isArray(rawAnalysis.strategy && rawAnalysis.strategy.balance) ? rawAnalysis.strategy.balance.slice(0, 6) : [],
    },
    thinning: {
      level: ['none', 'mild', 'moderate', 'advanced'].indexOf(String(rawAnalysis.thinning && rawAnalysis.thinning.level)) >= 0
        ? rawAnalysis.thinning.level : 'none',
      note: String((rawAnalysis.thinning && rawAnalysis.thinning.note) || '').trim(),
    },
  };
  const rawStyles = (plan && Array.isArray(plan.styles)) ? plan.styles : [];
  const styles = rawStyles
    .map((s, i) => normalizeHaircutStyle(s, opts.audience, i)) // reused: appends IDENTITY/CHILD clauses
    .filter((s) => s.imageEditPrompt)
    .slice(0, 5);
  return { analysis, styles };
}

exports.generateStyleStudio = onCall(
  {
    region: 'us-central1',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: '1GiB',
    cors: true,
  },
  async (request) => {
    await requireMobileBarberVendor(request); // throws HttpsError on non-vendor

    const data = request.data || {};
    const mode = StudioLib.normalizeStudioMode(data.mode);
    const audience = StudioLib.audienceForMode(mode, data.audience);
    const options = StudioLib.normalizeStudioOptions(mode, data.options);
    const preference = StudioLib.normalizeStudioPref(data.preference);
    const goal = StudioLib.normalizeStudioGoal(data.goal);
    const langParam = String(data.lang || 'en').toLowerCase();
    const lang = HAIRCUT_LANG_NAME[langParam] ? langParam : 'en';

    const rawDataUrl = String(data.selfieDataUrl || '');
    if (rawDataUrl.indexOf('data:image/') !== 0) {
      return { ok: false, vendorMessage: 'Missing or invalid selfie image.', debugCode: 'INVALID_INPUT' };
    }
    const match = rawDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return { ok: false, vendorMessage: 'Selfie format not supported (use JPEG/PNG/WebP).', debugCode: 'BAD_MIME' };
    const mimeType = match[1];
    const base64 = match[2];
    if (base64.length > 1_500_000) {
      return { ok: false, vendorMessage: 'Selfie is too large. Please use a smaller photo.', debugCode: 'IMAGE_TOO_LARGE' };
    }

    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) {
      return { ok: false, vendorMessage: 'AI Style Studio is temporarily unavailable.', debugCode: 'NO_GEMINI_KEY' };
    }

    const t0 = Date.now();
    let plan;
    try {
      plan = await runStudioPlan(geminiKey, base64, mimeType, { mode, options, audience, preference, goal, lang });
    } catch (e) {
      console.error('[generateStyleStudio] planning failure', e);
      return { ok: false, vendorMessage: 'Style Studio analysis failed. Please try again.', debugCode: 'PLAN_ERROR' };
    }
    const styles = (plan && plan.styles) || [];
    if (!styles.length) {
      return { ok: false, vendorMessage: 'Style Studio returned no styles. Try a clearer photo.', debugCode: 'PLAN_EMPTY' };
    }

    let recommendations;
    try {
      recommendations = await Promise.all(styles.map(async (style) => {
        const baseRec = {
          styleId: style.styleId, title: style.styleTitle, styleTitle: style.styleTitle,
          targetAudience: style.targetAudience, explanation: style.description, description: style.description,
          whyItFitsFace: style.whyItFitsFace, maintenance: style.maintenanceLevel, maintenanceLevel: style.maintenanceLevel,
          barberNotes: style.haircutInstructionsForBarber, haircutInstructionsForBarber: style.haircutInstructionsForBarber,
          colorRecommendation: style.colorRecommendation, highlightRecommendation: style.highlightRecommendation,
          curlStraightRecommendation: style.curlStraightRecommendation, confidence: style.confidence,
          safetyNotes: style.safetyNotes,
        };
        try {
          const edit = await callGeminiImageEdit(geminiKey, base64, mimeType, style.imageEditPrompt); // reused
          return Object.assign({}, baseRec, {
            previewDataUrl: edit.dataUrl,
            previewKind: (style.confidence >= 0.5) ? 'your_preview' : 'style_inspiration',
          });
        } catch (e) {
          return Object.assign({}, baseRec, { previewDataUrl: '', previewKind: 'style_inspiration', error: (e && e.message) || 'edit_failed' });
        }
      }));
    } catch (e) {
      console.error('[generateStyleStudio] image edit failure', e);
      return { ok: false, vendorMessage: 'Style Studio could not render previews. Please try again.', debugCode: 'EDIT_ERROR' };
    }

    return {
      ok: true,
      mode, audience, options, preference, goal,
      analysis: plan.analysis,            // vendor-only; caller must NOT persist
      recommendations,
      provider: 'gemini-2.5-flash-image',
      generationTimeMs: Date.now() - t0,
    };
  }
);
```

- [ ] **Step 3: Verify `HttpsError` + `admin` are in scope**

Run: `grep -nE "HttpsError|require\\('firebase-admin'\\)|admin\\.firestore\\(\\)|const \\{ *onCall" functions/index.js | head`
Expected: `HttpsError` is imported (from `firebase-functions/v2/https`) and `admin.firestore()` is already used (e.g. by `getAiKey`). If `HttpsError` is NOT imported, add it to the existing `firebase-functions/v2/https` import line. Document what you found.

- [ ] **Step 4: Lint the function file for syntax**

Run: `cd functions && node -e "require('./index.js'); console.log('index.js loads')" ; cd ..`
Expected: `index.js loads` (no syntax error). If it complains about missing secrets/emulator config at require time, instead run `node --check functions/index.js` and expect no output (syntax OK).

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat(style-studio): add vendor-authed generateStyleStudio callable (reuses Gemini helpers)"
```

---

## Task 4: Backend — regression guard for `generateHaircutPreviews`

**Files:**
- Test: `tests/unit/style-studio.test.js`

- [ ] **Step 1: Add a static-source regression assertion**

Append to `tests/unit/style-studio.test.js`:

```js
// Guard: generateHaircutPreviews signature + the reused helpers still exist and
// were not renamed/broken by the studio addition (static source check — no exec).
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../functions/index.js'), 'utf8');
assert.ok(/exports\.generateHaircutPreviews\s*=\s*onCall\(/.test(src), 'generateHaircutPreviews intact'); ok('generateHaircutPreviews intact');
assert.ok(/exports\.generateStyleStudio\s*=\s*onCall\(/.test(src), 'generateStyleStudio added'); ok('generateStyleStudio present');
['function callGeminiImageEdit', 'function callGeminiHaircutAnalysis', 'function normalizeHaircutStyle', 'async function getAiKey']
  .forEach((sig) => { assert.ok(src.indexOf(sig) >= 0, sig + ' present'); ok(sig.replace('function ', '') + ' present'); });
```

- [ ] **Step 2: Run to verify pass**

Run: `node tests/unit/style-studio.test.js`
Expected: PASS — all assertions green.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/style-studio.test.js
git commit -m "test(style-studio): regression guard that generateHaircutPreviews + helpers are intact"
```

---

## Task 5: Client — new module skeleton + i18n + self-init + lang wiring

**Files:**
- Create: `mobile-barber/mobile-barber-style-studio.js`

- [ ] **Step 1: Create the module with the IIFE pattern, STUDIO_STRINGS (vi/en/es), self-init, and lang re-wire**

```js
'use strict';
// Mobile Barber — AI STYLE STUDIO (vendor-only).
// Self-initialising module rendered into #mbStyleStudioRoot on dashboard.html.
// Reuses window.MobileBarberAIPreview (compression/cache) + window.MBLightbox.
// Calls the vendor-authed `generateStyleStudio` callable. NOTHING persists to
// Firestore/Storage: favorites + save history are localStorage/session only.
(function (root) {
  if (!root || !root.document) return;

  // ── i18n: vi / en / es (no hardcoded user-facing strings) ───────────────
  var STUDIO_STRINGS = {
    en: {
      studioTitle: 'AI Style Studio', studioSub: 'Vendor consult — analyse a selfie, explore looks',
      studioConsent: 'I have the customer’s consent to analyse this photo.',
      studioUpload: 'Upload / take selfie', studioGenerate: 'Generate looks', studioGenerating: 'Generating…',
      studioReady: 'Photo ready — pick a studio and generate.', studioConsentRequired: 'Confirm consent first.',
      studioError: 'AI Style Studio is temporarily unavailable.',
      modeHaircut: 'Hair Styles', modeColor: 'Hair Colors', modeTexture: 'Texture', modeEyebrow: 'Eyebrows',
      modeBeard: 'Beards', modeWig: 'Wigs', modeHairsystem: 'Hair Systems', modeEvent: 'Event Styles',
      modeVacation: 'Vacation Styles', favorites: 'Favorites', consult: 'Consultation',
      consultFeatures: 'Features', consultScores: 'Harmony (vendor-only)', consultStrategy: 'Strategy',
      consultEphemeral: 'Vendor-only · not saved · not shown to customer',
      saveToPhone: 'Save to phone', favorite: 'Favorite', unfavorite: 'Saved ✓', compare: 'Compare',
      scoreSymmetry: 'Symmetry', scoreYouthfulness: 'Youthfulness', scoreProfessional: 'Professional',
      scoreConfidence: 'Confidence', scoreSoftness: 'Softness', scoreMaintenance: 'Maintenance',
      emphasize: 'Emphasize', balance: 'Balance', thinning: 'Hair fullness',
    },
    vi: {
      studioTitle: 'Studio Tạo Kiểu AI', studioSub: 'Tư vấn cho thợ — phân tích ảnh, khám phá kiểu',
      studioConsent: 'Tôi đã được khách đồng ý phân tích ảnh này.',
      studioUpload: 'Tải / chụp ảnh', studioGenerate: 'Tạo kiểu', studioGenerating: 'Đang tạo…',
      studioReady: 'Ảnh đã sẵn sàng — chọn studio và tạo kiểu.', studioConsentRequired: 'Hãy xác nhận đồng ý trước.',
      studioError: 'Studio Tạo Kiểu AI tạm thời không khả dụng.',
      modeHaircut: 'Kiểu Tóc', modeColor: 'Màu Tóc', modeTexture: 'Kết Cấu Tóc', modeEyebrow: 'Chân Mày',
      modeBeard: 'Râu', modeWig: 'Tóc Giả', modeHairsystem: 'Hệ Thống Tóc', modeEvent: 'Kiểu Sự Kiện',
      modeVacation: 'Kiểu Du Lịch', favorites: 'Yêu Thích', consult: 'Tư Vấn',
      consultFeatures: 'Đặc Điểm', consultScores: 'Hài Hòa (chỉ thợ xem)', consultStrategy: 'Chiến Lược',
      consultEphemeral: 'Chỉ thợ xem · không lưu · không hiển thị cho khách',
      saveToPhone: 'Lưu về máy', favorite: 'Yêu thích', unfavorite: 'Đã lưu ✓', compare: 'So sánh',
      scoreSymmetry: 'Cân Đối', scoreYouthfulness: 'Trẻ Trung', scoreProfessional: 'Chuyên Nghiệp',
      scoreConfidence: 'Tự Tin', scoreSoftness: 'Mềm Mại', scoreMaintenance: 'Bảo Dưỡng',
      emphasize: 'Nhấn Mạnh', balance: 'Cân Bằng', thinning: 'Độ Dày Tóc',
    },
    es: {
      studioTitle: 'Estudio de Estilo AI', studioSub: 'Consulta del vendedor — analiza una selfie, explora looks',
      studioConsent: 'Tengo el consentimiento del cliente para analizar esta foto.',
      studioUpload: 'Subir / tomar selfie', studioGenerate: 'Generar looks', studioGenerating: 'Generando…',
      studioReady: 'Foto lista — elige un estudio y genera.', studioConsentRequired: 'Confirma el consentimiento primero.',
      studioError: 'El Estudio de Estilo AI no está disponible temporalmente.',
      modeHaircut: 'Cortes', modeColor: 'Colores', modeTexture: 'Textura', modeEyebrow: 'Cejas',
      modeBeard: 'Barbas', modeWig: 'Pelucas', modeHairsystem: 'Sistemas Capilares', modeEvent: 'Estilos de Evento',
      modeVacation: 'Estilos de Vacaciones', favorites: 'Favoritos', consult: 'Consulta',
      consultFeatures: 'Rasgos', consultScores: 'Armonía (solo vendedor)', consultStrategy: 'Estrategia',
      consultEphemeral: 'Solo vendedor · no se guarda · no se muestra al cliente',
      saveToPhone: 'Guardar en el teléfono', favorite: 'Favorito', unfavorite: 'Guardado ✓', compare: 'Comparar',
      scoreSymmetry: 'Simetría', scoreYouthfulness: 'Juventud', scoreProfessional: 'Profesional',
      scoreConfidence: 'Confianza', scoreSoftness: 'Suavidad', scoreMaintenance: 'Mantenimiento',
      emphasize: 'Destacar', balance: 'Equilibrar', thinning: 'Densidad capilar',
    },
  };

  var state = { lang: 'en', consent: false, selfieDataUrl: '', mode: 'haircut', options: {},
                analyzing: false, analysis: null, recommendations: [], sessionId: '',
                favorites: [], compareIds: [] };

  function t(key) {
    return (STUDIO_STRINGS[state.lang] && STUDIO_STRINGS[state.lang][key]) || STUDIO_STRINGS.en[key] || '';
  }
  function detectLang() {
    try {
      var p = new URLSearchParams(root.location.search).get('lang');
      if (STUDIO_STRINGS[p]) return p;
      var saved = root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang');
      if (STUDIO_STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }
  function applyI18n(scope) {
    (scope || root.document).querySelectorAll('[data-studio-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-studio-i18n'));
    });
  }

  // Public: re-render on external lang change (additive; dashboard keeps its own).
  function setLang(lang) {
    if (!STUDIO_STRINGS[lang]) return;
    state.lang = lang;
    render();
  }

  function init() {
    var rootEl = root.document.getElementById('mbStyleStudioRoot');
    if (!rootEl) return; // not on this page
    state.lang = detectLang();
    // Re-translate when the dashboard's language buttons are clicked (additive).
    root.document.querySelectorAll('.mb-language__button[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });
    render();
  }

  function render() { /* implemented in Task 7–9 */ applyI18n(); }

  root.MobileBarberStyleStudio = { init: init, setLang: setLang, _t: t, _state: state };

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 2: Smoke-load in a browser console mentally / syntax check**

Run: `node --check mobile-barber/mobile-barber-style-studio.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add mobile-barber/mobile-barber-style-studio.js
git commit -m "feat(style-studio): client module skeleton + vi/en/es i18n + self-init + lang wiring"
```

---

## Task 6: Client — studio client wrapper that calls `generateStyleStudio`

**Files:**
- Modify: `mobile-barber/mobile-barber-style-studio.js`

- [ ] **Step 1: Add the callable wrapper (mirror `MobileBarberAIPreview.generate`)**

Insert before `root.MobileBarberStyleStudio = {...}`:

```js
// Thin client for the vendor callable. Mirrors mobile-barber-ai-preview.js
// generate() but targets generateStyleStudio and passes mode/options/goal.
function callStudio(opts) {
  opts = opts || {};
  if (!opts.dataUrl) return Promise.resolve({ ok: false, code: 'no_image', message: 'No selfie.' });
  if (typeof root.firebase === 'undefined' || !root.firebase.functions) {
    return Promise.resolve({ ok: false, code: 'firebase_unavailable', message: t('studioError') });
  }
  var callable;
  try {
    callable = root.firebase.functions().httpsCallable('generateStyleStudio', { timeout: 180000 });
  } catch (e) {
    return Promise.resolve({ ok: false, code: 'callable_init_failed', message: t('studioError') });
  }
  return callable({
    selfieDataUrl: opts.dataUrl, lang: state.lang, mode: opts.mode,
    options: opts.options || {}, audience: opts.audience || 'neutral',
    preference: opts.preference || '', goal: opts.goal || '',
  }).then(function (result) {
    var p = (result && result.data) || {};
    if (!p.ok) return { ok: false, code: p.debugCode || 'provider_error', message: p.vendorMessage || t('studioError') };
    var recs = (p.recommendations || []).filter(function (r) { return r && r.previewDataUrl && !r.error; });
    if (!recs.length) return { ok: false, code: 'empty', message: t('studioError') };
    return { ok: true, mode: p.mode, analysis: p.analysis || null, recommendations: recs,
             provider: p.provider || 'gemini', generationTimeMs: p.generationTimeMs || 0 };
  }).catch(function (err) {
    if (root.console) root.console.error('[style-studio] callable failed', err);
    return { ok: false, code: 'callable_threw', message: t('studioError') };
  });
}
```

- [ ] **Step 2: Syntax check + commit**

Run: `node --check mobile-barber/mobile-barber-style-studio.js` → no output.

```bash
git add mobile-barber/mobile-barber-style-studio.js
git commit -m "feat(style-studio): client wrapper for generateStyleStudio callable"
```

---

## Task 7: Client — accordion (9 studios + Favorites) + selfie upload + per-mode option controls

**Files:**
- Modify: `mobile-barber/mobile-barber-style-studio.js`

- [ ] **Step 1: Add the studio definitions + accordion render + handlers**

Replace the placeholder `function render() {...}` with the full implementation and add the helpers below it:

```js
// 9 studios + their option controls. Data-driven so each mode is declared once.
var STUDIO_DEFS = [
  { mode: 'haircut', label: 'modeHaircut', controls: [] },
  { mode: 'color', label: 'modeColor', controls: [{ key: 'type', values: ['highlight', 'balayage', 'ombre', 'gray_blend', 'fashion'] }] },
  { mode: 'texture', label: 'modeTexture', controls: [{ key: 'texture', values: ['curly', 'straight', 'wavy'] }] },
  { mode: 'eyebrow', label: 'modeEyebrow', controls: [{ key: 'shape', values: ['natural', 'arched', 'straight', 'rounded', 'soft_angled'] }] },
  { mode: 'beard', label: 'modeBeard', controls: [{ key: 'length', values: ['stubble', 'short', 'medium', 'full'] }, { key: 'shape', values: ['rounded', 'angular', 'tapered'] }] },
  { mode: 'wig', label: 'modeWig', controls: [{ key: 'family', values: ['natural', 'business', 'modern', 'long', 'layered', 'curly', 'elegant', 'glamorous', 'cute', 'simple', 'school'] }] },
  { mode: 'hairsystem', label: 'modeHairsystem', controls: [{ key: 'type', values: ['frontal', 'partial', 'full', 'topper', 'crown'] }] },
  { mode: 'event', label: 'modeEvent', controls: [{ key: 'occasion', values: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] }] },
  { mode: 'vacation', label: 'modeVacation', controls: [{ key: 'destination', values: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] }] },
];

function elt(tag, cls, text) { var e = root.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function render() {
  var host = root.document.getElementById('mbStyleStudioRoot');
  if (!host) return;
  host.innerHTML = '';

  // Header + consent + upload + generate
  var head = elt('div', 'mb-studio-head');
  head.appendChild(elt('h2', 'mb-studio-title', t('studioTitle')));
  head.appendChild(elt('p', 'mb-studio-sub', t('studioSub')));
  var consent = elt('label', 'mb-studio-consent');
  var cb = root.document.createElement('input'); cb.type = 'checkbox';
  cb.addEventListener('change', function () { state.consent = cb.checked; refreshControls(); });
  consent.appendChild(cb); consent.appendChild(elt('span', null, t('studioConsent')));
  head.appendChild(consent);

  var upload = root.document.createElement('input');
  upload.type = 'file'; upload.accept = 'image/*'; upload.className = 'mb-studio-upload'; upload.id = 'mbStudioUpload';
  upload.addEventListener('change', onUpload);
  var uploadBtn = elt('label', 'mb-button mb-button--ghost', t('studioUpload')); uploadBtn.setAttribute('for', 'mbStudioUpload');
  head.appendChild(uploadBtn); head.appendChild(upload);
  host.appendChild(head);

  var selfiePreview = elt('div', 'mb-studio-selfie'); selfiePreview.id = 'mbStudioSelfie';
  if (state.selfieDataUrl) { var im = root.document.createElement('img'); im.src = state.selfieDataUrl; im.alt = ''; selfiePreview.appendChild(im); }
  host.appendChild(selfiePreview);

  host.appendChild(renderConsultation()); // Task 9

  // Accordion of 9 studios
  var acc = elt('div', 'mb-studio-accordion');
  STUDIO_DEFS.forEach(function (def) {
    var d = root.document.createElement('details'); d.className = 'mb-studio-panel'; d.setAttribute('data-mode', def.mode);
    var sum = root.document.createElement('summary'); sum.className = 'mb-studio-panel__summary';
    sum.appendChild(elt('span', 'mb-studio-panel__title', t(def.label)));
    d.appendChild(sum);
    var body = elt('div', 'mb-studio-panel__body');
    def.controls.forEach(function (ctrl) {
      var sel = root.document.createElement('select'); sel.className = 'mb-studio-select'; sel.setAttribute('data-ctrl', ctrl.key);
      ctrl.values.forEach(function (v) { var o = root.document.createElement('option'); o.value = v; o.textContent = v.replace(/_/g, ' '); sel.appendChild(o); });
      body.appendChild(sel);
    });
    var gen = elt('button', 'mb-button mb-button--primary mb-studio-generate', t('studioGenerate'));
    gen.type = 'button'; gen.disabled = !(state.consent && state.selfieDataUrl);
    gen.addEventListener('click', function () { onGenerate(def, body); });
    body.appendChild(gen);
    body.appendChild(elt('div', 'mb-studio-results', '')); // results container
    d.appendChild(body); acc.appendChild(d);
  });
  // Favorites panel (session/local; no Firestore)
  var fav = root.document.createElement('details'); fav.className = 'mb-studio-panel mb-studio-panel--favorites';
  var fsum = root.document.createElement('summary'); fsum.className = 'mb-studio-panel__summary';
  fsum.appendChild(elt('span', 'mb-studio-panel__title', t('favorites')));
  fav.appendChild(fsum);
  fav.appendChild(renderFavorites()); // Task 8
  acc.appendChild(fav);
  host.appendChild(acc);

  applyI18n(host);
}

function refreshControls() {
  root.document.querySelectorAll('.mb-studio-generate').forEach(function (b) {
    b.disabled = !(state.consent && state.selfieDataUrl);
  });
}

function onUpload(ev) {
  var file = ev && ev.target && ev.target.files && ev.target.files[0];
  if (!file) return;
  if (!state.consent) { toast(t('studioConsentRequired')); ev.target.value = ''; return; }
  var AIP = root.MobileBarberAIPreview;
  if (!AIP || typeof AIP.compressImage !== 'function') { toast(t('studioError')); return; }
  AIP.compressImage(file).then(function (dataUrl) {
    state.selfieDataUrl = dataUrl; toast(t('studioReady')); render();
  }).catch(function () { toast(t('studioError')); });
}

function onGenerate(def, bodyEl) {
  if (state.analyzing) return;
  state.analyzing = true; state.mode = def.mode;
  var opts = {};
  bodyEl.querySelectorAll('.mb-studio-select').forEach(function (s) { opts[s.getAttribute('data-ctrl')] = s.value; });
  state.options = opts;
  state.sessionId = 'studio_' + def.mode + '_' + Math.random().toString(36).slice(2, 9);
  var resultsEl = bodyEl.querySelector('.mb-studio-results');
  if (resultsEl) resultsEl.textContent = t('studioGenerating');
  callStudio({ dataUrl: state.selfieDataUrl, mode: def.mode, options: opts,
               audience: state.options.audience || 'neutral' }).then(function (res) {
    state.analyzing = false;
    if (!res.ok) { if (resultsEl) resultsEl.textContent = res.message || t('studioError'); return; }
    state.analysis = res.analysis || null;
    state.recommendations = res.recommendations || [];
    renderResults(resultsEl, res.recommendations); // Task 8
    renderConsultationInto(); // Task 9 refresh
  });
}

function toast(msg) {
  var el = root.document.getElementById('mbDashboardToast');
  if (!el) { if (root.console) root.console.log('[style-studio]', msg); return; }
  el.textContent = msg; el.hidden = false;
  root.setTimeout(function () { el.hidden = true; }, 2600);
}
```

- [ ] **Step 2: Syntax check + commit**

Run: `node --check mobile-barber/mobile-barber-style-studio.js` → no output.

```bash
git add mobile-barber/mobile-barber-style-studio.js
git commit -m "feat(style-studio): accordion of 9 studios + selfie upload + per-mode controls"
```

---

## Task 8: Client — results cards (mirror renderAiResults) + lightbox + save-to-phone + favorites + compare

**Files:**
- Modify: `mobile-barber/mobile-barber-style-studio.js`

- [ ] **Step 1: Add result-card render, lightbox, save, favorites, compare**

```js
function renderResults(container, recs) {
  if (!container) return;
  container.innerHTML = '';
  (recs || []).forEach(function (rec) {
    var imgSrc = rec.previewDataUrl || '';
    var card = elt('article', 'mb-studio-card'); card.setAttribute('data-style-id', rec.styleId || '');
    if (imgSrc) {
      var img = root.document.createElement('img'); img.className = 'mb-studio-card__img'; img.src = imgSrc; img.alt = rec.title || ''; img.loading = 'lazy';
      img.addEventListener('click', function () { openLightbox(imgSrc, rec.title || ''); });
      card.appendChild(img);
    }
    if (rec.previewKind === 'style_inspiration') card.appendChild(elt('span', 'mb-studio-card__insp', '★'));
    card.appendChild(elt('strong', 'mb-studio-card__title', rec.title || ''));
    if (rec.whyItFitsFace) card.appendChild(elt('p', 'mb-studio-card__why', rec.whyItFitsFace));
    if (rec.maintenance) card.appendChild(elt('p', 'mb-studio-card__meta', rec.maintenance));
    if (rec.barberNotes) card.appendChild(elt('p', 'mb-studio-card__notes', rec.barberNotes));
    [['colorRecommendation'], ['highlightRecommendation'], ['curlStraightRecommendation']].forEach(function (k) {
      if (rec[k[0]]) card.appendChild(elt('p', 'mb-studio-card__rec', rec[k[0]]));
    });

    var actions = elt('div', 'mb-studio-card__actions');
    var saveBtn = elt('button', 'mb-button mb-button--ghost mb-button--sm', t('saveToPhone')); saveBtn.type = 'button';
    saveBtn.addEventListener('click', function () { saveToPhone(imgSrc, rec); });
    var favBtn = elt('button', 'mb-button mb-button--ghost mb-button--sm', isFav(rec.styleId) ? t('unfavorite') : t('favorite')); favBtn.type = 'button';
    favBtn.addEventListener('click', function () { toggleFav(rec, imgSrc); favBtn.textContent = isFav(rec.styleId) ? t('unfavorite') : t('favorite'); });
    var cmpBtn = elt('button', 'mb-button mb-button--ghost mb-button--sm', t('compare')); cmpBtn.type = 'button';
    cmpBtn.addEventListener('click', function () { addCompare(rec, imgSrc); });
    actions.appendChild(saveBtn); actions.appendChild(favBtn); actions.appendChild(cmpBtn);
    card.appendChild(actions);
    container.appendChild(card);

    // Cache FULL-res to localStorage on this device only (reuses AIP helper).
    var AIP = root.MobileBarberAIPreview;
    if (AIP && typeof AIP.saveLocalCopy === 'function' && imgSrc) {
      try { AIP.saveLocalCopy(state.sessionId, rec.styleId || '', imgSrc); } catch (e) {}
    }
  });
}

function openLightbox(src, caption) {
  if (!src || !root.MBLightbox || !root.MBLightbox.open) return;
  root.MBLightbox.open(src, { caption: caption || '', closeLabel: 'Close', ariaLabel: caption || 'Preview' });
}

// Save-to-phone: trigger a native download of the full-res data URL. No upload.
function saveToPhone(src, rec) {
  if (!src) return;
  var a = root.document.createElement('a');
  a.href = src; a.download = ((rec && rec.styleId) || 'style') + '.jpg';
  root.document.body.appendChild(a); a.click(); root.document.body.removeChild(a);
}

// Favorites: session/local only — NO Firestore. Stores text ref + on-device key.
var FAV_KEY = 'mb_studio_favorites';
function readFavs() { try { return JSON.parse(root.localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } }
function writeFavs(list) { try { root.localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) {} }
function isFav(id) { return readFavs().some(function (f) { return f.styleId === id; }); }
function toggleFav(rec, imgSrc) {
  var list = readFavs(); var id = rec.styleId || '';
  if (list.some(function (f) { return f.styleId === id; })) {
    list = list.filter(function (f) { return f.styleId !== id; });
  } else {
    // text reference only (+ local cache key); no image bytes in this store.
    list.push({ styleId: id, title: rec.title || '', mode: state.mode, sessionId: state.sessionId,
                whyItFitsFace: rec.whyItFitsFace || '', barberNotes: rec.barberNotes || '' });
  }
  writeFavs(list);
}
function renderFavorites() {
  var wrap = elt('div', 'mb-studio-panel__body mb-studio-favorites');
  var list = readFavs();
  if (!list.length) { wrap.appendChild(elt('p', 'mb-studio-empty', '—')); return wrap; }
  list.forEach(function (f) {
    var row = elt('div', 'mb-studio-fav-row');
    var AIP = root.MobileBarberAIPreview;
    var cached = AIP && AIP.readLocalCopy ? AIP.readLocalCopy(f.sessionId, f.styleId) : '';
    if (cached) { var im = root.document.createElement('img'); im.src = cached; im.alt = ''; row.appendChild(im); }
    row.appendChild(elt('span', null, f.title || f.styleId));
    wrap.appendChild(row);
  });
  return wrap;
}

// Compare: side-by-side (the existing MBLightbox is single-image). Collect 2.
function addCompare(rec, imgSrc) {
  if (!imgSrc) return;
  state.compareIds = (state.compareIds || []).concat([{ src: imgSrc, title: rec.title || '' }]).slice(-2);
  if (state.compareIds.length === 2) showCompare();
}
function showCompare() {
  var existing = root.document.getElementById('mbStudioCompare'); if (existing) existing.remove();
  var ov = elt('div', 'mb-studio-compare'); ov.id = 'mbStudioCompare';
  state.compareIds.forEach(function (c) {
    var fig = elt('figure', 'mb-studio-compare__col');
    var im = root.document.createElement('img'); im.src = c.src; im.alt = c.title; fig.appendChild(im);
    fig.appendChild(elt('figcaption', null, c.title)); ov.appendChild(fig);
  });
  var close = elt('button', 'mb-studio-compare__close', '×'); close.type = 'button';
  close.addEventListener('click', function () { ov.remove(); state.compareIds = []; });
  ov.appendChild(close);
  root.document.body.appendChild(ov);
}
```

- [ ] **Step 2: Syntax check + commit**

Run: `node --check mobile-barber/mobile-barber-style-studio.js` → no output.

```bash
git add mobile-barber/mobile-barber-style-studio.js
git commit -m "feat(style-studio): result cards + lightbox + save-to-phone + local favorites + compare"
```

---

## Task 9: Client — Consultation panel (features + 0–100 scores + strategy), vendor-only & ephemeral

**Files:**
- Modify: `mobile-barber/mobile-barber-style-studio.js`

- [ ] **Step 1: Add consultation render**

```js
function renderConsultation() {
  var wrap = elt('section', 'mb-studio-consult'); wrap.id = 'mbStudioConsult';
  wrap.appendChild(elt('h3', 'mb-studio-consult__title', t('consult')));
  wrap.appendChild(elt('p', 'mb-studio-consult__note', t('consultEphemeral')));
  wrap.appendChild(elt('div', 'mb-studio-consult__body', ''));
  fillConsultation(wrap.querySelector('.mb-studio-consult__body'));
  return wrap;
}
function renderConsultationInto() {
  var body = root.document.querySelector('#mbStudioConsult .mb-studio-consult__body');
  if (body) fillConsultation(body);
}
function fillConsultation(body) {
  if (!body) return;
  body.innerHTML = '';
  var a = state.analysis;
  if (!a) { body.appendChild(elt('p', 'mb-studio-empty', '—')); return; }

  // Features (positive phrases)
  if (a.features && Object.keys(a.features).length) {
    var fblock = elt('div', 'mb-studio-consult__features');
    fblock.appendChild(elt('h4', null, t('consultFeatures')));
    Object.keys(a.features).forEach(function (k) {
      if (!a.features[k]) return;
      var row = elt('div', 'mb-studio-consult__feature');
      row.appendChild(elt('span', 'mb-studio-consult__k', k));
      row.appendChild(elt('span', 'mb-studio-consult__v', String(a.features[k])));
      fblock.appendChild(row);
    });
    body.appendChild(fblock);
  }

  // Harmony scores 0–100 (vendor-only; bars). Never shown to customer.
  if (a.scores) {
    var sblock = elt('div', 'mb-studio-consult__scores');
    sblock.appendChild(elt('h4', null, t('consultScores')));
    [['symmetry', 'scoreSymmetry'], ['youthfulness', 'scoreYouthfulness'], ['professional', 'scoreProfessional'],
     ['confidence', 'scoreConfidence'], ['softness', 'scoreSoftness'], ['maintenance', 'scoreMaintenance']].forEach(function (pair) {
      var val = a.scores[pair[0]];
      if (val == null) return;
      var row = elt('div', 'mb-studio-score');
      row.appendChild(elt('span', 'mb-studio-score__label', t(pair[1])));
      var bar = elt('div', 'mb-studio-score__bar'); var fillEl = elt('div', 'mb-studio-score__fill');
      fillEl.style.width = Math.max(0, Math.min(100, val)) + '%'; bar.appendChild(fillEl); row.appendChild(bar);
      row.appendChild(elt('span', 'mb-studio-score__num', String(val))); sblock.appendChild(row);
    });
    body.appendChild(sblock);
  }

  // Strategy (emphasize / balance) + thinning (soft language)
  if (a.strategy && (a.strategy.emphasize.length || a.strategy.balance.length)) {
    var st = elt('div', 'mb-studio-consult__strategy'); st.appendChild(elt('h4', null, t('consultStrategy')));
    if (a.strategy.emphasize.length) st.appendChild(elt('p', null, t('emphasize') + ': ' + a.strategy.emphasize.join(', ')));
    if (a.strategy.balance.length) st.appendChild(elt('p', null, t('balance') + ': ' + a.strategy.balance.join(', ')));
    body.appendChild(st);
  }
  if (a.thinning && a.thinning.note) {
    body.appendChild(elt('p', 'mb-studio-consult__thinning', t('thinning') + ': ' + a.thinning.note));
  }
}
```

- [ ] **Step 2: Syntax check + commit**

Run: `node --check mobile-barber/mobile-barber-style-studio.js` → no output.

```bash
git add mobile-barber/mobile-barber-style-studio.js
git commit -m "feat(style-studio): vendor-only ephemeral consultation panel (features+scores+strategy)"
```

---

## Task 10: dashboard.html — add the Style Studio section + script include + version bumps

**Files:**
- Modify: `mobile-barber/dashboard.html`

- [ ] **Step 1: Add the studio section** — insert a new `<section>` after the appointments section closes (after `:100`, before the Settings `<section>` at `:102`):

```html
    <section class="mb-dashboard-panel mb-style-studio-section" id="mbStyleStudioSection" aria-labelledby="mbStyleStudioHeading">
      <div class="mb-dashboard-panel__head">
        <h2 id="mbStyleStudioHeading" data-studio-i18n="studioTitle"></h2>
      </div>
      <div id="mbStyleStudioRoot" class="mb-style-studio-root"></div>
    </section>
```

- [ ] **Step 2: Add the script include** — after `mobile-barber-dashboard.js` at `:337`, add:

```html
  <script src="/mobile-barber/mobile-barber-style-studio.js?v=20260613a"></script>
```

- [ ] **Step 3: Bump the CSS version** — change line `:28` from `mobile-barber.css?v=20260601a` to `mobile-barber.css?v=20260613a`.

- [ ] **Step 4: Verify in a local server**

Run: `python3 -m http.server 8080` (from project root, background) then
`curl -s "http://localhost:8080/mobile-barber/dashboard.html" | grep -E "mbStyleStudioRoot|mobile-barber-style-studio.js\?v=20260613a|mobile-barber.css\?v=20260613a"`
Expected: all three lines present.

- [ ] **Step 5: Commit**

```bash
git add mobile-barber/dashboard.html
git commit -m "feat(style-studio): mount Style Studio section + script on dashboard.html + bump css"
```

---

## Task 11: CSS — studio styles (mobile-first + 768/1200 breakpoints) + bump css ?v= in all consumers

**Files:**
- Modify: `mobile-barber/mobile-barber.css` (append), `mobile-barber/index.html`, `mobile-barber/vendor.html`

- [ ] **Step 1: Append studio CSS** to `mobile-barber/mobile-barber.css`:

```css
/* ── AI Style Studio (vendor-only) ───────────────────────────────────── */
.mb-style-studio-root { display: grid; gap: .75rem; }
.mb-studio-head { display: grid; gap: .5rem; }
.mb-studio-title { font-family: var(--font-d, serif); margin: 0; }
.mb-studio-consent { display: flex; gap: .5rem; align-items: center; font-size: .9rem; }
.mb-studio-selfie img { max-width: 140px; border-radius: 12px; }
.mb-studio-accordion { display: grid; gap: .5rem; }
.mb-studio-panel { border: 1px solid rgba(255,255,255,.14); border-radius: 12px; overflow: hidden; }
.mb-studio-panel__summary { cursor: pointer; padding: .75rem 1rem; font-weight: 600; list-style: none; }
.mb-studio-panel__body { padding: .75rem 1rem; display: grid; gap: .6rem; }
.mb-studio-select { width: 100%; padding: .5rem; border-radius: 8px; }
.mb-studio-results { display: grid; gap: .75rem; grid-template-columns: 1fr; }
.mb-studio-card { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: .6rem; display: grid; gap: .35rem; }
.mb-studio-card__img { width: 100%; border-radius: 8px; cursor: zoom-in; }
.mb-studio-card__actions { display: flex; flex-wrap: wrap; gap: .4rem; }
.mb-studio-consult { border: 1px dashed rgba(255,200,120,.4); border-radius: 12px; padding: .75rem; }
.mb-studio-consult__note { font-size: .75rem; opacity: .7; margin: .15rem 0 .6rem; }
.mb-studio-score { display: grid; grid-template-columns: 7rem 1fr 2.5rem; gap: .5rem; align-items: center; }
.mb-studio-score__bar { height: 8px; background: rgba(255,255,255,.12); border-radius: 99px; }
.mb-studio-score__fill { height: 100%; background: linear-gradient(90deg,#c9a24a,#f4d27a); border-radius: 99px; }
.mb-studio-compare { position: fixed; inset: 0; z-index: 1000; background: rgba(4,12,24,.94); display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 2rem; }
.mb-studio-compare__col img { width: 100%; border-radius: 10px; }
.mb-studio-compare__close { position: absolute; top: 1rem; right: 1rem; font-size: 1.6rem; background: none; border: none; color: #fff; }

@media (min-width: 768px) {
  .mb-studio-results { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1200px) {
  .mb-studio-results { grid-template-columns: repeat(3, 1fr); }
  .mb-style-studio-root { max-width: 1280px; margin: 0 auto; }
}
```

- [ ] **Step 2: Bump css ?v= in the OTHER two consumers** (dashboard.html already bumped in Task 10).

In `mobile-barber/index.html` and `mobile-barber/vendor.html`, change `mobile-barber.css?v=20260601a` → `mobile-barber.css?v=20260613a`.

Run: `grep -rhoE "mobile-barber\.css\?v=[0-9a-z]+" mobile-barber/*.html | sort -u`
Expected: only `mobile-barber.css?v=20260613a`.

- [ ] **Step 3: Commit**

```bash
git add mobile-barber/mobile-barber.css mobile-barber/index.html mobile-barber/vendor.html
git commit -m "feat(style-studio): studio CSS (mobile-first + 768/1200) + bump css ?v= in all consumers"
```

---

## Task 12: Storage compliance — lock "no studio image persists"

**Files:**
- Modify: `mobile-barber/mobile-barber-booking.js` (`:1609`)
- Test: `tests/unit/style-studio.test.js`

- [ ] **Step 1: Add a failing no-persist guard test**

Append to `tests/unit/style-studio.test.js`:

```js
// Guard: the studio module must never write image bytes to Firestore. It may
// only use localStorage/sessionStorage + native download. Static source scan.
const studioSrc = fs.readFileSync(require('path').join(__dirname, '../../mobile-barber/mobile-barber-style-studio.js'), 'utf8');
assert.ok(!/\.set\(|\.add\(|\.update\(|uploadBytes|putString/.test(studioSrc.replace(/setItem|setLang|setTimeout|setAttribute|addEventListener/g, '')),
  'studio module performs no Firestore/Storage write'); ok('studio writes nothing server-side');
assert.ok(/localStorage/.test(studioSrc), 'studio uses localStorage for favorites/cache'); ok('studio uses localStorage');
```

- [ ] **Step 2: Run to verify it passes** (the module as written in Tasks 5–9 has no Firestore writes)

Run: `node tests/unit/style-studio.test.js`
Expected: PASS. If it FAILS, the module introduced a Firestore write — remove it (favorites/save must stay local).

- [ ] **Step 3: Defensive — extend `STORED_IMAGE_FIELDS`** at `mobile-barber-booking.js:1609` so that IF a future booking ever carries studio fields they are stripped. Change the array to add the two studio names + comment:

```js
  var STORED_IMAGE_FIELDS = [
    'selectedHaircutImageUrl', 'selectedHaircutThumbnailUrl', 'selectedHaircutImageStoragePath',
    'selectedAiStyleImage', 'selectedStylePreviewUrl',
    'customerSelfieUrl', 'customerSelfieStoragePath', 'selfieDataUrl',
    // AI Style Studio (vendor tool) — defensive: studio never persists images,
    // but if a booking ever carries these they must be stripped too.
    'studioSelectedPreviewUrl', 'studioSelfieDataUrl'
  ];
```

- [ ] **Step 4: Bump `mobile-barber-booking.js` ?v=** in every HTML consumer (it changed).

Run: `grep -rln "mobile-barber-booking.js" mobile-barber/*.html`
For each match, change `mobile-barber-booking.js?v=20260601e` → `?v=20260613a`.
Run: `grep -rhoE "mobile-barber-booking\.js\?v=[0-9a-z]+" mobile-barber/*.html | sort -u`
Expected: only `?v=20260613a`.

- [ ] **Step 5: Commit**

```bash
git add mobile-barber/mobile-barber-booking.js mobile-barber/*.html tests/unit/style-studio.test.js
git commit -m "test+feat(style-studio): lock no-image-persist guard + defensive strip fields + bump booking ?v="
```

---

## Task 13: Live smoke test (opt-in) for the 9 modes

**Files:**
- Create: `tests/live/mb-style-studio-smoke.js`

- [ ] **Step 1: Write the smoke harness** (documented as manual/opt-in — it hits real Gemini + needs a signed-in vendor token, so it is NOT part of the automated gate):

```js
'use strict';
// OPT-IN live smoke for generateStyleStudio. Requires: a deployed function, a
// vendor ID-token, and a base64 selfie. NOT run by the dry-run gate (live cost).
// Usage: STUDIO_TOKEN=<vendorIdToken> SELFIE=./fixture.jpg node tests/live/mb-style-studio-smoke.js
const fs = require('fs');
const https = require('https');
const MODES = ['haircut','color','texture','eyebrow','beard','wig','hairsystem','event','vacation'];
const TOKEN = process.env.STUDIO_TOKEN;
const SELFIE = process.env.SELFIE;
const ENDPOINT = process.env.STUDIO_ENDPOINT || 'https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/generateStyleStudio';
if (!TOKEN || !SELFIE) { console.error('Set STUDIO_TOKEN and SELFIE env vars.'); process.exit(2); }
const b64 = fs.readFileSync(SELFIE).toString('base64');
const selfieDataUrl = 'data:image/jpeg;base64,' + b64;

function call(mode) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ data: { mode, selfieDataUrl, lang: 'en', audience: 'neutral' } });
    const u = new URL(ENDPOINT);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve({ mode, status: res.statusCode, body: d.slice(0, 240) })); });
    req.on('error', (e) => resolve({ mode, status: 0, body: String(e) }));
    req.write(body); req.end();
  });
}
(async () => {
  for (const m of MODES) { const r = await call(m); console.log(r.mode.padEnd(11), r.status, r.body); }
})();
```

- [ ] **Step 2: Syntax check + commit** (do not run unless deploying to staging):

Run: `node --check tests/live/mb-style-studio-smoke.js` → no output.

```bash
git add tests/live/mb-style-studio-smoke.js
git commit -m "test(style-studio): opt-in live smoke harness for the 9 modes"
```

---

## Task 14: Master-plan report doc

**Files:**
- Create: `docs/ai_style_studio_master_plan.md`

- [ ] **Step 1: Write the report** mapping each Master-Plan phase to its status in this slice:

```markdown
# AI Style Studio — Master Plan Report (SP-1 + SP-2 + pulled-forward studios)

| Phase | Status | Files changed | Tests | Limitations |
|---|---|---|---|---|
| 0 Preserve | Done | (none to engine) | regression guard in tests/unit/style-studio.test.js | customer flow untouched |
| 1 Studio shell | Done | mobile-barber-style-studio.js, dashboard.html, mobile-barber.css | node --check + local curl | accordion in dashboard tab |
| 2 Facial analysis | Done | style-studio-lib.js, functions/index.js | unit (prompt/scores) | model-estimated, positive language |
| 3 Harmony scores | Done | style-studio-lib.js | normalizeStudioScores unit | vendor-only, ephemeral 0–100 |
| 4 Strategy | Done | style-studio-lib.js, module consult panel | unit | emphasize/balance lists |
| 5 Style intelligence | Done | goal param in callable+client | unit | goal biases prompt |
| 6 Thinning | Done | analysis.thinning | unit | soft language, no medical claim |
| 7 Wigs | Done | STUDIO_MODES.wig | live smoke (opt-in) | fidelity risk — documented |
| 8 Hair systems | Done | STUDIO_MODES.hairsystem | live smoke | before/after framing, no medical claim |
| 9 Color | Done | STUDIO_MODES.color | live smoke | highlight/balayage/ombre/gray/fashion |
| 10 Eyebrows | Done | STUDIO_MODES.eyebrow | live smoke | brows-only edit |
| 11 Beards | Done | STUDIO_MODES.beard | live smoke | men-only enforced |
| 12 Event | Done | STUDIO_MODES.event | live smoke | 8 occasions |
| 13 Vacation | Done | STUDIO_MODES.vacation | live smoke | 5 destinations |
| 14 Complete package | Partial | save/compare local | guard test | session/local only (no stored composite) |
| 15 Glasses | Deferred | — | — | not in this slice |
| 16 Celebrity match | Deferred SP-4 | — | — | biometric/provider-policy review |
| 17 Aging sim | Deferred SP-4 | — | — | biometric/provider-policy review |
| 18 Look younger | Deferred SP-4 | — | — | depends on 17 |
| 19 Makeup | Design-only | — | — | future |
| 20 Commerce | Design-only | — | — | future |

## Privacy
No selfie or generated image persists to Firestore/Storage. Favorites + save history are localStorage/session + native download only. Consultation scores are ephemeral (never stored, never shown to customer).

## Verification
- `node tests/unit/style-studio.test.js` → all green
- `node --check` on all new JS → clean
- `scripts/ai/full_system_dry_run.sh` → FINAL: PASS
- Live per-mode previews: `tests/live/mb-style-studio-smoke.js` (opt-in, staging)
```

- [ ] **Step 2: Commit**

```bash
git add docs/ai_style_studio_master_plan.md
git commit -m "docs(style-studio): master-plan phase report"
```

---

## Task 15: Full gate + manual verification

- [ ] **Step 1: Run the unit tests**

Run: `node tests/unit/style-studio.test.js`
Expected: all assertions pass.

- [ ] **Step 2: Syntax-check every touched JS**

Run: `for f in functions/index.js functions/style-studio-lib.js mobile-barber/mobile-barber-style-studio.js mobile-barber/mobile-barber-booking.js; do node --check "$f" && echo "ok $f"; done`
Expected: `ok` for each.

- [ ] **Step 3: Run the canonical dry-run gate**

Run: `scripts/ai/full_system_dry_run.sh`
Expected: ends with `FINAL: PASS`. If `FINAL: FAIL`, read `.ai_runs/latest/` and fix before proceeding (do not mark complete on FAIL).

- [ ] **Step 4: Manual mobile + desktop check** (local server)

Run: `python3 -m http.server 8080` (background), open `http://localhost:8080/mobile-barber/dashboard.html?vendor=<id>` at 375px and 1280px. Confirm: Style Studio section renders, accordion opens, consent+upload enable Generate, a mode generates cards (against staging function), consultation scores render vendor-only, no console errors.

- [ ] **Step 5: Confirm no customer-feature regression**

Run: `git diff --stat origin/main -- mobile-barber/index.html mobile-barber/mobile-barber-ai-preview.js functions/index.js`
Expected: `index.html` shows only the css `?v=` change; `mobile-barber-ai-preview.js` shows NO change; `functions/index.js` shows only the appended studio region + the one require line (no edits inside `generateHaircutPreviews`).

- [ ] **Step 6: Final report** (per CLAUDE.md Required Report Format): Summary / Files changed / Commands run + output excerpts / Dry run result / Report path / Remaining risks / Next command. **Do NOT deploy** — hold `firebase deploy` for explicit user go-ahead.

---

## Self-Review notes (author)

- **Spec coverage:** Phases 0–14 implemented; 15 (glasses) folded into "deferred this slice" — if you want glasses now, add a `mode:'glasses'` to `STUDIO_MODES` + `STUDIO_DEFS` (same pattern). 16–18 deferred to SP-4; 19–20 design-only. All covered or explicitly deferred.
- **Type consistency:** callable response `analysis` shape (`features`/`scores`/`strategy`/`thinning`) matches `runStudioPlan` output and `fillConsultation` consumer; `recommendations[]` matches the existing card fields used in `renderResults`. `STUDIO_MODES` option enums in `style-studio-lib.js` match `STUDIO_DEFS` controls in the client module (keep them in sync — if you add an option, add it in both).
- **No placeholders:** every code step is complete; the only intentional cross-references are `render()` (defined in Task 7 replacing the Task-5 stub) and `renderConsultation`/`renderResults` (Tasks 8–9) — all defined within this plan.
- **Auth caveat:** Step verifies `vendorUsers/{uid}` is the correct mapping against `firestore.rules isPortalVendorUser()`; if the mobile-barber vendor mapping differs, adjust `requireMobileBarberVendor`.

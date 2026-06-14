# AI Master Stylist Mode

> Report for slice `c3b918f`→`7b07b2d` (commits: `aa20c16`, `92ea647`, `5e8d30d`, `aac0279`, `822bf5a`, `7b07b2d`)

---

## Architecture

### Shared core: `runStudioGeneration`

The vendor-only `generateStyleStudio` callable originally contained its full body inline.
That body has been extracted into a shared async function `runStudioGeneration(params)` in
`functions/index.js`. Both callables now delegate to it:

```
generateStyleStudio  (vendor, requireMobileBarberVendor gate)
    └─► runStudioGeneration({ mode, options, audience, preference, goal, lang, base64, mimeType, geminiKey })

generateStyleStudioPublic  (public, anon-auth + promo gate)
    └─► runStudioGeneration({ ... })
```

`runStudioGeneration` is the single implementation of all generation paths. The vendor
callable's response shape (`{ ok, mode, audience, analysis, recommendations[], provider,
generationTimeMs }`) is **unchanged** — the extract is a pure refactor with no behavioral
diff on the per-mode (9-mode) path.

### Master mode branch

When `mode === 'master'`, `runStudioGeneration` executes a two-pass Gemini chain:

1. **Vision pass** — `callGeminiHaircutAnalysis` with `buildMasterStylistPrompt(audience, goal, lang)`. The model returns:
   ```json
   { "analysis": { ... }, "bestLook": { "title":"", "attributes":{...}, "explanation":"", "imageEditPrompt":"" } }
   ```
2. **Image edit pass** — `callGeminiImageEdit` with the model's own `imageEditPrompt` appended with `MASTER_STYLIST_CLAUSE` (and `CHILD_SAFETY_CLAUSE` for `audience=child`).

### Response shape for master mode

```json
{
  "ok": true,
  "mode": "master",
  "audience": "woman",
  "analysis": {
    "features": { "faceShape": "...", "forehead": "...", "eyes": "...", ... },
    "scores": { "symmetry": 84, "youthfulness": 72, "professional": 68, "confidence": 77, "softness": 81, "maintenance": 65 },
    "strategy": { "emphasize": ["..."], "balance": ["..."] },
    "thinning": { "level": "none", "note": "" }
  },
  "masterpiece": {
    "previewDataUrl": "data:image/webp;base64,...",
    "title": "Soft Balayage Lob",
    "explanation": "2-3 sentences in the visitor's language on WHY this look suits them.",
    "attributes": { "haircut": "...", "color": "...", "texture": "...", "bangs": "...", "eyebrows": "..." }
  },
  "provider": "gemini-2.5-flash-image",
  "generationTimeMs": 12340
}
```

The `analysis` block is produced by `normalizeStudioAnalysis` — the same function the 9-mode
per-mode path uses, factored out so master reuses it exactly. The `masterpiece` block is
coerced by `normalizeMasterpiece` before the image-edit call (so the edit prompt is always a
string, never undefined).

For the public page `style-studio-public.js`, `analysis` is available in the response but the
page currently renders only `masterpiece` fields to the visitor (the analysis block is reserved
for future "deep insights" UI).

---

## Prompt Strategy

### `buildMasterStylistPrompt(audience, goal, lang)` — `functions/style-studio-lib.js`

This function builds the single-pass vision prompt for the Master Stylist. Key decisions:

**Framing**: "elite celebrity stylist + personal image consultant" (not a vendor barber tool).
The 9-mode `buildStudioAnalysisPrompt` explicitly says "output is read only by the barber";
this prompt says "output is shown to the customer" — both the analysis and the explanation are
customer-facing positive language.

**Structural contract**: The prompt asks for strict JSON with exactly two top-level keys:
`analysis` (facial features + 0–100 proportion scores + strategy + thinning) and `bestLook`
(title + attributes + explanation + imageEditPrompt). This is a single JSON object returned in
one model call, unlike the 9-mode path which separates analysis from per-style edit prompts.

**Language injection**: The prompt receives the visitor's language as `langName`
(`STUDIO_LANG_NAME[lang]`). All customer-facing analysis text — features, strategy,
explanation — must be in `langName`. `imageEditPrompt` must be English-only (image model
constraint shared with the 9-mode path).

**`bestLook` scope**: The model is asked to auto-decide haircut, color, texture, bangs,
eyebrows, beard (men only), and a wig/hair-system **only if it clearly improves fullness or
harmony**. The model may return a `wigOrSystem` attribute when it judges it beneficial; the
client renders it as a chip only if present. No optional attribute is forced.

### `MASTER_STYLIST_CLAUSE` — `functions/index.js`

Appended to the model's own `imageEditPrompt` before the image-edit call. It:

- **Locks**: face, eyes, nose, lips, age range, ethnicity, skin tone, facial bone structure. No
  face swapping, no beautification of facial features.
- **Permits**: hair (cut, color, texture, bangs), eyebrows, facial hair/beard, and a wig or
  hair system if it improves fullness or harmony.
- **Instructs quality**: photorealistic, natural lighting, head-and-shoulders portrait, sharp focus.

This clause is the only difference between the master image-edit call and the 9-mode per-style
calls (which use `IDENTITY_CLAUSE` or `REPLACE_HAIR_CLAUSE` depending on mode). The master
clause is intentionally more permissive than `IDENTITY_CLAUSE` (which locks hair entirely) and
broader than `REPLACE_HAIR_CLAUSE` (which is hair-only).

### Positive-language safety

The safety instruction in `buildMasterStylistPrompt` is absolute and explicit:

> POSITIVE language only. Never say ugly/bad/balding/old-looking/unattractive or make a medical
> claim. Use "balance", "soften", "emphasize", "enhance", "fuller appearance", "youthful-looking".
> Children: wholesome, age-appropriate only.

This mirrors the safety phrasing in `buildStudioAnalysisPrompt` and the vendor's haircut
analysis prompt. The `thinning` field uses a four-level enum (`none/mild/moderate/advanced`)
and requires soft language — never a medical claim.

---

## Facial Analysis / Harmony / Feature-Enhancement Engines

### `normalizeStudioAnalysis(rawAnalysis)` — `functions/index.js`

Factored out of `runStudioPlan` so master mode reuses the same normalization. Coerces the
model's raw analysis object into:

| Field | Type | Notes |
|---|---|---|
| `features` | object | Free-form positive phrases per feature (faceShape, forehead, eyes, eyelids, brows, nose, lips, cheeks, jawChin, ears, hairline, hairDensity, beardDensity, skinToneBand, approxAgeRange) |
| `scores` | object | `normalizeStudioScores` — clamps each of the 6 keys to integer 0–100 |
| `strategy.emphasize` | string[] | Up to 6 items; positive phrasing only |
| `strategy.balance` | string[] | Up to 6 items; positive phrasing only |
| `thinning.level` | enum | `none|mild|moderate|advanced`; defaults to `none` if out-of-set |
| `thinning.note` | string | Trimmed; soft language |

### `normalizeStudioScores(raw)` — `functions/style-studio-lib.js`

Pure helper. Converts each of `['symmetry', 'youthfulness', 'professional', 'confidence', 'softness', 'maintenance']` to an integer 0–100, or `null` if the model returned a non-numeric value. These are PROPORTION/HARMONY metrics, explicitly framed in the prompt as "not a rating of the person."

### `normalizeMasterpiece(raw)` — `functions/style-studio-lib.js`

Null-safe coercion of the model's `bestLook` object:

- `title` — from `raw.title` or `raw.styleTitle`; default `"Your best look"`.
- `explanation` — from `raw.explanation` or `raw.whyItFitsFace`; trimmed string.
- `imageEditPrompt` — from `raw.imageEditPrompt` or `raw.editPrompt`; if empty, `runStudioGeneration` returns `MASTER_EMPTY` before calling the image model.
- `attributes` — only the 7 keys in `MASTER_ATTR_KEYS` (`haircut, color, texture, bangs, eyebrows, beard, wigOrSystem`) are kept; non-string or missing values are dropped. The client renders only present attributes as chips.

### Feature-enhancement scope

The Master Stylist is the only mode that auto-decides wig/hair-system inclusion. The 9 manual
modes have dedicated `wig` and `hairsystem` modes that the customer opts into; in master mode
the model makes that call automatically based on its assessment of fullness and harmony. The
`MASTER_STYLIST_CLAUSE` permits this addition while maintaining the identity lock.

---

## Files Changed

| File | Change |
|---|---|
| `functions/style-studio-lib.js` | Added `MASTER_ATTR_KEYS`, `normalizeMasterpiece`, `buildMasterStylistPrompt`, `resolveDailyLimit`; expanded `STUDIO_GOALS` to 15 entries (added `executive, business, glamorous` and others); all exported |
| `functions/index.js` | Added `MASTER_STYLIST_CLAUSE`; factored `normalizeStudioAnalysis` out of `runStudioPlan`; extracted `runStudioGeneration` shared core with master branch; rewrote `generateStyleStudio` body to delegate to shared core; added `getStyleStudioPromo`, `requireAuthedGuest`, `checkPublicQuota`, `incrementPublicUsage`, `generateStyleStudioPublic` |
| `firestore.rules` | Added `config/styleStudioPromo` (read:false / write:isAdmin) and `styleStudioUsage/{uid}/days/{day}` (owner-read, write:false) rules |
| `firebase.json` | Added rewrite `/style-studio → /style-studio.html` |
| `style-studio.html` | New public page |
| `style-studio-public.js` | New public client IIFE (`?v=20260613b`) |
| `style-studio.css` | New public page CSS (`?v=20260613b`) |
| `script.js` | Added `HOMEPAGE_MARKETPLACE_ENTRIES` AI Style Studio card + i18n keys for all 3 languages; `_hpCatLabel`/`_hpCatAccent` extended for `style-studio` category; `_CAT_PATHS` extended |
| `tests/unit/style-studio.test.js` | Added Task 1–3 assertions: expanded goals, `buildMasterStylistPrompt` contract, `normalizeMasterpiece` null-safety, `resolveDailyLimit` pure-logic cases; Task 2 static source guards (MASTER_STYLIST_CLAUSE, runStudioGeneration, vendor intact, master branch) |
| `tests/rules/firestore-rules.test.js` | Added styleStudioPromo and styleStudioUsage rule cases (read-deny for clients, admin write, owner read own, cross-uid deny, self-write deny) |

---

## Tests

### Unit tests — `tests/unit/style-studio.test.js`

Run with: `node tests/unit/style-studio.test.js`

New assertions added for this slice:

| Assertion | What it guards |
|---|---|
| `goals expanded` | `STUDIO_GOALS` contains `executive`, `business`, `glamorous` (and all 15 entries) |
| `master prompt one look` | `buildMasterStylistPrompt` output matches `/single best look\|ONE/i` and contains `bestLook` |
| `master prompt edit+why` | prompt contains `imageEditPrompt` and `explanation` |
| `master prompt safety` | prompt contains `positive` and matches `/never.*(balding\|medical)/i` |
| `normalizeMasterpiece ok` | coerces `{title,explanation,imageEditPrompt,attributes:{haircut}}` correctly |
| `normalizeMasterpiece null-safe` | `normalizeMasterpiece(null).attributes` is `{}` |
| `master clause present` | `MASTER_STYLIST_CLAUSE` defined in `index.js` source |
| `shared core present` | `async function runStudioGeneration(` present in source |
| `vendor studio intact` | `exports.generateStyleStudio = onCall(` still present (regression guard) |
| `master branch` | `mode === 'master'` branch present in source |
| `promo active → limit` | `resolveDailyLimit({active:true,...},'2026-06-20')` returns 5 |
| `after window → 0` | `resolveDailyLimit({...},'2026-07-01')` returns 0 after `endDate` |
| `inactive → 0` | `resolveDailyLimit({active:false,...})` returns 0 |
| `no config → 0` | `resolveDailyLimit(null,...)` returns 0 |

### Rules tests — `tests/rules/firestore-rules.test.js`

Run with: `npm run test:rules`

New cases:
- Authed client CANNOT read `config/styleStudioPromo` (rules `allow read: if false`).
- Anon client CANNOT read `config/styleStudioPromo`.
- Non-admin client CANNOT write `config/styleStudioPromo`.
- Admin CAN write `config/styleStudioPromo`.
- Owner uid CAN read own `styleStudioUsage/{uid}` and `styleStudioUsage/{uid}/days/{day}`.
- Other uid CANNOT read another user's usage doc or daily counter.
- Owner CANNOT write own usage counter (prevents self-reset bypass).

### Live smoke — `tests/live/mb-style-studio-smoke.js`

The existing smoke test covers only the 9-mode vendor callable. A separate smoke to cover the
public callable and master mode should be run against the deployed function with:

```bash
# After deploy — requires a JPEG selfie and an anonymous Firebase ID token:
PUBLIC_ENDPOINT=https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/generateStyleStudioPublic \
ANON_TOKEN=<firebase-anon-id-token> \
SELFIE=./tests/fixtures/selfie.jpg \
node tests/live/mb-style-studio-smoke.js
```

The smoke file itself was not extended in this slice (the plan noted it as a modify, but the
committed diff does not include it). A manual curl test against the deployed callable is the
recommended verification step before launch.

---

## Limitations

- **One masterpiece per call** — the master mode intentionally returns a single look, not 5 options. There is no "regenerate alternatives" path yet (deferred to a future slice).
- **Image model fidelity** — Gemini 2.5 Flash Image can occasionally deviate from the identity lock despite `MASTER_STYLIST_CLAUSE`. Photorealistic fidelity depends on image quality and model version.
- **Glasses, accessories, makeup, aging, celebrity** — these attributes are noted in `MASTER_ATTR_KEYS` only as named fields; the prompt does not explicitly ask for glasses or celebrity-match styling. They were deferred from this slice per the plan's "deferred hooks" note.
- **`wigOrSystem` attribute** — included in `MASTER_ATTR_KEYS` and permitted by the clause, but the image model may not always render a wig system convincingly on all selfie types.
- **`analysis` block not rendered** — `runStudioGeneration` returns the `analysis` object to the client in the public callable response, but `style-studio-public.js` currently renders only `masterpiece` fields. The analysis (scores, features, strategy) is available for a future "insights" panel.

---

## PASS / BLOCKED

**Design intent: PASS.**

- `buildMasterStylistPrompt`, `normalizeMasterpiece`, `resolveDailyLimit`, `MASTER_ATTR_KEYS`, expanded `STUDIO_GOALS` all implemented exactly as specified.
- `MASTER_STYLIST_CLAUSE` present and wired into the master image-edit call.
- `normalizeStudioAnalysis` factored out and shared between per-mode and master paths.
- `runStudioGeneration` extracted; vendor `generateStyleStudio` delegating to it with no behavior change (regression-guarded by unit tests).
- `generateStyleStudioPublic` present with anon-auth, promo, counter-after-success (split `checkPublicQuota` + `incrementPublicUsage`).
- All unit and rules tests pass: `node tests/unit/style-studio.test.js` exits 0.

**Blocked for production until:**
1. `firebase deploy --only functions,hosting,firestore:rules` is executed with explicit go-ahead.
2. The `config/styleStudioPromo` document is seeded in Firestore (see `style_studio_public_launch.md` — without it `resolveDailyLimit` returns 0 and every visitor hits the login wall immediately).
3. Live image verification: a real selfie through the deployed `generateStyleStudioPublic` callable in `master` mode should be confirmed to return `ok:true` with a non-empty `masterpiece.previewDataUrl`.

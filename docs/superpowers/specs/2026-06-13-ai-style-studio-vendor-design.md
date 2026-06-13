# AI Style Studio (Vendor Portal) — Design Spec

- **Date:** 2026-06-13
- **Status:** Approved design — ready for implementation plan
- **Sub-project:** SP-1 + SP-2 of the "AI Style Studio Expansion Master Plan" (Phases 0–6 shell + analysis), **with the SP-3 generative studios (Phases 7–13) pulled forward** so all 9 studios are functional now, per owner decision. SP-4 (Phases 14–18 celebrity/aging) and SP-5 (Phases 19–20 makeup/commerce) remain deferred.
- **Surface:** Vendor-only — new "Style Studio" tab in `mobile-barber/dashboard.html`
- **Owner decisions confirmed:** Option B isolated callable · all 9 studios functional now · numeric harmony scores vendor-only/ephemeral · privacy-first (no stored images) · celebrity-match + aging-sim deferred to SP-4

---

## 1. Background — current state (verified)

The AI Hairstyle feature is fully built and server-keyed, but exists **only on the customer-facing `mobile-barber/index.html`** landing. Vendor surfaces get a stripped variant (`vendor.html` collapsed `<details id="mbAiPreviewPanel">`) or a read-only display (`dashboard.html` `buildAiPreviewSection`). The feature is "not available" to vendors **not** because of a permission/flag/key — it is a UI-surfacing gap.

**Existing engine (to be reused, not modified):**

- Callable `generateHaircutPreviews` — `functions/index.js:2881`, `onCall({ secrets:[GEMINI_API_KEY] })`, server timeout 300s; client invokes with `httpsCallable('generateHaircutPreviews', { timeout: 180000 })`.
- Two-stage Gemini: vision analysis `gemini-2.5-flash` (`functions/index.js:2779`) → image-to-image edit `gemini-2.5-flash-image` ("Nano Banana", `functions/index.js:2865`), one preview per style via `Promise.all`.
- Key via `getAiKey('gemini')` (`functions/index.js:2919`) — Firestore `config/aiSecrets.geminiKey` first, then `GEMINI_API_KEY` Functions secret. Matches "AI keys server-side only."
- Server-side clauses `IDENTITY_LOCK` + `CHILD_SAFETY` embedded in every edit prompt.
- Existing controls: `audience` ∈ {man, woman, child, neutral}; `explore` ∈ {haircut, color, highlights, curly, straight} (always includes haircut); `preference` ∈ {professional, trendy, low_maintenance, natural, bold}.
- Response shape: `{ ok, analysis, audience, explore, preference, recommendations[], provider, generationTimeMs }`; each recommendation: `{ styleId, title, whyItFitsFace, maintenanceLevel, haircutInstructionsForBarber, color, highlight, curlStraightRecommendation, previewDataUrl, previewKind('your_preview'|'style_inspiration') }`.

**Client modules:**

- `mobile-barber/mobile-barber-ai-preview.js` — core client engine (`compressImage`, `generate`, `compressDataUrl`, `saveLocalCopy`/`readLocalCopy`/`pruneOldLocalCopies`).
- `mobile-barber/mobile-barber.js` — customer UI/state (`STRINGS` i18n, `state.aiPreview`, render/handle funcs).
- `mobile-barber/mobile-barber-booking.js` — `stripUnstoredImages` (lines ~1603–1645; called by `saveBooking` before `persistBooking` ~line 1650) — the no-stored-images enforcement.
- `mobile-barber/mobile-barber-dashboard.js` — `buildAiPreviewSection` (read-only display in the vendor dashboard).
- `mobile-barber/mobile-barber-lightbox.js` — `MBLightbox.open` (single-image zoom; **no** side-by-side).
- `mobile-barber/mobile-barber.css` — `mb-ai-*` styles.

**i18n:** mobile-barber is self-contained — embedded `STRINGS` object (en/vi/es) + `data-i18n="key"` attributes populated by `setText()`. Lang detection: `?lang=` → `localStorage` (`dlcLang`/`dlc_lang`) → `navigator.language` → default. It does **not** use `SalonI18n`.

**Versioning:** current high-water `?v=` across the feature is `20260602a` (dashboard.js). New strings must exceed it → start at **`20260613a`**.

**Storage:** `customerSavedStyles` (firestore.rules:487, `isCustomerScopedCreate`, `size() <= 60`) keeps one small compressed thumbnail for customer favorites; full-res + selfies never persist (`stripUnstoredImages`).

---

## 2. Goals / Non-goals

### Goals
- Give the barber (vendor) a full **AI Style Studio** tab in `mobile-barber/dashboard.html` driving all 9 studios off one selfie.
- Add a vendor-only **Facial Analysis + Harmony + Strategy** consultation layer (incl. numeric 0–100 scores) the barber uses to advise the client.
- Reuse the existing render / lightbox / Book-It path by keeping the per-recommendation response shape identical.
- Honor every guardrail: no stored images, no broken customer feature, vi/en/es, version bumps, mobile-first.

### Non-goals (this slice)
- **No** modification to `generateHaircutPreviews`, `mobile-barber-ai-preview.js`, or `mobile-barber/index.html` (customer flagship).
- **No** celebrity matching (P16), **no** aging/younger simulation (P17–18) — deferred to SP-4 (biometric-privacy + provider-policy review).
- **No** makeup (P19) / commerce (P20) implementation — design-only docs later.
- **No** new server-side image persistence of any kind.

---

## 3. Confirmed decisions

1. **Option B** — new isolated callable `generateStyleStudio`. Do not touch `generateHaircutPreviews`.
2. Build in **`mobile-barber/dashboard.html`** as a new vendor-only "Style Studio" tab.
3. **All 9 studios functional now:** Hair Styles, Hair Colors, Texture, Eyebrows, Beards, Wigs, Hair Systems, Event Styles, Vacation Styles (+ Favorites + Consultation panel).
4. Numeric harmony scores: **vendor-only, ephemeral, not stored, positive language only.**
5. Privacy-first: **no selfies stored, no generated images in Firestore/Storage; save/export = local/session/download only.**
6. Celebrity matching + aging simulation **deferred to SP-4** — not implemented now.

---

## 4. Architecture (Option B — isolated)

```
mobile-barber/dashboard.html
  └─ new "Style Studio" tab  (vendor-only; dashboard already auth-gated)
       └─ mobile-barber-style-studio.js   (NEW client engine + accordion + state)
            ├─ STUDIO_STRINGS (vi/en/es) + data-i18n/setText pattern
            ├─ accordion: 9 studios + Favorites + Consultation panel
            ├─ side-by-side Comparison view (new; current lightbox is single-image)
            ├─ local/session Save History via saveLocalCopy/prune pattern
            └─ httpsCallable('generateStyleStudio', { timeout: 180000 })
                                   │
functions/index.js                ▼
  └─ exports.generateStyleStudio  (NEW; onCall, secrets:[GEMINI_API_KEY])
       ├─ requireVendorAuth(context)            ← reject unauth + non-vendor
       ├─ runFacialAnalysis(imageDataUrl)       → features + 0–100 scores + strategy + thinning
       ├─ STUDIO_PROMPTS[mode](analysis,options)→ mode-specific edit prompt (reuses IDENTITY_LOCK + CHILD_SAFETY)
       └─ reuses the same low-level Gemini vision + image-edit helpers as generateHaircutPreviews
```

**Isolation guarantee:** `generateHaircutPreviews`, `mobile-barber-ai-preview.js`, and `mobile-barber/index.html` are untouched. The only shared code is low-level Gemini helpers (`getAiKey`, the vision/image-edit request builders, `IDENTITY_LOCK`, `CHILD_SAFETY`). If those helpers are not already factored out, factor them into pure shared functions **without changing their behavior** (covered by a regression test asserting `generateHaircutPreviews` output is unchanged).

### Auth
`generateStyleStudio` independently verifies the caller (defense in depth — not relying on the page gate alone): require `context.auth` and that the uid maps to a vendor (`vendorUsers/{uid}` exists, matching the portal vendor rule). Reject otherwise. Customers must not be able to call it.

---

## 5. New callable contract — `generateStyleStudio`

**Request `data`:**

| Field | Type | Notes |
|---|---|---|
| `mode` | enum | `haircut`\|`color`\|`texture`\|`eyebrow`\|`beard`\|`wig`\|`hairsystem`\|`event`\|`vacation` |
| `imageDataUrl` | string | client-compressed selfie; **never stored** |
| `audience` | enum | man\|woman\|child\|neutral |
| `preference` | enum | professional\|trendy\|low_maintenance\|natural\|bold |
| `goal` | enum? | professional\|youthful\|elegant\|masculine\|feminine\|soft\|confident\|vacation\|wedding\|party (optional; biases generation) |
| `options` | object | mode-specific (below) |
| `lang` | enum | vi\|en\|es — natural-language fields returned in this language |

**Mode-specific `options`:**

| mode | options |
|---|---|
| `haircut` | — |
| `color` | `{ type: highlight\|balayage\|ombre\|gray_blend\|fashion }` |
| `texture` | `{ texture: curly\|straight\|wavy }` |
| `eyebrow` | `{ shape?, thickness? }` |
| `beard` | `{ length?, density?, shape? }` (men only; enforce audience=man) |
| `wig` | `{ family? }` — audience-specific style sets |
| `hairsystem` | `{ type: frontal\|partial\|full\|topper\|crown }` |
| `event` | `{ occasion: wedding\|cruise\|disneyland\|vegas\|beach\|birthday\|graduation\|holiday }` |
| `vacation` | `{ destination: hawaii\|europe\|california_coast\|theme_parks\|luxury_resorts }` |

**Response:**

```jsonc
{
  "ok": true,
  "mode": "haircut",
  "audience": "man",
  "analysis": {                         // VENDOR-ONLY, EPHEMERAL, NEVER STORED
    "features": { "faceShape": "...", "forehead": "...", "eyes": "...", "eyelids": "...",
                  "brows": "...", "nose": "...", "lips": "...", "cheeks": "...",
                  "jawChin": "...", "ears": "...", "hairline": "...",
                  "hairDensity": "...", "beardDensity": "...", "skinToneBand": "...",
                  "approxAgeRange": "..." },
    "scores": { "symmetry": 0-100, "youthfulness": 0-100, "professional": 0-100,
                "confidence": 0-100, "softness": 0-100, "maintenance": 0-100 },
    "strategy": { "emphasize": ["eyes","jawline"], "balance": ["forehead height"] },
    "thinning": { "level": "none|mild|moderate|advanced", "note": "soft language" }
  },
  "recommendations": [ /* 5 × existing recommendation shape (incl. previewDataUrl) */ ],
  "provider": "gemini-2.5-flash-image",
  "generationTimeMs": 0
}
```

`recommendations[]` keeps the **exact existing per-item shape** so the client reuses `mapRecommendedStyles`-equivalent rendering + the Book-It path.

---

## 6. The 9 studios

| Studio | mode | Source | Quality risk |
|---|---|---|---|
| Hair Styles | `haircut` | reuse engine prompts | low |
| Hair Colors | `color` (+highlight/balayage/ombre/gray-blend/fashion) | reuse + extend | low |
| Texture | `texture` (curly/straight/wavy) | reuse engine | low |
| Eyebrows | `eyebrow` | new prompt mode | medium |
| Beards (men) | `beard` | new prompt mode | medium |
| Wigs | `wig` | **new** | high — needs smoke test |
| Hair Systems | `hairsystem` | **new** | high — needs smoke test |
| Event Styles | `event` | **new** | medium-high |
| Vacation Styles | `vacation` | **new** | medium-high |

**Wig style sets:** Men {business, modern, short, youthful}; Women {long, layered, curly, elegant, glamorous}; Children {cute, simple, school}. **Hair systems:** men {frontal, partial, full}; women {topper, crown}; goal = "restore fullness / youthful appearance," before→after framing, never a medical claim. **Thinning-hair (P6)** feeds wig/hair-system recommendations from the analysis `thinning` block using soft language ("appears thinner"), never "balding."

Each net-new mode must pass a smoke test (returns `ok:true`, 5 recs, identity-lock + child-safety honored, plausible preview) before being marked done. If the image model cannot produce a credible result for a mode, that is a documented limitation, not a silent fake (no static substitute images).

---

## 7. Facial Analysis + Harmony + Strategy (SP-2)

`runFacialAnalysis()` extends the vision prompt to emit the structured `analysis` block. Rendered in a **Consultation panel** visible to the barber only.

- **Features (P2):** face shape (oval/round/square/diamond/heart/triangle/oblong), forehead, eyes/eyelids, brows, nose, lips, cheeks/cheekbones, jaw/chin, ears, hairline, hair density, beard density, skin-tone band, approx age range.
- **Harmony scores (P3):** Symmetry, Youthfulness, Professional, Confidence, Softness, Maintenance — 0–100, framed as **proportion/harmony metrics**, positive language, vendor-only, never stored, never shown to the customer.
- **Strategy (P4–5):** `emphasize[]` + `balance[]` (positive only) + the `goal` selector biasing generation.
- **Thinning (P6):** soft-language assessment feeding Wig/Hair-System studios.

**Safety in the system prompt:** no diagnosis, no attractiveness judgment, no ethnicity assumptions, no medical claims; positive language only.

---

## 8. Storage compliance (privacy-first)

- `generateStyleStudio` returns data-URLs to the client and **persists nothing** image-bearing.
- **`stripUnstoredImages` extended** with every new image-bearing field name introduced by the studio, so any booking write stays clean. Add a test asserting a studio-originated booking write contains no `data:`/Storage URLs.
- **Save History / Comparison / "Complete Package" (P14):** session + `localStorage` only (full-res stays on device), reusing the `saveLocalCopy`/30-day-prune pattern. Comparison adds a **side-by-side** view (new; current lightbox is single-image).
- **Favorites:** vendor studio favorites are session/local. The customer-scoped `customerSavedStyles` thumbnail path is unchanged.
- **Facial analysis + scores:** ephemeral — rendered, never written anywhere.
- **Export:** browser download / native "Save Image" only.

---

## 9. Safety

Vendor-only surface; `IDENTITY_LOCK` + `CHILD_SAFETY` reused on every edit; positive language enforced; no diagnosis / attractiveness / ethnicity assumptions. Celebrity match + aging sim **not built** (SP-4). Makeup + commerce design-only later.

---

## 10. i18n + versioning + testing

- **i18n:** all new strings in **vi + en + es** in the same commit, via the embedded `STRINGS`/`data-i18n`/`setText()` pattern (new `STUDIO_STRINGS` table in `mobile-barber-style-studio.js`). No hardcoded user-facing text in any language. AI natural-language fields (`whyItFitsFace`, etc.) returned in `lang`.
- **Versioning:** new/touched JS `?v=` strings start at **`20260613a`** and increment by letter; bump **every** HTML consumer of every touched JS file (verify via `grep -rn 'FILENAME.js' . --include='*.html'`).
- **Tests:**
  - One smoke test per `mode` (9): asserts `ok:true`, 5 recommendations, child-safety/identity-lock honored, **no image bytes reach Firestore**.
  - Regression test: `generateHaircutPreviews` output/shape unchanged (guards the shared-helper refactor).
  - Auth test: `generateStyleStudio` rejects unauthenticated + non-vendor callers.
  - `stripUnstoredImages` test: studio booking write contains no data:/Storage URLs.
  - Render checks: new tab on **375px** and **1280px**.
  - Gate: `scripts/ai/full_system_dry_run.sh` → must end `FINAL: PASS`.

---

## 11. Files expected to change

**New:** `mobile-barber/mobile-barber-style-studio.js`; `docs/ai_style_studio_master_plan.md` (the per-phase report deliverable).
**Modified:** `functions/index.js` (add `generateStyleStudio` + `STUDIO_PROMPTS` + `runFacialAnalysis`; factor shared Gemini helpers without behavior change); `mobile-barber/dashboard.html` (new tab markup + script include + `?v=` bumps); `mobile-barber/mobile-barber.css` (studio + accordion + comparison styles); `mobile-barber/mobile-barber-booking.js` (`stripUnstoredImages` field list); possibly `firestore.rules` (only if a new non-image collection is needed — default: none); mobile-barber smoke-test files.
**Untouched (hard rule):** `generateHaircutPreviews`, `mobile-barber-ai-preview.js`, `mobile-barber/index.html`.

---

## 12. Limitations / risks

- New generative modes (wig, hairsystem, event, vacation) have real fidelity risk with `gemini-2.5-flash-image`; quality is documented per-mode, never faked.
- Pulling all 9 studios forward (owner decision) enlarges the slice and the shared-helper blast radius; mitigated by the isolated callable + the `generateHaircutPreviews` regression test.
- Numeric facial scores are inherently subjective; mitigated by vendor-only + ephemeral + positive framing + no storage.
- Latency: up to 5 image edits per call (~the existing 180s client timeout) — same envelope as today.

---

## 13. Acceptance criteria

- Vendor opens `mobile-barber/dashboard.html` → "Style Studio" tab → uploads one selfie → all 9 studios generate previews; Consultation panel shows features + 0–100 scores + strategy (vendor-only).
- Customer `mobile-barber/index.html` flow is byte-for-byte unchanged; `generateHaircutPreviews` regression test passes.
- No selfie or generated image is written to Firestore/Storage (verified by test).
- All UI strings work in vi/en/es; no hardcoded strings.
- All touched JS `?v=` bumped (≥ `20260613a`) in every HTML consumer.
- Renders correctly at 375px and 1280px.
- `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`.
- `docs/ai_style_studio_master_plan.md` written with per-phase files-changed / tests / limitations.

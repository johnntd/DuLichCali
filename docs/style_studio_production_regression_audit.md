# /style-studio — Production Regression Audit

- **Date:** 2026-06-14
- **Target:** `https://www.dulichcali21.com/style-studio` (production) + branch `feat/unified-vendor-portal` @ `0a3f54e`
- **PR:** https://github.com/johnntd/DuLichCali/pull/1 (→ `main`)
- **Verdict:** ✅ **PASS — no regressions.** Safe to proceed to the next (design-only) phase.

## A. Live production audit (Playwright, real browser)
Harness: `tests/live/style-studio-regression-audit.js` (opt-in; `npm i -D playwright && npx playwright install chromium`). **18/18 passed.**

| Check | Result |
|---|---|
| Page loads, no uncaught JS errors | PASS |
| `StyleStudioPublic` module loaded | PASS |
| Anonymous auth completes (`signedIn`, `isAnonymous`) | PASS |
| **ZERO native `<select>`** (chips/segmented only) | PASS — 0 selects |
| Goal chips rendered | PASS — 16 |
| Audience segmented control | PASS — 4 segments |
| Per-mode option chips (not selects) | PASS — 9 groups |
| Showcase carousel 5 cards | PASS |
| AI Wig Match flagship present | PASS |
| 9 manual mode panels | PASS |
| Account control + auth panel present | PASS |
| Master button present | PASS |
| **"Create my look" CTA gives feedback (not silent)** | PASS — status → "Please confirm consent first." |
| Viewer opens + locks scroll | PASS |
| **Viewer closes + RESTORES scroll (no freeze)** | PASS |
| Auth panel is non-trapping (no body lock) | PASS |
| Language switch localizes (vi/en), no error | PASS |
| Serving expected JS version | PASS — `?v=20260613g` |

## B. Code-regression audit (do-not-break surfaces)
| Surface | Result |
|---|---|
| `generateHaircutPreviews` behavior preserved (pins `mode='haircut'` → `IDENTITY_CLAUSE`, not the new `REPLACE_HAIR_CLAUSE`) | PASS |
| Vendor `generateStyleStudio` still vendor-gated; vendor client intact; shared `runStudioGeneration` core | PASS |
| Public member/guest gate (anon → promo wall; member → 100/day, `DAILY_LIMIT`, never create-account) | PASS |
| Privacy — no selfie/image persisted (only int counter + text profile); `stripUnstoredImages` intact | PASS |
| `mobile-barber-customer.js` not modified (reused) | PASS |
| `mobile-barber-booking.js` — only the defensive `STORED_IMAGE_FIELDS` addition | PASS |
| Version-string integrity — one current `?v=` per file, no reuse | PASS |
| `firestore.rules` — promo (read:false) + usage (owner-read/function-write) only | PASS |
| Gates — `tests/unit/style-studio.test.js` (48), `npm run test:rules` (46), `full_system_dry_run.sh` (`FINAL: PASS`) | PASS |

## Known / out-of-scope
- **1 advisory dry-run `✗`:** `[Mobile Barber Landing Page] Persistent login` expects `mobile-barber.js` to call `setPersistence(LOCAL)`; that file has zero such calls and was never touched by Style Studio — it fails identically on clean HEAD. **Pre-existing, unrelated.** Flag separately if landing-page persistent login is a live requirement.
- Uncommitted working-tree WIP (`mobile-barber.js` promo-film slide + 2 untracked clip assets) is the owner's in-flight work — untouched, not part of this branch.
- Live wig/master image fidelity is model-dependent (Gemini 2.5 Flash Image); the two-pass refine is active. Not a regression — a quality dimension to keep monitoring.

## Conclusion
PR opened to `main`; production `/style-studio` passes the full live + code regression audit. **Cleared to begin the next phase — AI Wig Match commerce/partner ecosystem (design only, no feature coding).**

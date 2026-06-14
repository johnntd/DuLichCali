# SP-8 — Conversion + Membership Flow

- **Date:** 2026-06-14 · **Scope:** conversion/membership UX on `/style-studio` + a single quota-**metadata** field on the public callable. **AI generation logic untouched** (no change to `runStudioGeneration`, prompts, realism gate, wig logic, or SP-6 harmony). · **Version:** `?v=20260614j`.
- **Status:** Implemented + verified (Playwright, 48 unit tests, dry-run PASS, adversarial review **Approve**). Awaiting deploy approval.

## What already existed (reused, not rebuilt)
Anonymous free-trial → login wall, LOCAL auth persistence (stay logged in until logout), on-device favorites + history, the account panel (profile + history/favorites tabs), the launch promo (`config/styleStudioPromo`: 5 free/day for guests, 100/day members, ends 2026-06-27), and the member-aware gate from SP-5 (members never see the create-account wall).

## What SP-8 added
1. **Quota display** (`#ssQuota`, `renderQuota()`) near the hero CTA so the funnel is obvious at a glance:
   - Guest, before first try → "**Free previews during launch — try it now**".
   - Guest, after a try → "**N/M free previews left today**"; at ≤1 left a "**Create free account**" nudge; at 0 → "Free previews used today".
   - Member → green "**Member**" chip + a "**Saved looks**" link to the dashboard (no quota anxiety).
2. **Quota metadata** (backend, membership only — NOT generation): `generateStyleStudioPublic` now returns `quota: { used, limit, remaining, isAnonymous }` on success and the over-limit responses; `callPublic` funnels it into `state.quota` → `renderQuota()`. `runStudioGeneration` and the gate are byte-unchanged.
3. **Premium tier placeholder** (`buildPremiumCard()`) — "**Premium · Coming soon**", "Everything you love — without limits", 4 features (unlimited previews · saved looks across devices · priority generation · exclusive styles & studios), a **disabled** "Coming soon" CTA, and "**You won't be charged — Premium isn't live yet.**" Shown in BOTH the membership wall (guests see the future tier) and the member dashboard (account panel).
4. **Member dashboard** — the existing account panel (profile header + Saved looks/History tabs) now also carries the Premium card; the account chip + Saved-looks link route to it.

## Files changed
- `functions/index.js` — `quotaMeta()` helper + `quota` field on the 3 `generateStyleStudioPublic` return paths (metadata only).
- `style-studio-public.js` — `state.quota`; `renderQuota()`, `buildPremiumCard()`, `renderMembershipExtras()`; `callPublic` quota pass-through; wired into `renderAccount` + `init` + `setLang`; Premium card in `renderAccountPanel`; 15 new i18n keys in **vi/en/es**.
- `style-studio.html` — `#ssQuota` (hero) + `#ssMembershipPremium` (wall); versions `i → j`.
- `style-studio.css` — `.ss-quota*` + `.ss-premium*`.

## PASS criteria — a visitor clearly understands:
| # | Requirement | How it's communicated |
|---|---|---|
| 1 | **Try free now** | Hero "Create My Look" + quota chip "Free previews during launch — try it now" / "N/M left today" |
| 2 | **Create account to continue** | At 0 free previews → the wall: "Keep your momentum going · Create a free account"; plus the ≤1-left nudge |
| 3 | **Stay logged in** | LOCAL Firebase persistence (preserved) — no repeated login prompts; member chip + Logout |
| 4 | **Saved looks / history** | Member dashboard (account panel) — Saved looks + History tabs; "Saved looks" link from the member chip |
| 5 | **Premium ready, not charging** | Premium placeholder: "Coming soon", disabled CTA, "You won't be charged — Premium isn't live yet" |

## Tests / verification
- **Playwright (iPhone 13):** guest quota chip renders ("Free previews during launch — try it now"); wall Premium card present (4 features, **CTA disabled**); member dashboard Premium card present (2 tabs); **0 console errors**. (Screenshot: `docs/screenshots/sp8-wall-premium.jpg`.)
- `node --check` (functions + frontend) clean · `node tests/unit/style-studio.test.js` → **48 passed** · `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` · adversarial code review → **Approve** (AI generation logic confirmed untouched).

## DO NOT BREAK — preserved
AI generation (unchanged), Master Stylist, Wig Match realism, SP-6 harmony, upload/take-selfie (+ tap), login persistence, save/share/download, vendor Style Studio, SP-7 WOW page + swipeable carousel. Purely additive. mobile-barber promo-film WIP untouched/excluded.

## Limitations
- Quota count comes from the server per generation; before the first generation the guest sees the launch invite (the exact remaining count appears after the first try). Members see a status chip rather than a number (their limit is generous).
- Premium is a **placeholder only** — no pricing, no payment, no new collection/callable. When you're ready to charge, that's a separate phase (Stripe + a tier in the user record).
- Saved looks/history remain on-device (localStorage) per the privacy-first rule; "saved across devices" is a listed Premium (future) benefit.

**PASS / BLOCKED:** the funnel is now explicit — try free → see previews-left → create a free account at the limit → stay logged in → saved looks/history → Premium clearly coming (not charging) → **PASS pending `deploy --only functions` + `--only hosting` and your on-device confirmation.**

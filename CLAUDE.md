# Du Lịch Cali — Claude Code Instructions

---

## Claude Role Override — DuLichCali

For this repo, Claude is the reviewer, safety auditor, and controlled implementer.

Claude may implement code when explicitly asked. Otherwise:
- Inspect current code first — never modify before reading.
- Classify findings before fixing (CONFIRMED_BUG / VALID_IMPROVEMENT / FALSE_POSITIVE / OUT_OF_SCOPE / NEEDS_HUMAN_DECISION).
- Fix only confirmed bugs unless the user explicitly approves broader changes.
- Recommend the smallest safe patch.
- Run `scripts/ai/full_system_dry_run.sh` after every patch.
- Do not mark work complete unless `FINAL: PASS`.

## Critical Trigger Areas — Slow Down and Audit First

For any change touching these areas, Claude must stop, read current code, and apply safety review before implementing:

- Booking availability check logic (nail salon, hair salon, airport/ride, mobile barber)
- AI receptionist prompt construction (`_buildPrompt`, `_mergeState`, `_earlyCheckReady`)
- Vendor page data loading and context injection (who gets which services, staff, hours)
- Firestore security rules or schema changes
- Firebase Functions (`functions/index.js`) — secrets, AI proxy, notifications
- Voice mode TTS chain (`nailsalon/voice-mode.js`)
- Mobile layout (anything in `style.css` at base/640px breakpoints)
- JS version string bumps — wrong version string causes silent production regression
- Any file loaded by both `nailsalon/` and `hairsalon/` — shared code risk

## Required Review Format

Use this format for all Codex diffs, PRs, or significant patches:

### Verdict
Approve / Request changes / Block

### Scope Check
- intended scope:
- files changed:
- unrelated changes:

### Safety Check
- booking behavior:
- AI receptionist behavior:
- vendor data isolation (nails vs hair vs food):
- mobile layout impact:
- JS version string bump status:
- Firestore/secrets impact:

### Tests
- dry run command:
- dry run result: FINAL: PASS / FINAL: FAIL
- missing coverage:

### Remaining Risks
- concise bullets

## Non-Negotiable Review Rules

- Do not approve changes that break Luxurious Nails page behavior.
- Do not approve booking changes that skip the availability check.
- Do not approve AI receptionist changes that introduce hardcoded strings in any language.
- Do not approve JS changes without checking `?v=` version strings are bumped in all HTML consumers.
- Do not approve broad rewrites when a minimal patch would work.
- Do not approve production deploy without explicit user confirmation.
- Do not approve Firestore schema changes without reviewing security rules impact.
- Always confirm: does the hair salon page show vendor-specific data (not generic directory data)?
- Always confirm: does the fix work on mobile (375px) AND desktop (1280px)?

## Automation Workflow

Canonical validation gate — must pass before any patch is marked complete:
```
scripts/ai/full_system_dry_run.sh
```

Targeted validation by scope:
```
scripts/ai/targeted_dry_run.sh hair-salon
scripts/ai/targeted_dry_run.sh booking
scripts/ai/targeted_dry_run.sh travel
scripts/ai/targeted_dry_run.sh marketplace
scripts/ai/targeted_dry_run.sh ai-receptionist
```

Patch cycle (prompt-driven):
```
scripts/ai/patch_cycle.sh prompts/<prompt>.md [--scope <scope>]
```

Codex-Claude loop (prompt-driven, multi-phase):
```
bash scripts/ai/ai_dev_loop.sh prompts/<prompt>.md --max-loops 3
```

### Codex-Claude loop — ESTABLISHED, do NOT re-verify each run

This setup is installed and has been working. Do **not** re-read `ai_dev_loop.sh`, re-check
the API key, re-check the codex CLI, or re-audit prerequisites before every run — just run it.
Treat the following as known-true unless a run actually fails and tells you otherwise:

- Codex is the **implementer** (`codex exec -s workspace-write`); the Anthropic API is the
  **reviewer** (emits a `VERDICT` line). `ANTHROPIC_API_KEY` is configured; the `codex` CLI
  is installed.
- The loop **never pushes, deploys, or commits** on its own.
- Each fix-type prompt MUST contain a `## Allowed files` bullet list (scope enforcement reads
  it) and a filename containing `fix`/`patch` to trigger the full dry-run gate.
- The loop wants a reasonably clean tree. Pre-existing untracked docs/prompts normally don't
  block it; if a run reports a dirty-tree/scope failure, pass `--allow-dirty` and/or
  `--auto-commit --commit-message "..."` — that is the fix, not another round of inspection.
- Run multi-phase prompt sets sequentially; do not start the next phase until the current
  one reports `FINAL: PASS` or a clear blocker.

Run artifacts are written to `.ai_runs/latest/` — never committed (gitignored).

Missing checks are always SKIPPED, not PASS.

## Required Report Format

Every significant Claude task must end with:

**Summary:** what was done  
**Files changed:** list  
**Commands run:** with exact output excerpts  
**Dry run result:** `FINAL: PASS` or `FINAL: FAIL`  
**Report path:** `.ai_runs/latest/` or `ai_reviews/`  
**Remaining risks:** concise bullets  
**Next command:** exact command to run next  

## Current Work Context

No specific phase is queued here. (The former "Phase 1 — Beauty Hair OC hair salon"
queue and its `patch_cycle.sh` command were superseded by the unified vendor/driver
portal work and removed to avoid stale instructions.)

Backlog / known (not blocking):
- `hairsalon/index.html` still loads shared `/nailsalon/` assets (`salon.css`,
  `receptionist.js`, `voice-mode.js`) rather than hair-specific files. Works today;
  refactor when the hair salon gets dedicated assets.

---

## RULE #1 — MOBILE-FIRST DEVELOPMENT (HIGHEST PRIORITY — OVERRIDES ALL ELSE)

Mobile is the PRIMARY platform for this application.

All features, bug fixes, AI behavior, booking logic, and UI interactions MUST be:

1. Implemented for mobile FIRST
2. Verified on mobile FIRST
3. Considered correct ONLY if mobile works correctly

Desktop is SECONDARY and must mirror mobile behavior.

### Enforcement

- Never fix desktop while mobile is incorrect
- Never assume mobile and desktop use the same code path — always verify
- Always inspect which script/version mobile loads BEFORE making changes
- All logic (AI, booking, schedule, notifications) must be correct on mobile first
- After mobile is correct, align desktop to use the SAME logic path
- Do NOT maintain separate logic branches for mobile vs desktop unless explicitly required

### AI Consistency Requirement

AI behavior must be identical across mobile and desktop.

Example:

User asks: "is Helen there"

Correct interpretation: "is Helen there RIGHT NOW"

The response must use real-time clock + staff schedule + open/closed state, and return the SAME correct answer on both mobile and desktop.

### Verification Requirement

Every change MUST be verified:

1. Mobile test (REQUIRED)
2. Desktop test (SECONDARY)
3. Proof both behave identically

A fix is NOT complete unless mobile works correctly and desktop matches mobile.

### Anti-Regression Rule

- Fix improves desktop but breaks mobile → INVALID FIX
- Fix works on desktop but not mobile → INCOMPLETE FIX

### Debugging Requirement

When debugging AI or booking behavior, always identify:

- Which script version each platform loads
- Which execution path each platform takes (Claude API vs fallback)
- Whether the platforms are using the same code path

### Desktop parity — CSS & breakpoints

Mobile-first applies to CSS too: every change must work on BOTH mobile and desktop (no exceptions).

- **CSS**: write mobile-first base styles, then add `@media (min-width: 768px)` and `@media (min-width: 1200px)` desktop overrides.
- **New components**: test mentally at 375px (mobile), 768px (tablet), and 1280px (desktop) before committing.
- **Layouts**: no hardcoded pixel widths that only make sense on one form factor — use `max-width` + `margin: auto` for centering and `clamp()` for fluid typography.
- **New pages**: must link `<link rel="stylesheet" href="/desktop.css">` (or `../desktop.css` from subdirectories) — the shared desktop upgrade layer.
- **New CSS files**: must contain their own `@media (min-width: 768px)` and `@media (min-width: 1200px)` sections.

| Breakpoint | Target |
|---|---|
| base (no media query) | Mobile 375px–767px |
| `min-width: 640px` | Large mobile / small tablet |
| `min-width: 768px` | Tablet (iPad) |
| `min-width: 1200px` | Desktop (sidebar nav layout) |
| `min-width: 1600px` | Wide monitor |

A change that works on mobile but breaks desktop (or vice versa) is **not complete** — fix both before committing.

---

## RULE #2 — MULTI-LANGUAGE & NO HARDCODED STRINGS (ABSOLUTE RULE)

**Every surface — customer-facing AND internal admin/vendor/driver tools — must support Vietnamese, English, and Spanish, and NEVER hardcode user-facing text in any language (not Vietnamese, not English, not Spanish).** There are no Vietnamese-only exceptions; the language switcher must work everywhere. Operators, vendors, and drivers may also prefer English or Spanish.

### Supported languages

| Code | Language | Role |
|------|----------|------|
| `vi` | Vietnamese | Primary — default when no preference is stored |
| `en` | English | Full support on ALL surfaces (customer and admin) |
| `es` | Spanish | Full support on ALL surfaces (customer and admin) |

The no-hardcoded-strings rule applies to:
- All `.js` files (receptionist.js, ai-engine.js, marketplace.js, salon-ai-os/*.js, etc.)
- All HTML inline scripts
- All Firebase Cloud Functions
- All admin pages (`admin.html`, `salon-admin.html`, `vendor-admin.html`, `driver-admin.html`)

### Why

This webapp and its admin tools serve Vietnamese, English, and Spanish speakers. Hardcoded strings in any language — even in "internal" tools — produce output that cannot be switched by the language selector and will appear broken to users who prefer a different language.

- **Customer-facing strings**: Hardcoded strings bypass the AI and produce rigid, untranslatable output.
- **Admin tool strings**: Hardcoded Vietnamese is as wrong as hardcoded English. The vendor or operator clicking the EN button must see English. Always use a translation key lookup.

### What to do instead

**For customer-facing AI paths (booking flow, receptionist, etc.):**
- Pass an English-only reason string back through the AI using `[SYSTEM: ...]` context so the AI responds naturally in the customer's language.
- For fatal error / no-API-key fallbacks: English only (these are rare).
- System prompt instructions and examples (inside `_buildPrompt`) may include example Vietnamese/Spanish text **for teaching the AI** — that is fine. The rule applies to runtime user-facing strings only.

**For admin tool strings (salon-admin.html, admin.html, driver-admin.html, etc.):**
- Add the key to the `_LABELS` object (vi + en + es) in `salon-admin.html`, or to `salon-ai-os/i18n.js` for AI OS modules.
- Access via `SalonI18n.t('key')` inside salon-ai-os modules, or `lb.key` inside `_applyLang()` for nav/panel labels.
- Never write a string directly into the DOM — always go through the translation lookup.

### Examples of violations

```javascript
// WRONG — hardcoded Vietnamese in admin module
el.innerHTML = '<h2>Nguyên Liệu Theo Dịch Vụ</h2>';

// WRONG — hardcoded English in admin module
el.innerHTML = '<h2>Service Materials</h2>';

// RIGHT — translation key used, works in vi/en/es
el.innerHTML = '<h2>' + SalonI18n.t('sm_header') + '</h2>';

// WRONG — hardcoded Vietnamese in customer flow
if (lang === 'vi') return 'Rất tiếc, tiệm không mở cửa vào ' + d;

// RIGHT — English only, routed through AI for natural response
return 'Sorry, the salon is closed on ' + d + '. Would you like to pick a different day?';
// Then: biz._aiHistory.push({ role: 'user', content: '[SYSTEM: ' + reason + ']' })
// Then: AIEngine.call(...) → AI responds in customer language
```

### Surface coverage

| Surface | Multi-language? | Notes |
|---------|----------------|-------|
| AI chat + workflow engine | ✅ vi / en / es | Auto-detects from user input; switches mid-conversation |
| Ride intake form | ✅ vi / en / es | Driven by `?lang=` URL param |
| Thank-you / confirmation page | ✅ vi / en / es | `?lang=` passed forward from booking |
| Email notifications | ✅ vi / en / es | `lang` param passed to all `DLCNotifications` functions |
| Homepage + landing pages | ✅ vi / en / es | Customer-facing — text must support all 3 |
| Marketplace pages (food/nail/hair) | ✅ vi / en / es | Customer-facing UI text must support all 3 |
| `salon-admin.html` + all salon-ai-os modules | ✅ vi / en / es | Uses `salon-ai-os/i18n.js` + `_LABELS` in salon-admin.html |
| `admin.html` | ✅ vi / en / es | Must have a lang switcher wired to `_LABELS`-style table |
| `vendor-admin.html` | ✅ vi / en / es | Must have a lang switcher |
| `/driver/` portal PWA | ✅ vi / en / es | `driver-portal.js` / `login.html` / `dashboard.html` must support a lang switcher (`driver-admin.html` is now a redirect stub) |
| Login pages (driver/vendor) | ✅ vi / en / es | All UI strings must be translatable |

### How language is detected and propagated

1. **AI chat (primary path)**: `AIEngine.detectLang(text)` reads user input → returns `'vi'`, `'en'`, or `'es'` → stored as `draft.lang` in workflow state. Auto-updates if the user switches language mid-conversation.
2. **URL param (forms and confirmation)**: `?lang=vi|en|es` — set when opening ride intake or launching `thankyou.html`. `ride-intake.js` reads it as `_lang`; `thankyou.html` reads the same param.
3. **Admin tools (salon-admin.html, admin.html, etc.)**: Lang switcher buttons call `dlcSetLang(l)` → stores in `localStorage('dlc_lang')` → applies to all nav labels, panel titles, and buttons via a `_LABELS` lookup table or `SalonI18n.t('key')`.
4. **Default**: `'vi'` when no stored preference is found.

### Where to add new strings

| Layer | File | Pattern |
|-------|------|---------|
| AI workflow (confirmations, questions, field labels) | `workflowEngine.js` → `CONFIRM_STRINGS` | Add key to all 3 tables (`vi`, `en`, `es`). Access via `S('key')` |
| Ride intake form (step nav, fare card, success screen) | `ride-intake.js` → `_RIDE_T` | Add key to `vi`, `en`, `es` tables. Access via `_T.key` |
| Email notifications | `notifications.js` | Use the `lang` param already passed to each function |
| Salon AI OS modules (`salon-ai-os/*.js`) | `salon-ai-os/i18n.js` | Add key to `vi`, `en`, `es` objects. Access via `SalonI18n.t('key')` or `_T('key')` inside the module |
| Salon admin nav + panel labels | `salon-admin.html` → `_LABELS` | Add key to all 3 `_LABELS` tables; wire into `_applyLang()` and `navMap` |

### Hard rules

- **Every new string — on any surface, customer or admin — must exist in vi + en + es in the same commit.** Never ship a string that only works in one language.
- Never hardcode a UI string in any language (Vietnamese, English, or Spanish) directly in HTML or JS. Always use a translation key lookup.
- Never leave a language entry as an empty string or a copy of another language's text as a placeholder. Translate correctly or flag it explicitly.
- When adding a new admin module or page: include a `_LABELS`-style object or use `SalonI18n.t()`, and wire a lang switcher that persists to `localStorage('dlc_lang')`.
- Do NOT create new Vietnamese-only pages or modules. The historical Vietnamese-only exceptions in admin tools are a bug to be fixed, not a pattern to follow.

### Failure condition

Any string that exists only in one language — on any surface, customer-facing or internal — is an incomplete implementation. Add all 3 entries before deploying.

---

## JS VERSION STRINGS — MANDATORY CACHE BUSTING RULE

Every time a JS file is modified and deployed, its `?v=...` query string in every HTML file that loads it **MUST be bumped**. Failure to do this causes browsers to serve the cached old version indefinitely, silently regressing features.

### Rule

**When you edit a `.js` file, find every `<script src="...filename.js?v=...">` tag across all HTML files and increment the version string.**

### How to find all HTML files loading a given JS file

```bash
grep -rn "filename.js" /path/to/project --include="*.html"
```

### Version string format

Use `YYYYMMDD` + letter suffix: `v=20260408a`, `v=20260408b`, etc. Increment the letter for multiple changes on the same day.

### CRITICAL: Never reuse a version string

Firebase Hosting sets `cache-control: immutable, max-age=31536000`. Once a browser caches a file at a given `?v=` string, it will NOT re-fetch for up to a year, even after a new deploy. **Reusing a version string that was previously deployed causes silent regression**: browsers serve the old cached content instead of the new code.

**Before setting any new version string, verify it has never been used before:**
```bash
git log --all -p -- nailsalon/index.html | grep "filename.js"
```

**Always use a version string HIGHER than the highest previously deployed.**
Do NOT keep a hardcoded high-water table here — it goes stale on every deploy and can
mislead you into reusing an already-deployed string (silent cache regression). Read the
actual highest deployed version straight from git before bumping (replace `FILE`):

```bash
git log --all -p -- '*.html' | grep -oE 'FILE\.js\?v=[0-9]{8}[a-z]*' | sort -u | tail -1
```
Then use the next letter on that date, or the next calendar date with an `a` suffix.

### Find every HTML consumer of a JS file (before bumping)

```bash
grep -rn 'FILENAME\.js' . --include='*.html'
```
Bump the `?v=` in EVERY match. Do not rely on a hardcoded consumer list — new pages get
added (e.g. `vendor-detail.html`, `mobile-barber/`), so a static table silently goes stale.

### Failure condition

Changing a JS file without bumping the version string → browsers serve cached old version → features silently regress → users report bugs that "worked before." This is a hard failure.

---

## HOSTING & PRODUCTION DEPLOYMENT — NON-NEGOTIABLE

| Role | Platform | Detail |
|------|----------|--------|
| **Live website host** | **Firebase Hosting** | Serves the production app to real users |
| **Production domain** | **`https://www.dulichcali21.com`** | The ONLY URL that counts as "done" |
| **Source control / backup** | GitHub (`johnntd/DuLichCali`) | Code repo + history — NOT a web host |
| **Staging / preview only** | `https://dulichcali-booking-calendar.web.app` | Testing only — never treat as production |

**GitHub is NOT the live website host.** `git push origin main` keeps the repo current but does NOT deploy the live site. Deploying to `web.app` only is NOT production. A task is NOT complete until changes are visible at `https://www.dulichcali21.com`.

**Deployment method:** `firebase deploy --only hosting` → Firebase Hosting serves `www.dulichcali21.com`.

### Deploy workflow (every task)

1. Edit and test locally at `http://localhost:8080` (`python3 -m http.server 8080` from project root)
2. Commit: `git add <files> && git commit`
3. Push to repo: `git push origin main`
4. **Deploy to production**: `firebase deploy --only hosting`
5. Verify: `curl -s "https://www.dulichcali21.com/<changed-file>" | head -5`
6. Confirm: `✔ Production domain updated — https://www.dulichcali21.com`

Steps 2–3 (git) and step 4 (firebase deploy) are BOTH required — git keeps the repo current; only `firebase deploy` updates the live site.

### Multi-phase work: hold the deploy

When working a series of phases before a release: do NOT deploy between phases — accumulate locally, commit to git, but hold the deploy. Only `firebase deploy --only hosting` once ALL phases in the batch are complete and locally verified, then verify production by curling a changed file and end with `✔ Production domain updated — https://www.dulichcali21.com`.

### Anti-patterns / failure conditions — NEVER do these

- Committing/pushing but NOT running `firebase deploy` — `git push origin main` is not a deploy; production is NOT updated until you run `firebase deploy --only hosting`.
- Treating or deploying only to `https://dulichcali-booking-calendar.web.app` as production — that is staging only.
- Finishing a session without verifying `https://www.dulichcali21.com` reflects the latest changes.
- Marking a task "complete" while `www.dulichcali21.com` shows old content → NOT done. Deploy and verify.
- Enabling or relying on GitHub Pages as a hosting path for this project.

---

## Homepage 3-Panel Architecture — NON-NEGOTIABLE

The homepage (`screenHome`) is permanently organized into **3 main service panels** plus a matching AI panel.

### The 3 Panels

| # | Panel | Section ID | Content |
|---|-------|-----------|---------|
| 1 | **Marketplace** | `#hpFeatured` | Vendor cards — food, nail, hair, future local vendors |
| 2 | **Airport & Ride** | `#hpAirport` | Airport pickup/dropoff tiles, private ride |
| 3 | **Tour & Travel** | (travel carousel) | Tour carousel, California destinations |

### AI Panel (always at bottom, above contact strip)

There must be **exactly 3 AI launcher buttons**, in this order, each mapping to one panel:

| Button | Maps To | JS Call |
|--------|---------|---------|
| 🛍️ Marketplace | Panel 1 | `homeAiSend('marketplace...')` |
| ✈️ Sân Bay & Xe | Panel 2 | `openAIWithIntent('airport')` |
| 🗺️ Tour & Du Lịch | Panel 3 | `openAIWithIntent('tour')` |

### Rules

- AI must **NOT** be rendered inline inside homepage content sections
- AI chat opens via `switchScreen('screenChat')` — never as raw text in the page
- The AI panel lives in its own `<section class="home-section home-ai-panel">` after the trust stats
- Homepage section order: Hero → Marketplace → Airport/Ride → Tour/Travel → Trust Stats → AI Panel → Contact Strip
- Any future homepage changes must preserve this 3-panel + 3-AI-launcher structure

---

## Customer Form UI/UX Rules — NON-NEGOTIABLE

DuLichCali is an AI-assisted service platform. Customer-facing booking and order forms must feel like a **guided conversation**, not an admin data-entry screen.

### Core Principles

1. **Minimal first step** — Show only the 2–3 most essential inputs first. Never dump all fields on screen at once.
2. **Progressive disclosure** — Reveal additional fields step-by-step as the user advances. Each sub-step should have at most 3 required fields.
3. **AI-assisted** — Let smart defaults, location awareness, and prior context do the heavy lifting. Forms support the user, not interrogate them.
4. **Optional fields are collapsed** — Non-critical fields (flight number, terminal, luggage, notes) must be hidden inside a collapsible "More details (optional)" section.
5. **Mobile-first** — Easy to scan and complete with one hand. No long scrolling walls of required inputs.
6. **Confidence-building, not overwhelming** — Customer forms are the last moment before trust. Simplicity = trust.

### Design Reference

- Clean card layout with strong visual hierarchy
- Generous spacing between field groups
- Elegant Bodoni Moda / Jost typography
- Clear, prominent CTA button per step
- Step indicator ("Step 1 / 3 — Flight Info") so user knows progress
- Navy header + gold CTA = brand-consistent

### Form Structure Rule

All customer-facing modal booking forms (airport, ride, food, nail, hair, tour) must use **3-sub-step progressive disclosure**:

| Step | Content | Max fields shown |
|------|---------|-----------------|
| 1 | Core service info (what/where/when) | 3 required |
| 2 | Secondary info (address, party size) | 2–3 required + collapsed optional |
| 3 | Contact info (name + phone) | 2 required + optional notes |

### Hard Rules

- **NEVER** show 10+ fields at once in a customer form
- **NEVER** apply admin-style complexity to customer booking flows
- **NEVER** mix admin/vendor/driver operational fields into customer forms
- Admin, vendor, and driver forms may be more detailed — that is correct and expected
- Any future customer form changes must preserve this 3-step progressive disclosure pattern
- The ride intake modal (`ride-intake.js` + `index.html`) is the canonical reference implementation

### Failure Condition

A customer form that shows all fields at once, or that requires more than 3 inputs before the user can advance, is **not acceptable**. Fix before deploying.

---

## Category Landing Page Architecture

Each service category has a dedicated standalone landing page at the root:

| URL | File | Purpose |
|-----|------|---------|
| `/airport` | `airport.html` | Airport & Ride landing page — full functional page with ride intake modal |
| `/tour` | `tour.html` | Tour & Travel landing page — destination highlights, AI entry |
| `/food` | `food.html` | Food landing page — menu highlights, links to marketplace |
| `/hair` | `hair.html` | Hair Salon landing page — services list, links to marketplace |
| `/nails` | `nails.html` | Nail Salon landing page — services list, links to marketplace |

### Design Rules

- All landing pages use the **same premium design language** as the homepage (`style.css` + `desktop.css` loaded, then body scroll override)
- Every page has its own **hero carousel** with category-specific slides and CSS accent colors
- Pages are **standalone** (scrollable body, not SPA-locked) — override: `html,body { height:auto; } body { overflow-y:auto; }`
- The `.hc` hero carousel height is `76vh` on landing pages (vs `60vh` on SPA homepage) since there is no bottom nav
- Self-contained carousel JS is inlined in each page (same IIFE pattern as `HeroCarousel` in `script.js`)

### AI Entry Points

| Page | AI button destination | Mode |
|------|-----------------------|------|
| `airport.html` | `/?entry=airport` | airport (structured workflow) |
| `tour.html` | `/?entry=tour` | tour (structured workflow) |
| `food.html` | `/?entry=marketplace` | marketplace |
| `hair.html` | `/?entry=marketplace` | marketplace |
| `nails.html` | `/?entry=marketplace` | marketplace |

The `?entry=` URL param is handled in `script.js` DOMContentLoaded — opens the main site's SPA AI in the correct mode.

### Booking Actions

- **airport.html**: Fully functional — includes ride intake modal HTML + loads Firebase + `location.js` + `ride-intake.js`. Tiles call `RideIntake.open('pickup'|'dropoff'|'ride')` directly.
- **tour.html**: Destination highlight cards link to `/?entry=tour` (AI plans tour).
- **food/hair/nails**: Service cards and CTA buttons link to `marketplace/?cat=X` for actual booking.

### Carousel Accent Colors

| Page | Accent | Glow |
|------|--------|------|
| airport (slide 1) | `#38bdf8` (sky blue) | `rgba(56,189,248,.45)` |
| airport (slide 2) | `#fb923c` (sunset) | `rgba(251,146,60,.45)` |
| tour (slide 1) | `#fb923c` | `rgba(251,146,60,.45)` |
| food | `#f59e0b`, `#fbbf24`, `#f97316`, `#84cc16`, `#fbbf24` | per slide |
| hair | `#c084fc` (purple) | `rgba(192,132,252,.48)` |
| nails | `#f472b6` (pink) | `rgba(244,114,182,.45)` |

### QR Code Usage

These pages are the canonical QR code destinations (see `qr.html`). Each page works as a self-contained entry point for social media links, printed materials, and QR scans.

---

## Permissions & Workflow

- **Auto-mode is always on.** Proceed with all file edits, writes, and implementations without asking for permission.
- When the user requests an update, new feature, or fix — make the changes directly and report what was done.
- Only pause and ask for confirmation if the action is **critical and irreversible** (e.g., deleting the repository, dropping a production database, or exposing secret keys).
- Never ask "should I proceed?" for routine code edits, CSS changes, or JS additions.

---

## Project Overview

Static HTML/CSS/JS travel booking web app for **Du Lịch Cali**, a Vietnamese-American travel service based in Southern California.

No build step. No framework. All files are served as-is.

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page app shell — 4 screens (Home, Destinations, Book, Chat) |
| `style.css` | Mobile-first CSS; base → 640px → 768px → 1200px → 1600px breakpoints |
| `desktop.css` | Shared desktop overrides — linked from every page |
| `script.js` | SPA navigation, booking wizard, estimate logic, destination modal |
| `destinations.js` | Single source of truth for destination data, costs, YouTube IDs |
| `chat.js` | AI chat module — rule-based fallback + optional Claude API |
| `workflowEngine.js` | State-machine AI workflow agent for all 6 service types |
| `thankyou.html` | Post-booking confirmation + live tracking page |
| `marketplace/marketplace.css` | Styles for all marketplace pages (nailsalon, hairsalon, foods) |

### Architecture

- **SPA screens**: shown/hidden via `opacity` + `pointer-events`; `switchScreen(id)` manages transitions
- **Bottom nav (mobile) / Sidebar nav (desktop 1200px+)**: CSS grid layout switches at 1200px
- **Destination modal**: full-screen cinematic video modal using YouTube IFrame API; slides up over the app
- **Booking wizard**: 5-step flow; `goStep(n)` manages visibility + progress bar (`--wiz-pct` CSS var)
- **Data layer**: `DESTINATIONS`, `AIRPORTS`, `QUICK_ESTIMATES` arrays in `destinations.js`
- **Firebase Firestore**: booking storage (v9.22.0 compat SDK) — project ID: `dulichcali-booking-calendar`
- **EIA Gas Price API**: California fuel price with 6h sessionStorage cache
- **Workflow engine**: `DLCWorkflow` global — handles food/nail/hair/airport/ride/tour flows

### Styling Conventions

- CSS variables defined in `:root` (navy palette, gold accents, typography)
- `--font-d`: Bodoni Moda (display); `--font-b`: Jost (body)
- Mobile-first: base → 640px → 768px → 1200px → 1600px
- **No max-width phone caps on desktop** — removed from both style.css and marketplace.css
- Shared desktop overrides live in `/desktop.css` — always link this from new pages

### Contact / Business Info

- Phone: +1 (408) 916-3439
- Email: dulichcali21@gmail.com
- Site: www.dulichcali21.com

---

## Provider Admin & PIN-Gated Access Rules — NON-NEGOTIABLE

### Overview

DuLichCali uses a **two-tier provider system**: Vendors (food/nail/hair) and Drivers. Both require admin-issued PINs to register/authenticate. Admin has full control over all provider accounts.

### Data Model

| Collection | Field | Purpose |
|---|---|---|
| `vendors/{id}` | `setupCode` | PIN admin issues to vendor |
| `vendors/{id}` | `adminStatus` | `active`, `pending`, `blocked`, `deactivated`, `archived` |
| `vendorUsers/{uid}` | `vendorId`, `email` | Maps Firebase Auth UID → vendor + registered email |
| `drivers/{id}` | `setupCode` | PIN admin issues to driver |
| `drivers/{id}` | `adminStatus` | `active`, `blocked`, `deactivated`, `archived` |
| `driverUsers/{uid}` | `driverId`, `phone` | Maps Firebase Auth UID → driver doc |

### Vendor Auth Flow

1. Admin creates vendor in Firestore (`adminStatus: 'pending'`) and issues a PIN (`setupCode`)
2. Admin sets vendor to `active` before vendor can register
3. Vendor visits `vendor-login.html?id={vendorId}`, enters email + password + PIN
4. `vendor-login.html` checks Firestore `adminStatus` — if not `active`, blocks registration
5. On first login: Firebase Auth account is created (email+password); `vendorUsers/{uid}` written
6. On subsequent logins: Firebase Auth `signInWithEmailAndPassword`; `adminStatus` re-checked each time
7. Session persists via Firebase Auth native persistence (no custom code needed)

### Driver Auth Flow

> **Architecture note (2026-06):** `driver-admin.html` and `driver-login.html` are now thin **redirect stubs**. The live driver experience is the PWA under **`/driver/`** (`/driver/login.html`, `/driver/dashboard.html`, `/driver/driver-portal.js`, built on `portal-kit/`). Where this doc still says `driver-login.html` / `driver-admin.html`, read it as the `/driver/` portal.

1. Admin creates driver in `admin.html` — Firebase Auth account is pre-created via REST API with derived credentials:
   - Email: `d{10-digit-phone}@dlc.app`
   - Password: `pin.padEnd(6,'0')` (PIN padded to 6 chars)
2. Firestore: `drivers/{uid}` saved with `setupCode: pin`, `adminStatus: 'active'`
3. Driver visits `driver-login.html`, enters phone + PIN only (no registration step)
4. `driver-login.html` signs in with derived email+password, then fetches `drivers/{driverId}` to check `adminStatus`
5. If `blocked`, `deactivated`, or `archived` → sign out immediately, show error
6. Session persists via Firebase Auth native persistence

### Admin PIN Reset

- **Vendor PIN reset**: Admin updates `vendors/{id}.setupCode` in Firestore. Next vendor login attempt will use new PIN.
- **Driver PIN reset**: Admin updates `drivers/{id}.setupCode` AND updates Firebase Auth password via Identity Toolkit REST (sign in with old credentials to get idToken, then update password). If old credentials don't work, Firestore-only update with warning.

### Status Enforcement Rules

| Status | Vendor can register? | Vendor can log in? | Driver can log in? |
|---|---|---|---|
| `active` | Yes | Yes | Yes |
| `pending` | No (blocked at registration) | No | N/A |
| `blocked` | No | No | No |
| `deactivated` | No | No | No |
| `archived` | No | No | No |

### Critical Security Rules

- Driver login MUST check `drivers/{driverId}.adminStatus` on EVERY login and auth state restore — not just `driverUsers`
- Vendor login MUST check `vendors/{id}.adminStatus` before allowing registration (PIN check)
- Admin never shares raw Firebase Auth credentials — only issues PINs through admin panel
- `vendor-login.html` must support both VENDOR_REGISTRY (hardcoded) and Firestore-only vendors (dynamic)
- `_tryShowScreen()` pattern in `vendor-login.html` prevents flash of wrong screen while async vendor config loads

### Admin UI Requirements

- Admin can create vendor profiles from admin panel (no hardcoding required)
- Admin can view registered email per vendor (from `vendorUsers` collection)
- Admin can set vendor/driver status (active/blocked/deactivated/archived)
- Admin can generate random 4-digit PINs with 🎲 button
- Admin can reset driver PIN and sync Firebase Auth password
- Vendor and driver cards show onboarding status (registered email vs "Chưa đăng ký")

---

## Driver Compliance & Approval Rules — NON-NEGOTIABLE

Drivers must pass compliance review before they can appear as available for rides. This system is permanent and must not be weakened.

### Required Compliance Documents

Every driver must submit three document groups before admin can approve them:

| Document | Required Fields | Key Expiry Field |
|---|---|---|
| **Driver License** | Legal name, license number, expiration date, front image URL | `license.expirationDate` |
| **Vehicle Registration** | License plate, VIN, expiration date, document URL | `registration.expirationDate` |
| **Insurance** | Insurer name, policy number, named insured, expiration date, card URL | `insurance.expirationDate` |

### Per-Document Statuses

`not_submitted` → `pending` → `approved` | `rejected`

Driver fills in → Admin reviews → Admin approves or rejects with reason.
If rejected, driver sees the reason and must update and resubmit.

### Overall Compliance Status

| Status | Meaning |
|---|---|
| `pending_documents` | Not all docs submitted yet |
| `pending_review` | All submitted, waiting for admin decision |
| `approved` | All docs approved by admin and not expired |
| `rejected` | At least one doc rejected by admin |
| `expired` | At least one approved doc has passed its expiration date |

### Enforcement Rules — NEVER violate

- **Only `approved` drivers appear in availability** — `checkRideServiceAvailability()` in `script.js` and `checkRides()` in `landing-nav.js` both filter `complianceStatus === 'approved'`
- **Real-time expiry check** — `licExpiry`, `regExpiry`, `insExpiry` mirror fields on `drivers/{id}` are checked against today's date in availability queries; expired docs automatically exclude the driver
- **`adminStatus` enforced** — `active` only; blocked/deactivated/archived drivers are also excluded
- **Admin is the only authority** — drivers cannot approve themselves; only admin.html approval functions update compliance status
- **Non-compliant drivers cannot receive ride notifications** — they do not appear in `_availableDrivers`

### Data Model

**Firestore collections:**

```
drivers/{driverId}
  complianceStatus: 'pending_documents'|'pending_review'|'approved'|'rejected'|'expired'
  licExpiry:  YYYY-MM-DD   ← mirror from license.expirationDate (set on admin approval)
  regExpiry:  YYYY-MM-DD   ← mirror from registration.expirationDate
  insExpiry:  YYYY-MM-DD   ← mirror from insurance.expirationDate

driver_compliance/{driverId}
  license:      { status, legalName, number, expirationDate, fileFrontUrl, fileBackUrl,
                  rejectionReason, reviewedAt, reviewedBy,
                  verificationSource, verificationStatus, verificationReference, verificationCheckedAt }
  registration: { status, plate, vin, expirationDate, fileUrl, rejectionReason, reviewedAt, reviewedBy }
  insurance:    { status, insurer, policyNumber, namedInsured, expirationDate, fileUrl, rejectionReason, reviewedAt, reviewedBy }
  overallStatus, complianceNotes, lastReviewAt, lastReviewBy, nextRequiredAction, expirationWarning
```

### Shared Utility

`driver-compliance.js` — loaded by both `/driver/dashboard.html` (the driver portal PWA) and `admin.html`.
Provides: `computeOverall()`, `computeExpirationWarning()`, `daysUntil()`, labels, CSS classes.
**Both pages must load this file before their own scripts.**

### Expiration Warning Thresholds

| Warning | Threshold |
|---|---|
| `expiring_soon_30` | ≤ 30 days until earliest approved-doc expiry |
| `expiring_soon_14` | ≤ 14 days |
| `expiring_soon_7`  | ≤ 7 days |

### Future Verification Integration Hooks

The compliance data model includes future-ready fields on `license`:
- `verificationSource` — e.g. `'aamva'`, `'checkr'`
- `verificationStatus` — e.g. `'verified'`, `'failed'`
- `verificationReference` — external job/reference ID
- `verificationCheckedAt` — timestamp of last verification check

Do NOT fake real-time DMV or insurance verification. Plug real verification results into these fields when an authorized integration is set up. The core workflow (driver submits → admin approves) must remain the gate regardless of verification source.

### Admin Actions Available

From `admin.html` driver row → Pháp Lý (compliance panel):
- **Duyệt** (Approve) individual document
- **Từ Chối** (Reject) individual document with required reason
- **Duyệt Tất Cả Đang Chờ** (Approve All Pending)
- **Yêu Cầu Cập Nhật** (Request Update) — sets status back to `pending_documents`
- Internal notes field (not shown to driver)

### New Driver Onboarding Flow

1. Admin creates driver in `admin.html` → `complianceStatus: 'pending_documents'` set automatically
2. Driver logs into `driver-admin.html` → taps "Tài Liệu" tab
3. Driver fills in all three document sections (forms + Google Drive links)
4. Driver clicks "Nộp Tài Liệu Để Duyệt" → status becomes `pending_review`
5. Admin reviews in `admin.html` → approves/rejects each doc
6. When all approved → `complianceStatus: 'approved'` → driver appears in availability

All future driver onboarding must follow this flow. Do not skip compliance review.

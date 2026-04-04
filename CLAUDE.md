# Du Lịch Cali — Claude Code Instructions

## HOSTING ARCHITECTURE — NON-NEGOTIABLE

| Role | Platform | Detail |
|------|----------|--------|
| **Live website host** | **Firebase Hosting** | Serves the production app to real users |
| **Production domain** | **`https://www.dulichcali21.com`** | The only URL that counts as "done" |
| **Source control / backup** | GitHub (`johnntd/DuLichCali`) | Code repo and version history — NOT a web host |
| **Staging / preview only** | `https://dulichcali-booking-calendar.web.app` | For testing — never treat as production |

**GitHub is NOT the live website host.**
`git push origin main` keeps the repo current but does NOT deploy the live site.
Deploying to `web.app` only is NOT production.
A task is NOT complete until changes are visible at `https://www.dulichcali21.com`.

### Anti-patterns — NEVER do these:

- Treating `git push origin main` as the production deploy step
- Treating `https://dulichcali-booking-calendar.web.app` as the production URL
- Finishing a session without verifying `https://www.dulichcali21.com` reflects the latest changes
- Enabling or relying on GitHub Pages as a hosting path for this project

---

## PRODUCTION DOMAIN — NON-NEGOTIABLE RULE

**Production URL:** `https://www.dulichcali21.com` — this is the ONLY launch URL that matters.

**Deployment method:** `firebase deploy --only hosting` → Firebase Hosting serves `www.dulichcali21.com`.

**Firebase web.app URL** (`https://dulichcali-booking-calendar.web.app`) is staging/test only. Never treat it as done.

### Deploy workflow (every task):

1. Edit and test locally at `http://localhost:8080` (`python3 -m http.server 8080` from project root)
2. Commit: `git add <files> && git commit`
3. Push to repo: `git push origin main`
4. **Deploy to production**: `firebase deploy --only hosting`
5. Verify: `curl -s "https://www.dulichcali21.com/<changed-file>" | head -5`
6. Confirm: `✔ Production domain updated — https://www.dulichcali21.com`

Steps 2–3 (git) and step 4 (firebase deploy) are both required. Git keeps the repo current; only Firebase deploy updates the live site.

### Multi-phase work: local testing first

When working on a series of phases or features before a final release:
- **Do NOT deploy between phases** — accumulate changes locally, commit to git, but hold the deploy.
- Only `firebase deploy --only hosting` when ALL phases in the current batch are complete and locally verified.
- After the final deploy, verify production by curling a changed file.
- End every completed batch with: `✔ Production domain updated — https://www.dulichcali21.com`

### Single-task deploys (default when no batch is active):

1. Commit changes with `git add <files> && git commit`
2. Push to repo: `git push origin main`
3. Deploy: `firebase deploy --only hosting`
4. Verify production by curling a changed file
5. Confirm: `✔ Production domain updated — https://www.dulichcali21.com`

### Failure conditions:

- Changes committed and pushed but `firebase deploy` not run → production is NOT updated. Run `firebase deploy --only hosting`.
- Task "complete" but `www.dulichcali21.com` shows old content → NOT done. Deploy and verify.
- Deployed only to `web.app` → NOT production. That is staging only.
- Session ended without confirming production → failure. Never finish with undeployed completed work.

---

## DESKTOP + MOBILE — MANDATORY COMPATIBILITY RULE

**Every change must work on BOTH desktop and mobile.** No exceptions.

### What this means in practice:

- **CSS changes**: Always write mobile-first base styles, then add `@media (min-width: 768px)` and `@media (min-width: 1200px)` overrides for desktop.
- **New components**: Test mentally at 375px (mobile), 768px (tablet), and 1280px (desktop) before committing.
- **Layouts**: No hardcoded pixel widths that only make sense on one form factor. Use `max-width` + `margin: auto` for centering, `clamp()` for fluid typography.
- **New pages**: Must include `<link rel="stylesheet" href="/desktop.css">` (or `../desktop.css` from subdirectories). This is the shared desktop upgrade layer.
- **New CSS files**: Must contain their own `@media (min-width: 768px)` and `@media (min-width: 1200px)` sections.

### Breakpoints used across this project:

| Breakpoint | Target |
|---|---|
| base (no media query) | Mobile 375px–767px |
| `min-width: 640px` | Large mobile / small tablet |
| `min-width: 768px` | Tablet (iPad) |
| `min-width: 1200px` | Desktop (sidebar nav layout) |
| `min-width: 1600px` | Wide monitor |

### Failure condition:

A change that works on mobile but breaks desktop (or vice versa) is **not complete**. Fix both before committing.

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

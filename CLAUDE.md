# Du Lịch Cali — Claude Code Instructions

## PRODUCTION DOMAIN — NON-NEGOTIABLE RULE

**Production URL:** `https://www.dulichcali21.com` — this is the ONLY launch URL that matters.

**Deployment method:** `git push origin main` → GitHub Pages auto-builds and serves `www.dulichcali21.com`.

**Firebase web.app URL** (`https://dulichcali-booking-calendar.web.app`) is staging/test only. Never treat it as done.

### Multi-phase work: local testing first

When working on a series of phases or features before a final release:
- **Do NOT push to production between phases** — accumulate changes locally, commit to git, but hold the push.
- **Test locally** at `http://localhost:8080` using `python3 -m http.server 8080` from the project root.
- Only `git push origin main` when ALL phases in the current batch are complete and locally verified.
- After the final push, verify production: `curl -s "https://www.dulichcali21.com/<file>" | head -5`
- End every completed batch with: `✔ Production domain updated — https://www.dulichcali21.com`

### Single-task deploys (default when no batch is active):

1. Commit changes with `git add <files> && git commit`
2. Push with `git push origin main`
3. Verify production by curling a changed file
4. Explicitly confirm: `✔ Production domain updated — https://www.dulichcali21.com`

### Failure condition:

If a batch is complete and changes are still only on local → push immediately. Never finish a conversation with unpushed completed work.

### Never run `firebase deploy` as the final deploy step. The production deploy is always `git push origin main`.

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

- Duy Hoa: 714-227-6007
- Dinh: 562-331-3809
- Email: dulichcali21@gmail.com
- Site: www.dulichcali21.com

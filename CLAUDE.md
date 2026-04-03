# Du Lịch Cali — Claude Code Instructions

## PRODUCTION DOMAIN — NON-NEGOTIABLE RULE

**Production URL:** `https://www.dulichcali21.com` — this is the ONLY launch URL that matters.

**Deployment method:** `git push origin main` → GitHub Pages auto-builds and serves `www.dulichcali21.com`.

**Firebase web.app URL** (`https://dulichcali-booking-calendar.web.app`) is staging/test only. Never treat it as done.

### Mandatory after EVERY task that touches any file:

1. Commit changes with `git add <files> && git commit`
2. Push with `git push origin main`
3. Verify production by curling a changed file: `curl -s "https://www.dulichcali21.com/<file>" | head -5`
4. Explicitly confirm: `✔ Production domain updated — https://www.dulichcali21.com`

### Failure condition:

If changes are only on local or only on `web.app` → the task is **NOT complete**. Fix immediately.

### Never run `firebase deploy` as the final deploy step. The production deploy is always `git push origin main`.

---

## Permissions & Workflow

- **Auto-mode is always on.** Proceed with all file edits, writes, and implementations without asking for permission.
- When the user requests an update, new feature, or fix — make the changes directly and report what was done.
- Only pause and ask for confirmation if the action is **critical and irreversible** (e.g., deleting the repository, dropping a production database, or exposing secret keys).
- Never ask "should I proceed?" for routine code edits, CSS changes, or JS additions.

## Project Overview

Static HTML/CSS/JS travel booking web app for **Du Lịch Cali**, a Vietnamese-American travel service based in Southern California.

No build step. No framework. All files are served as-is.

### Key Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page app shell — 4 screens (Home, Destinations, Book, Chat) |
| `style.css` | Mobile-first CSS; base → 640px → 900px breakpoints |
| `script.js` | SPA navigation, booking wizard, estimate logic, destination modal |
| `destinations.js` | Single source of truth for destination data, costs, YouTube IDs |
| `chat.js` | AI chat module — rule-based fallback + optional Claude API |
| `thankyou.html` | Post-booking confirmation + live tracking page |

### Architecture

- **SPA screens**: shown/hidden via `opacity` + `pointer-events`; `switchScreen(id)` manages transitions
- **Bottom nav**: 4 tabs; center Book tab is elevated gold circle (Uber-style)
- **Destination modal**: full-screen cinematic video modal using YouTube IFrame API; slides up over the app
- **Booking wizard**: 5-step flow; `goStep(n)` manages visibility + progress bar (`--wiz-pct` CSS var)
- **Data layer**: `DESTINATIONS`, `AIRPORTS`, `QUICK_ESTIMATES` arrays in `destinations.js`
- **Firebase Firestore**: booking storage (v9.22.0 compat SDK) — project ID: `dulichcali-booking-calendar`
- **EIA Gas Price API**: California fuel price with 6h sessionStorage cache

### Styling Conventions

- CSS variables defined in `:root` (navy palette, gold accents, typography)
- `--font-d`: Cormorant Garamond (display); `--font-b`: DM Sans (body)
- Mobile-first: base styles → `@media (min-width: 640px)` → `@media (min-width: 900px)`
- App max-width capped at 500px on desktop, centered

### Contact / Business Info

- Duy Hoa: 714-227-6007
- Dinh: 562-331-3809
- Email: dulichcali21@gmail.com
- Site: www.dulichcali21.com

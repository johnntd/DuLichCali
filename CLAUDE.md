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

`driver-compliance.js` — loaded by both `driver-admin.html` and `admin.html`.
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

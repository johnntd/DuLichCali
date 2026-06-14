# Critical Patch Prompt — Shared Mobile Barber Vendor Template Mobile Responsive Fix

## Problem
The Mobile Barber vendor pages are not mobile friendly.

Example:
https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc

Current issues:
- Layout feels desktop-first
- Hero/profile sections are oversized or cramped
- Service browsing requires too much scrolling
- Booking CTA not optimized for mobile
- Service cards feel awkward on small screens
- Typography hierarchy weak
- Portfolio/gallery not mobile friendly
- Buttons too small in some areas
- Page does not feel premium

IMPORTANT:
This is NOT a Michael-only issue.

The fix must apply to the shared Mobile Barber vendor template used by ALL barber vendors.

Do NOT hardcode:
`michael-nguyen-oc`

The responsive improvements must automatically apply to:
- Michael
- Tim
- every future barber vendor

---

## Objective
Make ALL Mobile Barber vendor pages mobile-first.

Target pattern:
```
/mobile-barber/vendor/:vendorId
```

The responsive improvements must apply to every vendor rendered by the shared template.

---

## Scope
Fix the shared Mobile Barber vendor template/components only.

Apply automatically to:
- `/mobile-barber/vendor/michael-nguyen-oc`
- `/mobile-barber/vendor/tim-nguyen-bay`
- `/mobile-barber/vendor/<future-vendor>`

Do NOT create vendor-specific CSS.
Do NOT branch by vendorId.
Do NOT duplicate pages.
Fix the shared rendering system.

---

## Allowed files
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber.css
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-data.js
- tests/lib/mobile-barber-landing.js
- docs/mobile_barber_vendor_mobile_responsive_shared_template_fix_report.md

Do not touch any file outside this list. In particular, do not touch:
- `nailsalon/`, `hairsalon/`, `marketplace/`, `ai-engine.js`, `script.js`, `style.css`, `chat.js`, `workflowEngine.js`
- `functions/`, `firestore.rules`, `firestore.indexes.json`
- Any auth, driver, ride, food, or travel surface.

---

## Strict Rules
1. Do NOT rewrite unrelated pages.
2. Do NOT break:
   - booking
   - AI booking
   - voice booking
   - dashboard
   - salon
   - food
   - rides
   - travel
3. Preserve routes.
4. Preserve Firestore collections.
5. Mobile-first.
6. Desktop must remain acceptable.
7. Use shared styles/components.
8. Future vendors inherit automatically.
9. No hardcoded user-facing strings in any language. Add new i18n keys in en + vi + es together.
10. JS version strings must be bumped in lockstep across all HTML consumers.

---

## Required Layout Changes

Applies to ALL vendors.

Breakpoint:
```
@media (max-width: 768px)
```

### 1. Shared Vendor Shell
Find actual shared container.

Examples:
- `mobile-barber-vendor-shell`
- vendor page wrapper
- mobile barber layout
- vendor template

Convert to:
- single-column mobile
- No desktop sidebar assumptions

Rules:
- `width: 100%`
- `max-width: 100%`
- padding 14–16px
- no overflow
- no fixed desktop widths

Prevent:
- horizontal scrolling

### 2. Hero Redesign
For ALL barber vendors.

Mobile order:
1. profile card
2. hero image / promo
3. CTA buttons
4. vendor details

Show:
- barber name
- business name
- service region
- rating
- languages
- specialties
- service chips

Service chips:
- horizontally scrollable
- NOT huge stacked blocks

Hero image:
- smaller mobile height
- No giant empty section

### 3. Sticky Mobile CTA
ALL vendors.

Create sticky bottom action bar.

Buttons:
- Book
- AI Booking
- Voice Booking

Large touch targets: 48px+.

Primary CTA always visible.

Desktop behavior unchanged.

### 4. Shared Service Carousel
ALL barber services.

Replace long grid on mobile.

Use horizontal swipe carousel.

Requirements:
- 1–1.1 cards visible
- scroll snap
- large image
- title
- price
- duration
- select button
- selected state
- smooth swipe

Desktop: grid acceptable.

No vendor-specific implementation.

Future vendors inherit automatically.

### 5. Booking Panel
Remove desktop sidebar feeling.

Mobile:
- booking becomes inline card OR bottom sheet style

Selected service summary visible.

Buttons large. Thumb friendly.

### 6. Shared Portfolio Layout
ALL vendors.

Portfolio becomes:
- horizontal swipe
- before/after slider if possible

AI label visible.

Avoid giant vertical gallery walls.

### 7. Typography
Shared typography:

- Headline: 26–32
- Section: 20–24
- Body: 14–16
- Buttons: 15–16

No tiny pills.

### 8. Motion
Lightweight polish:
- fade in
- slide cards
- tap feedback
- carousel snap
- hover lift desktop

Respect:
```css
@media (prefers-reduced-motion: reduce)
```

No heavy libs.

---

## Technical Audit Required
Find actual shared files.

Search:
```bash
grep -R "mobile-barber" -n public src .
grep -R "vendor template" -n .
grep -R "vendor shell" -n .
grep -R "mobileBarber" -n .
```

Likely:
- `mobile-barber.css`
- `mobile-barber-vendor.js`
- vendor page component
- shared vendor renderer

Fix shared components.

NOT individual vendor pages.

---

## Required Functional Verification

Test:

Michael: `/mobile-barber/vendor/michael-nguyen-oc`

Tim: `/mobile-barber/vendor/tim-nguyen-bay`

Create test vendor: `/mobile-barber/vendor/test-vendor`

Verify:
- responsive automatically applies
- without vendor-specific code

### Viewports
Test:
- 375x667
- 390x844
- 414x896
- 360x800
- 768x1024
- 1440 desktop

### Regression
Verify:
- `/mobile-barber`
- `/mobile-barber/dashboard`
- `/nailsalon?id=luxurious-nails`
- ride flow
- travel flow

No regression.

---

## Required Output Report
Create `docs/mobile_barber_vendor_mobile_responsive_shared_template_fix_report.md`.

Include:
1. Shared template found
2. Files changed
3. Mobile improvements
4. Carousel implementation
5. Sticky CTA
6. Viewports tested
7. Future vendor inheritance verification
8. Regression tests
9. PASS / BLOCKED

---

## PASS Criteria
PASS only if:
- ALL vendors inherit mobile layout automatically
- No vendor-specific CSS
- No vendor-specific branching
- No horizontal overflow
- Large CTA
- Swipe services
- Booking works
- AI booking works
- Voice booking works
- Desktop still works
- Future vendors automatically inherit layout

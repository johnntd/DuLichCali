# Patch Prompt — Polish Mobile Barber UI + Service Promo Animation

## Problem
The Mobile Barber app is functional, but the visual finish still feels too plain.

Current issues:
- Vendor page looks basic
- Hero area is too empty
- Service cards look flat
- Service section still feels like a static grid
- No elegant promotional motion
- No premium mobile-first barber brand feeling
- Service images/portfolio should feel more modern and polished

## Goal
Polish the Mobile Barber customer and vendor pages into a modern, elegant, premium mobile-first experience.

Use the existing nail salon page quality as the visual benchmark, but adapt it for a mobile barber / in-home haircut brand.

Do NOT break functionality.

---

## Scope
Polish these routes:
- `/mobile-barber`
- `/mobile-barber/vendor/michael-nguyen-oc`
- `/mobile-barber/vendor/tim-nguyen-bay`

Also polish shared Mobile Barber components if they are reused by these routes.

---

## Allowed files
- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/dashboard.html
- mobile-barber/mobile-barber.css
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-dashboard.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber-voice.js
- mobile-barber/mobile-barber-promo.js
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-data-model.js
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-agent.js
- docs/mobile_barber_polish_modern_ui_animation_report.md
- assets/mobile-barber/

---

## Strict Rules
1. Additive/minimal patch only.
2. Do NOT break:
   - booking
   - AI chat booking
   - AI voice booking
   - vendor dashboard
   - salon pages
   - food pages
   - ride pages
   - travel pages
3. Do NOT rewrite unrelated systems.
4. Do NOT remove existing data fields.
5. Preserve routes and Firestore collection names.
6. Keep mobile-first design.
7. No hardcoded barber photos; John will upload real photos later.
8. AI-generated promo visuals must be clearly labeled as sample/generated previews where appropriate.

---

## UI/UX Requirements

### 1. Premium Hero Section
Replace the plain hero with a modern barber landing visual:
- Elegant dark gradient background
- Barber-themed accent colors
- Strong headline
- Short benefit statement
- Trust badges:
  - In-home haircut
  - Verified barber
  - Same-day options
  - English / Vietnamese
- Large CTA buttons:
  - Book Now
  - Chat with AI Barber Assistant
  - Talk to Barber Assistant

For vendor pages, the hero should show:
- Barber business name
- Barber name
- service location
- rating
- phone CTA
- AI booking CTA
- service area chips
- language chips
- specialty chips

---

### 2. Mobile Service Slider Panel
On mobile, services must not feel like a long grid.

Create a swipeable panel/carousel:
- 1 card or 1.15 cards visible
- horizontal swipe
- scroll snap
- large image
- service name
- short description
- price
- duration
- "Select Service"
- selected state
- sticky booking CTA after selection

Desktop can still use a clean grid, but it should look more polished.

---

### 3. Better Service Cards
Cards should include:
- service-specific image
- gradient overlay
- price pill
- duration pill
- travel buffer pill
- cleanup buffer pill
- select button
- hover/tap animation
- selected border/glow
- accessible alt text

No repeated generic image unless absolutely no image exists.

---

### 4. Animated Promotional Section
Add a promotional animation section for Mobile Barber services.

Preferred implementation:
Use existing Remotion/video/promotional pipeline if available.

If Remotion already exists in the project:
- create/generate a short 8–15 second promo clip for Mobile Barber
- include service highlights:
  - Fade
  - Beard Trim
  - Kids Cut
  - Business Cut
  - In-home convenience
- use barber-style transitions
- include music/sound only if existing app pipeline supports it
- store generated clip consistently with existing promo video system
- embed it in the Mobile Barber landing page and vendor pages

If Remotion pipeline does NOT exist or cannot generate during this patch:
- create an elegant CSS/JS animated promo panel as fallback
- animated rotating service cards
- sliding before/after previews
- barber pole accent animation
- subtle shimmer/shine
- "Book an in-home haircut today" CTA

Do not block the patch if video generation is unavailable. Use the best available animation system.

---

### 5. Before/After Gallery Polish
Improve the AI-generated portfolio section:
- Use before/after slider cards if possible
- Show label:
  "Sample AI-generated style preview. Real barber portfolio coming soon."
- Add categories:
  - Fade
  - Beard
  - Kids
  - Business
  - Taper
- Make gallery swipeable on mobile
- Do not imply these are real customer photos

---

### 6. Booking Panel Polish
The booking panel should look more professional:
- sticky booking card on desktop
- bottom sticky CTA on mobile
- selected service summary
- clear manual booking button
- clear AI booking button
- clear voice booking button
- large touch-friendly buttons

---

### 7. Motion / Animation Standards
Use lightweight animations:
- fade-in on page load
- slide-up cards
- hover lift on desktop
- tap feedback on mobile
- smooth carousel snap
- animated badges or service highlight loop

Respect reduced motion:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

Do not add heavy libraries unless already installed.

---

## AI Image / Promo Visual Requirements

If the project has AI image generation:
- generate unique promo images per service
- store them in the same asset/location pattern as existing generated images
- update service image URLs

If no AI image generation exists:
- create prompt metadata for each service
- use unique curated placeholder assets if available
- never reuse one image for every service

Required service visuals:
- Classic Haircut
- Fade Haircut
- Skin Fade
- Taper Fade
- Haircut + Beard
- Beard Trim
- Kids Haircut
- Senior Haircut
- Business Style Haircut
- Buzz Cut
- Line Up
- Modern Styling
- Home Family Package

---

## Visual Direction

Use a premium barber look:
- dark navy / charcoal base
- warm gold accents
- glassmorphism cards
- clean rounded panels
- subtle shadows
- professional typography
- large readable mobile text
- strong spacing
- elegant CTA hierarchy

It should feel:
- modern
- premium
- trustworthy
- mobile-friendly
- service-focused
- easy to book

---

## Verification

Test:
1. `/mobile-barber`
2. `/mobile-barber/vendor/michael-nguyen-oc`
3. `/mobile-barber/vendor/tim-nguyen-bay`

Viewport tests:
- iPhone width
- Android width
- tablet
- desktop

Functional tests:
- service selection still works
- manual booking still works
- AI chat booking still works
- voice booking button still opens correct flow
- selected service is passed into booking context
- vendor dashboard still loads
- existing nail salon page still loads
- existing ride/food/travel pages still load

Visual tests:
- no repeated service image problem
- service carousel works on mobile
- promotional animation appears
- before/after gallery appears
- CTA buttons are large enough on mobile
- no horizontal page overflow
- no tiny unreadable text

---

## Required Report

Create:
`docs/mobile_barber_polish_modern_ui_animation_report.md`

Include:
1. Files changed
2. UI improvements made
3. Animation/video approach used
4. Whether Remotion/video generation was available
5. Service image fix status
6. Mobile carousel status
7. Routes tested
8. Regression tests
9. Screenshots/manual test notes
10. PASS / BLOCKED

Do not mark PASS unless the Mobile Barber pages look modern, polished, mobile-friendly, and all booking/AI flows still work.

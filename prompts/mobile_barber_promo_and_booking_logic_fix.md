# Critical Patch — Mobile Barber Promo Content + Booking Logic Reuse

## Problems

1. Mobile Barber page does not show real haircut promotion.
It only shows the same static hero area repeatedly.

Expected:
- Latest AI-generated haircut styles
- Before/after haircut previews
- Service-specific promo images/clips
- Convenience benefits of mobile haircut service
- Fresh visual content, not repeated hero blocks

2. Mobile Barber booking must reuse the proven nail/hair salon booking logic:
- no double booking
- no invalid booking
- service duration respected
- availability checked before confirmation
- customer record lookup
- clear confirmation
- real DB write

---

# Scope

Fix shared Mobile Barber pages:

```
/mobile-barber
/mobile-barber/vendor/:vendorId
```

Applies to Michael, Tim, and all future barbers.

Do not hardcode only one barber.

---

# Part A — Promotional Haircut Content

## Required Homepage Sections

Add these mobile-first sections:

1. **Latest AI Haircut Styles**
   - carousel/swipe panel
   - fade
   - taper
   - beard trim
   - kids cut
   - business cut
   - senior cut
   - line up
   - family package

2. **Before / After Gallery**
   - AI-generated sample haircut transformations
   - label clearly:
     > "AI-generated style preview. Real barber portfolio coming soon."

3. **Mobile Haircut Convenience**
   Show benefits:
   - Barber comes to your home
   - Good for kids and seniors
   - Hotel / office / care facility appointments
   - Transparent pricing
   - No waiting room
   - Flexible scheduling
   - English / Vietnamese support

4. **Optional Promo Clips**
   If Remotion/video generation pipeline exists:
   - generate 8–15 second mobile barber promo clips
   - embed playable clips
   - do not loop the same static hero image

   If no video pipeline exists:
   - create animated promotional cards/sliders as fallback.

---

# Part B — AI Image Generation

If the app has image generation:
- generate unique images for every service/style
- store URLs in Mobile Barber data
- no repeated one-image-for-all-services problem

If no image generation API is wired:
- create prompt metadata per style
- use distinct safe fallback assets
- document missing generator

Required fields:

```js
{
  id,
  title,
  category,
  imageUrl,
  clipUrl,
  prompt,
  isAIGenerated: true,
  active: true,
  displayOrder
}
```

---

# Part C — Booking Logic Must Reuse Nail/Hair Salon Guardrails

Audit nail/hair salon booking code first.

Search:

```bash
grep -R "double booking" -n .
grep -R "availability" -n public src functions .
grep -R "booking" -n public/nailsalon src functions .
grep -R "confirmed" -n public/nailsalon src functions .
grep -R "salon" -n public src functions .
grep -R "mobileBarberBookings" -n .
```

Mobile Barber must reuse or mirror the same proven guardrails:

- availability check before confirm
- overlap detection
- service duration
- staff/vendor schedule
- blocked time
- confirmed/pending booking conflict
- customer phone lookup
- final confirmation step
- DB write result handling

Mobile-specific additions:

- travel buffer
- service area validation
- customer address required

---

# Required Booking Tests

1. Valid manual booking creates record.
2. Same barber/time duplicate is blocked.
3. Overlapping service duration is blocked.
4. Missing address is blocked.
5. Out-of-area address becomes blocked or vendor_review.
6. Booking appears in dashboard.
7. AI/voice booking uses same create path.
8. Nail/hair salon booking still works.

---

# Required UI Tests

1. `/mobile-barber` shows haircut style promo carousel.
2. Vendor page shows style/promotional gallery.
3. Images are not all the same.
4. Mobile view is readable at 390px.
5. Convenience section appears.
6. Promo clips or animated fallback appears.

---

# Allowed files

- mobile-barber/index.html
- mobile-barber/vendor.html
- mobile-barber/mobile-barber.js
- mobile-barber/mobile-barber-vendor.js
- mobile-barber/mobile-barber-booking.js
- mobile-barber/mobile-barber-data.js
- mobile-barber/mobile-barber-agent.js
- mobile-barber/mobile-barber.css
- tests/lib/mobile-barber-landing.js
- tests/lib/mobile-barber-booking.js
- tests/lib/mobile-barber-agent.js
- docs/mobile_barber_promo_and_booking_logic_fix_report.md

Do NOT touch:
- nailsalon/* (read-only — used as reference only)
- hairsalon/* (read-only — used as reference only)
- functions/index.js
- firestore.rules
- script.js, style.css, desktop.css
- marketplace/*

---

# Required Report

Create:

```
docs/mobile_barber_promo_and_booking_logic_fix_report.md
```

Include:

1. Why promo content was missing/repeating
2. Promo sections added
3. Whether AI image/video generation exists
4. Booking logic comparison with nail/hair salon
5. Shared booking guards reused
6. Tests run
7. PASS/BLOCKED

---

# PASS Criteria

Do not mark PASS unless:

- promo haircut styles display
- before/after gallery displays
- convenience section displays
- no repeated static-only hero
- manual booking creates valid record
- duplicate/invalid booking is blocked
- AI/voice booking uses same booking path
- existing salon booking still works

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_promo_and_booking_logic_fix.md --max-loops 3 --allow-dirty --timeout 2400
```

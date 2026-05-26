# Patch Prompt — Add Mobile Barber to the Main DuLichCali Homepage Listing

## Goal

The main DuLichCali homepage at https://www.dulichcali21.com should show Mobile Barber as a visible service / vendor option, the same way the other vendors and categories are shown.

---

## Required

1. Add a Mobile Barber card / section to the homepage.
2. Link it to:

   ```
   https://www.dulichcali21.com/mobile-barber
   ```

3. Use label:

   ```
   Mobile Barber
   ```

4. Subtitle:

   ```
   In-home haircuts. We come to you.
   ```

5. CTA:

   ```
   Book Mobile Barber
   ```

6. Use a barber / mobile haircut image or an existing Mobile Barber promo asset (e.g. one of the AI-generated style or portfolio JPGs already under `assets/mobile-barber/`).
7. Must be mobile-friendly.
8. Must NOT break existing homepage vendors / services.
9. Must NOT replace salon, food, ride, travel, or any other existing section.
10. If homepage categories are data-driven, add Mobile Barber to the shared category / vendor config — do not hardcode a one-off DOM block.

---

## Search first

```bash
grep -R "Luxurious Nails" -n .
grep -R "vendors" -n public src .
grep -R "homepage" -n public src .
grep -R "dulichcali21" -n public src .
grep -R "mobile-barber" -n public src .
```

Document:

- which file renders the homepage vendor / category cards
- whether the cards come from a data array or hardcoded HTML
- where the existing salon / food / ride / travel entries live
- whether mobile-barber is already referenced anywhere on the homepage

---

## Strict Rules

1. Do NOT touch:
   - mobile-barber pages themselves (`mobile-barber/*`) — those already exist and work
   - functions/index.js
   - firestore.rules
   - notifications.js
   - marketplace/*, foods/*, nailsalon/*, hairsalon/*, salon-admin.html
   - airport.html, tour.html (standalone landing pages — leave alone)
2. Do NOT add a card that duplicates a Marketplace tile if the marketplace tile already routes to `/mobile-barber/`.
3. Mobile Barber card must coexist with Marketplace, Airport & Ride, Tour & Travel — the homepage 3-panel architecture in `CLAUDE.md` must not be broken.
4. If the homepage uses the 3 main service panels (Marketplace / Airport & Ride / Tour & Travel), the Mobile Barber card should sit INSIDE the Marketplace panel as a vendor card alongside food / nails / hair vendors. Do NOT create a 4th main panel — that would break the documented 3-panel rule.

---

## Test

- Homepage loads.
- Mobile Barber card / vendor entry appears in the marketplace panel.
- Clicking the card opens `/mobile-barber`.
- Mobile layout (375px iPhone) works — card readable, image not stretched, CTA tappable.
- Existing vendor links still work (food, nails, hair, airport, ride, tour).
- 3-panel homepage architecture preserved.

---

## Allowed files

- index.html
- script.js
- destinations.js
- style.css
- desktop.css
- assets/mobile-barber/* (read-only — can reference existing images)
- tests/lib/*  (if a homepage assertion test exists; otherwise add a new one)
- docs/mobile_barber_homepage_listing_report.md

Do NOT touch:

- mobile-barber/* (already implemented)
- functions/index.js
- firestore.rules
- notifications.js
- marketplace/* (its own scope)
- foods/*, nailsalon/*, hairsalon/*, salon-admin.html
- airport.html, tour.html, food.html, hair.html, nails.html

---

## Required Report

Create:

```
docs/mobile_barber_homepage_listing_report.md
```

Include:

1. Where homepage vendor cards are rendered (file + function)
2. Whether listing is data-driven or hardcoded
3. What was added (data entry + render proof)
4. Files changed
5. Mobile 375px layout proof
6. Existing vendor link smoke check
7. PASS / BLOCKED

---

## PASS Criteria

Do not mark PASS unless:

- Mobile Barber is visible from the main homepage on first load
- Clicking it opens `/mobile-barber`
- 3-panel homepage structure intact
- No existing vendor / category links broken
- Mobile (375px) renders cleanly

Run:

```bash
bash scripts/ai/ai_dev_loop.sh prompts/mobile_barber_homepage_listing.md --max-loops 3 --allow-dirty --timeout 1800
```

# Mobile Barber — AI Hairstyle Direct-Booking Flow

**Status:** Shipped to production (`https://www.dulichcali21.com/mobile-barber/`)
**Date:** 2026-05-27

## Goal

Make every AI-generated hairstyle preview card directly bookable. Customer uploads a selfie, AI generates 3 photoreal previews, the customer taps **Book this style** on whichever one they like — an inline booking panel slides open under that card, they fill in 6 quick fields, and the booking is saved to Firestore with the chosen hairstyle attached as a reference for the barber.

## What Changed

### Data Model — `mobile-barber/mobile-barber-data.js`

Added 6 canonical `selectedAi*` fields to `BOOKING_FIELDS`:

| Field | Purpose |
|-------|---------|
| `selectedAiStyleId` | Style identifier (mirrors `selectedStyleId` for legacy renderers) |
| `selectedAiStyleName` | Human-readable name (e.g. "Modern Skin Fade") |
| `selectedAiStyleImage` | AI-generated preview image data URL or hosted URL |
| `selectedAiStyleDescription` | One-line description from the AI |
| `selectedAiBarberNotes` | Cutting reference notes from the AI |
| `selectedAiMaintenanceLevel` | Maintenance cadence (e.g. "Every 3 weeks") |

`validateBooking()` extended with a size guard on `selectedAiStyleImage` (≤ 900 000 chars) so the booking doc stays under Firestore's 1 MB cap.

### Pricing / Build — `mobile-barber/mobile-barber-booking.js`

`buildBooking()` now reads all 6 new fields off the `draft` and persists them on the booking. Also mirrors them into the legacy `selectedStyleId` / `selectedStylePreviewUrl` so dashboards and history readers built before this feature still work without modification.

### Customer Landing — `mobile-barber/mobile-barber.js`

- New per-card **Book this style** premium CTA inside `renderAiResults()` — replaces the old radio-select pattern.
- New `renderInlineBookingPanel(rec)` — inline form expands directly under the chosen card with: phone, name, address, city, ZIP, preferred date, preferred time, optional notes, and Cash/Zelle payment radios.
- New `submitInlineStyleBooking(rec, fullDataUrl, panel)` — bypasses the chat agent and goes straight through `BOOKING.findVendorForAddress` → `BOOKING.checkAvailability` → `BOOKING.buildBooking` → `BOOKING.saveBooking({ requireDatabase: true })`.
- `attachAiPreviewToBooking()` extended so the **chat-driven** booking path also writes all 6 canonical fields — no inconsistency between booking sources.
- Existing prefill: customer name/phone/address pulled from `state.lastBooking` and `readSavedLocation()` so a repeat customer fills the form in 2 taps.
- Per-form drafts persisted in `state.aiPreview.formDrafts` so a re-render (e.g. style switch) doesn't wipe what the customer typed.
- Friendly error mapping for every `checkAvailability` failure key (`service_area_out_of_range`, `closed_day`, `outside_hours`, `same_day_cutoff`, `booking_overlap`, etc.).
- Success state per card: gold gradient flips to green, "Booking submitted. The barber will confirm shortly." surfaces below the CTA, and the next inline tap reads **Book another time**.

### Vendor Dashboard — `mobile-barber/mobile-barber-dashboard.js`

`buildAiPreviewSection()` updated to:
- Prefer the new `selectedAiStyleImage` / `selectedAiStyleName` for the image caption.
- Render a new dedicated **AI hairstyle reference** block: style name, maintenance cadence, description, and barber reference notes — all gold-bordered so the barber sees it at a glance.
- Falls back to legacy `selectedStyleId` + `recommendedStyles[]` for bookings written before this feature.

### CSS — `mobile-barber/mobile-barber.css`

- Premium gold-gradient `.mb-ai-rec-card__cta` with hover/active states and full-width block layout (sticky on long forms via `position: sticky` on the booking actions row).
- `.mb-ai-rec-card--expanded` glow + grid full-width override so the inline panel breaks the auto-fit grid and uses the entire row.
- `.mb-ai-rec-card--booked` green state for post-submission.
- `mbAiBookingExpand` keyframe (220 ms ease-out fade + slide-up), gated by `prefers-reduced-motion`.
- New `.mb-ai-rec-card__field`, `.mb-ai-rec-card__row`, `.mb-ai-rec-card__payment` inline-form styles. All inputs are 44 px+ tall on mobile (touch-target spec). Two-column rows collapse to one column at ≤ 540 px.
- `.mb-booking-ai-preview__reference` vendor-side block with gold border + cream-on-navy contrast.

### i18n — vi / en / es

30 new keys in `STRINGS` (customer landing) — `homeAiPreviewBookCta`, `homeAiPreviewBookFormTitle`, `homeAiPreviewBookPhone/Name/Address/City/Zip/Date/Time/Notes/Submit/Submitting/Success/Submitted/Missing/NoVendor/NoService/Blackout/Closed/OutsideHours/Cutoff/Overlap/Generic`, plus `homeAiPreviewMaintenanceLabel`, `homeAiPreviewBookCancel`, `homeAiPreviewBookAgain`.

3 new keys in the dashboard `_LABELS` — `vendorAiPreviewStyleLabel`, `vendorAiPreviewMaintenanceLabel`, `vendorAiPreviewBarberRefNotes`.

All three languages populated in the same commit (per the **no hardcoded strings in any language** rule). No customer- or vendor-facing string is locked to a single language.

## Booking Payload

When the customer submits the inline form, the booking saved to `mobileBarberBookings/{id}` carries the full standard booking shape plus:

```json
{
  "selectedAiStyleId": "fade-haircut",
  "selectedAiStyleName": "Modern Skin Fade",
  "selectedAiStyleImage": "data:image/jpeg;base64,...",
  "selectedAiStyleDescription": "Sharp skin fade, scissor on top",
  "selectedAiBarberNotes": "#0 sides, scissor top, matte finish",
  "selectedAiMaintenanceLevel": "Every 3 weeks",
  "selectedStyleId": "fade-haircut",
  "selectedStylePreviewUrl": "data:image/jpeg;base64,..."
}
```

Plus `selfieDataUrl`, `aiAnalysisSummary`, `aiAnalysisConsent`, and `recommendedStyles[]` (metadata only, no bulk image data) — same as the legacy chat-attach path.

## Vendor View

In `dashboard.html` → bookings list → expand booking row → the AI haircut preview section now shows:

```
AI haircut preview                [AI suggestion]
[selfie thumb]  [style thumb — caption "Modern Skin Fade"]

┌─ AI hairstyle reference (gold-bordered) ────────────┐
│ Style:        Modern Skin Fade                       │
│ Maintenance:  Every 3 weeks                          │
│ Sharp skin fade, scissor on top                      │
│ Barber reference notes: #0 sides, scissor top,       │
│ matte finish                                         │
└──────────────────────────────────────────────────────┘

AI summary: …
[Your cutting notes textarea]
[Save cutting notes]  [Delete selfie (privacy)]
```

## Architecture / Future-Ready

The 6 canonical `selectedAi*` fields are the contract regardless of where the AI preview comes from:

- Today: Gemini 2.5 Flash Image via the existing `generateHaircutPreviews` Cloud Function.
- Tomorrow: a real-image AI service swapped in. Vendor / customer code is unchanged — only the recommendation source changes.
- Future hairstyle features (favorites, history, barber recommendations) read from the same fields. Storing them on the booking instead of side-tables keeps the read path simple.

The legacy `selectedStyleId` / `selectedStylePreviewUrl` mirror fields stay so older renderers and older bookings still work. No migration required.

## Cache-Bust Versions

All touched files bumped to `?v=20260527q` in `mobile-barber/index.html`, `mobile-barber/dashboard.html`, and `mobile-barber/vendor.html`:
- `mobile-barber.css`
- `mobile-barber-data.js`
- `mobile-barber-booking.js`
- `mobile-barber-dashboard.js`
- `mobile-barber.js`

Files NOT changed and NOT bumped: `mobile-barber-agent.js`, `mobile-barber-ai-preview.js`, `mobile-barber-vendor.js`, `mobile-barber-voice.js`.

## Tests

`tests/lib/mobile-barber-ai-style-booking.js` — 8 tests, all passing:

| # | Test |
|---|------|
| A1 | `BOOKING_FIELDS` includes the 6 canonical `selectedAi*` fields |
| A2 | `validateBooking` accepts all 6 `selectedAi*` fields populated |
| A3 | `buildBooking()` reads `selectedAi*` off the draft + mirrors to legacy |
| A4 | Landing renders per-card "Book this style" CTA + inline panel + i18n keys |
| A5 | Inline submit uses `findVendorForAddress` + `checkAvailability` + `buildBooking` + `saveBooking({ requireDatabase: true })` |
| A6 | Vendor dashboard renders the AI hairstyle reference block (all 5 readable fields) |
| A7 | CSS ships premium CTA + expand animation + `prefers-reduced-motion` guard + vendor reference block |
| A8 | `attachAiPreviewToBooking` writes `selectedAi*` so chat-path bookings carry the canonical contract too |

Plus the test runner now also includes the previously-orphaned `mobile-barber-promotions.js` (16 tests).

Full system gate: **`FINAL: PASS` — 384 passed, 0 failed**.

## Manual Smoke Test (Production)

1. Open `https://www.dulichcali21.com/mobile-barber/?lang=en`.
2. Scroll to **See yourself in 3 AI haircut previews**.
3. Tick the consent box, tap **Add a photo or selfie**, pick a clear face photo.
4. Tap **Get 3 AI hairstyle previews**. Wait for 3 cards.
5. Tap **Book this style** on any card. Inline panel slides open under that card.
6. Fill phone, name, address, city, ZIP, date, time. Pick Cash or Zelle. Tap **Send booking request**.
7. Within ~1 second the card flips green, "Booking submitted. The barber will confirm shortly." appears, the CTA reads **Book another time**.
8. Open `https://www.dulichcali21.com/mobile-barber/dashboard.html?id=michael-nguyen-oc` (or `tim-nguyen-bay` if BayArea ZIP).
9. The new booking appears in the bookings list. Expand it. Under **AI haircut preview**, the gold-bordered **AI hairstyle reference** block shows the style name, maintenance cadence, description, and barber reference notes.

## Constraints Honored

- Existing chat-based booking flow: unchanged. The chat agent still attaches the same canonical fields via `attachAiPreviewToBooking()`.
- AI hairstyle generation: unchanged (still uses `MobileBarberAIPreview.generate` → `generateHaircutPreviews` Cloud Function → Gemini).
- Vendor portal: only added to (new reference block + new i18n keys). All existing booking UI unchanged.
- Voice booking: unchanged (different code path; not touched).
- Promotion logic: unchanged. If a vendor has an active promo, the inline booking still applies the discount because it goes through the same `calculateMobileBarberPrice` pipeline.

## Remaining Risks

- Today the inline form falls back to the first available service for the chosen vendor if `state.selectedServiceId` is empty — the customer is not asked to pick a service in the inline flow because the AI preview was meant as a quick "this haircut please" gesture. If a vendor's first service isn't representative, surface a small service picker in the inline panel.
- The `selectedAiStyleImage` may carry a base64 data URL up to ~600 KB. Combined with the selfie (also inline), bookings can approach the 1 MB Firestore document cap. The validator guards against >900 000 chars per field, but consider hoisting images to Firebase Storage once usage grows.

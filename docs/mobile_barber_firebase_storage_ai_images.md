# Mobile Barber — Firebase Storage for AI Hairstyle Images

## Summary

Wired durable Firebase Storage for Mobile Barber AI-generated hairstyle preview
images (and consented customer selfies), replacing the inline-data-URL-on-booking-doc
approach. On booking save, any inline `data:` image is uploaded to Firebase Storage and
the booking field is rewritten to the durable download URL, so the vendor portal shows a
real, full-resolution image without bloating the Firestore doc (1MB cap). The inline data
URL is preserved as a fallback when Storage is unavailable or an upload fails — the booking
still completes and the vendor still sees the reference. No deploy performed.

### Design decisions
- **Reuse the already-permitted nailsalon Storage path** `vendors/{vendorId}/bookings/{bookingId}/...`
  — no new `storage.rules` / `firebase.json` storage block added, which avoids clobbering the
  live console-set Storage rules on a future full deploy.
- **Anonymous auth added additively** on the customer pages (`signInAnonymously`) because the
  live Storage rules require `request.auth != null`. This does NOT change Firestore booking-create
  behavior (that rule uses `hasAll`, no auth), and `customerUid` is intentionally not set so read/write
  gating is unchanged.
- **Full-resolution sourcing**: a small `aiPreviewSessionId` string is carried draft→booking so the
  upload can pull the crisp full-res copy from the customer's localStorage cache
  (`MobileBarberAIPreview.readLocalCopy`) instead of the compressed inline thumbnail. Falls back to the
  inline data URL if the cache is gone.
- **Synchronous-return preserved**: `saveBooking` keeps its synchronous return shape (relied on by the
  existing test harness and stubs) via a `syncResolved` synchronous thenable in the no-op path. It only
  goes async when `firebase.storage` is available AND a data-URL image exists.
- **Dashboard unchanged**: it renders `selectedHaircutImageUrl`, which becomes the durable Storage URL
  on success or stays inline on fallback. `getDownloadURL` URLs are public, so the dashboard needs no
  auth/storage upload capability.

## Files changed

- `mobile-barber/mobile-barber-booking.js` — added Storage helpers (`uploadBookingImages`,
  `fullResHaircutDataUrl`, `canUseStorage`, `hasUploadableImages`, `syncResolved`, etc.); split old
  `saveBooking` body into `persistBooking`; new `saveBooking` uploads then persists;
  `aiPreviewSessionId` added to `buildBooking` output; `uploadBookingImages` exported.
- `mobile-barber/mobile-barber-data.js` — added `aiPreviewSessionId` to the `BOOKING_FIELDS` allowlist.
- `mobile-barber/mobile-barber.js` — carry `aiPreviewSessionId` through the AI-attachment object and
  `attachAiPreviewToBooking`.
- `mobile-barber/index.html` — added `firebase-storage-compat.js`; anon-auth + `window.dlcStorage` init;
  bumped `mobile-barber-data.js`, `mobile-barber-booking.js`, `mobile-barber.js` to `?v=20260529m`.
- `mobile-barber/vendor.html` — added `firebase-storage-compat.js`; anon-auth + `window.dlcStorage` init;
  bumped data.js + booking.js to `?v=20260529m`.
- `mobile-barber/dashboard.html` — bumped data.js + booking.js to `?v=20260529m` (no storage/auth scripts
  needed; auth-compat already present).
- `tests/lib/mobile-barber-landing.js` — version-string assertions bumped to `20260529m` in lockstep
  (landing, vendor, dashboard blocks).
- `tests/lib/mobile-barber-booking.js` — 5 new Storage-upload unit tests.

## Commands run

- `node --check` on all edited JS + test files → `ALL SYNTAX OK`
- `node tests/lib/mobile-barber-booking.js` → `37 passed, 0 failed`
- `node tests/runner.js` → `✅ ALL TESTS PASSED: 517 passed, 0 failed`
- `bash scripts/ai/full_system_dry_run.sh` → `FINAL: PASS` (`PASS: 1 | FAIL: 0 | SKIP: 1`)

Diagnostic log confirms canonical paths, e.g.:
`[haircut-storage] {"bookingId":"storage-haircut-1","field":"haircutImage","storagePath":"vendors/michael-nguyen-oc/bookings/storage-haircut-1/ai_haircut_…png","uploaded":true}`

## Dry run result

`FINAL: PASS`

## Report path

`docs/mobile_barber_firebase_storage_ai_images.md`

## Remaining risks

- Storage upload path is verified by stubbed unit tests only; real Firebase Storage upload +
  anonymous-auth handshake is not exercised by the harness (needs a live browser test on
  www.dulichcali21.com after deploy).
- Anonymous auth depends on Anonymous sign-in being enabled in the Firebase console; if it is
  disabled, uploads silently fall back to the inline data URL (no regression, but no durable image).
- Live Storage rules are console-managed; this change relies on the nailsalon `vendors/.../bookings/...`
  path already being permitted. Confirm before any future full `firebase deploy` that includes storage.

## Next command

```
firebase deploy --only hosting   # ONLY after explicit user confirmation
```

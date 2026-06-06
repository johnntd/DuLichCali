# On-Device Verification Checklist — Unified Vendor Portal (Driver) + Mobile Barber

**Date:** 2026-06-06
**Branch under test:** `feat/unified-vendor-portal` (local; NOT pushed, NOT deployed)
**Rule:** Complete every PASS box on a real iPhone before any production hosting deploy or `git push`. Mark ❌ + notes on any failure; do not deploy hosting until all ❌ are resolved.

---

## 0. How to test on iPhone BEFORE production (read first)

iOS PWA behavior — Add-to-Home-Screen, standalone, **login persistence, web push, and the app-icon badge** — only works over **HTTPS**. A local `http://localhost` or `http://<mac-LAN-IP>:8080` server is NOT a secure context on the phone, so SW/push/badge will silently no-op. Two safe ways to get an HTTPS URL **without** touching production:

- **Recommended — Firebase Hosting preview channel** (isolated HTTPS URL, expires, does NOT change `www.dulichcali21.com`):
  ```
  firebase hosting:channel:deploy driver-test --expires 7d
  ```
  This prints a `https://dulichcali-booking-calendar--driver-test-XXXX.web.app` URL. Test the driver portal at `…/driver/login` there.
  > ⚠️ Backend note: a preview channel still uses the **live** Firestore + Functions. So the **rules** and **`sendDriverRidePush`** must be deployed (steps 1–2) for push + isolation to behave as designed. If you test the channel before deploying rules, isolation reflects the OLD rules; push won't fire until the function is deployed.
- **Alternative** — ngrok/Cloudflare tunnel to a local `firebase serve`/http server (HTTPS front). More setup; the preview channel is simpler.

**Sequencing hazard to know:** between deploying the new **rules** (step 1) and deploying **hosting** (step 3), production still serves the OLD `driver-admin.html`. Its tour feed uses `travelAssignments.where('travel_driver_id','in',[…])`; under the new rule that's fine only if every value equals the driver's uid. **Recommendation:** do steps 1→2→3 in one short window (after the preview-channel checklist passes), to minimize the time the old portal runs against new rules.

---

## A. Prerequisites (set up before testing)
- [ ] A **test driver** account (phone + PIN) with `adminStatus: active` and at least one **assigned** ride (`bookings.driver.driverId == that driver's uid`).
- [ ] A **second driver** (Driver B) with their own assigned ride — for the isolation test.
- [ ] A way to **create a new ride/airport booking** that dispatches an offer to the test driver (real booking flow or an admin-created `bookingOffers` doc / `dispatchQueue`).
- [ ] **Michael's owner** login for `mobile-barber/dashboard.html?id=michael-nguyen-oc` (multi-business owner).
- [ ] An iPhone on iOS **16.4+** (required for web push + app badge).
- [ ] HTTPS test URL ready (preview channel per §0), and rules+functions deployed if testing push/isolation.

---

## B. Mobile Barber dashboard — NO regression (we did not touch its files)
- [ ] `mobile-barber/dashboard.html` loads; bookings list shows for the vendor.
- [ ] New booking popup + chime + bell badge still work; drawer mark-read works.
- [ ] Settings accordions, services, hours, payments unchanged.
- [ ] Its Home-Screen PWA (if installed) still launches and stays logged in.
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## C. Driver portal — install + login persistence (Safari)
- [ ] Open `…/driver/login` (Safari). Old `/driver-admin.html` and `/driver-login.html` **redirect** here (with query/hash preserved).
- [ ] Log in with phone + PIN → lands on `/driver/dashboard`.
- [ ] **Refresh** the page → still logged in (no bounce to login).
- [ ] **Force-quit Safari, reopen** the URL → still logged in.
- [ ] Toggle **airplane mode ON for ~10s** while on the dashboard, then OFF → the portal does **NOT** log you out (transient-read tolerance); it recovers.
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## D. iOS Home Screen — login persistence
- [ ] In Safari on `/driver/dashboard`, Share → **Add to Home Screen**. Confirm you can **edit the name** (e.g. "DLC Driver") — the manifest intentionally omits a locked name.
- [ ] Launch from the Home-Screen icon → opens **standalone** (no Safari chrome); icon is the **shuttle** art (navy/gold), not the barber icon.
- [ ] First launch may require **one login inside the installed app** (separate storage from Safari — expected).
- [ ] After that login: force-close the app, relaunch → **still logged in**.
- [ ] Reboot the phone, relaunch → **still logged in** (until explicit Sign out).
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## E. Notification popup (foreground)
- [ ] With the driver dashboard **open**, create a new ride **offer/booking** for this driver.
- [ ] An in-app **popup/toast** appears within a few seconds; the bell badge increments; the item shows in the drawer.
- [ ] Tapping the notification opens/expands the related ride card.
- [ ] **No duplicate** notification on refresh (de-dup) — refresh and confirm it doesn't re-pop the same one.
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## F. Notification badge count
- [ ] **In-app badge** (`.pk-notif-badge` on the bell) shows the correct unread count; "99+" caps correctly.
- [ ] **Home-screen app-icon badge** (installed PWA) shows the count after a push (requires §G permission + steps 1–2 deployed). 
- [ ] **Refresh** the dashboard → unread badge **persists** (localStorage-backed).
- [ ] **Mark one read** → in-app badge decrements; **Mark all read** → badge clears (hidden).
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## G. Sound enable (gesture unlock)
- [ ] Tap **"Enable Alerts"** → grants notification permission; this also subscribes to push (stores `drivers/{uid}/pushSubscriptions/…`).
- [ ] Trigger a new offer with the app open → the **chime** plays (foreground).
- [ ] Background the app / lock the phone, trigger a new offer → an **OS notification** appears (system sound) and tapping it opens the dashboard. (Best-effort; may lag the 35s offer window — by design it deep-links, it does not auto-accept.)
- [ ] "Disable push" removes the subscription (no more background pushes).
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## H. New booking appears correctly
- [ ] Collapsed card shows: status pill, pickup time, customer name, pickup city, destination (short), passengers/luggage.
- [ ] Expanded card shows: phone, full pickup + dropoff, date/time, flight (airport), passengers/luggage, fare/notes, and actions: **Map / Navigate / Accept / Decline / advance status / Call / Text**.
- [ ] **Accept** an offer → calls `acceptOffer`; status moves to `assigned`; on a stale offer you get a friendly "ride already taken" toast (not a crash).
- [ ] **Advance status** (assigned → on_the_way → arrived → in_progress → completed) updates and notifies the customer.
- [ ] Counters (Today / Upcoming / Pending / In Progress / Completed Today) are correct and **filter** the list when tapped.
- [ ] Language switch **vi / en / es** changes all labels (no leftover hardcoded text).
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## I. Driver only sees assigned rides (isolation — emulator-proven, confirm live)
- [ ] Test driver sees **only their own** assigned rides; not Driver B's.
- [ ] (Verified at rules layer: 31/31 emulator cases incl. "driverA CANNOT list driverB rides", field-pinning blocks `paymentStatus`/`driver`/`ownerId`.) Confirm live behavior matches.
- [ ] Offer **pool** (`rideNotifications` new/accepted) is intentionally visible to eligible drivers until claimed — that is correct, not a leak.
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## J. Michael unified owner portal still works (no regression — critical)
- [ ] `mobile-barber/dashboard.html?id=michael-nguyen-oc` loads in **owner mode**.
- [ ] **Barber** bookings load (by `vendorId`).
- [ ] **Ride** bookings load (by `ownerId`) — these would break if the `isPortalVendorUser` rule branch were wrong.
- [ ] **Tour** bookings load (by `ownerId`), including any legacy ones (compat scan).
- [ ] Owner notifications + unified counters + booking list all populate; status updates route correctly.
- Result: ⬜ PASS ⬜ FAIL — notes: __________

## K. Customer flows not broken (spot check)
- [ ] A customer can still **create** a ride/airport/tour booking (anonymous).
- [ ] The **tracking** page still loads a booking by id.
- Result: ⬜ PASS ⬜ FAIL — notes: __________

---

## Ride Pricing Audit — confirmation
**✅ Confirmed: NO-GO. Do NOT launch / advertise with current ride pricing.**
- Current pricing is uncompetitive on all 13 audited routes (off-peak ≈ +26% to +420% vs UberX), catastrophically so on short rides (San Jose→SJC, Westminster/Garden Grove→SNA ≈ 4–5× Uber) due to the flat $100/$120/$140 minimum; Bay Area solo riders are charged Sienna (7-seat) rates; **no shared-ride discount exists**; Irvine→LAX is even slightly below cost.
- This is **independent of the portal work** — the portal can ship; **pricing must be restructured first** (graduated minimums, Bay sedan tier, 35% shared-ride discount, recalibrated rates) per `docs/ride_pricing_competitiveness_audit.md`. Until then, do not position DuLichCali on price; lead with the fixed no-surge guarantee + Vietnamese drivers + scheduling.

---

## Deploy gate (only on your explicit approval; NOTHING done yet)
1. ⬜ `firebase deploy --only firestore:rules` → verify isolation live (drivers, Michael, customer).
2. ⬜ `firebase deploy --only functions:sendDriverRidePush` → confirm `VAPID_PRIVATE_KEY` secret is set (already used by Mobile Barber); test a push.
3. ⬜ `firebase deploy --only hosting` — **HOLD until you approve** (do all 9 sections PASS first; prefer preview-channel testing before this).
4. ⬜ `git push origin feat/unified-vendor-portal` → PR — **only after live iPhone testing passes.**

Verify after each prod deploy by curling a changed file; finish with `✔ Production domain updated — https://www.dulichcali21.com`.

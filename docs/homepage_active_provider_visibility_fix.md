# Homepage — Inactive / Closed Provider Visibility Fix

**Date:** 2026-05-27
**Status:** ✅ Shipped to production
**Customer-reported bug:** screenshot of `www.dulichcali21.com` showed two `CLOSED` salon cards (Beauty Hair OC + Beauty Nails OC) visible in the "Featured in Orange County" panel.

---

## Root cause (three compounding bugs in `script.js`)

| # | Location | Bug |
|---|---|---|
| 1 | `renderHomepageVendors()` line ~1842 (Firestore branch) | Hardcoded `active: true` on every assembled vendor — **discarded the doc's actual `active` flag**, defeating every downstream filter that checked `b.active`. |
| 2 | Render pipeline | Vendors currently **outside business hours** (`computeBizAvailability()` → `'closed'`) were rendered with a CLOSED badge instead of being filtered out. |
| 3 | Empty-list path | When zero vendors remained, the section showed a placeholder `<p>Coming soon in this area ✦</p>` instead of hiding entirely. The spec calls for the whole category card to vanish. |

---

## Fix

### `script.js`

1. **Preserve the Firestore active flag** — `active: data.active !== false` (was `active: true`).
2. **Hard active-check before assembly** — `if (data.active === false || data.disabled === true) return;` skips inactive vendors before they even enter the candidate list (belt-and-suspenders).
3. **New helper: `_filterPubliclyVisibleVendors(vendors)`** runs at the render boundary:
   - Drops vendors with `active === false`, `disabled === true`, or `status === 'inactive'`.
   - Drops vendors whose live `computeBizAvailability().status === 'closed'`.
   - Marketplace homepage entries (Mobile Barber region cards) pass through unconditionally — they're always-available routing placeholders with no business hours.
4. **Empty list → hide section** — `section.hidden = true` and `container.innerHTML = ''`, NO more "Coming soon" filler. Renderer also re-shows the section (`section.hidden = false`) when vendors are present, so adding a vendor in the admin makes it reappear on next reload.
5. Exposed `window._filterPubliclyVisibleVendors` for tests + future reuse.

### Cache busted
- `index.html` → `script.js?v=20260527m` (was `v=20260526b`).

---

## Tests added

`tests/lib/homepage-visibility.js` (9 source-pattern assertions, all passing):

| # | Assertion |
|---|---|
| 1 | `_filterPubliclyVisibleVendors` exists in `script.js` + is exported on `window` |
| 2 | Inactive `active === false` branch present |
| 3 | `status === 'inactive'` branch present |
| 4 | `availabilityStatus === 'closed'` branch present |
| 5 | Marketplace entries bypass the closed check |
| 6 | Renderer applies the filter AND sets `section.hidden = true` on empty list |
| 7 | Firestore vendor assembly preserves `data.active` (regression guard against the hardcoded `active:true`) |
| 8 | Hard active-check in the Firestore loop |
| 9 | Mobile Barber region cards still carry `availabilityStatus: 'now'` so they survive the filter |

### Full test sweep (after the fix)

```
$ node tests/lib/homepage-visibility.js
Homepage visibility tests: 9 passed, 0 failed

$ node tests/lib/mobile-barber-data-model.js     # 13 passed, 0 failed
$ node tests/lib/mobile-barber-agent.js          # 31 passed, 0 failed
$ node tests/lib/mobile-barber-booking.js        # 30 passed, 0 failed
$ node -e "...mobile-barber-landing..."          # PASS 35 / FAIL 0
$ scripts/ai/full_system_dry_run.sh              # FINAL: PASS
```

---

## What the customer sees now

### Before (live screenshot at start of this fix):

```
Featured in Orange County
  Cơm Tấm Dì Tám            [OPEN NOW]
  Michael Mobile Barber OC  [BOOK NOW]
  Beauty Hair OC            [CLOSED]   ← visible bug
  Beauty Nails OC           [CLOSED]   ← visible bug
  Cali Hair & Beauty        [OPEN NOW]
```

### After deploy:

```
Featured in Orange County
  Cơm Tấm Dì Tám            [OPEN NOW]
  Michael Mobile Barber OC  [BOOK NOW]
  Cali Hair & Beauty        [OPEN NOW]
```

If *all* vendors in OC become inactive/closed, the entire "Featured in Orange County" section disappears (no "Coming soon" filler).

---

## Smoke-test instructions

1. Hard-refresh `https://www.dulichcali21.com/` (Cmd-Shift-R).
2. Scroll to **Featured in Orange County** — only `OPEN NOW` / `BOOK NOW` cards should appear. No `CLOSED` cards.
3. Toggle Beauty Hair OC's `adminStatus` or `active` to `false` in `admin.html` (or directly in Firestore) → reload homepage → that card is gone.
4. Toggle BOTH Michael and Tim Mobile Barber to inactive → reload → the Mobile Barber region cards are gone from the homepage.
5. Toggle them back → cards return.
6. Confirm `/admin.html`, `/vendor-admin.html`, `/driver-admin.html`, and direct vendor URLs still show inactive vendors (admin-side management is untouched).

---

## Production deploy verification

```
$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete

$ curl -sL "https://www.dulichcali21.com/" | grep "script.js?v="
  <script src="script.js?v=20260527m" defer>

$ curl -sL "https://www.dulichcali21.com/script.js?v=20260527m" \
    | grep -E "_filterPubliclyVisibleVendors|active: data.active !== false|section.hidden = true"
  function _filterPubliclyVisibleVendors(vendors) {
        active: data.active !== false
        section.hidden = true;
  vendors = _filterPubliclyVisibleVendors(vendors);
        window._filterPubliclyVisibleVendors = _filterPubliclyVisibleVendors;
```

✔ Production updated — https://www.dulichcali21.com

---

## DO NOT BREAK — verified intact

- Direct vendor admin URLs (`/mobile-barber/dashboard.html?id=…`, `/salon-admin.html?id=…`, `/driver-admin.html`, `/vendor-admin.html`, `/admin.html`) — untouched
- Inactive vendor management in admin / vendor portals — untouched (admin pages don't go through `_filterPubliclyVisibleVendors`)
- Existing active vendor / driver / service display — passes the filter unchanged
- Firestore rules — no changes
- Marketplace routing — no changes
- All prior shipped features (Mobile Barber preferred-barber dropdown, Cash/Zelle payments, AI haircut preview, etc.) — no changes

---

## Scope notes / remaining work

1. **This fix targets the homepage marketplace panel** (the `Featured in <region>` cards) which is where the customer-reported bug surfaced.
2. **Other homepage sections** (Tour & Travel, Airport & Private Rides) already had their own active-filtering paths: travel filters via `DLC_TRAVEL_PACKAGES.filter(p => p.active !== false)`, airport tiles are static. They were not affected by the bug.
3. **Driver visibility (Airport/Ride)** uses a separate path: `_availableDrivers` already filters on `adminStatus === 'active'` + `complianceStatus === 'approved'`. No change needed.
4. **`/mobile-barber` landing** already filters `DATA.sampleVendors.filter(v => v.active !== false)` everywhere — its coverage-card render path was already correct.

If the user encounters additional surfaces where inactive providers leak through (e.g. category-specific listing pages under `/nailsalon/`, `/hairsalon/`, `/foods/`), the same `_filterPubliclyVisibleVendors` helper is now exported on `window` and can be reused with a single line of code there.

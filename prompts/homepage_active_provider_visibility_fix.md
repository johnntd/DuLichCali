# Homepage — Hide inactive vendors / drivers / services

**Critical visibility fix.**

`www.dulichcali21.com` still displays inactive services, vendors, and drivers on the public homepage. This violates the project's business rule: **inactive providers must not appear on customer-facing surfaces**.

---

## Business rule

If a vendor, driver, or service is inactive, it MUST NOT appear on the public homepage or any customer-facing public page.

If an area or category has zero active providers, **the entire category card** must be hidden from the homepage — do not render an empty category.

---

## Examples

| Situation | Public homepage behavior |
|---|---|
| All barber vendors inactive | Hide the Mobile Barber card/section entirely |
| No active drivers in OC | Hide the ride/airport option for that area |
| Salon vendor `active: false` | Hide that salon listing/card |
| Food vendor `active: false` | Hide that food listing/card |
| Every vendor in a category is inactive | Hide the whole category card |
| At least one active vendor in a category | Show the category card |

---

## Data invariant

- Do NOT delete inactive records.
- Inactive records remain reachable through admin/vendor portals for management.
- Filter happens at **render time** on customer pages only.

---

## Required logic

1. Audit each homepage data source.
2. Find every place homepage services / vendors / drivers are rendered.
3. Add active filtering at the render boundary:
   - `vendor.active === true`
   - `driver.active === true`
   - `service.active === true`
   - `status !== 'inactive'`
   - `disabled !== true`
4. A category/service card renders **only** if at least one active provider exists (either in the customer's service area OR globally if no region filter applies).
5. If no active provider exists, hide the card completely.
6. Do NOT show "coming soon" placeholders unless a setting explicitly opts in.
7. Do NOT hardcode this to Mobile Barber only — apply to every homepage category.

---

## Routes to verify

- `/` (homepage)
- `/mobile-barber` (marketplace landing)
- Salon / vendor listings (nailsalon, hairsalon — directory and homepage cards)
- Ride / airport listings (driver availability)
- Food listings
- Travel / service sections

For each route, customer should never see an inactive provider or an empty category.

---

## DO NOT BREAK

- Direct vendor admin URLs (e.g. `/mobile-barber/dashboard.html?id=…`, `/salon-admin.html?id=…`)
- Inactive vendor management in admin / vendor portals
- Inactive driver management in `driver-admin.html` / `admin.html`
- Existing active vendor / driver / service display
- Existing Firestore rules
- Existing marketplace routing

---

## Audit targets (start here, expand as needed)

- `index.html` + `script.js` homepage rendering:
  - `HOMEPAGE_MARKETPLACE_ENTRIES` (already region-filtered, but check `active` flag)
  - `_withHomepageMarketplaceEntries()` / `_isVendorActive()`
  - Marketplace panel render
  - Airport & Ride panel render (needs to check driver count via `complianceStatus === 'approved'` + `adminStatus === 'active'`)
  - Tour & Travel panel render
- `/mobile-barber/mobile-barber.js` coverage cards (already vendor-filtered, but verify `active` flag)
- `marketplace/marketplace.js` vendor listing
- Any rendering that pulls from `vendors`, `drivers`, `mobileBarberVendors`, or `services` collections

---

## Tests (add to `tests/lib/` — pure-data, no DOM required where possible)

1. **Inactive vendor hidden from homepage** — HOMEPAGE_MARKETPLACE_ENTRIES filter respects `active: false`
2. **Inactive driver hidden from homepage** — Airport/Ride panel hides when no drivers are `complianceStatus === 'approved' && adminStatus === 'active'`
3. **Category with zero active vendors → category hidden** — Mobile Barber section disappears when both Michael + Tim are deactivated
4. **Category with one active vendor → category visible** — Mobile Barber section appears when Michael is active even if Tim is not
5. **Active Mobile Barber visible only if Michael OR Tim active** — same as 3 + 4
6. **Inactive Mobile Barber hidden if all barbers inactive** — explicit, covers the all-off case
7. **Existing active services still display** — regression guard for nail / hair / food

---

## Report

Write to `docs/homepage_active_provider_visibility_fix.md`:

- **Before** — list of every customer surface that displayed an inactive provider, with file + line
- **After** — the filter function(s) added/changed
- **Test additions** (the 7 above) with one-line each summary
- **Smoke-test instructions** for the user (toggle Michael active → reload homepage → Mobile Barber card hides)
- **Production deploy confirmation** (curl version strings)
- **Remaining risks**

PASS only if:
- Public homepage does NOT display inactive vendors / drivers / services
- Categories with zero active providers are hidden entirely
- Active provider categories continue to render
- Direct vendor admin URLs continue to work for inactive providers
- No data deleted, no rules changed, no admin tools degraded

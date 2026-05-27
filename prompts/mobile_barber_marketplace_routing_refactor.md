# Mobile Barber — Marketplace Routing Refactor

Use **ui-ux-pro-max + architecture review**.

We are moving Mobile Barber away from per-vendor customer landing pages to a single **marketplace routing** model. The customer never picks a barber by name — they describe what they need, the AI engine routes them to the right available vendor, and a booking is created against that vendor.

Vendor portals (admin/dashboard surfaces) stay exactly as they are today. Only the **customer-facing journey** changes.

---

## Current state (to remove from customer flow)

Today there are individual customer-facing vendor landing pages:

- `/mobile-barber/vendor/michael-nguyen-oc`
- `/mobile-barber/vendor/tim-nguyen-bay`

This is redundant. Customers should not need to browse individual barbers.

---

## New customer flow (target)

```
www.dulichcali21.com/mobile-barber
        ↓
  "Find My Barber" (city OR ZIP)
        ↓
  AI booking assistant (chat or voice)
        ↓
  Auto routing engine
        ↓
  Booking created
        ↓
  Customer sees: "Your barber is Michael / Tim"
```

The customer never lands on a barber-specific page. The barber name only appears in the booking confirmation after the AI routes them.

---

## Vendor portals — KEEP UNCHANGED

These are admin/operator surfaces and must continue to work:

- `/mobile-barber/dashboard.html?id=michael-nguyen-oc`
- `/mobile-barber/dashboard.html?id=tim-nguyen-bay`
- All future vendors inherit the same pattern.

Vendor login flow via `vendor-login.html?id=<vendorId>` continues unchanged.

---

## Customer-facing vendor pages — make optional / hidden

Keep the route handlers for `/mobile-barber/vendor/<vendorId>` functional so that:

- SEO / direct ads can still link to them
- Debugging / preview is still possible
- A future "view profile" CTA can be added back

But:

- **Remove every customer-facing link** to these pages from the homepage, marketplace listing, navigation, talk-to-agent screens, and the Mobile Barber landing.
- **Do not redirect customers** to these pages from the marketplace landing or from the AI agent. The talk-to-agent flow must stay on `/mobile-barber` (or the chat UI) and not navigate away.

---

## Auto-routing engine

The AI agent (and the Find-My-Barber form) must route to a barber automatically using all of:

- ZIP
- City
- `serviceAreas` on each vendor
- `travelRadiusMiles`
- Language preference (vi / en / es)
- Real availability (open hours, blocks, existing bookings, cleanup + travel buffers)
- Workload / pending bookings
- `vendor.active === true` AND `adminStatus === 'active'`
- Repeat-customer preferred barber (if `customers.lastVendorId` is set, prefer that vendor when available)

### Worked examples

| Inputs | Route to |
|---|---|
| San Jose / 95121 / kids haircut / Vietnamese | **Tim** |
| Garden Grove / fade haircut | **Michael** |
| Westminster / classic mobile cut | **Michael** |
| Santa Clara / beard trim / Vietnamese | **Tim** |
| Out of both vendors' service areas | **No barber available → out-of-range message + waitlist capture** |

### Customer override

If the customer explicitly asks for a vendor by name ("I want Michael", "with Tim"), the agent honors that **if** the vendor's service area covers the address. Otherwise it explains the area constraint and asks if the customer is OK with the auto-routed barber.

---

## Landing page (`/mobile-barber`) — changes

- Keep the hero, the carousel, the trust chips, the city/ZIP gate, and the AI/voice CTAs.
- The two vendor showcase cards (currently "Michael Mobile Barber OC" / "Tim Mobile Barber Bay Area") become **service showcase cards** instead — e.g., "Orange County coverage" / "Bay Area coverage" or featured style cards — and they no longer link to `/mobile-barber/vendor/...`.
- Replace any "Open Michael's page" / "Open Tim's page" CTAs with:
  - **Find My Barber** (current city/ZIP gate)
  - **Talk to AI** (chat)
  - **Book now** (voice or chat)

### Homepage marketplace cards (`script.js` → `HOMEPAGE_MARKETPLACE_ENTRIES`)

Currently the homepage shows region-scoped Michael and Tim cards that link directly to `/mobile-barber/vendor/...`. Update to:

- One unified "Mobile Barber — Find My Barber" card whose `href` is `/mobile-barber`, OR
- Two region-scoped cards whose `href` is `/mobile-barber?region=oc` (and `?region=bayarea`) so the city/ZIP gate is pre-filled but the customer still lands on the marketplace, not on a vendor page.

Pick the cleaner option. Either way: **no homepage card may link to `/mobile-barber/vendor/...`** for customer traffic.

---

## Booking flow (target, unchanged from today except the routing step)

1. Phone → customer lookup
2. Service
3. Address (city + ZIP)
4. **Auto-route to vendor** (new — formal step)
5. Availability check against that vendor
6. Confirm
7. Create booking under the routed `vendorId`

The shared `findVendorForAddress()` / `routeByLocation()` logic that already exists in `mobile-barber-booking.js` and `mobile-barber.js` is the canonical router. Both the chat AI agent and the Find-My-Barber form must use the same router. No bespoke routing logic anywhere else.

---

## Vendor side — UNCHANGED

- Vendor dashboard, appointments, schedule, history, notifications, voice mode, payment marking.
- Vendor portal redirect from `vendor-admin.html` for `category === 'mobile_barber'` continues to route to `/mobile-barber/dashboard.html?id=<id>`.

---

## DO NOT BREAK

- Booking DB writes (Firestore `mobileBarberBookings` rules + statuses)
- Vendor portal login (`vendor-login.html`) + dashboard
- AI booking flow (`mobile-barber-agent.js` STATE machine)
- Voice booking (`mobile-barber-voice.js`, OpenAI/Gemini chain)
- Gemini Vietnamese voice
- Customer history (`mobileBarberCustomers` lookups)
- Strict service-area enforcement (`service_area_out_of_range`)
- Distance Matrix pricing + travel-fee calc
- The compact list-row vendor dashboard that just shipped

---

## Audit — places to inspect

- `mobile-barber/mobile-barber.js` — Find-My-Barber form, `routeByLocation()`, vendor showcase cards
- `mobile-barber/mobile-barber-agent.js` — agent routing, any vendor-link emissions in `replyTemplate`
- `mobile-barber/mobile-barber-booking.js` — `findVendorForAddress()`, vendor switching logic
- `mobile-barber/mobile-barber-vendor.js` — the vendor customer page (keep route alive but not linked)
- `mobile-barber/index.html` — landing hero, CTAs, marketplace cards, footer links
- `mobile-barber/vendor.html` — keep the page (SEO/ads), but it must not link back to itself from the marketplace or homepage
- `script.js` — `HOMEPAGE_MARKETPLACE_ENTRIES` for `mobile-barber-*` entries
- Any anchor whose `href` contains `/mobile-barber/vendor/`

---

## Tests

### Customer

- Mobile barber landing loads at `/mobile-barber`, no "Open Michael" / "Open Tim" links visible
- Find-My-Barber with San Jose 95121 → AI introduces Tim only after first message
- Find-My-Barber with Garden Grove → AI introduces Michael only after first message
- "I want Michael" while entering Westminster ZIP → routes to Michael
- "I want Tim" while entering Santa Clara → routes to Tim
- Out-of-area ZIP → service-area refusal + waitlist
- Repeat customer (matching `customers.lastVendorId`) → routed to that vendor when in area
- Direct visit to `/mobile-barber/vendor/michael-nguyen-oc` still renders (SEO preserved)

### Vendor

- `vendor-login.html?id=michael-nguyen-oc` still logs in
- `dashboard.html?id=michael-nguyen-oc` still renders compact list rows + stats
- Realtime booking alert still fires when a marketplace booking is routed to that vendor

### Tests to run

```
node tests/lib/mobile-barber-data-model.js
node tests/lib/mobile-barber-agent.js
scripts/ai/targeted_dry_run.sh booking
```

All must pass.

---

## Report

Write to `docs/mobile_barber_marketplace_routing_refactor.md`:

- **Before / after customer flow** diagrams (text-based is fine)
- **Routing examples** (each example above with the expected resolved vendor)
- **List of removed customer-facing links** (file + line)
- **List of preserved routes** (`/mobile-barber/vendor/...` still functional)
- **Vendor portal verification** (still works)
- **Test results** (pasted summary lines)
- **Production deploy confirmation** (`firebase deploy --only hosting` output, curled version strings)
- **Remaining risks**

PASS only if:
- Customer flow lands on `/mobile-barber` and never lands on a vendor page through navigation
- Vendor pages still render at their old URLs for SEO / direct links
- AI routing assigns the correct vendor for each worked example
- Vendor portal (dashboard.html + vendor-login.html) is unaffected
- All tests pass
- Production at `https://www.dulichcali21.com/mobile-barber` shows the new marketplace-only landing

# Mobile Barber — Vendor Portal Settings Refactor

**Date:** 2026-05-27
**Status:** ✅ Shipped to production (`https://www.dulichcali21.com/mobile-barber/dashboard.html`)
**Skill used:** `ui-ux-pro-max` (design-system search: data-dense dashboard + FAQ accordion)

---

## Goal

Make the **vendor portal feel like an appointment center, not an admin form
factory.** The previous layout interleaved three rows of management forms
(Profile, Services, Hours, Blocks, Portfolio, Reviews) immediately below the
booking lists, so daily operators scrolled past hundreds of lines of config
controls every time they checked today's schedule.

Reorganize: keep all functionality, push the six management areas into a
single collapsed-by-default **Settings** section with accordion panels.
Customer-facing landing untouched.

---

## Before / after layout

### Before

```
[ Notifications panel ]
[ 3-cell stats row (today / upcoming / pending) ]

[ TODAY appointments | PENDING appointments ]        ← 2-col grid
[ UPCOMING appointments (full width) ]

[ PROFILE form          | SERVICES form ]            ← 2-col grid (always visible)
[ WORKING HOURS         | UNAVAILABLE BLOCKS ]       ← 2-col grid (always visible)
[ PORTFOLIO UPLOAD      | REVIEWS & RESPONSES ]      ← 2-col grid (always visible)
```

Three management grids = ~450 lines of DOM expanded at all times, even when
the operator just wanted to glance at today's schedule on a phone.

### After

```
[ Notifications panel ]
[ 5-cell stats row (today / upcoming / pending / in-progress / completed) ]

[ TODAY appointments | PENDING appointments ]
[ UPCOMING appointments (full width) ]

──── Settings ──────────────────────────────────
[ ▸ Profile & contact ]            collapsed
[ ▸ Services & pricing ]           collapsed
[ ▸ Working hours ]                collapsed
[ ▸ Unavailable blocks ]           collapsed
[ ▸ Portfolio images ]             collapsed
[ ▸ Reviews & responses ]          collapsed
```

The six management panels are now a single `<section class="mb-settings-section">`
with six `<details>` elements (native browser accordions — zero JS, fully
keyboard accessible, focus-visible ring, prefers-reduced-motion respected).

At ≥1200px the settings grid switches to two columns so operators can
expand and edit two related panels (e.g. Hours + Blocks, or Profile +
Services) side-by-side without a long vertical scroll.

---

## What stayed visible (appointment focus)

- Notifications + sound-alert toggle
- 5-cell summary counters (Today / Upcoming / Pending / In progress / Completed today)
- **Today's appointments** panel
- **Pending confirmations** panel
- **Upcoming bookings** panel with filter chips (Upcoming / All / Completed / Cancelled)
- Compact list-row + click-to-expand detail panel (shipped in prior cycle)
- All quick-actions on each row: Accept / Reject / Reschedule / Mark paid / Mark unpaid / Cash / Zelle / Payment note / Map link

---

## What moved into Settings

| # | Panel | Settings ID | Inner form / list IDs (preserved) |
|---|---|---|---|
| 1 | Profile & contact | `mbSettingsProfile` | `mbProfileForm`, `mbDashBusinessName`, `mbDashBarberName`, `mbDashPhone`, `mbDashEmail`, `mbDashServiceAreas`, `mbDashTravelRadius`, `mbDashTravelFee` |
| 2 | Services & pricing | `mbSettingsServices` | `mbServiceForm`, `mbDashServiceSelect`, `mbDashServiceName`, `mbDashServicePrice`, `mbDashServiceDuration`, `mbDashCleanupBuffer`, `mbDashTravelBuffer`, `mbServicesManageList` |
| 3 | Working hours | `mbSettingsHours` | `mbHoursGrid` |
| 4 | Unavailable blocks | `mbSettingsBlocks` | `mbBlockForm`, `mbBlockDate`, `mbBlockStart`, `mbBlockEnd`, `mbBlockReason`, `mbBlocksList` |
| 5 | Portfolio images | `mbSettingsPortfolio` | `mbPortfolioForm`, `mbPortfolioTitleInput`, `mbPortfolioDescription`, `mbPortfolioOrder`, `mbPortfolioUpload`, `mbPortfolioBeforeUpload`, `mbPortfolioAfterUpload`, `mbPortfolioManageList` |
| 6 | Reviews & responses | `mbSettingsReviews` | `mbReviewsManageList` |

Every existing JS hook (`saveProfile`, `saveService`, `saveHours`, `addBlock`,
`addPortfolio`, `saveReviewResponses`, the file-upload handlers, the list
renderers) binds by ID. **No JS changes were required** — `<details>` lazily
shows/hides the children but never removes them from the DOM, so
`document.getElementById('mbProfileForm')` still resolves, file inputs still
upload, and `renderHours()` / `renderBlocks()` / `renderPortfolio()` /
`renderReviews()` continue to populate their containers whether the
accordion is open or closed.

---

## Accordion UX rules (matches the design brief)

- **Collapsed by default** — `<details>` without the `open` attribute. The
  operator opens only the panel they need.
- **Native accordion** — `<details>` + `<summary>`. No tabindex hacks, no JS
  expand/collapse state to track.
- **Edit/save inside each panel** — every panel keeps its own "Save" /
  "Add" CTA inside the body. No global "Save settings" megabutton.
- **Mobile-friendly** — single column at base, ≥56px tap target on each
  summary row, no horizontal scroll, no nested scrollbars.
- **Desktop two-column** — `@media (min-width: 1200px) .mb-settings-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr)); }` so panels open in
  pairs without consuming vertical space.
- **Focus + reduced motion** — `:focus-visible` shows the gold outline ring;
  `@media (prefers-reduced-motion: reduce)` strips the chevron rotate +
  open transition.
- **Smooth open animation** — uses `interpolate-size: allow-keywords` +
  `::details-content` behind `@supports`, which gracefully degrades to an
  instant open on browsers without that feature.

---

## i18n keys added (en / vi / es)

| Key | EN | VI | ES |
|---|---|---|---|
| `settingsTitle` | Settings | Cài đặt | Ajustes |
| `settingsHint` | Profile, services, hours, blocks, portfolio, and reviews. Tap a panel to expand. | Hồ sơ, dịch vụ, giờ làm, ngày nghỉ, portfolio, và đánh giá. Bấm vào từng mục để mở rộng. | Perfil, servicios, horario, bloques, portafolio y reseñas. Toca un panel para expandir. |
| `settingsProfileTitle` / `settingsProfileSub` | Profile & contact / Business name, barber, phone, email, service area | Hồ sơ & liên hệ / Tên tiệm, thợ, số điện thoại, email, khu vực phục vụ | Perfil y contacto / Nombre del negocio, barbero, teléfono, correo, área de servicio |
| `settingsServicesTitle` / `settingsServicesSub` | Services & pricing / Service menu, prices, durations, buffers | Dịch vụ & giá / Danh mục dịch vụ, giá, thời lượng, thời gian đệm | Servicios y precios / Menú de servicios, precios, duración, márgenes |
| `settingsHoursTitle` / `settingsHoursSub` | Working hours / Recurring weekly schedule | Giờ làm việc / Lịch hàng tuần lặp lại | Horario de trabajo / Horario semanal recurrente |
| `settingsBlocksTitle` / `settingsBlocksSub` | Unavailable blocks / Days off, time off, vacation | Khoảng thời gian không nhận lịch / Ngày nghỉ, giờ nghỉ, kỳ nghỉ | Bloques no disponibles / Días libres, tiempo libre, vacaciones |
| `settingsPortfolioTitle` / `settingsPortfolioSub` | Portfolio images / Photos shown on the public vendor page | Hình portfolio / Hình hiển thị trên trang vendor | Imágenes del portafolio / Fotos mostradas en la página pública del barbero |
| `settingsReviewsTitle` / `settingsReviewsSub` | Reviews & responses / Customer reviews and your replies | Đánh giá & phản hồi / Đánh giá khách và phản hồi của bạn | Reseñas y respuestas / Reseñas de clientes y tus respuestas |

---

## Files changed

```
 mobile-barber/dashboard.html             | ~ +100 / -90   (3 grids -> 1 settings section + 6 details)
 mobile-barber/mobile-barber-dashboard.js |   +45          (settings* i18n keys in en/vi/es)
 mobile-barber/mobile-barber.css          |  +143          (settings accordion styles)
 mobile-barber/index.html                 |    1 line      (css version bump)
 mobile-barber/vendor.html                |    1 line      (css version bump)
 tests/lib/mobile-barber-landing.js       |    4 lines     (version asserts)
```

---

## Tests

```
$ node tests/lib/mobile-barber-data-model.js
Mobile Barber data model tests: 12 passed, 0 failed

$ node tests/lib/mobile-barber-agent.js
Mobile Barber agent tests: 29 passed, 0 failed

$ node tests/lib/mobile-barber-landing.js (via runner)
PASS 35 / FAIL 0

$ scripts/ai/full_system_dry_run.sh
FINAL: PASS
```

---

## Production deploy verification

```
$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete

$ curl -sL "https://www.dulichcali21.com/mobile-barber/dashboard.html" \
    | grep -E "mb-settings-section|v=20260527"
  <link rel="stylesheet" href="/mobile-barber/mobile-barber.css?v=20260527b">
    <section class="mb-settings-section" id="mbSettingsSection" aria-labelledby="mbSettingsTitle">
      <header class="mb-settings-section__head">
        <h2 id="mbSettingsTitle" data-i18n="settingsTitle"></h2>
        <p class="mb-settings-section__hint" data-i18n="settingsHint"></p>
  <script src="/mobile-barber/mobile-barber-dashboard.js?v=20260527a"></script>
```

✔ Production updated — https://www.dulichcali21.com

---

## What did NOT change (per spec)

- Customer landing (`/mobile-barber`) — untouched
- Customer vendor page (`/mobile-barber/vendor/...`) — untouched
- Booking DB (Firestore `mobileBarberBookings` rules + statuses) — untouched
- Appointment status update actions (Accept / Reject / Reschedule / Mark paid / etc.) — untouched
- Service editor, working-hours editor, blocks editor, portfolio uploader, review responses — same forms, same JS, same Firestore writes
- AI routing engine (`BOOKING.findVendorForAddress`) — untouched
- Voice mode, Gemini Vietnamese voice — untouched

---

## Remaining risks

1. **First-time discoverability** — accordion is collapsed by default. New
   vendors might not realize where to find Profile / Hours editors. Mitigated
   by the `settingsHint` subline directly under the "Settings" header and by
   the per-panel subtitle that summarizes what each panel contains. Could be
   improved with a one-time toast or a pulsing dot on the first visit.
2. **Two-column desktop** kicks in at 1200px. On 1024-px tablets the panels
   stack single-column, which is the right call for tap targets but means
   editing Hours + Blocks side-by-side requires desktop.
3. **`<details>` open state is not persisted** across page reloads. If an
   operator was mid-edit on Portfolio and refreshed, they'd land collapsed.
   Acceptable trade-off; sessionStorage persistence is a clean follow-up if
   needed.
4. **Native `<details>` animation** is browser-dependent — modern Chrome,
   Edge, and Safari 18+ animate the open/close; older Safari snaps. Function
   is identical either way.

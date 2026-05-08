# Nail Salon AI OS Phase 0 Audit

## Executive Summary

This Phase 0 audit reviewed the current nail salon implementation for the planned vendor-agnostic Nail Salon AI OS. The existing salon experience already has a strong appointment foundation: vendor detail pages, Firestore-backed service/staff loading, direct AI receptionist booking, customer memory lookup, voice mode, reference image upload, notification records, optional confirmation email, and vendor admin status updates.

The new Nail Salon AI OS is mostly new work. There is no nail inventory model, no supplier model, no service-to-material mapping, no cost/margin model, no low-stock automation, and no appointment-completion hook that deducts inventory. Existing product concepts in the repo are food marketplace products and vendor menu items, not salon consumables.

The safest implementation path is to add vendor-scoped subcollections under `vendors/{vendorId}` and attach inventory deduction only to explicit appointment completion transitions. All modules must accept `vendorId` as input and must not hardcode `luxurious-nails`.

## Current State

### 1. Service Catalog Structure

What exists:
- Nail services are statically defined in `marketplace/services-data.js` under `window.MARKETPLACE.businesses`.
- Current nail service fields include `category`, `name`, `price`, `priceFrom`, `duration`, `durationMins`, `active`, `assignedStaff`, `imageUrl`, and `desc`.
- `luxurious-nails` has a full static catalog with services inactive by default.
- `beauty-nails-oc` has the same general nail catalog shape with selected active services and prices.
- `marketplace/marketplace.js` loads live `vendors/{vendorId}/services` where `active == true` and keeps static services as `_staticServices` fallback knowledge.
- `nailsalon/receptionist.js` builds AI service context from active services, then falls back to static catalog if no active services are loaded.

What is missing:
- No material or product inventory list for nail supplies.
- No service-to-material usage mapping.
- No per-service cost or margin fields.
- No units-of-measure model for consumables.
- No service variant model for color, finish, design complexity, product brand, or add-on material load.

Risks:
- Static and Firestore service catalogs can diverge.
- Existing service IDs are not consistently explicit; service names are used heavily. Inventory mapping should use stable service document IDs plus service name snapshots.
- `price` is a display string while `priceFrom` is numeric. Margin calculations need numeric canonical pricing.

### 2. Booking + Appointment Lifecycle

What exists:
- Manual nail booking form in `marketplace/marketplace.js` writes an `escalations/{escId}` document with `status: pending_vendor_response`; it does not directly create a booking.
- AI direct booking in `nailsalon/receptionist.js` writes directly to `vendors/{vendorId}/bookings/{bookingId}` with `status: confirmed`.
- AI booking fields include `bookingId`, `type: nail_appointment`, `vendorId`, `services`, `selectedServices`, `serviceType`, `staff`, `requestedDate`, `requestedTime`, `durationMins`, `priceEst`, `customerName`, `customerPhone`, aliases `name` and `phone`, `notes`, `lang`, `status`, `isReschedule`, `source`, and `createdAt`.
- Reschedules update the existing booking in place when an exact booking ID is known; fallback reschedules mark prior confirmed bookings as `rescheduled` and create a new booking.
- Vendor admin listens to `vendors/{vendorId}/bookings` and lets staff move records through statuses such as `pending`, `confirmed`, `preparing`, `completed`, `cancelled`, and `no_show`.
- Inbound email replies can set statuses `confirmed_by_customer`, `cancelled_by_customer`, and `reschedule_requested`.
- Availability checking treats `confirmed` and `in_progress` as hard conflicts. It also considers pending escalations.

What is missing:
- No dedicated appointment completion event or Cloud Function trigger for salon bookings.
- No idempotent inventory deduction marker on bookings.
- No completed-at timestamp in the generic `setOrderStatus()` path.
- No distinction between completed food orders and completed salon appointments in the generic status update helper.
- No explicit booking material snapshot.

Risks:
- If inventory deduction keys only off `status == completed`, repeated status writes or status toggles can double-deduct without an idempotency guard.
- AI-created bookings are immediately `confirmed`, while manual form bookings enter `escalations`; future completion hooks must support both once they become booking docs.
- Vendor admin uses generic names like orders/preparing that are food-oriented but also render appointment cards.

### 3. Vendor Data Model

What exists:
- Top-level `vendors/{vendorId}` documents are publicly readable and writable only by vendor members in the explicit top-level rule.
- Explicit vendor subcollections in `firestore.rules`:
  - `vendors/{vendorId}/staff/{doc}`: public read, vendor-member write.
  - `vendors/{vendorId}/services/{doc}`: public read, vendor-member write.
  - `vendors/{vendorId}/staffCompensation/{doc}`: vendor-member read/write only.
  - `vendors/{vendorId}/payrollPeriods/{doc}`: vendor-member read/write only.
- A broad fallback rule allows any authenticated user to read/write other vendor subcollections: `vendors/{vendorId}/{sub=**}`.
- Existing vendor subcollections used by source include `bookings`, `notifications`, `emailQueue`, `inboundEmails`, `menuItems`, `staff`, `services`, `staffCompensation`, and `payrollPeriods`.
- `vendorUsers/{uid}` maps users to `vendorId` or `vendorIds`.
- Vendor docs include fields such as business/name, category/vendorType, phone, phoneDisplay, address, hero/profile fields, `smsEnabled`, and `notificationPhone`.

What is missing:
- No inventory, suppliers, service materials, restock orders, or analytics snapshot subcollections.
- No role helper beyond simple vendor membership.
- No owner-only separation for financial analytics and cost/margin data.

Risks:
- The broad fallback vendor subcollection rule is too permissive for sensitive inventory cost and supplier records because any authenticated user can access unmatched vendor subcollections.
- New AI OS rules must be explicit and placed before the fallback rule.

### 4. Vendor Admin Capabilities

What exists in `vendor-admin.html`:
- Authenticates vendor users and resolves single or multi-vendor access through `vendorUsers/{uid}`.
- Redirects nail and hair vendors to `salon-admin.html?id={vendorId}`.
- For food vendors, manages menu items in `vendors/{vendorId}/menuItems`.
- Shows orders/calendar/list views from `vendors/{vendorId}/bookings`.
- Provides status buttons for `pending`, `confirmed`, `preparing`, `completed`, `cancelled`, and `no_show`.
- Shows notifications from `vendors/{vendorId}/notifications`.
- Shows pending AI escalations from top-level `escalations`.
- Provides business profile settings, hero image, SMS settings, and plan/billing link.

What is missing:
- No inventory UI.
- No supplier UI.
- No material usage editor.
- No cost/margin dashboard.
- No low-stock dashboard.
- No restock order workflow.
- No AI pricing or upsell controls.

Risks:
- Nail/hair admin UX is effectively outside `vendor-admin.html` because salon vendors are redirected to `salon-admin.html`. Future implementation should decide whether Nail Salon AI OS lives in `salon-admin.html`, a new shared module, or both admin shells.

### 5. AI and Receptionist

What exists:
- `nailsalon/receptionist.js` is a stateful salon receptionist for nail and hair vendors.
- Uses shared `AIEngine.detectLang`, conversation history, and Claude calls.
- Maintains booking state: `intent`, `services`, `staff`, `date`, `time`, `name`, `phone`, `lang`, `pendingAction`, and `existingBookingId`.
- Validates date, time, phone, service array, language, and pending action markers.
- Checks staff schedule, closing time, named-staff conflicts, customer conflicts, pending escalations, and some parallel-service rules before confirming.
- Writes confirmed booking docs for direct AI bookings.
- Adds reference image upload after booking.
- Queues optional confirmation email.
- `customer-memory.js` looks up prior vendor bookings by normalized phone and returns name, last service, last staff, last appointment date, and vendor ID.
- `phone-intake.js` normalizes spoken phone numbers in Vietnamese, English, and Spanish.
- `voice-mode.js` provides mobile push-to-talk, STT, TTS, language controls, and shared receptionist routing.

What is missing:
- No inventory-aware AI context.
- No material availability checks before service recommendation.
- No upsell recommendation logic based on customer history, margins, or inventory.
- No cost/margin explanations.
- No nail design assistant that maps design request to services/materials.
- No AI-generated restock or supplier recommendation.

Risks:
- Adding inventory context directly into the main receptionist prompt could bloat booking-critical context and increase hallucination risk.
- Product or pricing suggestions must not auto-change public pricing or confirm unavailable materials.

### 6. SMS / Notification Layer

What exists:
- `functions/index.js` has Twilio notification infrastructure, but `SMS_ENABLED = false`.
- `onVendorNotification` triggers on `vendors/{vendorId}/notifications/{notificationId}` and would send SMS if enabled.
- It checks `vendor.smsEnabled` and `vendor.notificationPhone`.
- Vendor admin exposes SMS settings and clearly states SMS is temporarily offline.
- Browser-side vendor admin creates `sms:` links for manual text messages.
- Email confirmation is active through `vendors/{vendorId}/emailQueue` and Resend.
- Inbound email reply handling exists for CONFIRM, CANCEL, and RESCHEDULE.

What is missing:
- No customer SMS opt-in/opt-out model for marketing or retention messages.
- No salon-specific low-stock SMS notification type.
- No supplier SMS/email workflow.
- No SMS audit or consent records per recipient.

Risks:
- Twilio is intentionally disabled. Any SMS phase must preserve the kill switch and require explicit opt-in before customer marketing or retention messages.
- Existing vendor notification SMS is vendor-facing; it should not be reused for customer SMS without consent modeling.

### 7. Existing Inventory-Related Code

Search terms used: `inventory`, `stock`, `restock`, `product`, `material`, `supplier`.

What exists:
- `product` appears broadly in marketplace food ordering, vendor menu editing, AI product copy, and Remotion promo tooling.
- `stock` appears in unrelated contexts such as city names in pricing data.
- `material` appears in print/marketing text, not inventory logic.
- `supplier`, `restock`, and meaningful nail inventory usage were not found in scoped JS/HTML/CSS/rules files.
- `marketplace/services-data.js` includes salon marketing text like safe products and premium salon-quality products, but not structured consumables.

What is new work:
- All nail consumable inventory, supplier, restock, material usage, deduction, low-stock, cost, and margin logic.

Risks:
- Reusing food `products`/`menuItems` terminology for nail consumables would confuse public product sales with private operational supplies. Use `inventory` and `serviceMaterials`.

### 8. Mobile Layout

What exists:
- `nailsalon/index.html` is a small shell that loads shared marketplace CSS, desktop CSS, nail-specific CSS, and salon runtime JS.
- `nailsalon/salon.css` is explicitly mobile-first, scoped to `.mp-main--nails`, with breakpoints at `768px` and `1200px`.
- `marketplace/marketplace.css` also includes mobile-first marketplace layout, full-screen mobile AI chat behavior, mobile bottom nav, and voice mode overlay.
- Nail CSS hides generic marketplace detail layout and replaces it with stacked `ns-*` sections.

What is missing:
- No AI OS dashboard/mobile admin UI exists yet.
- No mobile inventory management patterns exist.

Risks:
- Adding admin-heavy inventory controls to the public nail page would overload customer mobile UX. AI OS controls should live in admin/vendor surfaces, with only customer-safe outputs exposed publicly.

## Gaps Identified

- No vendor-scoped inventory collection.
- No service-to-material mapping collection.
- No supplier or restock order model.
- No inventory deduction trigger on appointment completion.
- No booking idempotency fields for inventory deduction.
- No low-stock alert system.
- No AI OS dashboard, analytics snapshots, or margin calculations.
- No customer SMS consent model.
- No AI design assistant or customer-safe material availability layer.
- Firestore fallback rule is too broad for future sensitive cost/supplier data.
- Salon admin surface needs to be explicitly included in future implementation scope even though Phase 0 requested `vendor-admin.html`.

## Data Model Specification

### `vendors/{vendorId}/inventory/{productId}`

Purpose: private vendor inventory item records for nail supplies and future salon consumables.

Fields:
- `name`: string
- `sku`: string, optional
- `category`: string, e.g. `gel_polish`, `acrylic_powder`, `dip_powder`, `tips`, `rhinestones`, `liquid`, `sanitation`, `retail`
- `type`: string, e.g. `consumable`, `tool`, `retail`
- `unit`: string, e.g. `ml`, `oz`, `g`, `piece`, `set`, `bottle`
- `currentQty`: number
- `minQty`: number
- `reorderQty`: number
- `costPerUnit`: number
- `currency`: string, default `USD`
- `supplierId`: string, nullable
- `supplierSku`: string, optional
- `brand`: string, optional
- `colorName`: string, optional
- `colorCode`: string, optional
- `location`: string, optional
- `active`: boolean
- `trackStock`: boolean
- `lastCountedAt`: timestamp, optional
- `lastRestockedAt`: timestamp, optional
- `updatedAt`: timestamp
- `createdAt`: timestamp

Reads/writes:
- Vendor members only. Not public.
- Future owner-only reads may be appropriate for cost fields if role helpers are added.

### `vendors/{vendorId}/serviceMaterials/{serviceId}`

Purpose: maps a service to the materials consumed when that service is completed.

Fields:
- `serviceId`: string
- `serviceNameSnapshot`: string
- `active`: boolean
- `materials`: array of objects:
  - `productId`: string
  - `productNameSnapshot`: string
  - `qtyPerService`: number
  - `unit`: string
  - `deductMode`: string, `fixed`, `per_nail`, `per_minute`, `manual`
  - `required`: boolean
  - `allowSubstitute`: boolean
- `defaultWastePct`: number
- `notes`: string, optional
- `updatedAt`: timestamp
- `createdAt`: timestamp

Reads/writes:
- Vendor members only. Not public.

### `vendors/{vendorId}/suppliers/{supplierId}`

Purpose: vendor supplier records for restock planning.

Fields:
- `name`: string
- `contactName`: string, optional
- `phone`: string, optional
- `email`: string, optional
- `website`: string, optional
- `address`: string, optional
- `preferred`: boolean
- `leadTimeDays`: number
- `minimumOrderAmount`: number, optional
- `notes`: string, optional
- `active`: boolean
- `updatedAt`: timestamp
- `createdAt`: timestamp

Reads/writes:
- Vendor members only. Not public.

### `vendors/{vendorId}/restockOrders/{orderId}`

Purpose: restock order history and recommendations.

Fields:
- `supplierId`: string
- `supplierNameSnapshot`: string
- `status`: string, e.g. `draft`, `recommended`, `ordered`, `received`, `cancelled`
- `source`: string, e.g. `manual`, `ai_recommendation`, `low_stock_alert`
- `items`: array of objects:
  - `productId`: string
  - `productNameSnapshot`: string
  - `qty`: number
  - `unit`: string
  - `estimatedUnitCost`: number
  - `receivedQty`: number
- `estimatedTotal`: number
- `orderedAt`: timestamp, optional
- `receivedAt`: timestamp, optional
- `createdByUid`: string
- `aiRationale`: string, optional
- `updatedAt`: timestamp
- `createdAt`: timestamp

Reads/writes:
- Vendor members only. Not public.
- No auto-purchase; status `ordered` must require explicit vendor action.

### `vendors/{vendorId}/analyticsSnapshots/{snapshotId}`

Purpose: daily or weekly operational metrics.

Document ID:
- Recommended `YYYY-MM-DD` for daily snapshots and `YYYY-Www` for weekly snapshots.

Fields:
- `periodType`: string, `daily` or `weekly`
- `periodStart`: string or timestamp
- `periodEnd`: string or timestamp
- `bookingCount`: number
- `completedAppointmentCount`: number
- `cancelledAppointmentCount`: number
- `grossRevenueEstimate`: number
- `materialCostEstimate`: number
- `grossMarginEstimate`: number
- `topServices`: array
- `lowStockCount`: number
- `inventoryValueEstimate`: number
- `newCustomerCount`: number
- `returningCustomerCount`: number
- `generatedAt`: timestamp
- `source`: string, e.g. `scheduled_function`, `manual_refresh`

Reads/writes:
- Vendor members only. Not public.
- Prefer Cloud Function/Admin SDK writes for generated snapshots.

### Updated Booking Fields

Add only when implementing deduction, not in Phase 0:
- `inventoryDeductionStatus`: string, `not_applicable`, `pending`, `deducted`, `skipped`, `error`
- `inventoryDeductedAt`: timestamp, optional
- `inventoryDeductionId`: string, optional idempotency key
- `inventoryDeductionVersion`: number
- `materialsSnapshot`: array of material usage objects copied from `serviceMaterials` at completion time
- `completedAt`: timestamp
- `completedByUid`: string, optional
- `completedSource`: string, e.g. `vendor_admin`, `function`

Deduction should trigger only when an appointment transitions into `completed` and `inventoryDeductionStatus != deducted`.

### Firestore Rules Changes

Required explicit rules before `match /vendors/{vendorId}/{sub=**}`:

```js
match /vendors/{vendorId}/inventory/{doc} {
  allow read, write: if isVendorMember(vendorId);
}

match /vendors/{vendorId}/serviceMaterials/{doc} {
  allow read, write: if isVendorMember(vendorId);
}

match /vendors/{vendorId}/suppliers/{doc} {
  allow read, write: if isVendorMember(vendorId);
}

match /vendors/{vendorId}/restockOrders/{doc} {
  allow read, write: if isVendorMember(vendorId);
}

match /vendors/{vendorId}/analyticsSnapshots/{doc} {
  allow read: if isVendorMember(vendorId);
  allow write: if isVendorMember(vendorId);
}
```

Preserve existing rules for `vendors`, `staff`, `services`, `staffCompensation`, `payrollPeriods`, bookings, drivers, travel, and vendor signup flows.

## Implementation Plan

### Phase 1 — Inventory Foundation

Goal: Add vendor-scoped inventory CRUD with no booking integration.

New files to create:
- `salon-ai-os/inventory-model.js`
- `salon-ai-os/inventory-admin.js`
- `prompts/phase1_salon_ai_os_inventory_foundation.md`

Existing files to modify:
- `salon-admin.html`: add Inventory tab and load new admin module.
- `firestore.rules`: add explicit vendor-member rules for `inventory`.

Firestore changes:
- Add `vendors/{vendorId}/inventory/{productId}`.

Dependencies:
- Phase 0 complete.

Risk level: MEDIUM

Estimated complexity: MEDIUM

### Phase 2 — Service Materials Mapping

Goal: Let vendors map services to consumed materials.

New files to create:
- `salon-ai-os/service-materials.js`
- `prompts/phase2_salon_ai_os_service_materials.md`

Existing files to modify:
- `salon-admin.html`: add service-material mapping editor.
- `firestore.rules`: add explicit vendor-member rules for `serviceMaterials`.

Firestore changes:
- Add `vendors/{vendorId}/serviceMaterials/{serviceId}`.

Dependencies:
- Phase 1 inventory items.
- Stable service IDs confirmed.

Risk level: MEDIUM

Estimated complexity: MEDIUM

### Phase 3 — Completion Hook + Inventory Deduction

Goal: Deduct inventory when a salon appointment is explicitly completed.

New files to create:
- `salon-ai-os/inventory-deduction.js`
- `prompts/phase3_salon_ai_os_completion_deduction.md`

Existing files to modify:
- `salon-admin.html`: route appointment completion through an idempotent deduction helper.
- `nailsalon/receptionist.js`: no booking behavior changes unless adding non-invasive booking fields is approved.
- `firestore.rules`: ensure booking update rules still preserve vendor membership.

Firestore changes:
- Add booking fields `completedAt`, `inventoryDeductionStatus`, `inventoryDeductedAt`, `inventoryDeductionId`, `materialsSnapshot`.

Dependencies:
- Phases 1 and 2.

Risk level: HIGH

Estimated complexity: LARGE

### Phase 4 — Low Stock Alerts

Goal: Surface low-stock inventory to vendors without auto-ordering.

New files to create:
- `salon-ai-os/low-stock-alerts.js`
- `prompts/phase4_salon_ai_os_low_stock_alerts.md`

Existing files to modify:
- `salon-admin.html`: add low-stock dashboard panel.
- `functions/index.js`: optionally add scheduled or write-trigger alert generation.

Firestore changes:
- Use `vendors/{vendorId}/notifications` for vendor alerts.
- No customer notifications.

Dependencies:
- Phase 1 inventory.

Risk level: MEDIUM

Estimated complexity: MEDIUM

### Phase 5 — Suppliers + Restock Orders

Goal: Add supplier records and draft restock order workflow.

New files to create:
- `salon-ai-os/suppliers.js`
- `salon-ai-os/restock-orders.js`
- `prompts/phase5_salon_ai_os_suppliers_restock.md`

Existing files to modify:
- `salon-admin.html`: add Suppliers and Restock views.
- `firestore.rules`: add explicit rules for `suppliers` and `restockOrders`.

Firestore changes:
- Add `vendors/{vendorId}/suppliers/{supplierId}`.
- Add `vendors/{vendorId}/restockOrders/{orderId}`.

Dependencies:
- Phase 1 inventory.
- Phase 4 low-stock signals recommended.

Risk level: MEDIUM

Estimated complexity: LARGE

### Phase 6 — Analytics Snapshots

Goal: Store daily/weekly operational snapshots for dashboard and AI analysis.

New files to create:
- `salon-ai-os/analytics-snapshots.js`
- `prompts/phase6_salon_ai_os_analytics_snapshots.md`

Existing files to modify:
- `functions/index.js`: scheduled snapshot generator.
- `salon-admin.html`: analytics panel.
- `firestore.rules`: add explicit `analyticsSnapshots` rules.

Firestore changes:
- Add `vendors/{vendorId}/analyticsSnapshots/{snapshotId}`.

Dependencies:
- Phase 3 completed bookings and deduction data.

Risk level: MEDIUM

Estimated complexity: LARGE

### Phase 7 — AI Cost + Margin Analysis

Goal: Provide vendor-only margin insights from services, prices, and material cost.

New files to create:
- `salon-ai-os/ai-margin-analysis.js`
- `prompts/phase7_salon_ai_os_ai_margin_analysis.md`

Existing files to modify:
- `salon-admin.html`: add AI margin cards.
- `aiOrchestrator.js` or `functions/index.js`: server-side AI analysis endpoint if needed.

Firestore changes:
- Optionally write analysis output to `analyticsSnapshots` or a future `aiInsights` subcollection.

Dependencies:
- Phases 2, 3, and 6.

Risk level: MEDIUM

Estimated complexity: MEDIUM

### Phase 8 — AI Upsell + Customer Retention

Goal: Suggest customer-safe upsells and retention prompts without auto-sending messages.

New files to create:
- `salon-ai-os/retention-insights.js`
- `prompts/phase8_salon_ai_os_upsell_retention.md`

Existing files to modify:
- `nailsalon/receptionist.js`: add narrow, vendor-scoped, customer-safe upsell context only after booking intent is understood.
- `salon-admin.html`: show suggested follow-ups.

Firestore changes:
- Optional future `vendors/{vendorId}/customerInsights/{customerKey}`; do not add unless privacy model is approved.

Dependencies:
- Customer memory and booking history.
- Phase 7 margin analysis for profitability-aware upsells.

Risk level: HIGH

Estimated complexity: LARGE

### Phase 9 — Smart Pricing Suggestions

Goal: Recommend price changes for vendor review only.

New files to create:
- `salon-ai-os/pricing-suggestions.js`
- `prompts/phase9_salon_ai_os_smart_pricing.md`

Existing files to modify:
- `salon-admin.html`: pricing suggestions view with approve/reject controls.

Firestore changes:
- Optional `vendors/{vendorId}/pricingSuggestions/{suggestionId}`.
- No automatic writes to service prices.

Dependencies:
- Phases 6 and 7.

Risk level: HIGH

Estimated complexity: MEDIUM

### Phase 10 — AI Nail Design Assistant

Goal: Let customers or staff describe/upload nail inspiration and map it to services/materials safely.

New files to create:
- `salon-ai-os/nail-design-assistant.js`
- `prompts/phase10_salon_ai_os_design_assistant.md`

Existing files to modify:
- `nailsalon/receptionist.js`: add optional design-assistant handoff.
- `salon-admin.html`: show design interpretation on appointment cards.

Firestore changes:
- Extend booking reference image/design fields, e.g. `designRequest`, `designAnalysis`, `suggestedServices`, `suggestedMaterials`.

Dependencies:
- Existing reference photo upload.
- Phase 2 service-material mapping.

Risk level: MEDIUM

Estimated complexity: LARGE

### Phase 11 — SMS Notification Layer

Goal: Add consent-aware SMS flows for vendor alerts and optional customer messaging.

New files to create:
- `salon-ai-os/sms-consent.js`
- `prompts/phase11_salon_ai_os_sms_layer.md`

Existing files to modify:
- `functions/index.js`: only after Twilio is reprovisioned and `SMS_ENABLED` policy is approved.
- `salon-admin.html`: consent/audit UI.
- Customer booking UI if explicit opt-in is added.

Firestore changes:
- Optional `vendors/{vendorId}/smsConsent/{phoneHash}` and/or booking-level `smsOptIn`.

Dependencies:
- User approval for SMS behavior.
- Twilio/A2P remediation.

Risk level: HIGH

Estimated complexity: LARGE

### Phase 12 — AI Supply Marketplace

Goal: Create a vendor-facing supply marketplace/recommendation layer with no auto-purchase.

New files to create:
- `salon-ai-os/supply-marketplace.js`
- `prompts/phase12_salon_ai_os_supply_marketplace.md`

Existing files to modify:
- `salon-admin.html`: supply marketplace tab.
- Future marketplace/admin modules if supplier catalog becomes shared.

Firestore changes:
- Optional global `supplyCatalog/{itemId}` and vendor restock order references.
- Continue using vendor-scoped `restockOrders`.

Dependencies:
- Phases 1, 5, and 7.

Risk level: HIGH

Estimated complexity: LARGE

## Risks and Blockers

- `salon-admin.html` is the actual salon admin destination, but it was not included in the requested audit scope. Future phases should explicitly include it before implementation.
- Firestore fallback rule for unmatched vendor subcollections is broad and must be tightened or superseded by explicit rules for sensitive AI OS collections.
- Inventory deduction must be idempotent and tied to explicit completion only.
- Existing AI receptionist prompt is already large; new AI OS context should be modular and injected only when needed.
- SMS is disabled globally and should remain disabled until explicitly approved and reprovisioned.
- Stable service IDs should be confirmed before mapping materials to services.

## Assumptions

- Vendor ID will always be provided by page context, auth mapping, or URL; AI OS modules should never hardcode `luxurious-nails`.
- Nail Salon AI OS private operational data should be vendor-member only unless a specific public field is intentionally exposed.
- No automatic purchasing, price changing, or customer marketing SMS is allowed without explicit later approval.
- Phase 0 is audit/planning only; no dry run is required and no runtime functionality changed.

# Phase 2 — Nail Salon AI OS: Service Material Usage Mapping

## Role

You are implementing Phase 2 of the Nail Salon AI OS for the DuLichCali webapp.

Phase 1 added `vendors/{vendorId}/inventory/{itemId}` and the `SalonInventoryAdmin` module in `salon-ai-os/inventory-admin.js`.

Phase 2 adds service-to-materials mapping: for each service, which inventory items are consumed and in what quantity. This is data entry only — no automatic deduction yet (that is Phase 3).

Do NOT break existing booking, AI receptionist, staff availability, or vendor page logic.

---

## Primary Targets

- `salon-ai-os/service-materials.js` — NEW: service-material mapping module
- `salon-admin.html` — add Materials sub-section inside the Services tab, load the new script

## Allowed files

- salon-ai-os/service-materials.js
- salon-admin.html

---

## Hard Rules

- Do NOT hardcode one vendor ID. All functions must accept `vendorId`.
- Do NOT touch `nailsalon/receptionist.js`, `marketplace/marketplace.js`, `marketplace/services-data.js`.
- Do NOT touch booking creation, booking status logic, or availability checks.
- Do NOT auto-deduct inventory in this phase. Data entry only.
- Do NOT add any customer-visible UI.
- All UI strings in Vietnamese (admin tool — Vietnamese-only is intentional per project rules).
- Mobile-first: works at 375px and 1280px.

---

## Firestore Data Model

Collection path: `vendors/{vendorId}/serviceMaterials/{serviceId}`

The document ID is the Firestore service document ID from `vendors/{vendorId}/services/{serviceId}`.

Fields:
- `serviceId`: string
- `serviceNameSnapshot`: string — name at time of mapping
- `active`: boolean
- `materials`: array of objects:
  - `productId`: string — ref to `vendors/{vendorId}/inventory/{productId}`
  - `productNameSnapshot`: string
  - `qtyPerService`: number
  - `unit`: string
  - `deductMode`: string — one of: `fixed`, `per_nail`, `manual` (default: `fixed`)
  - `required`: boolean (default: true)
- `updatedAt`: timestamp
- `createdAt`: timestamp

Note: `firestore.rules` already covers this collection via the `vendors/{vendorId}/{sub=**}` auth rule. Do NOT modify firestore.rules in this phase.

---

## salon-ai-os/service-materials.js — New File

Expose as `window.SalonServiceMaterials`. Use IIFE pattern matching `inventory-admin.js`.

Functions:
- `init(vendorId, containerEl)` — initialize with vendorId and container element
- `loadMappings()` — real-time listener on `vendors/{vendorId}/serviceMaterials` (active == true)
- `loadServices()` — one-time load of `vendors/{vendorId}/services` (active == true)
- `loadInventory()` — one-time load of `vendors/{vendorId}/inventory` (active == true)
- `saveMaterials(serviceId, serviceNameSnapshot, materialsArray)` — set/merge mapping doc
- `deleteMaterials(serviceId)` — soft delete via `active: false`
- `getMaterialsForService(serviceId)` — return mapping for one service

UI rendering:
- Header: "Nguyên Liệu Theo Dịch Vụ"
- List of services (loaded from Firestore services collection) with a "Cài nguyên liệu" button per service
- If service already has a mapping: show current material count + estimated cost per service
- When "Cài nguyên liệu" is clicked: show inline edit form for that service
- Edit form: add/remove material lines (product picker from inventory, qty, unit, deductMode, required toggle)
- Save and cancel buttons
- Estimated material cost = sum of (qtyPerService × costPerUnit) for each mapped inventory item

Use `firebase.firestore()` (compat SDK). Plain JS only. No external dependencies.

---

## salon-admin.html Changes

1. Add `<script src="salon-ai-os/service-materials.js?v=20260508a"></script>` in `<head>` after the inventory-admin.js script tag.
2. Inside `panel-services` (the Services tab panel), after the existing service list content, add:
   - A divider `<hr style="border-color:var(--border);margin:1.5rem 0">`
   - A container `<div id="serviceMaterialsPanel"></div>`
3. Add `_serviceMaterialsReady` flag (same pattern as `_inventoryAdminReady`).
4. Add `initServiceMaterials()` function that calls `SalonServiceMaterials.init(VENDOR_ID, panel)`.
5. In the `switchTab` function, when `tab === 'services'`, call `initServiceMaterials()` (lazy init).

---

## Validation

Run after implementation:
```bash
node --check salon-ai-os/service-materials.js
scripts/ai/full_system_dry_run.sh
```

Verify:
- [ ] No existing booking logic touched
- [ ] No customer-facing pages changed
- [ ] Services tab still loads existing content first
- [ ] Material mapping is per vendorId (not cross-vendor)
- [ ] No auto-deduction logic present
- [ ] No auto-purchase or auto-restock

---

## Output

Write implementation notes to `ai_reviews/phase2_service_materials_report.md`.
Update `docs/salon_ai_os_phase_status.md` with Phase 2 status block.

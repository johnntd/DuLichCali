# Phase 1 — Nail Salon AI OS: Inventory Foundation

## Role

You are implementing Phase 1 of the Nail Salon AI OS for the DuLichCali webapp.

Phase 0 audit confirmed: there is no inventory system yet. This phase adds the base vendor-scoped inventory module.

Do NOT break existing booking, AI receptionist, staff availability, or vendor page logic.

---

## Primary Targets

- `salon-admin.html` — add Inventory tab and load the new inventory module
- `salon-ai-os/inventory-admin.js` — NEW: client-side inventory CRUD module
- `firestore.rules` — add explicit `vendors/{vendorId}/inventory/{doc}` rule

These are the ONLY files that may change. Do not touch booking logic, receptionist.js, marketplace.js, services-data.js, or any customer-facing page.

---

## Allowed files

- salon-admin.html
- salon-ai-os/inventory-admin.js
- firestore.rules

---

## Hard Rules

- Do NOT hardcode one vendor ID. All inventory functions must accept `vendorId` as a parameter.
- Do NOT touch `nailsalon/receptionist.js`, `marketplace/marketplace.js`, `marketplace/services-data.js`.
- Do NOT touch booking creation, booking status logic, or availability checks.
- Do NOT add any customer-visible UI. Inventory is vendor-admin only.
- Do NOT auto-purchase, auto-restock, or auto-change prices.
- Inventory reads/writes must require authenticated vendor membership (match existing `isVendorMember` pattern).
- Mobile-first: inventory UI must work at 375px AND 1280px.
- All UI strings must be in Vietnamese (internal admin tool — Vietnamese-only is correct per CLAUDE.md).

---

## Firestore Data Model

Collection path: `vendors/{vendorId}/inventory/{itemId}`

Fields:
- `name`: string (required)
- `category`: string — one of: `gel_polish`, `acrylic_powder`, `dip_powder`, `nail_tips`, `glue`, `files_buffers`, `disposable`, `sanitation`, `retail`, `other`
- `brand`: string, optional
- `sku`: string, optional
- `unit`: string — one of: `ml`, `oz`, `g`, `piece`, `set`, `bottle`, `box`, `pack`
- `currentQty`: number (required)
- `minQty`: number — low-stock threshold (required)
- `reorderQty`: number — suggested reorder amount
- `costPerUnit`: number, optional
- `supplierId`: string, optional (Phase 5 will link to supplier docs)
- `supplierUrl`: string, optional (direct link for manual reorder)
- `active`: boolean (default true)
- `trackStock`: boolean (default true)
- `lastRestockedAt`: timestamp, optional
- `updatedAt`: timestamp (always set on write)
- `createdAt`: timestamp (set on create only)

---

## Firestore Rules Change

Add this rule BEFORE the broad fallback `match /vendors/{vendorId}/{sub=**}`:

```javascript
match /vendors/{vendorId}/inventory/{doc} {
  allow read, write: if isVendorMember(vendorId);
}
```

Preserve ALL existing rules exactly. Do not remove or reorder any existing rule.

---

## salon-admin.html Changes

1. Add an "Inventory" tab button to the existing tab navigation.
2. Add an inventory panel div (hidden by default, shown when tab is active).
3. Add a `<script>` tag loading `salon-ai-os/inventory-admin.js` with a new version string `?v=20260508a`.
4. Tab UI must be consistent with existing tab pattern in the file.

Do not change any other section of salon-admin.html.

---

## salon-ai-os/inventory-admin.js — New File

Create this file. It must:

1. Export or expose a `SalonInventoryAdmin` module/object (IIFE or ES module pattern matching existing codebase style).
2. Accept `vendorId` as its primary parameter on init.
3. Provide these functions:
   - `init(vendorId, containerEl)` — initializes the inventory panel in the given container
   - `loadItems()` — loads `vendors/{vendorId}/inventory` (active items only, ordered by category then name)
   - `addItem(itemData)` — writes a new inventory document
   - `updateItem(itemId, updates)` — updates an existing document
   - `updateQty(itemId, newQty)` — convenience wrapper for quantity updates
   - `deleteItem(itemId)` — sets `active: false` (soft delete)
   - `getLowStockItems()` — returns items where `currentQty <= minQty`

4. Render a simple inventory list with:
   - Item name, category, brand (if set)
   - Current quantity + unit
   - Low-stock badge (red) when `currentQty <= minQty`
   - Quantity +/- controls
   - Edit and deactivate buttons
   - "Add item" button that opens a simple form

5. The add/edit form must include all required fields (name, category, unit, currentQty, minQty).
6. Use Firebase Firestore v9 compat SDK (same pattern as rest of codebase: `firebase.firestore()`).
7. No external dependencies. Plain JS only.
8. Vietnamese labels (admin tool — Vietnamese-only is correct).

---

## JS Version String Rule

After writing `salon-ai-os/inventory-admin.js`, verify which HTML files load it:

```bash
grep -rn "inventory-admin.js" . --include="*.html"
```

Each file that loads it must have `?v=20260508a` (or higher if that string was already deployed).

---

## Validation After Implementation

Run:

```bash
scripts/ai/targeted_dry_run.sh hair-salon
scripts/ai/full_system_dry_run.sh
```

Both must pass before claiming complete.

Also verify manually:
- [ ] Existing booking flow untouched
- [ ] Vendor admin still loads
- [ ] Inventory tab appears in salon-admin.html
- [ ] Inventory module loads without JS errors
- [ ] Low-stock items show badge
- [ ] No cross-vendor inventory visibility possible
- [ ] No auto-purchase or auto-restock
- [ ] Mobile layout correct at 375px

---

## Output

Write implementation notes to:

```
ai_reviews/phase1_inventory_foundation_report.md
```

Include: files changed, Firestore model added, tests run, verdict.

Also update `docs/salon_ai_os_phase_status.md` with the Phase 1 status block.

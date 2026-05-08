# Phase 3 — Inventory Deduction + Low Stock Alerts

Goal:
When a completed salon appointment happens, deduct estimated material usage from inventory.

Rules:
- Deduct only when appointment status becomes completed.
- Do not deduct on pending/cancelled/no-show.
- Prevent double deduction.
- Add audit trail.

Firestore:
vendors/{vendorId}/inventoryTransactions/{transactionId}

Fields:
- type: service_usage | manual_adjustment | restock | correction
- inventoryItemId
- quantityChange
- beforeQuantity
- afterQuantity
- relatedBookingId
- reason
- createdAt
- createdBy

Booking record:
Add:
- inventoryDeducted: true/false
- inventoryDeductedAt

Alerts:
vendors/{vendorId}/inventoryAlerts/{alertId}

Fields:
- inventoryItemId
- alertType: low_stock | out_of_stock
- message
- active
- createdAt
- resolvedAt

Vendor admin:
- Show low-stock dashboard card
- Show out-of-stock warning
- Show restock needed list

Acceptance tests:
- Completed booking deducts materials once
- Cancelled booking does not deduct
- Low stock alert appears
- Inventory transaction is logged
- Manual adjustment works

# Phase 4 — Supplier + Online Restock System

Goal:
Help salons save cost by comparing restock options and generating shopping/restock recommendations.

Important:
Do not auto-purchase yet.
Only generate restock recommendations and shopping links.

Supplier data model:
vendors/{vendorId}/suppliers/{supplierId}

Fields:
- name
- website
- contactName
- phone
- email
- shippingNotes
- active

Inventory item fields:
- preferredSupplierId
- supplierUrl
- amazonUrl
- walmartUrl
- costcoUrl
- localSupplierUrl
- lastPrice
- targetPrice

Restock recommendation:
vendors/{vendorId}/restockRecommendations/{id}

Fields:
- inventoryItemId
- itemName
- currentQty
- reorderThreshold
- suggestedQty
- supplierOptions[]
- estimatedCost
- estimatedSavings
- priority
- status: suggested | approved | ordered | dismissed
- createdAt

Vendor admin UI:
Add Restock Center:
- Items needing reorder
- Supplier links
- Estimated cost
- Approve / dismiss / mark ordered
- Manual supplier URL entry

AI assistant:
Allow vendor to ask:
- "What do I need to reorder?"
- "Which supplies are running low?"
- "How much will restock cost?"
- "Where can I buy cheaper?"

Acceptance tests:
- Low stock creates restock suggestion
- Vendor can approve/dismiss
- Supplier links open correctly
- No auto-purchase
- Inventory updates only when vendor marks restocked

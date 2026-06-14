Implement Patch 13 only.

Goal:
Surface reconciliation_pending / quantity_mismatch states clearly for operators without changing trading behavior.

Scope:
- admin/dashboard/API/status reporting files only
- focused tests if existing
- Do NOT modify broker logic
- Do NOT modify live_exit_service.py unless only needed for read-only formatting
- Do NOT modify journal close behavior
- Do NOT modify retry behavior

Problem:
Patch 12 adds:
- reconciliation_pending=True
- reconciliation_reason="journal_broker_quantity_mismatch"

But operators/dashboard may not clearly see which trades need manual reconciliation.

Requirements:
1. Find where open/pending exits are displayed or returned:
   - admin panel endpoints
   - dashboard/status APIs
   - pending exit views
   - execution log summaries

2. Add read-only visibility for:
   - reconciliation_pending
   - reconciliation_reason
   - quantity_mismatch
   - partial_close_detected
   - journal_quantity
   - broker_max_close_quantity
   - closed_quantity
   - remaining_quantity
   - operator_action

3. Do NOT change trade state.
4. Do NOT auto-clear anything.
5. Do NOT submit/cancel orders.
6. Add/adjust tests if existing status/admin tests are available.

After implementation:
- run focused tests
- run scripts/ai/full_system_dry_run.sh
- show exact diff
- explain where operators will now see reconciliation-pending trades

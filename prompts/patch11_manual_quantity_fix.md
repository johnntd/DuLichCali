Implement Patch 11 only.

Goal:
Introduce structured handling for partial close situations so the system does not enter ambiguous state when broker closes less than journal quantity.

Scope:
- app/services/live_exit_service.py
- app/services/fill_reconciliation.py (only if needed)
- focused tests only

Do NOT modify:
- trade_watcher.py
- broker adapters
- order payloads
- spread_exit_engine
- journal close logic (except metadata)

Problem:
After Patch 8, when broker_max_qty < journal_qty:
- system returns manual_action_required
- but journal still shows full quantity
- broker position is partially reduced
- system lacks explicit “partial close state”

Requirements:

1. Introduce new response fields when partial close detected:
   - partial_close_detected: True
   - closed_quantity
   - remaining_quantity
   - journal_quantity
   - broker_max_close_quantity

2. Do NOT call log_close for full close in this case.

3. Add structured operator_action:
   "Partial close detected: broker closed X of Y contracts; reconciliation required"

4. Ensure no retry storm:
   - if partial_close_detected=True, suppress immediate retry
   - rely on next cycle reconciliation instead

5. Ensure dedup logic respects partial state:
   - do not attempt full close again immediately

6. Add focused tests:
   - partial close returns structured fields
   - trade_closed remains False
   - no log_close triggered
   - retry is suppressed
   - dedup does not resubmit immediately

7. Keep diff minimal.

After implementation:
- run focused tests
- run scripts/ai/full_system_dry_run.sh
- show exact diff
- explain how ambiguity is eliminated

Implement Patch 12 only — Option B.

Goal:
When partial close / quantity mismatch occurs, preserve the original journal quantity but add explicit reconciliation-pending state so the system does not silently treat the trade as normal.

Scope:
- app/services/live_exit_service.py
- app/services/fill_reconciliation.py only if needed
- focused tests only

Do NOT modify:
- broker adapters
- order payloads
- trade_watcher.py
- spread_exit_engine.py
- journal close semantics
- full-close journal behavior

Requirements:
1. When partial_close_detected or quantity_mismatch is returned:
   - keep trade_closed=False
   - keep manual_action_required=True
   - add reconciliation_pending=True
   - add reconciliation_reason="journal_broker_quantity_mismatch"
   - preserve:
     - journal_quantity
     - broker_max_close_quantity
     - corrected_quantity / closed_quantity if available
     - remaining_quantity if available

2. Ensure exit_attempt log records include:
   - reconciliation_pending
   - reconciliation_reason
   - partial_close_detected
   - journal_quantity
   - broker_max_close_quantity
   - corrected_quantity
   - closed_quantity
   - remaining_quantity

3. Do NOT update journal quantity yet.
4. Do NOT full-close the trade.
5. Do NOT retry full quantity immediately when reconciliation_pending=True.
6. If a pending/dedup result is returned for a quantity mismatch state, it must preserve reconciliation fields.

Tests:
- quantity mismatch result includes reconciliation_pending=True
- exit_attempt log includes reconciliation fields
- dedup/pending result preserves reconciliation fields
- trade_closed remains False
- log_close is not called
- no full-quantity retry occurs immediately

After implementation:
- run focused tests
- run scripts/ai/full_system_dry_run.sh
- show exact diff
- explain why journal quantity is preserved safely

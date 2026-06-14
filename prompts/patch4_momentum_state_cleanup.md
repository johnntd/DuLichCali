Implement Patch 4 only.

Scope:
- app/services/momentum_exit_engine.py
- focused tests only

Goal:
Prevent stale momentum/trailing exit state from persisting after trades are closed outside normal trade_watcher evaluate_exit paths.

Requirements:
1. In save_states():
   - call get_open_trades()
   - build open trade_id set
   - persist only states whose trade_id is still open
   - evict stale closed trade_ids from in-memory _trade_states
   - if journal lookup fails, fall back safely without crashing

2. In restore_states():
   - load momentum_states.json
   - call get_open_trades()
   - restore only states whose trade_id is still open
   - skip stale closed trade_ids
   - log skipped count if any
   - if journal lookup fails, restore existing file safely as fallback

3. Do not modify:
   - trade_watcher.py
   - admin_panel.py
   - fill_reconciliation.py
   - daily_profit_target.py
   - launcher_gui.py
   - live_exit_service.py
   - broker routing
   - journal close behavior

4. Add focused tests:
   - save_states evicts closed trade state from disk and memory
   - restore_states skips closed trade IDs
   - new trade does not inherit stale state
   - restore fallback works when journal lookup fails

5. Keep diff minimal.

After implementation:
- show exact diff
- list tests run
- explain why this avoids stale trailing/profit-protection state without touching close paths

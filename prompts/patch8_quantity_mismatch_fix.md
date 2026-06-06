Implement Patch 8 only.

Goal:
Prevent quantity mismatch retry storms and prevent full journal close when broker can only close a smaller quantity.

Scope:
- app/services/live_exit_service.py
- focused tests only

Problem:
Single-leg exits do not handle broker rejection:
cannot_close_more_than_existing_position

Vertical spreads retry quantity mismatch once, but if corrected quantity is less than journal quantity and fills, journal may still mark the whole trade closed.

Requirements:
1. Add single-leg handling for cannot_close_more_than_existing_position:
   - parse broker max close qty with existing _parse_max_close_qty()
   - retry once using min(journal_qty, broker_max_qty)
   - do not recurse endlessly
   - do not change broker routing

2. If corrected quantity < journal quantity:
   - do NOT report trade_closed=True
   - do NOT call log_close as full close
   - return manual_action_required=True
   - include quantity_mismatch=True
   - include journal_quantity, broker_max_close_quantity, corrected_quantity
   - include operator_action explaining journal/broker quantity mismatch needs review

3. Preserve existing behavior when corrected quantity == journal quantity.

4. Do not modify:
   - trade_watcher.py
   - BrokerRouter
   - TastytradeBroker
   - journal_agent.py
   - spread_exit_engine.py
   - iron_condor behavior

5. Add focused tests:
   - single-leg quantity mismatch retries once with broker max qty
   - corrected quantity < journal quantity does not full-close journal
   - retry rejection returns manual_action_required and quantity_mismatch fields
   - vertical spread quantity mismatch behavior remains covered and does not journal-close a larger journal quantity incorrectly

6. Keep diff minimal.

After implementation:
- run focused tests
- show exact diff
- explain why this prevents quantity mismatch retry storms and phantom full closes

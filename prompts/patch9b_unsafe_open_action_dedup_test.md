Implement Patch 9B only.

Goal:
Add focused regression coverage for the existing unsafe_open_action dedup re-entry path in live_exit_service._place_spread_exit().

Scope:
- tests/test_regression.py only
- Do NOT modify production code unless the test proves a real bug.
- Do NOT modify broker routing.
- Do NOT modify journal behavior.

Context:
Patch 9 added tests proving spread exit broker/proof legs containing "Buy to Open" / "Sell to Open" are blocked before log_close().
Claude review found one remaining low-priority test gap:
- existing unsafe_open_action sentinel re-entry path is not covered.

Requirements:
1. Add a test where _pending_exit_orders already contains an entry for the trade_id with:
   - unsafe_open_action=True
   - status/manual_required style fields
   - offending_leg_actions
2. Call _place_spread_exit() again for the same trade.
3. Assert:
   - BrokerRouter.place_complex_order is NOT called
   - log_close is NOT called
   - result trade_closed=False
   - result manual_action_required=True
   - result preserves unsafe_open_action/offending_leg_actions
4. Run:
   .venv/bin/python -m pytest tests/test_regression.py::TestSpreadExitErrorRecovery -q
5. Keep diff minimal.

After implementation:
- show exact diff
- summarize tests run

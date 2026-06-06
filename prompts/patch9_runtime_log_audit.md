Implement Patch 9 only.

Goal:
Add a hard safety guard so live vertical_spread exit orders can never be treated as valid if any broker payload/proof leg maps to an OPEN action.

Scope:
- app/services/live_exit_service.py
- focused tests only

Problem:
Runtime audit found historical live spread exit proof logs where broker raw leg actions showed:
- Sell to Open
- Buy to Open

For a spread exit, every broker leg must be close-only:
- Sell to Close
- Buy to Close

Requirements:
1. Inspect the vertical spread close path in _place_spread_exit().
2. Add a safety validation around the broker result/proof payload if leg actions are available.
3. If any spread exit leg action contains "Open":
   - do NOT journal-close
   - return status "error" or "manual_required"
   - trade_closed=False
   - manual_action_required=True
   - include reason/error: "spread exit broker action mapped to open"
   - include offending leg actions for audit
   - write an exit_attempt/audit record if existing helper supports it
4. Preserve valid Close actions.
5. Do not change BrokerRouter or TastytradeBroker in this patch unless absolutely required.
6. Do not change order placement payloads yet.
7. Do not change iron_condor behavior.
8. Add focused tests:
   - broker response with Buy to Open / Sell to Open blocks journal close
   - broker response with Buy to Close / Sell to Close proceeds as before
   - log_close is not called when open action is detected
9. Keep diff minimal.

After implementation:
- run focused tests
- run scripts/ai/full_system_dry_run.sh
- show exact diff
- explain why this prevents unsafe spread exits

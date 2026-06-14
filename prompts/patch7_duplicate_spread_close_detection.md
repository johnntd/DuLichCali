Implement the smallest safe fix for duplicate broker close-order detection.

Scope:
- app/services/live_exit_service.py
- focused tests only

Problem from runtime audit:
AMAT vertical spread close attempts were repeatedly rejected because Tastytrade returned a message like:
"You already have a closing order for AMAT ... which must be canceled before this order can be routed"

The code has intended handling for duplicate close errors, but it appears to only match cannot_close_against_more_than_existing_position or another narrower code shape. Runtime logs show repeated rejections instead of registering the pending_external dedup sentinel.

Requirements:
1. Inspect _place_spread_exit() duplicate-close rejection handling.
2. Add robust detection for broker messages indicating an existing/working closing order, including phrases like:
   - "already have a closing order"
   - "closing order"
   - "must be canceled before this order can be routed"
3. When detected:
   - do not keep submitting duplicate close orders
   - register the existing pending/external close sentinel using the existing mechanism
   - return a safe result showing pending/external close instead of rejected storm
   - do not journal-close the trade
4. Do not change broker routing.
5. Do not change order placement payloads.
6. Do not change single-leg behavior unless the same helper is safely reused.
7. Add focused tests:
   - Tastytrade duplicate closing order message registers pending_external
   - repeated call does not submit another complex order while sentinel is active
   - trade_closed remains false
   - log_close is not called
8. Keep diff minimal.

After implementation:
- run focused tests
- show exact diff
- explain why this prevents retry storms without hiding real failures

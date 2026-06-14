Read-only audit for Patch 10.

Goal:
Find the root cause of why historical live vertical_spread exit broker proof showed:
- Buy to Open
- Sell to Open

For an exit, broker payload/actions must be close-only:
- Buy to Close
- Sell to Close

Do NOT modify code.

Inspect:
- app/services/live_exit_service.py
- BrokerRouter complex order path
- TastytradeBroker.place_complex_order()
- spread leg inversion logic
- any payload/proof logging path

Report:
1. Where spread close legs are built
2. Where action/side is converted to broker action
3. Whether close payload uses correct position_effect/price_effect
4. Whether broker adapter ignores close intent and maps to open
5. Whether proof log is showing request payload or broker response
6. Smallest safe implementation plan to force close-only actions for vertical_spread exits
7. Tests needed to prove:
   - closing short leg uses Buy to Close
   - closing long leg uses Sell to Close
   - no exit payload contains Open action
   - journal does not close if broker response still shows Open

Do not modify code.

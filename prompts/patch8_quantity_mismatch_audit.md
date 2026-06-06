Read-only audit for Patch 8.

Goal:
Audit quantity mismatch handling between journal open trades and broker-held positions.

Problem:
Runtime evidence showed a case where the journal/open trade quantity did not match what broker could close. This can cause repeated rejected close orders, partial close confusion, or incorrect trade_closed reporting.

Do NOT modify code.

Inspect:
- app/services/live_exit_service.py
- app/services/fill_reconciliation.py
- app/agents/journal_agent.py
- app/services/trade_watcher.py
- any broker position snapshot / summarize_open_trades logic

Report:
1. Where trade quantity comes from for single-leg exits
2. Where trade quantity comes from for vertical_spread exits
3. How broker-reported max close quantity is parsed and handled
4. Whether partial quantity close is safe
5. Whether journal quantity can drift from broker quantity
6. Whether reconciliation detects/corrects this drift
7. Whether repeated quantity mismatch can cause retry storms
8. Smallest safe Patch 8 implementation plan
9. Focused tests needed

Do not modify code.

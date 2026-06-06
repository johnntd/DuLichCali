Read-only Monday paper validation.

Goal:
Audit the first live market paper session after all exit/journal/spread safety patches.

Do NOT modify code.

Inspect:
- logs/
- execution_log.jsonl
- paper/live trade journals
- open positions
- pending exits
- reconciliation_pending records
- unsafe_open_action records
- duplicate close sentinels
- quantity_mismatch records
- scanner/watcher output

Report:
1. Trades placed or rejected
2. Exit triggers
3. Broker/paper exit behavior
4. Retry storms
5. Journal close integrity
6. Any reconciliation_pending/manual_action_required states
7. Whether system remains READY_FOR_PAPER
8. Whether any new patch is required

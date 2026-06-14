Read-only audit for Patch 12.

Goal:
Audit how the system should reconcile journal quantity vs broker quantity after a partial close / quantity mismatch event.

Do NOT modify code.

Inspect:
- app/services/fill_reconciliation.py
- app/services/live_exit_service.py
- app/agents/journal_agent.py
- trade watcher / summarize_open_trades logic
- logs/execution_log.jsonl behavior

Focus:
1. How partial_close_detected records are logged
2. Whether reconciliation can detect journal_quantity > broker_quantity
3. Whether journal supports partial quantity adjustment
4. Whether open trade quantity can be reduced safely
5. Whether a partial close should create a child close record or update metadata only
6. How to avoid phantom full-close
7. Smallest safe implementation plan for Patch 12
8. Focused tests needed

Report:
- current behavior
- risks
- recommended implementation plan
- files/functions involved

Implement Patch 1 only.

Scope:
- app/agents/journal_agent.py
- focused tests only

Goal:
Fix journal close idempotency and silent failure.

Requirements:
1. log_close() must detect if trade_id is already closed/no longer open before writing a duplicate close.
2. If already closed, log a warning and return None.
3. log_close() must check the return value of log_trade().
4. If log_trade() returns None, log a warning and return None.
5. Do not modify:
   - live_exit_service
   - trade_watcher
   - broker routing
   - spread logic
   - execution_orchestrator
6. Add focused tests:
   - calling log_close() twice for the same trade_id produces exactly one close record
   - log_close() returns None when log_trade() rejects/fails the write

After implementation:
- show exact diff
- list tests run
- explain why this prevents duplicate/phantom closes

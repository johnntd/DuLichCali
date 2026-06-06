Implement Patch 6 only.

Goal:
Create a full end-to-end dry-run validation command for the AI Trading System.

Scope:
- scripts/ai/
- docs/
- tests/ only if needed
- Do NOT modify trading logic.
- Do NOT modify broker routing.
- Do NOT place real trades.
- Do NOT call external broker APIs.
- Do NOT require live market data.

Requirements:
1. Add a script:
   scripts/ai/full_system_dry_run.sh

2. It must run safe validation only:
   - journal idempotency tests
   - live exit log_close contract tests
   - execution pause tests
   - momentum state reconcile tests
   - live exit/spread routing regression tests if already available
   - config sanity checks if available

3. It must write output to:
   .ai_runs/latest/full_system_dry_run.txt

4. It must print:
   FINAL: PASS
   or
   FINAL: FAIL

5. It must clearly state:
   - no live orders placed
   - no broker API calls made
   - no external market data required

6. Add docs:
   docs/full_system_dry_run.md

7. Keep diff minimal.

After implementation:
- run:
  bash -n scripts/ai/full_system_dry_run.sh
  scripts/ai/full_system_dry_run.sh
- show exact diff
- summarize tests run

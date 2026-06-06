Implement Patch 5 only.

Goal:
Add a safe full-system validation runner for the AI Trading System.

Scope:
- scripts/ai/
- tests/ if focused validation tests are needed
- docs/ if a short validation checklist is useful
- Do NOT modify trading logic
- Do NOT modify broker routing
- Do NOT modify live execution behavior

Requirements:
1. Create a validation script that runs the safety-critical test groups:
   - journal close idempotency
   - live exit log_close contract
   - execution pause enforcement
   - momentum state reconciliation
   - live exit / spread exit routing regression tests if already available

2. The script should:
   - use the same pytest runner detection logic as precommit_ai_gate.sh
   - write output to .ai_runs/latest/full_validation.txt
   - clearly print PASS or FAIL
   - never place trades
   - never call external broker APIs
   - never require live market data

3. Add a short documentation block or README section explaining:
   - how to run full safety validation
   - what it checks
   - what it does NOT check

4. Keep diff minimal.

After implementation:
- run the new validation script
- show exact diff
- summarize tests run

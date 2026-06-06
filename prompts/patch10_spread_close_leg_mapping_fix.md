Implement Patch 10 only.

Goal:
Prevent any live vertical_spread exit from reaching Tastytrade with Open leg actions.

Scope:
- app/brokers/tastytrade/adapter.py
- focused adapter tests only
- Do NOT modify live_exit_service.py unless absolutely required
- Do NOT modify broker routing
- Do NOT modify journal logic
- Do NOT modify iron_condor behavior

Problem:
Audit found adapter defaults missing position_effect to "open". For spread exits, missing close intent can produce Buy to Open / Sell to Open. Patch 9 already guards broker response after the fact; Patch 10 must prevent unsafe open-action exit payloads before submit.

Requirements:
1. In TastytradeBroker.place_complex_order(), detect vertical_spread exit payloads.
2. For vertical_spread exits, require every leg to have position_effect == "close".
3. After building broker legs, reject locally if any leg action contains "Open".
4. Return/raise a clear local error before POST:
   "spread exit leg action mapped to open"
5. Do not change valid close behavior:
   - short entry leg closes as Buy to Close
   - long entry leg closes as Sell to Close
6. Add focused tests:
   - missing position_effect on vertical_spread exit is rejected before POST
   - valid close legs produce Buy to Close / Sell to Close
   - no exit payload contains Open action
7. Keep diff minimal.

After implementation:
- run focused tests
- run scripts/ai/full_system_dry_run.sh
- show exact diff

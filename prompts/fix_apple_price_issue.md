# TASK — Fix AAPL Option Pricing / Quote Integrity Bug

## Problem

The dashboard showed an impossible AAPL option position:

- Symbol: AAPL
- Contract: AAPL260620C00180000
- Type: CALL
- Strike: 180
- Expiry: 2026-06-20
- Entry: $5.00
- Current: $106.5750
- P/L: +2031.50%

This is unsafe. The system accepted an option quote that produced an unrealistic P/L.

The fix must protect the trading system from invalid option marks, fake P/L, duplicate recovered positions, and unsafe direct trade placement.

Do NOT add new strategies.

Do NOT change trading intelligence.

Do NOT enable live trading.

Focus only on execution and quote integrity.

---

## Phase 0 — Safety First

Before changing code, confirm safe defaults:

- execution_mode = paper
- live_trading_armed = false
- auto_place = false
- lifecycle_enabled = false if present
- scheduler_autostart = false if present

Do not place trades.

Do not delete the bad AAPL trade silently.

---

## Phase 1 — Trace Root Cause

Audit the current code and report:

1. Where current option mid/mark is calculated.
2. Where option quote sanity is checked.
3. Where single-leg option P/L is calculated.
4. Where exit/profit-taking uses current option marks.
5. Where paper positions are restored.
6. Where duplicate open trades are filtered or missed.
7. Where direct `place_trade()` calls still exist.
8. Whether scanner, Smart Trade, QoQ, Adaptive Brain, or legacy trade_engine can bypass `execute_trade_candidate()`.

Then implement fixes.

---

## Phase 2 — Option Quote Validation

Create or update a central validator, preferably:

```python
app/data/option_quote_validation.py
Implement a function like:
def validate_option_mark(
    symbol,
    contract_symbol,
    option_type,
    strike,
    expiry,
    mark,
    bid=None,
    ask=None,
    last=None,
    underlying_price=None,
    entry_mark=None,
    quote_timestamp=None,
    provider=None,
    allow_extreme_confirmed=False,
):
    ...
Return:
{
    "valid": bool,
    "quote_status": "valid | invalid | stale | suspicious | missing",
    "reason": "...",
    "validated_mark": float | None,
}
Reject or quarantine if:
	1.	mark is None or <= 0
	2.	bid or ask is negative
	3.	bid > ask
	4.	spread is extreme relative to mid
	5.	option mark is greater than underlying price unless explicitly confirmed
	6.	option mark is suspiciously close to underlying price
	7.	current mark implies extreme P/L, default threshold 500%
	8.	quote timestamp is stale if timestamp exists
	9.	contract symbol does not match ticker / expiry / strike / option type when parseable
	10.	provider data is incomplete
If invalid/stale/suspicious:
	•	return validated_mark = None
	•	do not calculate fake P/L
	•	do not allow exit triggers

⸻

Phase 3 — Integrate Validation Into Quote Path
Update option quote retrieval, likely:
app/data/options_data.py
Around:
get_current_option_mid()
Required:
	•	Validate yfinance bid/ask mid.
	•	Validate Polygon/Massive/Tastytrade marks if used.
	•	If invalid, return None or structured invalid result depending on existing API style.
	•	Log reason clearly.
Log fields:
	•	symbol
	•	contract_symbol
	•	provider
	•	reason
	•	bid
	•	ask
	•	last
	•	mark
	•	underlying_price
	•	entry_mark

⸻

Phase 4 — Fix P/L Safety
Update single-leg P/L calculation in files such as:
app/agents/monitor_agent.py
app/services/position_tracker.py
Required behavior:
If quote is invalid, stale, missing, or suspicious:
	•	current_option_mid = None
	•	pnl_pct = None
	•	pnl_dollars = None
	•	quote_status = invalid/stale/suspicious/missing
	•	pnl_status = unavailable
	•	review_required = true
Do NOT calculate fake P/L.
Do NOT include invalid quote P/L in daily P/L.
Do NOT feed invalid P/L into CAE, Adaptive Brain, lock-gain logic, or exit logic.

⸻

Phase 5 — Fix Exit / Watcher Safety
Audit and update:
app/services/trade_watcher.py
app/services/live_exit_service.py
app/services/position_tracker.py
app/agents/monitor_agent.py
app/services/scheduler.py
If quote is invalid/stale/suspicious:
	•	do not trigger take-profit
	•	do not trigger stop-loss
	•	do not trigger chart-reduce
	•	do not trigger lock-gains
	•	do not auto-close
Log:
quote_invalid_exit_suppressed
with symbol, contract_symbol, trade_id, and reason.

⸻

Phase 6 — Paper / Live Recovery Isolation
Update:
app/brokers/paper_broker.py
app/agents/journal_agent.py
Required:
	1.	paper_broker._restore_positions() must call:
get_open_trades(execution_mode="paper")
	2.	Any live restore path must call:
get_open_trades(execution_mode="live")
	1.	journal_agent.get_open_trades() must de-duplicate open records by:
	•	trade_id
	•	contract_symbol for open single-leg positions
	•	spread identity for spreads if applicable
If duplicates exist:
	•	keep newest valid open record
	•	suppress older duplicate
	•	log duplicate_open_trade_suppressed
Do not delete journal lines silently.

⸻

Phase 7 — Block Synthetic / Low-Evidence Paper Entries
A valid runtime single-leg paper trade must include:
	•	symbol
	•	contract_symbol
	•	option_type
	•	strike
	•	expiry
	•	bid/ask or validated mid
	•	entry mark
	•	contracts
	•	estimated_total_cost
	•	execution_mode
	•	execution_path = execute_trade_candidate
	•	selection_reason OR ranking_reason OR intent_id OR smart_trade_plan_id
	•	provider/source if available
If required fields are missing:
	•	reject the paper trade
	•	do not write it as an open trade
	•	log paper_trade_rejected_low_evidence
Testing exception:
Allow synthetic trades only if:
allow_synthetic_test_trade=True
This must never be enabled by runtime settings.

⸻

Phase 8 — Fence Direct
place_trade()
Paths
Audit all runtime code for:
place_trade(
Known risk area:
app/services/trade_engine.py
All runtime trade execution must route through:
execute_trade_candidate()
If legacy direct placement remains, fence it behind:
ALLOW_LEGACY_DIRECT_PLACE_TRADE = False
Default must be false.
If runtime code calls legacy direct placement without explicit test override:
	•	raise runtime error
	•	log safety violation
Do not break broker-layer internal order placement after gates. The unsafe problem is strategy/scanner/service code bypassing orchestrator.

⸻

Phase 9 — Quarantine Bad AAPL Position
Do not silently delete the bad AAPL trade.
For the suspicious AAPL trade, likely:
paper-0484
AAPL260620C00180000
Mark it or suppress it as:
	•	quote_status = suspicious
	•	review_required = true
	•	quarantine_reason = extreme_pnl_unconfirmed_or_synthetic_entry
It must not:
	•	count toward realized P/L
	•	trigger exits
	•	trigger gain lock
	•	influence Adaptive Brain / CAE
	•	show fake P/L
Use append-only quarantine/audit log if possible:
logs/trade_quarantine.jsonl

⸻

Phase 10 — Tests Required
Add or update tests.
Create files if needed:
tests/test_option_quote_integrity.py
tests/test_journal_recovery_integrity.py
tests/test_execution_path_integrity.py
Required tests:
	1.	AAPL 180C entry $5.00, valid current mid $5.50 → P/L +10%.
	2.	Provider returns underlying-like price $106.575 for entry $5.00 → quote rejected/quarantined.
	3.	option mark > underlying price → invalid unless confirmed.
	4.	bid > ask → invalid.
	5.	missing bid/ask/last → missing quote.
	6.	stale timestamp → stale quote.
	7.	extreme P/L > threshold suppresses P/L and exit.
	8.	valid deep ITM option is not falsely rejected if explicitly confirmed.
	9.	Invalid quote returns pnl_pct=None and pnl_dollars=None.
	10.	Invalid quote excluded from daily P/L aggregation.
	11.	Credit spread P/L path still works.
	12.	Invalid quote does not trigger take-profit.
	13.	Invalid quote does not trigger stop-loss.
	14.	Invalid quote does not trigger lock-gains.
	15.	Watcher logs quote_invalid_exit_suppressed.
	16.	paper_broker._restore_positions filters execution_mode=“paper”.
	17.	live restore filters execution_mode=“live” if present.
	18.	duplicate open trade_id is suppressed.
	19.	duplicate open contract_symbol is suppressed.
	20.	recovered duplicate AAPL position does not show multiple open positions.
	21.	Smart Trade uses execute_trade_candidate.
	22.	Scanner uses execute_trade_candidate.
	23.	QoQ uses execute_trade_candidate.
	24.	Adaptive Brain uses execute_trade_candidate.
	25.	Legacy trade_engine cannot directly place trades in runtime mode.
	26.	No runtime strategy/scanner/service direct place_trade path remains.
	27.	Paper single-leg trade without selector/ranking evidence is rejected.
	28.	Paper single-leg trade with validated quote and selector evidence is accepted.
	29.	Synthetic test trade only allowed with explicit test flag.
	30.	Paper and live open positions remain mode-isolated.
	31.	Invalid paper trade cannot appear in live positions.
	32.	Live trading remains disabled unless live_trading_armed=true.

⸻

Phase 11 — Run Tests
Run:
source .venv/bin/activate
pytest tests/test_regression.py -q
pytest tests/test_qoq_earnings_strength.py -q
pytest tests/test_capital_allocation_engine.py -q
pytest tests/test_paper_live_mode_isolation.py -q
pytest tests/test_patch22_profit_target_mode_isolation.py -q
pytest tests/test_option_quote_integrity.py -q
pytest tests/test_journal_recovery_integrity.py -q
pytest tests/test_execution_path_integrity.py -q
pytest -q
If a listed file does not exist, create it or explain the replacement.

⸻

Phase 12 — Final Report Required
Return:
	1.	Root cause confirmed.
	2.	Files changed.
	3.	Fix summary.
	4.	How AAPL fake P/L is now prevented.
	5.	How invalid quotes are handled.
	6.	How exits are suppressed on invalid quotes.
	7.	How paper/live recovery is isolated.
	8.	How duplicate recovered positions are suppressed.
	9.	How direct place_trade paths are fenced.
	10.	How bad AAPL trade was quarantined or suppressed.
	11.	Full test results.
	12.	Trading safety state:
	•	auto-place remains OFF
	•	lifecycle/scheduler remains OFF if applicable
	•	live_trading_armed remains false
	•	execution_mode remains paper
	•	no unsafe direct runtime place_trade path exists
	13.	Remaining risks before resuming paper trading.

⸻

Strict Rules
	•	Do not patch only the dashboard.
	•	Do not hide fake P/L without fixing valuation and exit logic.
	•	Do not resume trading.
	•	Do not enable live trading.
	•	Do not delete paper-0484 silently.
	•	Do not add new trading strategies.
	•	Do not weaken tests just to pass.
	•	Do not commit .venv, .pid, logs, or runtime artifacts.
	•	Keep the fix focused on execution and quote integrity.

 


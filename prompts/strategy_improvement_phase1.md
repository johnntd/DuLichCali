# AI Trading System — Phase 1: Backtest Harness Foundation

Phase 0 is APPROVED. Implement Phase 1 only.

## Context from Phase 0

Phase 0 produced:
- scripts/backtest/backtest_trend_alignment.py       — reads paper_trades.jsonl
- scripts/backtest/backtest_counterfactual_alignment.py — reads preview_trades_archived.jsonl
- scripts/backtest/results/                         — CSV outputs

Phase 0 findings:
- No IV rank data exists anywhere in local logs (makes IV gate infeasible without external data)
- ma20, ma50, short_strike, long_strike, net_credit_per_share, spread_width present in journal
- delta data is hardcoded placeholder (-0.2), not real
- 18 unique credit spread setups in journal; 15 spread types identifiable
- Recommended first live gate candidate: trend alignment (ma20/ma50 — all data present)

## DO-NOT-CHANGE baseline

The following are working and must not be rewritten or weakened:
- risk_agent gates: regime blocks and earnings blocks
- Profit target exits (SMCI, NOW, GS showed clean +12.73% exits)
- Earnings-day exits
- Chart reversal exits
- Scanner Phase 1 rejection logic
- RED regime → no_trade
- Existing exit safety stack: duplicate close detection, quantity mismatch handling,
  reconciliation_pending, unsafe_open_action guard, log_close contract, closed_at integrity
- DO NOT touch: live_exit_service.py, spread_exit_engine.py, momentum_exit_engine.py,
  trade_watcher.py, scheduler.py, daily_profit_target.py, journal_agent.py, risk_agent.py

## Phase 1 — Backtest Harness Foundation

Goal:
Create a safe offline backtest framework for strategy improvement research.

Scope: scripts/backtest/, tests/, docs/
Do NOT modify live trading logic, broker routing, scanner execution logic, risk gates, or exit engines.

Requirements:

1. Build scripts/backtest/data_loader.py — a read-only data loader that:
   - Reads logs/paper_trades.jsonl (open + close record pairs)
   - Reads logs/preview_trades_archived.jsonl
   - Returns a list of normalized TradeRecord dicts with these fields:
       trade_id, symbol, strategy_type, structure_type, spread_type,
       direction (bullish/bearish/unknown), execution_mode,
       entry_time (ISO str), exit_time (ISO str, None if open),
       dte_at_entry (int, None if missing),
       net_credit_per_share (float, None if missing),
       spread_width (float, None if missing),
       short_strike (float, None if missing),
       long_strike (float, None if missing),
       close_at_entry (float — underlying price at scan time, None if missing),
       ma20 (float, None), ma50 (float, None),
       rsi14 (float, None),
       iv (float, None — implied volatility if present, None otherwise),
       iv_rank (float, None — ALWAYS None; IV rank not in local data),
       pct_change (float, None if open/unknown),
       exit_reason (str, None if open),
       status (open/closed/unknown),
       outcome (win/loss/flat/unknown — derived from pct_change),
       data_quality (complete/partial/missing_ma/missing_strikes/missing_exit),
       source_file (paper_trades/preview_trades)
   - Mark missing fields as None — never guess or fill forward
   - Return both paper and preview records (tagged by source_file)

2. Build scripts/backtest/report_generator.py — produces:
   - A CSV: scripts/backtest/results/backtest_dataset.csv
   - A JSON: scripts/backtest/results/backtest_dataset.json
   - A missing-data summary: scripts/backtest/results/missing_data_report.txt
     (counts per field of how many records have None)
   - A data quality breakdown (complete / partial / missing_ma / missing_strikes / missing_exit)

3. Build scripts/backtest/README.md with:
   - How to run: python scripts/backtest/data_loader.py
   - How to generate reports: python scripts/backtest/report_generator.py
   - Field definitions for each TradeRecord field
   - How to interpret data_quality flags
   - Limitations section (no IV rank, no intraday quotes, small sample)

4. Add tests/test_backtest_data_loader.py with focused tests:
   - test_load_paper_trades_returns_list
   - test_closed_trade_has_exit_fields
   - test_open_trade_has_none_exit
   - test_missing_ma_flagged_in_data_quality
   - test_missing_strikes_flagged
   - test_preview_records_tagged_correctly
   - test_no_production_file_written (confirm data_loader writes nothing to logs/)

IMPORTANT — test runner:
  Use .venv/bin/python -m pytest (not bare pytest or python3 -m pytest).
  The project venv is at .venv/; bare pytest is not on PATH.

Verification:
- Run: .venv/bin/python -m pytest tests/test_backtest_data_loader.py -q
- Run: .venv/bin/python scripts/backtest/report_generator.py
- Run: scripts/ai/full_system_dry_run.sh
- All existing regression tests must still pass
- Claude review must approve before Phase 2

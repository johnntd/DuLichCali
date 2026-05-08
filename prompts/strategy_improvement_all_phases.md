Implement the strategy improvement project phase-by-phase.

Critical rule:
Do NOT move to the next phase unless the current phase:
1. is fully implemented,
2. has focused tests,
3. passes full safety validation,
4. receives Claude verdict: APPROVE.

If Claude returns REQUEST_CHANGES:
- fix only Claude’s findings,
- rerun tests,
- rerun Claude review,
- do not proceed to the next phase until approved.

If Claude returns BLOCK:
- stop immediately.

Do NOT enable live trading.
Do NOT modify broker routing, live exits, journal logic, risk gates, or existing scanner behavior unless the phase explicitly requires it and Claude approves.

Phases:

PHASE 0 — Audit
- read-only feasibility audit
- no code changes
- produce implementation order

PHASE 1 — Backtest data foundation
- build read-only journal/log loader
- normalize historical trade records
- generate CSV/JSON dataset
- missing-data report
- tests

PHASE 2 — OTM cushion backtest
- compute sigma distance for short strikes
- bucket results by sigma distance
- generate report
- tests
- no live behavior change

PHASE 3 — IV rank gate backtest
- attach IV rank where available
- bucket by IV rank
- generate report
- tests
- no live behavior change

PHASE 4 — Trend alignment backtest
- reconstruct trend state at entry/scan time
- compare filtered vs unfiltered candidates
- generate report
- tests
- no live behavior change

PHASE 5 — Implement first proven gate only
- choose only the strongest proven gate from Phase 2–4
- config-driven
- default conservative
- add rejection logging
- tests
- full dry-run validation

PHASE 6 — 30-day paper forward-test plan
- daily/weekly report format
- promotion criteria
- no live trading

For each phase output:
- files changed
- tests run
- report generated
- risks
- whether phase is ready for Claude review

Stop after any phase if approval is not achieved.

# AI Trading System — Phased Strategy Improvement Implementation

You are working inside my existing AI Trading System repo.

Use the existing Codex → Claude loop rules:
- Work phase by phase.
- Do NOT move to the next phase unless the current phase is implemented, tested, and Claude-reviewed as APPROVE.
- If Claude returns REQUEST_CHANGES, fix only those findings and rerun the loop.
- If Claude returns BLOCK, stop.
- Do NOT broaden scope.
- Do NOT modify working components listed as DO-NOT-CHANGE.
- Do NOT enable live trading.
- Default mode remains PAPER.
- Never bypass risk gates, journal safeguards, broker safety guards, or exit protections.

## DO-NOT-CHANGE baseline

The following are working and must not be rewritten or weakened:
- Setup classifier: identifies momentum setups and filters neutral.
- risk_agent gates: regime blocks and earnings blocks fire correctly.
- Profit target exits: SMCI, NOW, GS showed clean +12.73% exits.
- Earnings-day exits reduce losses.
- Chart reversal exits have correct timing.
- Scanner Phase 1 rejection logic works: neutral bias, vol gates, PDT blocks.
- RED regime → no_trade correctly halts trading during volatility crises.
- Existing exit safety stack: duplicate close detection, quantity mismatch handling, reconciliation_pending, unsafe_open_action guard, log_close contract, closed_at integrity.

---

# Phase 0 — Read-only audit and data feasibility

Do NOT modify code.

Audit whether the repo already has enough data to implement strategy-selection improvements.

Backtests to evaluate:
1. IV rank gate:
   - Test whether credit spread entries below IV rank 35 underperform entries above IV rank 35.
2. OTM cushion gate:
   - Compute sigma-distance of historical short strikes.
   - Test whether losses cluster at short strikes <= 0.8σ.
3. Credit-based stop:
   - Simulate 2x credit stop for historical spreads.
4. Trend alignment filter:
   - Compare scanner outputs with/without trend alignment gate.

Inspect:
- journals
- execution logs
- scanner logs
- strategy selector
- credit_spread logic
- option liquidity filters
- available IV/chain data
- Polygon/Tastytrade data availability
- current test infrastructure

Output:
1. Data available vs missing
2. Which backtest is feasible first
3. Recommended implementation order
4. Files/functions involved
5. Risks and assumptions
6. Phase 1 plan

Verification required:
- Run existing dry-run validation.
- Run regression tests.
- Claude must review and approve Phase 0 before Phase 1.

Do not implement Phase 1 yet.

---

# Phase 1 — Backtest harness foundation

Only begin if Phase 0 is approved.

Goal:
Create a safe offline backtest framework for strategy improvement research.

Scope:
- scripts/backtests/
- tests/
- docs/
- read-only journal/log parsing helpers if needed

Do NOT modify:
- live trading logic
- broker routing
- scanner execution logic
- risk gates
- exit engines

Requirements:
1. Build a backtest data loader that reads existing journal/log data.
2. Normalize historical trades into structured records:
   - trade_id
   - symbol
   - strategy_type
   - entry_time
   - exit_time
   - entry_price/credit
   - exit_price/debit
   - short_strike
   - long_strike
   - expiry
   - DTE
   - IV/IV rank if available
   - outcome / P&L
3. Clearly mark missing data as missing, not guessed.
4. Produce a CSV/JSON backtest dataset.
5. Add tests for parser correctness.

Output:
- backtest dataset file
- missing-data report
- tests passing
- README explaining how to run

Verification:
- Run focused tests.
- Run full safety validation.
- Claude review must approve before Phase 2.

---

# Phase 2 — OTM cushion gate backtest

Only begin if Phase 1 is approved.

Goal:
Backtest whether short-strike sigma distance predicts credit-spread losses.

Scope:
- scripts/backtests/
- tests/
- docs/

Do NOT change live strategy behavior yet.

Requirements:
1. Compute sigma distance for short strikes where data exists.
2. Bucket trades:
   - <= 0.8σ
   - 0.8–1.0σ
   - 1.0–1.2σ
   - >1.2σ
3. Report:
   - win rate
   - avg P&L
   - max loss
   - number of trades
   - loss concentration
4. If IV data is missing, document what cannot be concluded.
5. Recommend whether to implement a live OTM cushion gate.

Verification:
- Tests for sigma calculation.
- Backtest report generated.
- Claude approval required before Phase 3.

---

# Phase 3 — IV rank gate backtest

Only begin if Phase 2 is approved.

Goal:
Backtest whether IV rank improves credit-spread expectancy.

Scope:
- scripts/backtests/
- tests/
- docs/

Do NOT change live strategy behavior yet.

Requirements:
1. For each historical credit spread, attach IV rank at entry if available.
2. Bucket:
   - IVR < 20
   - 20–35
   - 35–50
   - >50
3. Test hypothesis:
   - trades below IVR 35 underperform.
4. Report:
   - win rate
   - avg P&L
   - max loss
   - profit factor
   - trade count
5. If Polygon historical IV is missing, create a missing-data report and recommend external data source or forward-test-only plan.

Verification:
- Tests for IV rank calculation.
- Backtest report generated.
- Claude approval required before Phase 4.

---

# Phase 4 — Trend alignment filter backtest

Only begin if Phase 3 is approved.

Goal:
Test whether trend alignment would have filtered losing entries.

Scope:
- scripts/backtests/
- tests/
- docs/

Do NOT change live scanner behavior yet.

Requirements:
1. Reconstruct trend state at scan/entry time:
   - price vs 20/50 DMA if available
   - trend direction
   - overbought/extended state
2. Compare candidates with/without filter.
3. Report:
   - number filtered
   - winners filtered
   - losers filtered
   - net effect
4. Recommend whether to implement the filter.

Verification:
- Tests for trend classification.
- Report generated.
- Claude approval required before Phase 5.

---

# Phase 5 — Implement first proven gate only

Only begin if prior backtests prove value.

Goal:
Implement exactly ONE live strategy gate, starting with the highest-confidence backtest result.

Allowed candidates:
- OTM cushion gate
- IV rank gate
- trend alignment gate
- no-trade regime improvement

Rules:
- Must be config-driven.
- Default should be conservative.
- Must log rejection reason clearly.
- Must not weaken existing risk gates.
- Must not affect exits.
- Must have focused tests.
- Must have before/after report.

Verification:
- Focused tests.
- Full dry-run validation.
- Full regression.
- Claude approval required before commit.

---

# Phase 6 — Paper forward-test plan

Only begin after Phase 5 is approved.

Goal:
Create a 30-day paper validation plan.

Deliverables:
1. Daily report fields:
   - candidates scanned
   - trades approved/rejected
   - gate rejection counts
   - fills
   - P&L
   - exits
   - reconciliation issues
2. Weekly review metrics:
   - win rate
   - avg win/loss
   - profit factor
   - max drawdown
   - avoided trades
3. Promotion criteria:
   - no live trading until explicit written approval
   - minimum paper sample size
   - no unresolved reconciliation_pending
   - no unsafe_open_action
   - no retry storms
   - all tests pass

Verification:
- Dry-run report generation.
- Claude approval.

---

# Automation behavior

Use the Codex-Claude loop:

Run each phase with:

scripts/ai/ai_dev_loop.sh --max-loops 3 prompts/<phase_prompt>.md

Rules:
- If Claude APPROVES: stop and wait for my commit/approval before next phase.
- If Claude REQUEST_CHANGES: loop back using codex_followup_prompt.md.
- If Claude BLOCKS: stop immediately.
- Do not auto-commit trading logic.
- Never push.
- Never enable live trading.

Begin with Phase 0 only.

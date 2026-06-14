# Codex Task — Emergency Audit of AI Trading System Option Pricing / Execution Safety

## Context

My AI Trading System has a serious bug.

Dashboard shows an impossible AAPL option position:

- Symbol: AAPL
- Strategy: momentum options
- Type: CALL
- Strike: 180
- Expiry: 2026-06-20
- Entry: $5.00
- Current: $106.5750
- P/L: +2031.50%

This is likely wrong because the current option value appears to be using the underlying stock price or another invalid quote instead of the actual option premium.

There was also an earlier duplicate AAPL open-position issue.

## Your Role

Do a READ-ONLY audit first.

Do NOT modify code.

Do NOT delete trades.

Do NOT “fix” anything yet.

I need a root-cause audit report that Claude will review afterward.

## Audit Scope

Inspect the full code path for:

1. Single-leg option quote retrieval
2. Option contract symbol construction/parsing
3. Strike/expiry/type mapping
4. Current premium calculation
5. P/L calculation
6. Paper/live journal recovery
7. Duplicate open-position prevention
8. Smart Trade / Adaptive Brain trade creation
9. Scanner execution path
10. Exit intelligence / profit-taking logic
11. Dashboard display logic

## Critical Questions

Answer these clearly:

1. Where does the AAPL current value `$106.5750` come from?
2. Is it the underlying AAPL stock price being used as the option premium?
3. Which file/function calculated the displayed P/L?
4. Which file/function loaded this AAPL position?
5. Which path created the AAPL trade:
   - Smart Trade
   - Universe scanner
   - Adaptive Brain
   - recovered journal
   - test/demo seed
   - manual entry
6. Did the trade go through `execute_trade_candidate()`?
7. Was option liquidity validated before entry?
8. Are paper/live journals being mixed?
9. Is recovered session duplicating stale positions?
10. Are duplicate same-contract entries blocked?

## Files/Areas to Inspect

Search and inspect anything related to:

- `paper_trades.jsonl`
- `execution_log.jsonl`
- `paper_broker.py`
- `trade_watcher.py`
- `live_exit_service.py`
- `execution_orchestrator.py`
- `universe_scanner.py`
- `smart_trade`
- `adaptive_trading_brain.py`
- `capital_allocation_engine.py`
- `ranking_agent.py`
- option quote providers
- yfinance fallback
- Polygon / Massive / Tastytrade quote adapters
- dashboard open-position rendering
- recovered session loading

## Required Audit Checks

### A. Option Quote Safety

Verify that single-leg option current value comes only from:

- option bid/ask mid
- option last price only if bid/ask unavailable and quote is fresh

It must NEVER use:

- underlying stock price
- intrinsic value alone
- stale fallback price
- dashboard placeholder

### B. P/L Safety

Verify:

- Single-leg option P/L uses option premium change.
- Credit spread P/L uses spread value logic separately.
- Contract multiplier is correct.
- Invalid/stale option quotes do not generate fake P/L.
- Extreme P/L requires quote validation.

### C. Execution Safety

Verify:

- All new trades go through `execute_trade_candidate()`.
- No direct `place_trade()` exists from strategy/scanner/smart-trade paths.
- Risk gates still run:
  - kill switch
  - market open
  - max daily loss
  - max open premium
  - max open trades
  - paper/live separation
  - live armed gate

### D. Duplicate Position Safety

Verify:

- Same symbol/type/strike/expiry cannot be opened repeatedly unless explicitly allowed.
- Recovered journal does not duplicate open positions.
- Same trade ID cannot load multiple times.

## Required Output Format

Return a structured audit report:

### 1. Executive Summary

- Severity
- Likely root cause
- Whether trading should remain disabled

### 2. Evidence

For each finding include:

- File path
- Function name
- Relevant line numbers
- Why it is unsafe or safe

### 3. Root Cause

Explain exactly how the AAPL position got:

```text
Entry = 5.00
Current = 106.575
P/L = +2031.50%

# QuantFusion Benchmark Backlog (2026-03-05)

## Scan Inputs
- Inayan Builder Reddit research (`/api/v1/reddit/search`) for trading workflow signals.
- Inayan Builder GitHub research (`/api/v1/github/research`) plus direct MCP indexing.
- Indexed repos:
  - `local/quantfusion`
  - `local/InayanBuilderBot`
  - `tripolskypetr/backtest-kit`

## Ranked Gaps
1. Paper execution realism (entry/exit slippage + spread/volatility impact)
- Impact: High. Prevents inflated paper PnL and improves live-transfer confidence.
- Status: Implemented.
- Targets: `server/services/working-trader.ts`, `server/routes.ts`, `.env.example`.

2. Trade lifecycle realism (partial exits and staged de-risking)
- Impact: High. Better mirrors practical execution/risk management.
- Source signal: backtest-kit partial profit/loss lifecycle (`Action`, `Broker`, `ClientStrategy`).
- Status: Implemented.
- Targets: `server/services/working-trader.ts`, `server/storage.ts`, `shared/schema.ts` (if metadata columns added).

3. Breakeven threshold tied to transaction costs
- Impact: High. Avoids breakeven moves before costs are covered.
- Source signal: backtest-kit formula: `(slippage + fee) * 2`.
- Status: Implemented.
- Targets: `server/services/working-trader.ts` (stop adjustment rules).

4. Execution quality analytics endpoint
- Impact: Medium. Fast validation of paper realism drift over time.
- Targets: `server/routes.ts` (`/api/trading/execution-quality`), aggregate in `server/storage.ts`.

5. Strategy-level rejection diagnostics
- Impact: Medium. Faster iteration by surfacing why trades were blocked.
- Source signal: backtest-kit risk rejection events.
- Targets: `server/utils/trade-validation.ts`, `server/routes.ts`, `server/services/working-trader.ts`.

## Next Fast Wins
- Add execution-quality report: avg modeled slippage, realized fee drag, expectancy after costs.
- Add strategy-level rejection diagnostics endpoint with reason codes and counts.
- Add startup-checklist history/aging metric to detect intermittent feed degradation over rolling windows.

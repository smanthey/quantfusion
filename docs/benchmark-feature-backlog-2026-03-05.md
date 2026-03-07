# QuantFusion Benchmark Backlog (2026-03-05)

## Scan Inputs
- Inayan Builder Reddit research (`/api/v1/reddit/search`) for trading workflow signals.
  - Output: `docs/inayan-reddit-2026-03-05.json`
- Inayan Builder GitHub research (`/api/v1/github/research`) failed (no token / unavailable).
  - Output: `docs/inayan-github-2026-03-05.json`
- Indexed repos:
  - `local/quantfusion`
  - `local/InayanBuilderBot`
  - `tripolskypetr/backtest-kit`

## Ranked Gaps (All Implemented)
1. Paper execution realism (entry/exit slippage + spread/volatility impact)
- Impact: High. Prevents inflated paper PnL and improves live-transfer confidence.
- Status: Implemented.
- Targets: `server/services/working-trader.ts`, `server/routes.ts`, `.env.example`.

2. Trade lifecycle realism (partial exits and staged de-risking)
- Impact: High. Better mirrors practical execution/risk management.
- Source signal: backtest-kit partial profit/loss lifecycle (`Action`, `Broker`, `ClientStrategy`).
- Status: Implemented.
- Targets: `server/services/working-trader.ts`.

3. Breakeven threshold tied to transaction costs
- Impact: High. Avoids breakeven moves before costs are covered.
- Source signal: backtest-kit formula: `(slippage + fee) * 2`.
- Status: Implemented.
- Targets: `server/services/working-trader.ts` (stop adjustment rules).

4. Execution quality analytics endpoint
- Impact: Medium. Fast validation of paper realism drift over time.
- Status: Implemented.
- Targets: `server/services/execution-metrics.ts`, `server/routes.ts` (`/api/trading/execution-quality`).

5. Strategy-level rejection diagnostics
- Impact: Medium. Faster iteration by surfacing why trades were blocked.
- Status: Implemented.
- Targets: `server/services/rejection-tracker.ts`, `server/services/working-trader.ts`, `server/routes.ts`.

6. Learning state persistence + analysis endpoint
- Impact: Medium. Enables longitudinal learning and visibility.
- Status: Implemented.
- Targets: `server/services/learning-state.ts`, `server/services/working-trader.ts`, `server/routes.ts` (`/api/trading/learning/analysis`).

7. Strategy lab + trade-performance insights fusion
- Impact: Medium. Surfaces top/watch/noise by lab + actual results.
- Status: Implemented.
- Targets: `server/services/strategy-insights.ts`, `server/routes.ts` (`/api/trading/strategy-insights`).

8. Startup checklist history + aging signal
- Impact: Medium. Detects intermittent feed degradation and readiness flapping.
- Status: Implemented.
- Targets: `server/services/startup-checklist-monitor.ts`, `server/routes.ts`.

9. Trade journal backfill path
- Impact: Medium. Rehydrates reporting from historical DB trades.
- Status: Implemented.
- Targets: `server/scripts/backfill-trade-journal.ts`, `server/routes.ts` (`/api/trading/journal/backfill`).

10. Risk guardrail integration for WorkingTrader
- Impact: High. Prevents new entries when circuit breakers trip.
- Status: Implemented.
- Targets: `server/services/working-trader.ts` + singleton `riskManager`.

## Next Fast Wins
- Re-run Inayan GitHub research once token is available; index any surfaced repos for strategy/metrics UX patterns.
- Add execution-quality alerts if slippage spikes above a configurable threshold.
- Wire strategy-lab top candidate into WorkingTrader (optional, after validating stability).

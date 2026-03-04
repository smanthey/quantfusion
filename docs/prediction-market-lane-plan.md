# QuantFusion Prediction-Market Lane (Implementation Plan)

## What is now implemented

The existing OpenClaw mock lane was upgraded instead of creating a parallel subsystem:

- Existing fair-value model retained: binary option style `P(YES) = N(d2)`
- Existing cross-venue scanner retained and improved with ranked opportunities
- New latency-dislocation scanner added for "blind window" conditions
- Stable deterministic ordering added for opportunities:
  - `score` descending
  - `lastSeenAt` descending
  - `id` ascending

## Why this is the best fit

QuantFusion already had a prediction-market paper lane in `openclaw-mock-lab` and API routes in `routes.ts`. Extending that lane avoids duplicate risk logic, duplicate storage schema, and duplicate dashboard wiring.

## New backend capability

### 1) Deterministic, evidence-tracked opportunity ranking

Opportunities now include:

- `score`
- `lastSeenAt`
- `evidenceCount`
- `source` (`fair_value` or `latency_dislocation`)

This improves dashboard stability and prevents cards from jittering when scores tie.

### 2) Latency dislocation scanner

New endpoint:

- `POST /api/openclaw/mock/scan-latency`

Purpose:

- Measure lag between reference feed and market venue
- Estimate a fair probability shift from fast reference move
- Score and gate opportunities by edge, fees, and lag window

Core outputs:

- `lagMs`
- `withinBlindWindow`
- `edgeBps`
- `expectedRoiPct`
- `recommendation` (`enter_candidate` or `skip`)

## Suggested next integration steps

1. Feed live timestamps from your real adapters (Binance/Chainlink/venue websockets) into `/scan-latency` every tick.
2. Add a dashboard lane for top opportunities from `getDashboard().opportunities` using the same deterministic sort keys.
3. Gate paper execution with stricter predicates:
   - minimum liquidity threshold
   - max lag threshold
   - minimum expected ROI after fees
4. Promote to live route only after paper metrics are stable:
   - hit-rate by edge bucket
   - realized vs expected ROI drift
   - adverse selection by lag bucket

## Example payload for latency scanner

```json
{
  "symbol": "BTC",
  "marketId": "btc-5m-up",
  "venue": "Polymarket",
  "marketProbability": 0.53,
  "referencePriceNow": 103200,
  "referencePricePrev": 102900,
  "referenceTimestampMs": 1762200000500,
  "marketTimestampMs": 1762200000120,
  "feeBps": 35,
  "liquidityUsd": 25000,
  "blindWindowMs": 500,
  "minEdgeBps": 50
}
```

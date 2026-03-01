# OpenClaw Trading Automation (Paper-First)

This adds a safe workflow for OpenClaw + TradingView/OpenAlgo:

1. Market alerts ingestion from TradingView webhooks
2. Automated position sizing calculator
3. Order submission in paper mode by default
4. Live mode requires explicit confirmation token before order routing
5. Daily P&L summary endpoint

## Endpoints

- `GET /api/openclaw/trading/config`
- `POST /api/openclaw/trading/alerts/tradingview`
- `POST /api/openclaw/trading/position-size`
- `POST /api/openclaw/trading/orders`
- `POST /api/openclaw/trading/orders/:id/confirm`
- `GET /api/openclaw/trading/orders/pending`
- `GET /api/openclaw/trading/pnl/daily?date=YYYY-MM-DD`

## Safety

- Default mode: `OPENCLAW_TRADING_MODE=paper`
- Live requires confirmation token from submit response
- If `OPENALGO_API_URL` is missing, live execution is blocked

## Example flow

1) TradingView sends webhook alert:

```bash
curl -X POST http://localhost:5000/api/openclaw/trading/alerts/tradingview \
  -H 'Content-Type: application/json' \
  -H 'x-tradingview-secret: replace_with_random_secret' \
  -d '{"symbol":"BTCUSDT","side":"buy","condition":"EMA crossover","timeframe":"15m"}'
```

2) Calculate position size:

```bash
curl -X POST http://localhost:5000/api/openclaw/trading/position-size \
  -H 'Content-Type: application/json' \
  -d '{"accountBalance":10000,"riskPercent":1,"entryPrice":62000,"stopLossPrice":61500}'
```

3) Submit paper order:

```bash
curl -X POST http://localhost:5000/api/openclaw/trading/orders \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"BTCUSDT","side":"BUY","entryPrice":62000,"stopLoss":61500,"takeProfit":63000,"mode":"paper"}'
```

4) Submit live order (requires confirmation):

```bash
curl -X POST http://localhost:5000/api/openclaw/trading/orders \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"BTCUSDT","side":"BUY","entryPrice":62000,"stopLoss":61500,"takeProfit":63000,"mode":"live"}'
```

Then confirm with `pendingOrderId` + `confirmationToken`:

```bash
curl -X POST http://localhost:5000/api/openclaw/trading/orders/<pendingOrderId>/confirm \
  -H 'Content-Type: application/json' \
  -d '{"token":"<confirmationToken>","confirm":true}'
```

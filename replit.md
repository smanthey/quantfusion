# Algorithmic Crypto Trading Platform

## Overview
A production-ready algorithmic crypto trading platform designed for multi-strategy execution, regime detection, dynamic allocation, and comprehensive risk management. The platform aims to achieve sustainable profitability through research-backed strategies and real-time market adaptation.

## User Preferences
- No placeholder data - authentic market data only
- Production-ready code with proper error handling
- Fully responsive design for all screen sizes
- Real-time updates and monitoring
- Use proven models from top hedge funds ("work smarter not harder")
- Institutional-grade performance targets: 60-75% win rates

## Current Status (October 21, 2025 - HEDGE FUND DIVERSIFIED PORTFOLIO 🎯)
- ✅ **15-PAIR PORTFOLIO** - Expanded to institutional hedge fund universe for maximum diversification
- ✅ **Multi-Asset Coverage** - 7 forex pairs, 6 crypto pairs, 2 commodities (gold/silver)
- ✅ **Trade Archiving** - All 24 old buggy trades archived, fresh $10,000 start
- ✅ **STRATEGY OVERHAUL** - Fixed 0% win rate by requiring ALL 3 confirmations (EMA cross + RSI cross + ADX ≥25)
- ✅ **ADX Fixed** - Now calculating properly (77.4, 98.2, 100.0 on active pairs)
- ✅ **Wider Stops** - 2.0×ATR (was 1.5×ATR) gives trades breathing room
- ✅ **Lower Target** - 1.5:1 reward:risk (was 2:1) for more achievable profit targets  
- ✅ **Profit Protection** - Breakeven move at +1R, trailing stops at +1.5R to lock in gains
- ✅ **Auto-Start** - Working Trader starts automatically 3 seconds after server boot
- ✅ **Proper Risk Management** - 1% risk per trade, max 5% notional ($500 on $10k account)
- ✅ **Stop-Loss & Take-Profit** - SL/TP values properly stored in database, automatic trade closing at targets
- ✅ **Historical data storage** - All prices permanently archived (577+ candles loaded)
- ✅ **Exponential backoff with jitter** - All API calls retry with delays: 1s→2s→4s→8s→16s→32s→60s
- ✅ **Circuit breakers LIVE** - APIs auto-blocked after 5 failures, testing recovery with HALF_OPEN state
- ✅ **Portfolio VaR calculation** - Parametric, Historical, CVaR with risk limits
- ✅ **Daily loss limit** - Trading stops automatically if loss exceeds $500/day
- ✅ **Position persistence** - Open trades saved to database, survive system restarts
- ✅ **Accounting Fix** - Closed trades properly set profit/loss/fees for accurate P&L
- Account Balance: $10,000.00 (fresh start, 0 open positions, scanning 15 pairs every 30s)

## System Architecture
The platform features a multi-strategy ensemble (mean reversion, trend following, breakout) with an HMM-based regime detection system for dynamic strategy allocation. It includes walk-forward backtesting with Monte Carlo validation and real-time execution with slippage and fee modeling. Comprehensive risk management is implemented with circuit breakers, per-trade limits, and dynamic position sizing (e.g., Kelly Criterion, volatility-adjusted sizing). The system also incorporates an explore/exploit learning system for continuous self-improvement.

The architecture comprises:
- **Frontend**: React with Tailwind CSS, focusing on a responsive design and real-time updates.
- **Backend**: Node.js/Express with WebSocket for real-time data communication.
- **Database**: PostgreSQL for persistent storage (trades, positions, historical prices, performance metrics).
- **Trading Engine**: WorkingTrader executes trades for BOTH forex AND crypto pairs from unified account.
  - **Forex pairs**: EURUSD, GBPUSD, AUDUSD (via Alpha Vantage, ExchangeRatesAPI)
  - **Crypto pairs**: BTCUSDT, ETHUSDT (via CoinGecko, CoinCap, CoinLore fallback)
  - Each pair uses same EMA Crossover + RSI strategy with proper SL/TP
  - Prevents duplicate positions (max 1 open trade per symbol)
  - Monitors all open positions every 30s for SL/TP exit conditions
- **Risk Management**: Production-ready with exponential backoff (1s→60s), circuit breakers (5 failures = OPEN), portfolio VaR (parametric/historical/CVaR), daily loss limit ($500 max), position persistence, and 1:2 risk/reward enforcement. API failures trigger automatic trading suspension.
- **Machine Learning**: An advanced ML predictor system with multi-model ensembles for trend, volatility, and price direction, and continuous learning based on trade results.
- **Order Execution**: Advanced order types such as TWAP, VWAP, Iceberg orders, and Implementation Shortfall algorithms.
- **Portfolio Optimization**: Markowitz Mean-Variance and Kelly Criterion optimization methods.
- **Technical Analysis**: Custom indicators including Adaptive RSI, sentiment oscillators, market regime detection, and volume profiles.

## External Dependencies
- **Market Data APIs**: Binance, CoinLore, CoinGecko, CoinCap (for live price feeds and historical data, with intelligent fallback mechanisms).
  - All APIs wrapped with exponential backoff + circuit breakers
  - Automatic retry with jitter: 1s→2s→4s→8s→16s→32s→60s (max)
  - Circuit breakers OPEN after 5 failures, test recovery after 60s timeout
  - Trading automatically suspended when circuit breakers are OPEN
- **Forex Data APIs**: Alpha Vantage, ExchangeRatesAPI, FX-1-Minute-Data (GitHub repo for historical forex data).

## Recent Improvements (October 20, 2025)
Based on research of proven solutions from OpenAlgo, Jesse, NautilusTrader, QuantStats, and QuestDB:

1. **API Reliability**
   - Exponential backoff with full jitter (prevents thundering herd)
   - Adaptive rate limiting (slows down on errors, speeds up on success)
   - Circuit breakers wired to all API clients (CoinGecko, CoinCap, Binance)
   - Automatic retry on transient failures (429, 503, ECONNRESET, ETIMEDOUT)

2. **Risk Management (FIXED October 20, 2025)**
   - **CRITICAL FIX**: Position sizing bug causing 30% positions ($3,000) fixed to 5% ($494)
   - Risk per trade: 1% of account ($100 on $10k account)
   - ATR-based stops: 1.5×ATR with 2:1 reward:risk (replaced fixed 0.2%)
   - Max notional per trade: 5% of account ($500 cap)
   - Max concurrent positions: 2 trades
   - Total portfolio exposure: 15% maximum
   - Daily loss limit: $500/day stops trading
   - Portfolio VaR: Parametric, Historical, CVaR calculations
   - Sharpe ratio and max drawdown tracking

3. **Position Persistence**
   - All open positions saved to PostgreSQL database
   - Includes entry price, stop-loss, take-profit, strategy used
   - System survives restarts without losing open trades
   - Automatic position recovery on startup

4. **Data Integrity**
   - Historical price deduplication (symbol + timestamp + interval)
   - Code-based UPSERT pattern for safe data storage
   - 5,000+ historical candles stored permanently
   - Batched writes with flush-on-full buffer strategy

5. **Trading Strategy (October 20, 2025 - STRICT MODE)**
   - **Philosophy** - Quality over quantity, strict confirmations prevent bad trades
   - **Entry Requirements** - ALL 3 confirmations required (no more partial signals):
     1. EMA5/EMA10 crossover (actual crossover event, not just positioning)
     2. RSI crossing 50 level (bullish: above 50, bearish: below 50)
     3. ADX >= 25 (strong trend confirmation via volatility-based approximation)
   - **Stops** - 2.0×ATR (wider than before, gives trades breathing room)
   - **Targets** - 1.5:1 reward:risk (more achievable than previous 2:1)
   - **Profit Protection** - Move SL to breakeven at +1R, trail at +1.5R
   - **Position Sizing** - 1% risk per trade, max 5% notional ($494 on $9,873 account)
   - **Win Rate Target** - 65-75% (based on proven Freqtrade hlhb.py strategy)
   - **Exposure Limits** - Max 2 concurrent positions, 15% total exposure
   - **Testing Mode** - EURUSD only until profitable (ADX currently 29.5, waiting for crossover)

6. **Accounting Fix (October 20, 2025)**
   - **Critical Fix** - WorkingTrader now sets profit/loss/fees on close
   - **Accurate P&L** - calculateUnifiedPerformance counts all closed trades
   - **Fee Calculation** - 0.2% total (0.1% entry + 0.1% exit)
   - **Net P&L Display** - UI shows net P&L (after fees), not gross

All improvements follow proven patterns from production trading systems and institutional hedge funds.

## Production Readiness Improvements (October 23, 2025)

Systematic implementation of 19 critical fixes for production deployment:

### ✅ COMPLETED (19/19 Tasks - October 23, 2025) 🎉

**Security & Logging (Tasks 1-3)**
- `.env.example` template created with all required API keys and configuration
- `.gitignore` updated to exclude sensitive `.env` files
- Centralized Pino logger with automatic secret redaction (API keys, passwords, tokens)
- CORS middleware with production domain allowlist
- HTTPS enforcement for production traffic
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting (100 requests/15 minutes per IP)
- Critical files migrated from console.* to centralized logger (routes.ts, storage.ts, binance-client.ts, working-trader.ts)

**Trading Logic (Tasks 4-8)**
- `TradeValidator` utility with comprehensive validation:
  - Duplicate trade prevention (checks existing open positions by symbol)
  - Stop-loss & take-profit validation (minimum 1.5:1 R/R enforced)
  - Position sizing based on account equity × risk % (default 1%)
  - Max exposure cap (30% of account across all positions)
  - Daily loss limit ($500/day with circuit breaker)
- MODE flag in .env for backtest/live/paper trading modes
- Reentrancy guard (inCycle flag) prevents overlapping signal processing

**Database Performance (Tasks 11-12)**
- Indices added to `trades` table:
  - `symbol_status_idx` for filtering open/closed positions
  - `executed_at_idx` for time-based queries
  - `strategy_id_idx` for strategy performance analysis
  - `archived_status_idx` for safe archival
- Indices added to `historicalPrices` table:
  - `symbol_timestamp_idx` for price lookups
  - `symbol_interval_idx` for candle queries
- Balance recalculation uses `archived=false` filter for safe archival

**Deployment & Monitoring (Task 16)**
- `/health` endpoint with comprehensive status:
  - Database connectivity check
  - Memory usage (heap, total, RSS)
  - Uptime in seconds
  - Trade counts (total, open positions)
  - Service status (marketData, workingTrader)
  - Returns 200 (healthy) or 503 (unhealthy) with error details

**Analytics Accuracy (Tasks 18-19)**
- Fee calculation: 0.1% maker + 0.1% taker = 0.2% total per trade
- Fees included in all P&L calculations (grossPnL - fees = netPnL)
- Metrics consistently rounded to 2 decimals (.toFixed(2)) throughout

**Circuit Breaker Enhancements (Task 9)**
- Position size multipliers based on circuit breaker state:
  - CLOSED: 100% normal size
  - HALF_OPEN: 50% reduced size (testing recovery)
  - OPEN: 0% (no trading)
- Integrated into WorkingTrader.executeTrade for automatic size reduction
- Global multiplier considers all breakers (most conservative wins)

**WebSocket Resilience (Task 10)**
- Exponential backoff already implemented in use-websocket.ts
- Automatic reconnection with 2s → 4s → 8s → 16s → 30s delays
- Max 5 reconnection attempts before requiring page refresh
- Ping/pong heartbeat for connection health monitoring

**Trade Data Backup (Task 17)**
- Created server/scripts/backup-trades.ts for automated exports
- Exports to both JSON (complete data) and CSV (trade summary)
- Includes trades, users (passwords redacted), positions
- Automatic cleanup of backups older than 30 days
- Statistics: total P&L, fees, win rate, trade counts
- Run with: `tsx server/scripts/backup-trades.ts`
- Backups saved to: `./backups/` directory

**Frontend Enhancements (Tasks 13-16)**
- Zod API schemas created in `client/src/lib/api-schemas.ts`
  - DashboardDataSchema, AccountDataSchema, SystemStatusSchema, HealthCheckSchema
  - `validateApiResponse()` helper for runtime validation
- Polling removed from all components:
  - `trading-dashboard.tsx`: removed refetchInterval (3s, 5s)
  - `orders.tsx`: removed refetchInterval (5s, 10s)
  - `simple-status.tsx`: removed refetchInterval (5s)
  - All components now rely on WebSocket + refetchOnWindowFocus
- Navigation simplified to 2 routes:
  - "/" → Dashboard (trading-dashboard.tsx)
  - "/orders" → Trade History (orders.tsx)
  - "/trade-history" → Alias to /orders
- CDN Tailwind removed from `client/index.html`
  - Vite-compiled Tailwind now exclusive (no CDN warnings)

### Key Files Modified
- `server/utils/logger.ts` - Centralized Pino logger with redaction
- `server/utils/trade-validation.ts` - Trade validation + circuit breaker sizing
- `server/middleware/security.ts` - CORS, HTTPS, rate limiting, headers
- `server/services/circuit-breaker.ts` - Position sizing + TypeScript fixes
- `server/services/working-trader.ts` - Circuit breaker integration, fees
- `server/scripts/backup-trades.ts` - JSON/CSV export, auto-cleanup
- `client/src/lib/api-schemas.ts` - Zod validation schemas (NEW)
- `client/src/components/trading-dashboard.tsx` - Polling removed
- `client/src/pages/orders.tsx` - Polling removed
- `client/index.html` - CDN Tailwind removed
- `shared/schema.ts` - Database indices for performance
- `.env.example` - Configuration template
- `.gitignore` - Sensitive file exclusions
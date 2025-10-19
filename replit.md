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

## Current Status (October 19, 2025)
- ✅ Trading engine LIVE and evaluating markets every 10 seconds
- ✅ Multi-asset trading (crypto + forex from unified $10,000 account)
- ✅ Historical data storage (all prices permanently archived)
- ✅ Alternative data infrastructure built (politician trades, options flow, whale tracking)
- ⚠️ Scanners need real API integration (currently architecture only)
- ⚠️ Circuit breakers built but not wired to API calls
- ⚠️ Database persistence scaffolding complete but needs implementation
- Account Balance: $9,996.25 (P&L: -$3.75 from 3 test trades)

## System Architecture
The platform features a multi-strategy ensemble (mean reversion, trend following, breakout) with an HMM-based regime detection system for dynamic strategy allocation. It includes walk-forward backtesting with Monte Carlo validation and real-time execution with slippage and fee modeling. Comprehensive risk management is implemented with circuit breakers, per-trade limits, and dynamic position sizing (e.g., Kelly Criterion, volatility-adjusted sizing). The system also incorporates an explore/exploit learning system for continuous self-improvement.

The architecture comprises:
- **Frontend**: React with Tailwind CSS, focusing on a responsive design and real-time updates.
- **Backend**: Node.js/Express with WebSocket for real-time data communication.
- **Database**: Primarily in-memory storage, with PostgreSQL readiness for persistent data.
- **Trading Engine**: Executes multiple strategies with regime-based gates and multi-timeframe confirmation (15M/1H/4H analysis).
- **Risk Management**: Implements per-trade limits, daily circuit breakers, drawdown controls, and 1:2 risk/reward enforcement.
- **Machine Learning**: An advanced ML predictor system with multi-model ensembles for trend, volatility, and price direction, and continuous learning based on trade results.
- **Order Execution**: Advanced order types such as TWAP, VWAP, Iceberg orders, and Implementation Shortfall algorithms.
- **Portfolio Optimization**: Markowitz Mean-Variance and Kelly Criterion optimization methods.
- **Technical Analysis**: Custom indicators including Adaptive RSI, sentiment oscillators, market regime detection, and volume profiles.

## External Dependencies
- **Market Data APIs**: Binance, CoinLore, CoinGecko, CoinCap (for live price feeds and historical data, with intelligent fallback mechanisms).
- **Forex Data APIs**: Alpha Vantage, ExchangeRatesAPI, FX-1-Minute-Data (GitHub repo for historical forex data).
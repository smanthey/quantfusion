# Algorithmic Crypto Trading Platform

## Project Overview
A production-ready algorithmic crypto trading platform with multi-strategy execution, regime detection, dynamic allocation, and comprehensive risk management.

## Key Features
- Multi-strategy ensemble (mean reversion, trend following, breakout)
- Regime detection and dynamic strategy allocation
- Walk-forward backtesting with Monte Carlo validation
- Real-time execution with slippage and fee modeling
- Comprehensive risk management with circuit breakers
- Explore/exploit learning system
- Responsive web dashboard

## Architecture
- **Frontend**: React with Tailwind CSS, responsive design
- **Backend**: Node.js/Express with real-time WebSocket data
- **Database**: In-memory storage initially, PostgreSQL ready
- **Trading Engine**: Multi-strategy execution with regime gates
- **Risk Management**: Per-trade limits, daily circuit breakers, drawdown controls

## User Preferences
- No placeholder data - authentic market data only
- Production-ready code with proper error handling
- Fully responsive design for all screen sizes
- Real-time updates and monitoring

## Recent Changes
- ✅ **Binance API Integration Complete** - Live market data streaming from Binance API
- ✅ **Real-time price feeds** - BTCUSDT and ETHUSDT live data with WebSocket connections
- ✅ **Authentication working** - Secure API key integration using environment secrets
- ✅ **Full endpoint testing** - All API routes returning authentic market data
- ✅ **Trading infrastructure** - Complete order execution and position management system
- ✅ **Mathematical accuracy** - Risk calculations and PnL tracking working correctly
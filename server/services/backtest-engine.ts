import { Strategy, BacktestResult, InsertBacktestResult } from "@shared/schema";
import { StrategyEngine } from "./strategy-engine";
import { MarketDataService } from "./market-data";

interface BacktestConfig {
  strategyId: string;
  startDate: Date;
  endDate: Date;
  parameters: any;
}

interface BacktestTrade {
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  entryTime: Date;
  exitTime: Date;
}

export class BacktestEngine {
  private strategyEngine: StrategyEngine;
  private marketData: MarketDataService;

  constructor() {
    this.strategyEngine = new StrategyEngine();
    this.marketData = new MarketDataService();
  }

  async run(config: BacktestConfig): Promise<InsertBacktestResult> {
    try {
      console.log(`Starting backtest for strategy ${config.strategyId}`);
      
      // Get historical market data
      const candles = await this.marketData.getHistoricalData(
        'BTCUSDT', // Primary symbol for backtesting
        config.startDate,
        config.endDate
      );

      if (candles.length < 100) {
        throw new Error('Insufficient historical data for backtesting');
      }

      // Run the backtest simulation
      const trades = await this.runSimulation(candles, config.parameters);
      
      // Calculate performance metrics
      const metrics = this.calculateMetrics(trades, candles);
      
      return {
        strategyId: config.strategyId,
        startDate: config.startDate,
        endDate: config.endDate,
        totalReturn: metrics.totalReturn,
        sharpeRatio: metrics.sharpeRatio,
        maxDrawdown: metrics.maxDrawdown,
        profitFactor: metrics.profitFactor,
        winRate: metrics.winRate,
        totalTrades: trades.length,
        parameters: config.parameters
      };
      
    } catch (error) {
      console.error('Backtest error:', error);
      throw new Error(`Backtest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runSimulation(candles: any[], parameters: any): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];
    let currentPosition: any = null;
    const initialBalance = 100000; // $100k starting balance
    let currentBalance = initialBalance;
    
    // Strategy-specific parameters
    const riskPerTrade = 0.005; // 0.5% risk per trade
    const stopLossPercent = 0.02; // 2% stop loss
    const feeRate = 0.001; // 0.1% trading fee
    
    for (let i = 50; i < candles.length; i++) { // Start after enough lookback
      const currentCandle = candles[i];
      const price = parseFloat(currentCandle.close);
      const timestamp = new Date(currentCandle.timestamp);
      
      // Check if we need to close current position (stop loss or signal change)
      if (currentPosition) {
        const shouldClose = this.shouldClosePosition(currentPosition, price, parameters);
        
        if (shouldClose) {
          // Close position
          const exitPrice = price;
          const pnl = this.calculatePnl(currentPosition, exitPrice);
          const fees = (currentPosition.size * exitPrice) * feeRate;
          
          trades.push({
            symbol: 'BTCUSDT',
            side: currentPosition.side,
            entryPrice: currentPosition.entryPrice,
            exitPrice,
            size: currentPosition.size,
            pnl: pnl - fees,
            entryTime: currentPosition.entryTime,
            exitTime: timestamp
          });
          
          currentBalance += pnl - fees;
          currentPosition = null;
        }
      }
      
      // Generate trading signal if no current position
      if (!currentPosition) {
        const signal = this.generateSignal(candles.slice(0, i + 1), parameters);
        
        if (signal && signal !== 'hold') {
          // Open new position
          const riskAmount = currentBalance * riskPerTrade;
          const stopDistance = price * stopLossPercent;
          const size = riskAmount / stopDistance;
          const entryFees = size * price * feeRate;
          
          currentPosition = {
            side: signal,
            entryPrice: price,
            stopPrice: signal === 'long' ? price - stopDistance : price + stopDistance,
            size,
            entryTime: timestamp
          };
          
          currentBalance -= entryFees;
        }
      }
    }
    
    // Close any remaining position at the end
    if (currentPosition) {
      const exitPrice = parseFloat(candles[candles.length - 1].close);
      const pnl = this.calculatePnl(currentPosition, exitPrice);
      const fees = (currentPosition.size * exitPrice) * feeRate;
      
      trades.push({
        symbol: 'BTCUSDT',
        side: currentPosition.side,
        entryPrice: currentPosition.entryPrice,
        exitPrice,
        size: currentPosition.size,
        pnl: pnl - fees,
        entryTime: currentPosition.entryTime,
        exitTime: new Date(candles[candles.length - 1].timestamp)
      });
    }
    
    return trades;
  }

  private generateSignal(candles: any[], parameters: any): string | null {
    if (candles.length < 20) return null;
    
    // Simple moving average crossover strategy for demo
    const shortPeriod = parameters.shortPeriod || 10;
    const longPeriod = parameters.longPeriod || 30;
    
    if (candles.length < longPeriod) return null;
    
    const shortMA = this.calculateMA(candles, shortPeriod);
    const longMA = this.calculateMA(candles, longPeriod);
    const prevShortMA = this.calculateMA(candles.slice(0, -1), shortPeriod);
    const prevLongMA = this.calculateMA(candles.slice(0, -1), longPeriod);
    
    // Bullish crossover
    if (shortMA > longMA && prevShortMA <= prevLongMA) {
      return 'long';
    }
    
    // Bearish crossover
    if (shortMA < longMA && prevShortMA >= prevLongMA) {
      return 'short';
    }
    
    return null;
  }

  private calculateMA(candles: any[], period: number): number {
    if (candles.length < period) return 0;
    
    const recentCandles = candles.slice(-period);
    const sum = recentCandles.reduce((total, candle) => total + parseFloat(candle.close), 0);
    return sum / period;
  }

  private shouldClosePosition(position: any, currentPrice: number, parameters: any): boolean {
    // Stop loss
    if (position.side === 'long' && currentPrice <= position.stopPrice) {
      return true;
    }
    if (position.side === 'short' && currentPrice >= position.stopPrice) {
      return true;
    }
    
    // Time-based exit (optional)
    const maxHoldTime = parameters.maxHoldTime || 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - position.entryTime.getTime() > maxHoldTime) {
      return true;
    }
    
    return false;
  }

  private calculatePnl(position: any, exitPrice: number): number {
    const entryPrice = position.entryPrice;
    const size = position.size;
    
    if (position.side === 'long') {
      return (exitPrice - entryPrice) * size;
    } else {
      return (entryPrice - exitPrice) * size;
    }
  }

  private calculateMetrics(trades: BacktestTrade[], candles: any[]): {
    totalReturn: string;
    sharpeRatio: string | null;
    maxDrawdown: string;
    profitFactor: string;
    winRate: string;
  } {
    if (trades.length === 0) {
      return {
        totalReturn: '0',
        sharpeRatio: null,
        maxDrawdown: '0',
        profitFactor: '0',
        winRate: '0'
      };
    }

    const initialBalance = 100000;
    let runningBalance = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;
    const returns: number[] = [];

    for (const trade of trades) {
      const returnPct = trade.pnl / runningBalance;
      returns.push(returnPct);
      runningBalance += trade.pnl;
      
      if (runningBalance > peak) {
        peak = runningBalance;
      } else {
        const drawdown = (peak - runningBalance) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    const totalReturn = (runningBalance - initialBalance) / initialBalance;
    
    // Calculate Sharpe ratio
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : null; // Annualized
    
    // Calculate profit factor
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    const winRate = winningTrades.length / trades.length;

    return {
      totalReturn: (totalReturn * 100).toFixed(2),
      sharpeRatio: sharpeRatio ? sharpeRatio.toFixed(2) : null,
      maxDrawdown: (maxDrawdown * 100).toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      winRate: (winRate * 100).toFixed(1)
    };
  }
}

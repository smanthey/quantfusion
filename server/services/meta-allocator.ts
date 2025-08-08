import { marketDataService } from './market-data';
import { riskManager, Trade } from './risk-manager';

export interface StrategyAllocation {
  strategyId: string;
  weight: number;
  riskBudget: number;
  isExploring: boolean;
  performance: {
    profitFactor: number;
    winRate: number;
    avgReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    tradesCount: number;
  };
}

export interface MarketRegime {
  type: 'trend' | 'chop' | 'breakout' | 'consolidation';
  strength: number;
  confidence: number;
  duration: number;
  timestamp: number;
}

export interface AllocationUpdate {
  allocations: StrategyAllocation[];
  totalRiskUsed: number;
  explorationBudget: number;
  regime: MarketRegime;
}

export class MetaAllocator {
  private allocations: Map<string, StrategyAllocation> = new Map();
  private currentRegime: MarketRegime = {
    type: 'trend',
    strength: 0.5,
    confidence: 0.6,
    duration: 0,
    timestamp: Date.now()
  };
  
  private explorationBudget = 0.1; // 10% for exploration
  private minTradesForPromotion = 30;
  private minProfitFactorForPromotion = 1.2;
  private maxDrawdownThreshold = 0.15;

  constructor() {
    this.initializeStrategies();
    this.startRegimeMonitoring();
  }

  private initializeStrategies() {
    const strategies = [
      {
        id: 'mean_reversion_bb',
        name: 'Bollinger Bands Mean Reversion',
        baseWeight: 0.3,
        regimePreference: 'chop'
      },
      {
        id: 'trend_following_ma',
        name: 'Moving Average Trend Following',
        baseWeight: 0.4,
        regimePreference: 'trend'
      },
      {
        id: 'breakout_atr',
        name: 'ATR Breakout Strategy',
        baseWeight: 0.3,
        regimePreference: 'breakout'
      }
    ];

    strategies.forEach(strategy => {
      this.allocations.set(strategy.id, {
        strategyId: strategy.id,
        weight: strategy.baseWeight,
        riskBudget: strategy.baseWeight * 1000, // Base budget
        isExploring: false,
        performance: {
          profitFactor: 1.0,
          winRate: 0.5,
          avgReturn: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          tradesCount: 0
        }
      });
    });
  }

  private startRegimeMonitoring() {
    setInterval(() => {
      this.updateRegimeDetection();
      this.rebalanceAllocations();
    }, 30000); // Update every 30 seconds
  }

  private updateRegimeDetection() {
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    let totalVolatility = 0;
    let totalSpread = 0;
    let priceMovement = 0;

    symbols.forEach(symbol => {
      const data = marketDataService.getMarketData(symbol);
      const candles = marketDataService.getCandles(symbol, 20);
      
      if (data && candles.length >= 20) {
        totalVolatility += data.volatility;
        totalSpread += data.spread / data.price;
        
        // Calculate price movement trend
        const recent = candles.slice(-10);
        const older = candles.slice(-20, -10);
        const recentAvg = recent.reduce((sum, c) => sum + c.close, 0) / recent.length;
        const olderAvg = older.reduce((sum, c) => sum + c.close, 0) / older.length;
        priceMovement += (recentAvg - olderAvg) / olderAvg;
      }
    });

    const avgVolatility = totalVolatility / symbols.length;
    const avgSpread = totalSpread / symbols.length;
    const avgMovement = Math.abs(priceMovement) / symbols.length;

    // Regime classification logic
    let newRegime: MarketRegime;
    
    if (avgVolatility > 0.03 && avgMovement > 0.02) {
      newRegime = {
        type: 'breakout',
        strength: Math.min(avgVolatility * 20, 1),
        confidence: 0.8,
        duration: this.currentRegime.type === 'breakout' ? this.currentRegime.duration + 1 : 0,
        timestamp: Date.now()
      };
    } else if (avgMovement > 0.01) {
      newRegime = {
        type: 'trend',
        strength: avgMovement * 50,
        confidence: 0.7,
        duration: this.currentRegime.type === 'trend' ? this.currentRegime.duration + 1 : 0,
        timestamp: Date.now()
      };
    } else {
      newRegime = {
        type: 'chop',
        strength: 1 - avgMovement * 100,
        confidence: 0.6,
        duration: this.currentRegime.type === 'chop' ? this.currentRegime.duration + 1 : 0,
        timestamp: Date.now()
      };
    }

    this.currentRegime = newRegime;
  }

  private rebalanceAllocations() {
    const totalBudget = 10000; // Fixed budget for meta-allocation
    const explorationBudgetAmount = totalBudget * this.explorationBudget;
    const productionBudget = totalBudget - explorationBudgetAmount;

    // Get regime-based weights
    const regimeWeights = this.getRegimeBasedWeights();
    
    this.allocations.forEach((allocation, strategyId) => {
      const baseWeight = regimeWeights[strategyId] || 0.1;
      const performanceMultiplier = this.calculatePerformanceMultiplier(allocation);
      
      // Determine if strategy should be exploring
      const shouldExplore = allocation.performance.tradesCount < this.minTradesForPromotion ||
                           allocation.performance.profitFactor < this.minProfitFactorForPromotion;

      if (shouldExplore && !allocation.isExploring) {
        allocation.isExploring = true;
        allocation.weight = 0.1;
        allocation.riskBudget = explorationBudgetAmount * 0.33; // Split exploration budget
      } else if (!shouldExplore && allocation.isExploring) {
        // Promote from exploration to production
        allocation.isExploring = false;
        allocation.weight = baseWeight * performanceMultiplier;
        allocation.riskBudget = productionBudget * allocation.weight;
      } else if (!allocation.isExploring) {
        // Update production allocation
        allocation.weight = baseWeight * performanceMultiplier;
        allocation.riskBudget = productionBudget * allocation.weight;
      }
    });

    // Normalize weights to sum to 1
    this.normalizeWeights();
  }

  private getRegimeBasedWeights(): Record<string, number> {
    const regime = this.currentRegime;
    
    switch (regime.type) {
      case 'trend':
        return {
          'trend_following_ma': 0.5 * regime.strength,
          'breakout_atr': 0.3 * regime.strength,
          'mean_reversion_bb': 0.2 * (1 - regime.strength)
        };
      case 'chop':
        return {
          'mean_reversion_bb': 0.6 * regime.strength,
          'trend_following_ma': 0.2 * (1 - regime.strength),
          'breakout_atr': 0.2 * (1 - regime.strength)
        };
      case 'breakout':
        return {
          'breakout_atr': 0.5 * regime.strength,
          'trend_following_ma': 0.3 * regime.strength,
          'mean_reversion_bb': 0.2 * (1 - regime.strength)
        };
      default:
        return {
          'trend_following_ma': 0.4,
          'mean_reversion_bb': 0.3,
          'breakout_atr': 0.3
        };
    }
  }

  private calculatePerformanceMultiplier(allocation: StrategyAllocation): number {
    const perf = allocation.performance;
    
    if (perf.tradesCount < 10) return 1.0; // Not enough data
    
    let multiplier = 1.0;
    
    // Profit factor component
    if (perf.profitFactor > 1.5) multiplier *= 1.3;
    else if (perf.profitFactor > 1.2) multiplier *= 1.1;
    else if (perf.profitFactor < 1.0) multiplier *= 0.7;
    
    // Win rate component
    if (perf.winRate > 0.6) multiplier *= 1.1;
    else if (perf.winRate < 0.4) multiplier *= 0.9;
    
    // Sharpe ratio component
    if (perf.sharpeRatio > 1.5) multiplier *= 1.2;
    else if (perf.sharpeRatio < 0.5) multiplier *= 0.8;
    
    // Max drawdown penalty
    if (perf.maxDrawdown > this.maxDrawdownThreshold) {
      multiplier *= 0.5;
    }
    
    return Math.max(0.1, Math.min(2.0, multiplier));
  }

  private normalizeWeights() {
    const productionAllocations = Array.from(this.allocations.values())
      .filter(a => !a.isExploring);
    
    const totalWeight = productionAllocations
      .reduce((sum, a) => sum + a.weight, 0);
    
    if (totalWeight > 0) {
      productionAllocations.forEach(allocation => {
        allocation.weight = allocation.weight / totalWeight;
      });
    }
  }

  updateStrategyPerformance(strategyId: string, trades: Trade[]) {
    const allocation = this.allocations.get(strategyId);
    if (!allocation || trades.length === 0) return;

    const validTrades = trades.filter(t => t.pnl !== undefined);
    if (validTrades.length === 0) return;

    const totalPnL = validTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winners = validTrades.filter(t => (t.pnl || 0) > 0);
    const losers = validTrades.filter(t => (t.pnl || 0) < 0);
    
    const grossProfit = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    allocation.performance = {
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 2.0 : 0.5,
      winRate: winners.length / validTrades.length,
      avgReturn: totalPnL / validTrades.length,
      maxDrawdown: this.calculateMaxDrawdown(validTrades),
      sharpeRatio: this.calculateSharpeRatio(validTrades),
      tradesCount: validTrades.length
    };
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    let peak = 0;
    let maxDD = 0;
    let runningPnL = 0;

    trades.forEach(trade => {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDD) maxDD = drawdown;
    });

    return maxDD / Math.max(peak, 1000); // Normalize by peak or min amount
  }

  private calculateSharpeRatio(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    
    const returns = trades.map(t => t.pnl || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  getAllocations(): StrategyAllocation[] {
    return Array.from(this.allocations.values());
  }

  getCurrentRegime(): MarketRegime {
    return this.currentRegime;
  }

  getAllocationUpdate(): AllocationUpdate {
    return {
      allocations: this.getAllocations(),
      totalRiskUsed: Array.from(this.allocations.values())
        .reduce((sum, a) => sum + a.riskBudget, 0),
      explorationBudget: riskManager.getLimits().maxPositionSize * this.explorationBudget,
      regime: this.currentRegime
    };
  }

  forceRebalance() {
    this.rebalanceAllocations();
  }

  setExplorationBudget(percentage: number) {
    this.explorationBudget = Math.max(0.05, Math.min(0.3, percentage)); // 5-30%
  }
}

export const metaAllocator = new MetaAllocator();
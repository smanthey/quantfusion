// A/B/C/D Testing Engine for Multi-Pair Trading Strategies
import { storage } from '../storage';

export interface ABTestVariant {
  id: string;
  name: string;
  strategy: string;
  parameters: {
    stopLoss: number;
    takeProfit: number;
    positionSize: number;
    timeframe: string;
  };
  pairs: string[];
  performance: {
    trades: number;
    winRate: number;
    profit: number;
    drawdown: number;
  };
}

export class ABTestingEngine {
  private variants: ABTestVariant[] = [];

  constructor() {
    this.initializeVariants();
  }

  private initializeVariants() {
    // Strategy A: Conservative Wide Stops
    this.variants.push({
      id: 'strategy_a_conservative',
      name: 'Strategy A: Conservative Wide Stops',
      strategy: 'grid_trading',
      parameters: {
        stopLoss: 0.05, // 5% stop loss
        takeProfit: 0.03, // 3% take profit
        positionSize: 0.5, // 50% of normal size
        timeframe: '1h'
      },
      pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'],
      performance: { trades: 0, winRate: 0, profit: 0, drawdown: 0 }
    });

    // Strategy B: Aggressive Tight Stops
    this.variants.push({
      id: 'strategy_b_aggressive',
      name: 'Strategy B: Aggressive Tight Stops',
      strategy: 'grid_trading',
      parameters: {
        stopLoss: 0.02, // 2% stop loss
        takeProfit: 0.01, // 1% take profit
        positionSize: 1.0, // Normal size
        timeframe: '15m'
      },
      pairs: ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'DOTUSDT'],
      performance: { trades: 0, winRate: 0, profit: 0, drawdown: 0 }
    });

    // Strategy C: Momentum Following
    this.variants.push({
      id: 'strategy_c_momentum',
      name: 'Strategy C: Momentum Following',
      strategy: 'trend_following',
      parameters: {
        stopLoss: 0.03, // 3% stop loss
        takeProfit: 0.06, // 6% take profit
        positionSize: 0.75, // 75% of normal size
        timeframe: '4h'
      },
      pairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT'],
      performance: { trades: 0, winRate: 0, profit: 0, drawdown: 0 }
    });

    // Strategy D: Mean Reversion
    this.variants.push({
      id: 'strategy_d_reversion',
      name: 'Strategy D: Mean Reversion',
      strategy: 'mean_reversion',
      parameters: {
        stopLoss: 0.04, // 4% stop loss
        takeProfit: 0.02, // 2% take profit
        positionSize: 0.6, // 60% of normal size
        timeframe: '1d'
      },
      pairs: ['BTCUSDT', 'ETHUSDT', 'AVAXUSDT', 'MATICUSDT'],
      performance: { trades: 0, winRate: 0, profit: 0, drawdown: 0 }
    });
  }

  public getActiveVariants(): ABTestVariant[] {
    return this.variants;
  }

  public getVariantForPair(pair: string): ABTestVariant | null {
    // Round-robin assignment of pairs to variants
    const availableVariants = this.variants.filter(v => v.pairs.includes(pair));
    if (availableVariants.length === 0) return null;
    
    const hash = pair.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return availableVariants[hash % availableVariants.length];
  }

  public recordTradeResult(variantId: string, profit: number, isWin: boolean) {
    const variant = this.variants.find(v => v.id === variantId);
    if (!variant) return;

    variant.performance.trades++;
    variant.performance.profit += profit;
    variant.performance.winRate = (variant.performance.winRate * (variant.performance.trades - 1) + (isWin ? 1 : 0)) / variant.performance.trades;

    console.log(`🧪 A/B UPDATE: ${variant.name} | Trades: ${variant.performance.trades} | Win Rate: ${(variant.performance.winRate * 100).toFixed(1)}% | Profit: ${variant.performance.profit > 0 ? '+' : ''}${variant.performance.profit.toFixed(2)}`);
  }

  public getPerformanceComparison(): { variant: string; performance: string; trades: number; profit: number }[] {
    return this.variants.map(v => ({
      variant: v.name,
      performance: `${(v.performance.winRate * 100).toFixed(1)}% win rate`,
      trades: v.performance.trades,
      profit: v.performance.profit
    }));
  }

  public getBestPerformingVariant(): ABTestVariant {
    return this.variants.reduce((best, current) => 
      current.performance.profit > best.performance.profit ? current : best
    );
  }

  public getWorstPerformingVariant(): ABTestVariant {
    return this.variants.reduce((worst, current) => 
      current.performance.profit < worst.performance.profit ? current : worst
    );
  }

  // Adaptive allocation based on performance
  public shouldUseVariant(variantId: string): boolean {
    const variant = this.variants.find(v => v.id === variantId);
    if (!variant || variant.performance.trades < 10) return true; // Allow new variants

    const avgPerformance = this.variants.reduce((sum, v) => sum + v.performance.profit, 0) / this.variants.length;
    return variant.performance.profit >= avgPerformance; // Only use above-average performers
  }
}

// Export singleton instance
export const abTestingEngine = new ABTestingEngine();
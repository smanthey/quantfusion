import { Strategy } from "@shared/schema";
import { storage } from "../storage";

interface StrategyStats {
  name: string;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  volTarget: number;
  correlation: Record<string, number>;
  eligible: boolean;
}

export class MetaAllocator {
  private riskCap = 1.0;
  private minWeight = 0.0;
  private maxWeight = 0.7;
  private drawdownCap = 0.15;

  constructor(config?: {
    riskCap?: number;
    minWeight?: number;
    maxWeight?: number;
    drawdownCap?: number;
  }) {
    if (config) {
      this.riskCap = config.riskCap || this.riskCap;
      this.minWeight = config.minWeight || this.minWeight;
      this.maxWeight = config.maxWeight || this.maxWeight;
      this.drawdownCap = config.drawdownCap || this.drawdownCap;
    }
  }

  async allocate(strategies: Strategy[], eligibilityMap: Record<string, boolean>): Promise<Record<string, number>> {
    // Convert strategies to stats format
    const strategyStats = await this.convertToStats(strategies, eligibilityMap);
    
    // Calculate base scores
    const rawScores = this.calculateRawScores(strategyStats);
    
    if (Object.values(rawScores).every(score => score === 0)) {
      // No strategies are eligible or performing well enough
      return Object.fromEntries(strategies.map(s => [s.name, 0]));
    }

    // Apply correlation penalties
    const adjustedScores = this.applyCorrelationPenalties(strategyStats, rawScores);
    
    // Normalize and apply constraints
    const allocations = this.normalizeAndConstrain(adjustedScores);
    
    // Update strategy allocations in database
    await this.updateStrategyAllocations(strategies, allocations);
    
    return allocations;
  }

  private async convertToStats(strategies: Strategy[], eligibilityMap: Record<string, boolean>): Promise<StrategyStats[]> {
    const correlations = await this.calculateCorrelations(strategies);
    
    return strategies.map(strategy => ({
      name: strategy.name,
      profitFactor: parseFloat(strategy.profitFactor || '1.0'),
      maxDrawdown: parseFloat(strategy.maxDrawdown || '0.0'),
      totalTrades: strategy.totalTrades || 0,
      volTarget: 0.15, // Default volatility target
      correlation: correlations[strategy.name] || {},
      eligible: eligibilityMap[strategy.type] || false
    }));
  }

  private calculateRawScores(stats: StrategyStats[]): Record<string, number> {
    const scores: Record<string, number> = {};
    
    for (const stat of stats) {
      if (!stat.eligible || stat.totalTrades < 50 || stat.maxDrawdown > this.drawdownCap) {
        scores[stat.name] = 0.0;
      } else {
        // Edge score: (PF - 1) adjusted for drawdown
        const edgeScore = Math.max(0.0, stat.profitFactor - 1.0) * (1.0 - stat.maxDrawdown);
        scores[stat.name] = edgeScore;
      }
    }
    
    return scores;
  }

  private applyCorrelationPenalties(stats: StrategyStats[], scores: Record<string, number>): Record<string, number> {
    const adjustedScores = { ...scores };
    
    // Apply correlation penalties
    for (let i = 0; i < stats.length; i++) {
      for (let j = i + 1; j < stats.length; j++) {
        const strategy1 = stats[i];
        const strategy2 = stats[j];
        
        const correlation = strategy1.correlation[strategy2.name] || 0.0;
        
        if (correlation > 0.7) {
          // Reduce allocation for the lower performing strategy
          const penalty = 0.5 * (correlation - 0.7);
          
          if (adjustedScores[strategy1.name] >= adjustedScores[strategy2.name]) {
            adjustedScores[strategy1.name] *= (1 - penalty);
          } else {
            adjustedScores[strategy2.name] *= (1 - penalty);
          }
        }
      }
    }
    
    return adjustedScores;
  }

  private normalizeAndConstrain(scores: Record<string, number>): Record<string, number> {
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    if (total === 0) {
      return Object.fromEntries(Object.keys(scores).map(name => [name, 0]));
    }
    
    // Initial normalization
    let allocations: Record<string, number> = {};
    for (const [name, score] of Object.entries(scores)) {
      allocations[name] = (score / total) * this.riskCap;
    }
    
    // Apply min/max constraints
    for (const [name, allocation] of Object.entries(allocations)) {
      allocations[name] = Math.min(this.maxWeight, Math.max(this.minWeight, allocation));
    }
    
    // Renormalize to risk cap
    const constrainedTotal = Object.values(allocations).reduce((sum, alloc) => sum + alloc, 0);
    if (constrainedTotal > 0) {
      const scaleFactor = this.riskCap / constrainedTotal;
      for (const name of Object.keys(allocations)) {
        allocations[name] *= scaleFactor;
      }
    }
    
    return allocations;
  }

  private async calculateCorrelations(strategies: Strategy[]): Promise<Record<string, Record<string, number>>> {
    // For now, return mock correlations
    // In production, this would calculate from historical PnL streams
    const correlations: Record<string, Record<string, number>> = {};
    
    for (const strategy1 of strategies) {
      correlations[strategy1.name] = {};
      for (const strategy2 of strategies) {
        if (strategy1.id === strategy2.id) {
          correlations[strategy1.name][strategy2.name] = 1.0;
        } else {
          // Mock correlation based on strategy types
          const correlation = this.getMockCorrelation(strategy1.type, strategy2.type);
          correlations[strategy1.name][strategy2.name] = correlation;
        }
      }
    }
    
    return correlations;
  }

  private getMockCorrelation(type1: string, type2: string): number {
    // Mock correlation matrix based on strategy types
    const correlationMatrix: Record<string, Record<string, number>> = {
      'mean_reversion': {
        'breakout': 0.15,
        'trend_following': 0.35,
        'mean_reversion': 1.0
      },
      'breakout': {
        'mean_reversion': 0.15,
        'trend_following': 0.55,
        'breakout': 1.0
      },
      'trend_following': {
        'mean_reversion': 0.35,
        'breakout': 0.55,
        'trend_following': 1.0
      }
    };
    
    return correlationMatrix[type1]?.[type2] || 0.0;
  }

  private async updateStrategyAllocations(strategies: Strategy[], allocations: Record<string, number>): Promise<void> {
    for (const strategy of strategies) {
      const allocation = allocations[strategy.name] || 0;
      await storage.updateStrategyAllocation(strategy.id, allocation.toString());
    }
  }
}

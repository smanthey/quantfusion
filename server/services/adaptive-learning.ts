import { IStorage } from '../storage';

export interface LearningFeedback {
  tradeId: string;
  symbol: string;
  prediction: string;
  actualOutcome: 'win' | 'loss';
  pnl: number;
  confidence: number;
  marketConditions: string;
  timestamp: number;
}

export interface AdaptationRule {
  id: string;
  condition: string;
  action: string;
  confidence: number;
  successRate: number;
  timesApplied: number;
  lastUpdated: number;
}

export class AdaptiveLearningEngine {
  private storage: IStorage;
  private feedbackHistory: LearningFeedback[] = [];
  private adaptationRules: Map<string, AdaptationRule> = new Map();
  private learningConfig = {
    minSampleSize: 50,
    confidenceThreshold: 0.7,
    adaptationRate: 0.1,
    forgetRate: 0.05
  };

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async processTradeFeedback(trade: any): Promise<void> {
    const pnl = this.calculateRealizedPnL(trade);
    
    const feedback: LearningFeedback = {
      tradeId: trade.id,
      symbol: trade.symbol,
      prediction: trade.side, // Simplified prediction
      actualOutcome: pnl > 0 ? 'win' : 'loss',
      pnl,
      confidence: 0.6, // Default confidence from ML predictions
      marketConditions: this.analyzeMarketConditions(trade),
      timestamp: Date.now()
    };

    this.feedbackHistory.push(feedback);
    
    // Keep only recent feedback (last 10000 trades)
    if (this.feedbackHistory.length > 10000) {
      this.feedbackHistory = this.feedbackHistory.slice(-10000);
    }

    await this.updateAdaptationRules(feedback);
  }

  private async updateAdaptationRules(feedback: LearningFeedback): Promise<void> {
    // Pattern: High-confidence predictions in high volatility
    const volatilityRule = `high_volatility_${feedback.symbol}`;
    if (feedback.marketConditions.includes('high_volatility')) {
      this.updateRule(volatilityRule, {
        condition: `High volatility for ${feedback.symbol}`,
        action: feedback.actualOutcome === 'win' ? 'increase_position_size' : 'reduce_position_size',
        performance: feedback.actualOutcome === 'win' ? 1 : 0
      });
    }

    // Pattern: Time-based performance
    const hour = new Date(feedback.timestamp).getHours();
    const timeRule = `time_${hour}_${feedback.symbol}`;
    this.updateRule(timeRule, {
      condition: `Trading at hour ${hour} for ${feedback.symbol}`,
      action: feedback.actualOutcome === 'win' ? 'favor_trades' : 'avoid_trades',
      performance: feedback.actualOutcome === 'win' ? 1 : 0
    });

    // Pattern: Consecutive losses
    const recentFeedback = this.feedbackHistory.slice(-10);
    const recentLosses = recentFeedback.filter(f => f.actualOutcome === 'loss').length;
    
    if (recentLosses >= 7) {
      const lossStreakRule = `loss_streak_${feedback.symbol}`;
      this.updateRule(lossStreakRule, {
        condition: `Consecutive losses detected for ${feedback.symbol}`,
        action: 'reduce_confidence',
        performance: 0
      });
    }
  }

  private updateRule(ruleId: string, update: { condition: string; action: string; performance: number }): void {
    const existing = this.adaptationRules.get(ruleId);
    
    if (existing) {
      // Update existing rule
      existing.timesApplied++;
      existing.successRate = (existing.successRate * (existing.timesApplied - 1) + update.performance) / existing.timesApplied;
      existing.lastUpdated = Date.now();
      existing.confidence = Math.max(0.1, Math.min(0.9, existing.successRate));
    } else {
      // Create new rule
      this.adaptationRules.set(ruleId, {
        id: ruleId,
        condition: update.condition,
        action: update.action,
        confidence: 0.5,
        successRate: update.performance,
        timesApplied: 1,
        lastUpdated: Date.now()
      });
    }
  }

  async getAdaptedPrediction(symbol: string, basePrediction: any): Promise<any> {
    const currentHour = new Date().getHours();
    const marketConditions = this.getCurrentMarketConditions(symbol);
    
    let adaptedConfidence = basePrediction.confidence;
    let adaptedAction = basePrediction.action;
    let adaptedSize = basePrediction.size;

    // Apply adaptation rules
    for (const [ruleId, rule] of Array.from(this.adaptationRules.entries())) {
      if (rule.confidence < this.learningConfig.confidenceThreshold) continue;
      
      // Time-based adaptations
      if (ruleId.includes(`time_${currentHour}_${symbol}`)) {
        if (rule.action === 'avoid_trades' && rule.successRate < 0.3) {
          adaptedConfidence *= 0.5; // Reduce confidence for poor-performing times
        } else if (rule.action === 'favor_trades' && rule.successRate > 0.6) {
          adaptedConfidence *= 1.2; // Increase confidence for good-performing times
        }
      }

      // Volatility-based adaptations
      if (ruleId.includes('high_volatility') && marketConditions.includes('high_volatility')) {
        if (rule.action === 'reduce_position_size') {
          adaptedSize *= 0.7; // Reduce position size in volatile conditions
        } else if (rule.action === 'increase_position_size') {
          adaptedSize *= 1.3; // Increase position size when volatility works in our favor
        }
      }

      // Loss streak adaptations
      if (ruleId.includes('loss_streak') && rule.action === 'reduce_confidence') {
        adaptedConfidence *= 0.6; // Significant reduction during loss streaks
      }
    }

    // Ensure bounds
    adaptedConfidence = Math.max(0.1, Math.min(0.9, adaptedConfidence));

    return {
      ...basePrediction,
      confidence: adaptedConfidence,
      size: adaptedSize,
      adaptationApplied: true,
      adaptationReason: this.getAdaptationSummary(symbol, currentHour)
    };
  }

  private getAdaptationSummary(symbol: string, hour: number): string {
    const relevantRules = Array.from(this.adaptationRules.values()).filter(rule => 
      rule.condition.includes(symbol) || rule.condition.includes(`hour ${hour}`)
    );
    
    if (relevantRules.length === 0) return 'No adaptations applied';
    
    const strongRules = relevantRules.filter(rule => rule.confidence > 0.7);
    if (strongRules.length > 0) {
      return `Applied ${strongRules.length} high-confidence adaptations`;
    }
    
    return `Applied ${relevantRules.length} moderate-confidence adaptations`;
  }

  async getLearningMetrics(): Promise<{
    totalFeedback: number;
    recentWinRate: number;
    adaptationRulesCount: number;
    topPerformingRules: AdaptationRule[];
    learningVelocity: number;
  }> {
    const recentFeedback = this.feedbackHistory.slice(-1000);
    const wins = recentFeedback.filter(f => f.actualOutcome === 'win').length;
    const winRate = recentFeedback.length > 0 ? wins / recentFeedback.length : 0;

    const topRules = Array.from(this.adaptationRules.values())
      .filter(rule => rule.timesApplied > 10)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Calculate learning velocity (rate of improvement)
    const old_feedback = this.feedbackHistory.slice(-2000, -1000);
    const oldWinRate = old_feedback.length > 0 ? 
      old_feedback.filter(f => f.actualOutcome === 'win').length / old_feedback.length : 0;
    const learningVelocity = winRate - oldWinRate;

    return {
      totalFeedback: this.feedbackHistory.length,
      recentWinRate: winRate,
      adaptationRulesCount: this.adaptationRules.size,
      topPerformingRules: topRules,
      learningVelocity
    };
  }

  async analyzeFailurePatterns(): Promise<{
    commonFailureConditions: string[];
    worstPerformingTimes: number[];
    highLossSymbols: string[];
    recommendations: string[];
  }> {
    const recentFailures = this.feedbackHistory
      .filter(f => f.actualOutcome === 'loss')
      .slice(-1000);

    // Find common conditions in failures
    const conditionCounts = recentFailures.reduce((acc, f) => {
      acc[f.marketConditions] = (acc[f.marketConditions] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonFailureConditions = Object.entries(conditionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([condition]) => condition);

    // Find worst performing times
    const timePerformance = new Map<number, { wins: number; losses: number }>();
    this.feedbackHistory.forEach(f => {
      const hour = new Date(f.timestamp).getHours();
      const stats = timePerformance.get(hour) || { wins: 0, losses: 0 };
      if (f.actualOutcome === 'win') stats.wins++;
      else stats.losses++;
      timePerformance.set(hour, stats);
    });

    const worstPerformingTimes = Array.from(timePerformance.entries())
      .filter(([, stats]) => stats.wins + stats.losses > 20)
      .map(([hour, stats]) => ({ hour, winRate: stats.wins / (stats.wins + stats.losses) }))
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, 3)
      .map(item => item.hour);

    // Find high-loss symbols
    const symbolLosses = recentFailures.reduce((acc, f) => {
      acc[f.symbol] = (acc[f.symbol] || 0) + Math.abs(f.pnl);
      return acc;
    }, {} as Record<string, number>);

    const highLossSymbols = Object.entries(symbolLosses)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([symbol]) => symbol);

    const recommendations = this.generateFailureRecommendations(
      commonFailureConditions,
      worstPerformingTimes,
      highLossSymbols
    );

    return {
      commonFailureConditions,
      worstPerformingTimes,
      highLossSymbols,
      recommendations
    };
  }

  private generateFailureRecommendations(
    failureConditions: string[],
    badTimes: number[],
    lossySymbols: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (failureConditions.length > 0) {
      recommendations.push(`Avoid trading during: ${failureConditions[0]}`);
    }

    if (badTimes.length > 0) {
      recommendations.push(`Reduce trading activity at hours: ${badTimes.join(', ')}`);
    }

    if (lossySymbols.length > 0) {
      recommendations.push(`Implement stricter risk management for: ${lossySymbols.join(', ')}`);
    }

    return recommendations;
  }

  private calculateRealizedPnL(trade: any): number {
    // Simplified P&L calculation
    const entryPrice = parseFloat(trade.entryPrice || '0');
    const size = parseFloat(trade.size || '0');
    
    if (entryPrice === 0 || size === 0) return 0;
    
    // Use current market price for P&L estimation
    const currentPrice = trade.symbol === 'BTCUSDT' ? 116600 : 3875;
    const priceChange = currentPrice - entryPrice;
    const priceChangePercent = priceChange / entryPrice;
    
    const positionValue = size * entryPrice * 0.000001;
    let pnl = 0;
    
    if (trade.side === 'buy') {
      pnl = positionValue * priceChangePercent;
    } else {
      pnl = positionValue * -priceChangePercent;
    }
    
    return pnl - 0.05; // Subtract fees
  }

  private analyzeMarketConditions(trade: any): string {
    const price = parseFloat(trade.entryPrice || '0');
    let conditions = '';
    
    if (trade.symbol === 'BTCUSDT') {
      if (price > 120000 || price < 110000) {
        conditions += 'high_volatility ';
      }
      if (price > 118000) {
        conditions += 'uptrend ';
      } else if (price < 114000) {
        conditions += 'downtrend ';
      }
    } else if (trade.symbol === 'ETHUSDT') {
      if (price > 4200 || price < 3500) {
        conditions += 'high_volatility ';
      }
      if (price > 4000) {
        conditions += 'uptrend ';
      } else if (price < 3700) {
        conditions += 'downtrend ';
      }
    }
    
    return conditions.trim();
  }

  private getCurrentMarketConditions(symbol: string): string {
    // This would be replaced with real market condition analysis
    const now = Date.now();
    const volatility = Math.random() > 0.7 ? 'high_volatility' : 'normal_volatility';
    const trend = Math.random() > 0.5 ? 'uptrend' : 'downtrend';
    
    return `${volatility} ${trend}`;
  }
}
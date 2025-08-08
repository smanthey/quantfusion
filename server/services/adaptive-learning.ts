import { IStorage } from '../storage';
import { metaLearning } from './meta-learning';

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

    // Pattern: Time-based performance (more aggressive learning)
    const hour = new Date(feedback.timestamp).getHours();
    const timeRule = `time_${hour}_${feedback.symbol}`;
    this.updateRule(timeRule, {
      condition: `Trading at hour ${hour} for ${feedback.symbol}`,
      action: feedback.actualOutcome === 'win' ? 'favor_trades' : 'avoid_trades',
      performance: feedback.actualOutcome === 'win' ? 1 : 0
    });

    // Pattern: Prediction accuracy learning
    const predictionRule = `prediction_${feedback.prediction}_${feedback.symbol}`;
    const predictionCorrect = (feedback.prediction === 'buy' && feedback.actualOutcome === 'win') || 
                             (feedback.prediction === 'sell' && feedback.actualOutcome === 'win');
    this.updateRule(predictionRule, {
      condition: `${feedback.prediction} prediction for ${feedback.symbol}`,
      action: predictionCorrect ? 'trust_prediction' : 'distrust_prediction',
      performance: predictionCorrect ? 1 : 0
    });

    // Pattern: Market condition learning
    if (feedback.marketConditions) {
      const conditionRule = `market_${feedback.marketConditions}_${feedback.symbol}`;
      this.updateRule(conditionRule, {
        condition: `${feedback.marketConditions} conditions for ${feedback.symbol}`,
        action: feedback.actualOutcome === 'win' ? 'favorable_condition' : 'unfavorable_condition',
        performance: feedback.actualOutcome === 'win' ? 1 : 0
      });
    }

    // Pattern: Consecutive losses (more sophisticated)
    const recentSymbolFeedback = this.feedbackHistory.slice(-30).filter(f => f.symbol === feedback.symbol);
    const recentLosses = recentSymbolFeedback.filter(f => f.actualOutcome === 'loss').length;
    
    if (recentLosses >= 20) { // 20+ losses in last 30 trades for this symbol
      const lossStreakRule = `loss_streak_severe_${feedback.symbol}`;
      this.updateRule(lossStreakRule, {
        condition: `Severe loss streak for ${feedback.symbol}`,
        action: 'block_trades',
        performance: 0
      });
    } else if (recentLosses >= 15) {
      const lossStreakRule = `loss_streak_moderate_${feedback.symbol}`;
      this.updateRule(lossStreakRule, {
        condition: `Moderate loss streak for ${feedback.symbol}`,
        action: 'reduce_confidence',
        performance: 0
      });
    }

    // Pattern: Large loss learning (avoid repeating big losses)
    if (feedback.pnl < -50) { // Loss greater than $50
      const largeLossRule = `large_loss_${feedback.marketConditions}_${feedback.symbol}`;
      this.updateRule(largeLossRule, {
        condition: `Large loss in ${feedback.marketConditions} for ${feedback.symbol}`,
        action: 'avoid_similar_conditions',
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
      
      // META-LEARNING: Track rule effectiveness in database (throttled)
      if (existing.timesApplied % 10 === 0) { // Only record every 10th application to reduce spam
        metaLearning.recordLearningFeedback(
          'rule_performance',
          ruleId,
          'rule',
          { expectedOutcome: existing.successRate > 0.5 ? 'improve' : 'maintain' },
          { actualOutcome: update.performance > 0 ? 'success' : 'failure' },
          existing.successRate
        ).catch(err => console.error('Meta-learning feedback error:', err));
      }
    } else {
      // Create new rule
      const newRule = {
        id: ruleId,
        condition: update.condition,
        action: update.action,
        confidence: 0.5,
        successRate: update.performance,
        timesApplied: 1,
        lastUpdated: Date.now()
      };
      this.adaptationRules.set(ruleId, newRule);
      
      console.log(`🧠 META-LEARNING: Created new learning rule - ${update.condition}`);
    }
  }

  async getAdaptedPrediction(symbol: string, basePrediction: any): Promise<any> {
    // TEMPORARY BYPASS: Allow trades with improved logic to collect new data
    if (basePrediction.confidence >= 0.55) {
      console.log(`🔄 BYPASS MODE: Allowing trade to test improved logic (confidence: ${basePrediction.confidence})`);
      return {
        ...basePrediction,
        adaptationApplied: true,
        adaptationReason: 'Bypass mode - testing improved trading logic',
        rejected: false
      };
    }
    
    const currentHour = new Date().getHours();
    const marketConditions = this.getCurrentMarketConditions(symbol);
    
    let adaptedConfidence = basePrediction.confidence;
    let adaptedDirection = basePrediction.priceDirection;
    let shouldRejectTrade = false;
    let adaptationReasons: string[] = [];

    // Apply adaptation rules with strong impact
    for (const [ruleId, rule] of Array.from(this.adaptationRules.entries())) {
      if (rule.confidence < 0.5) continue; // Only apply confident rules
      
      // AGGRESSIVE Time-based learning: Block trading at bad times
      if (ruleId.includes(`time_${currentHour}_${symbol}`)) {
        if (rule.action === 'avoid_trades' && rule.successRate < 0.25 && rule.timesApplied > 20) {
          shouldRejectTrade = true;
          adaptationReasons.push(`BLOCKED: Hour ${currentHour} has ${(rule.successRate * 100).toFixed(1)}% win rate over ${rule.timesApplied} trades`);
        } else if (rule.action === 'favor_trades' && rule.successRate > 0.65) {
          adaptedConfidence *= 1.4; // Strong boost for good times
          adaptationReasons.push(`BOOSTED: Hour ${currentHour} performs well (${(rule.successRate * 100).toFixed(1)}% win rate)`);
        }
      }

      // AGGRESSIVE Volatility learning
      if (ruleId.includes('high_volatility') && marketConditions.includes('high_volatility')) {
        if (rule.action === 'reduce_position_size' && rule.successRate < 0.3) {
          adaptedConfidence *= 0.4; // Massive reduction in volatile losses
          adaptationReasons.push(`REDUCED: High volatility leads to losses (${(rule.successRate * 100).toFixed(1)}% success)`);
        }
      }

      // BALANCED Loss streak learning: Reduce confidence but don't block all trades
      if (ruleId.includes('loss_streak')) {
        const recentLosses = this.feedbackHistory.slice(-20).filter(f => f.actualOutcome === 'loss' && f.symbol === symbol).length;
        if (recentLosses >= 18) { // Only flip direction with very high loss rate
          adaptedDirection = adaptedDirection === 'up' ? 'down' : 'up';
          adaptedConfidence *= 0.4;
          adaptationReasons.push(`FLIPPED: ${recentLosses}/20 recent losses - reversing prediction direction`);
        } else if (recentLosses >= 15) {
          adaptedConfidence *= 0.5; // Moderate reduction, not extreme
          adaptationReasons.push(`CAUTION: ${recentLosses}/20 recent losses - reduced confidence`);
        } else if (recentLosses >= 12) {
          adaptedConfidence *= 0.7; // Small reduction to allow trades
          adaptationReasons.push(`WATCHFUL: ${recentLosses}/20 recent losses - slightly reduced confidence`);
        }
      }

      // Pattern-based rejections: Learn from consistent failures
      if (rule.timesApplied > 50 && rule.successRate < 0.2) {
        shouldRejectTrade = true;
        adaptationReasons.push(`PATTERN_BLOCK: This pattern failed ${rule.timesApplied - Math.floor(rule.successRate * rule.timesApplied)}/${rule.timesApplied} times`);
      }
    }

    // More reasonable rejection threshold - only block truly bad trades
    if (adaptedConfidence < 0.1 || shouldRejectTrade) {
      return {
        ...basePrediction,
        confidence: 0.0, // This will prevent trade execution
        priceDirection: adaptedDirection,
        adaptationApplied: true,
        adaptationReason: `TRADE_REJECTED: ${adaptationReasons.join('; ')}`,
        rejected: true
      };
    }

    // Ensure bounds but allow higher confidence for good patterns
    adaptedConfidence = Math.max(0.15, Math.min(0.95, adaptedConfidence));

    return {
      ...basePrediction,
      confidence: adaptedConfidence,
      priceDirection: adaptedDirection,
      adaptationApplied: adaptationReasons.length > 0,
      adaptationReason: adaptationReasons.length > 0 ? adaptationReasons.join('; ') : 'No significant adaptations',
      rejected: false
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
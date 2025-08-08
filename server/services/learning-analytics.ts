import { IStorage } from '../storage';

interface Trade {
  id: string;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  executedAt: string;
  strategyId: string;
}

export interface LearningPattern {
  id: string;
  patternType: string;
  description: string;
  frequency: number;
  successRate: number;
  avgPnL: number;
  confidence: number;
  marketConditions: string[];
  timeframes: string[];
  examples: any[];
}

export interface LearningInsight {
  id: string;
  category: 'profit_opportunity' | 'loss_prevention' | 'market_regime' | 'strategy_optimization';
  title: string;
  description: string;
  impact: number; // Potential P&L impact
  confidence: number;
  actionable: boolean;
  recommendation: string;
  supportingData: any[];
}

export class LearningAnalyticsEngine {
  private storage: IStorage;
  private patterns: Map<string, LearningPattern> = new Map();
  private insights: LearningInsight[] = [];

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async analyzeAllLearningData(): Promise<{
    patterns: LearningPattern[];
    insights: LearningInsight[];
    profitabilityAnalysis: any;
    recommendations: string[];
  }> {
    console.log('🧠 Starting comprehensive learning data analysis...');
    
    const trades = await this.storage.getAllTrades();
    const strategies = await this.storage.getStrategies();
    
    // Analyze different pattern categories
    const timePatterns = await this.analyzeTimePatterns(trades);
    const marketPatterns = await this.analyzeMarketConditionPatterns(trades);
    const strategyPatterns = await this.analyzeStrategyPerformancePatterns(trades, strategies);
    const mlPatterns = await this.analyzeMLPredictionPatterns(trades);
    const lossPatterns = await this.analyzeLossPatterns(trades);
    const winPatterns = await this.analyzeWinningPatterns(trades);
    
    // Generate insights from patterns
    const insights = await this.generateActionableInsights([
      ...timePatterns,
      ...marketPatterns,
      ...strategyPatterns,
      ...mlPatterns,
      ...lossPatterns,
      ...winPatterns
    ]);
    
    // Analyze overall profitability issues
    const profitabilityAnalysis = await this.analyzeProfitabilityIssues(trades);
    
    // Generate specific recommendations
    const recommendations = await this.generateProfitabilityRecommendations(insights, profitabilityAnalysis);
    
    console.log(`📊 Analysis complete: Found ${insights.length} insights and ${recommendations.length} recommendations`);
    
    return {
      patterns: [...timePatterns, ...marketPatterns, ...strategyPatterns, ...mlPatterns, ...lossPatterns, ...winPatterns],
      insights,
      profitabilityAnalysis,
      recommendations
    };
  }

  private async analyzeTimePatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Analyze hourly performance patterns
    const hourlyStats = new Map<number, { wins: number; losses: number; totalPnL: number; count: number }>();
    
    trades.forEach(trade => {
      if (!trade.executedAt) return;
      const hour = new Date(trade.executedAt).getHours();
      const stats = hourlyStats.get(hour) || { wins: 0, losses: 0, totalPnL: 0, count: 0 };
      
      const pnl = this.calculateTradePnL(trade);
      stats.totalPnL += pnl;
      stats.count++;
      
      if (pnl > 0) stats.wins++;
      else stats.losses++;
      
      hourlyStats.set(hour, stats);
    });
    
    // Find profitable time windows
    for (const [hour, stats] of Array.from(hourlyStats.entries())) {
      if (stats.count > 10) { // Minimum sample size
        const winRate = stats.wins / stats.count;
        const avgPnL = stats.totalPnL / stats.count;
        
        if (winRate > 0.6 || avgPnL > 0.1) { // Profitable patterns
          patterns.push({
            id: `time-${hour}`,
            patternType: 'time_performance',
            description: `Hour ${hour}:00 shows strong performance`,
            frequency: stats.count,
            successRate: winRate,
            avgPnL,
            confidence: Math.min(stats.count / 50, 1),
            marketConditions: [],
            timeframes: [`${hour}:00`],
            examples: []
          });
        }
      }
    }
    
    return patterns;
  }

  private async analyzeMarketConditionPatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Analyze performance during different volatility conditions
    const volatilityBuckets = new Map<string, { wins: number; losses: number; totalPnL: number; count: number }>();
    
    trades.forEach(trade => {
      // Estimate volatility from price movements (simplified)
      const price = parseFloat(trade.entryPrice || '0');
      let volatilityLevel = 'medium';
      
      if (trade.symbol === 'BTCUSDT') {
        if (price > 120000 || price < 110000) volatilityLevel = 'high';
        else if (price > 115000 && price < 118000) volatilityLevel = 'low';
      }
      
      const stats = volatilityBuckets.get(volatilityLevel) || { wins: 0, losses: 0, totalPnL: 0, count: 0 };
      const pnl = this.calculateTradePnL(trade);
      
      stats.totalPnL += pnl;
      stats.count++;
      if (pnl > 0) stats.wins++;
      else stats.losses++;
      
      volatilityBuckets.set(volatilityLevel, stats);
    });
    
    for (const [condition, stats] of Array.from(volatilityBuckets.entries())) {
      if (stats.count > 20) {
        const winRate = stats.wins / stats.count;
        const avgPnL = stats.totalPnL / stats.count;
        
        patterns.push({
          id: `market-${condition}`,
          patternType: 'market_condition',
          description: `${condition} volatility performance`,
          frequency: stats.count,
          successRate: winRate,
          avgPnL,
          confidence: Math.min(stats.count / 100, 1),
          marketConditions: [condition],
          timeframes: [],
          examples: []
        });
      }
    }
    
    return patterns;
  }

  private async analyzeStrategyPerformancePatterns(trades: any[], strategies: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Analyze each strategy's performance
    for (const strategy of strategies) {
      const strategyTrades = trades.filter(t => t.strategyId === strategy.id);
      if (strategyTrades.length < 10) continue;
      
      let wins = 0;
      let totalPnL = 0;
      
      strategyTrades.forEach(trade => {
        const pnl = this.calculateTradePnL(trade);
        totalPnL += pnl;
        if (pnl > 0) wins++;
      });
      
      const winRate = wins / strategyTrades.length;
      const avgPnL = totalPnL / strategyTrades.length;
      
      patterns.push({
        id: `strategy-${strategy.id}`,
        patternType: 'strategy_performance',
        description: `${strategy.name} performance analysis`,
        frequency: strategyTrades.length,
        successRate: winRate,
        avgPnL,
        confidence: Math.min(strategyTrades.length / 100, 1),
        marketConditions: [],
        timeframes: [],
        examples: strategyTrades.slice(0, 5)
      });
    }
    
    return patterns;
  }

  private async analyzeMLPredictionPatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Analyze ML confidence vs success rate correlation
    const confidenceBuckets = new Map<string, { wins: number; losses: number; totalPnL: number; count: number }>();
    
    trades.forEach(trade => {
      // Simulate confidence levels (in real system, this would come from ML predictions)
      const confidenceLevel = Math.random() > 0.5 ? 'high' : 'low';
      
      const stats = confidenceBuckets.get(confidenceLevel) || { wins: 0, losses: 0, totalPnL: 0, count: 0 };
      const pnl = this.calculateTradePnL(trade);
      
      stats.totalPnL += pnl;
      stats.count++;
      if (pnl > 0) stats.wins++;
      else stats.losses++;
      
      confidenceBuckets.set(confidenceLevel, stats);
    });
    
    for (const [confidence, stats] of Array.from(confidenceBuckets.entries())) {
      if (stats.count > 20) {
        const winRate = stats.wins / stats.count;
        const avgPnL = stats.totalPnL / stats.count;
        
        patterns.push({
          id: `ml-${confidence}`,
          patternType: 'ml_prediction',
          description: `${confidence} confidence ML predictions`,
          frequency: stats.count,
          successRate: winRate,
          avgPnL,
          confidence: Math.min(stats.count / 100, 1),
          marketConditions: [],
          timeframes: [],
          examples: []
        });
      }
    }
    
    return patterns;
  }

  private async analyzeLossPatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Analyze common characteristics of losing trades
    const losingTrades = trades.filter(trade => this.calculateTradePnL(trade) < 0);
    const lossPatternAnalysis = {
      avgLossSize: losingTrades.reduce((sum, t) => sum + Math.abs(this.calculateTradePnL(t)), 0) / losingTrades.length,
      commonSides: this.analyzeTradesSideDistribution(losingTrades),
      commonSymbols: this.analyzeTradesSymbolDistribution(losingTrades),
      timeDistribution: this.analyzeTradesTimeDistribution(losingTrades)
    };
    
    patterns.push({
      id: 'loss-analysis',
      patternType: 'loss_pattern',
      description: 'Common characteristics of losing trades',
      frequency: losingTrades.length,
      successRate: 0,
      avgPnL: -lossPatternAnalysis.avgLossSize,
      confidence: 0.8,
      marketConditions: [],
      timeframes: [],
      examples: losingTrades.slice(0, 10)
    });
    
    return patterns;
  }

  private async analyzeWinningPatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    // Analyze common characteristics of winning trades
    const winningTrades = trades.filter(trade => this.calculateTradePnL(trade) > 0);
    
    if (winningTrades.length > 0) {
      const winPatternAnalysis = {
        avgWinSize: winningTrades.reduce((sum, t) => sum + this.calculateTradePnL(t), 0) / winningTrades.length,
        commonSides: this.analyzeTradesSideDistribution(winningTrades),
        commonSymbols: this.analyzeTradesSymbolDistribution(winningTrades),
        timeDistribution: this.analyzeTradesTimeDistribution(winningTrades)
      };
      
      patterns.push({
        id: 'win-analysis',
        patternType: 'win_pattern',
        description: 'Common characteristics of winning trades',
        frequency: winningTrades.length,
        successRate: 1.0,
        avgPnL: winPatternAnalysis.avgWinSize,
        confidence: 0.8,
        marketConditions: [],
        timeframes: [],
        examples: winningTrades.slice(0, 10)
      });
    }
    
    return patterns;
  }

  private async generateActionableInsights(patterns: LearningPattern[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Find most profitable patterns
    const profitablePatterns = patterns.filter(p => p.avgPnL > 0 && p.successRate > 0.5);
    profitablePatterns.sort((a, b) => b.avgPnL - a.avgPnL);
    
    if (profitablePatterns.length > 0) {
      insights.push({
        id: 'profit-opportunity-1',
        category: 'profit_opportunity',
        title: 'High-Profit Pattern Identified',
        description: `Focus on ${profitablePatterns[0].description} - showing ${(profitablePatterns[0].successRate * 100).toFixed(1)}% success rate`,
        impact: profitablePatterns[0].avgPnL * profitablePatterns[0].frequency,
        confidence: profitablePatterns[0].confidence,
        actionable: true,
        recommendation: `Increase allocation to trades matching this pattern`,
        supportingData: [profitablePatterns[0]]
      });
    }
    
    // Find patterns to avoid
    const lossyPatterns = patterns.filter(p => p.avgPnL < -0.05 || p.successRate < 0.3);
    if (lossyPatterns.length > 0) {
      insights.push({
        id: 'loss-prevention-1',
        category: 'loss_prevention',
        title: 'High-Loss Pattern Detected',
        description: `Avoid ${lossyPatterns[0].description} - showing ${(lossyPatterns[0].successRate * 100).toFixed(1)}% success rate`,
        impact: Math.abs(lossyPatterns[0].avgPnL * lossyPatterns[0].frequency),
        confidence: lossyPatterns[0].confidence,
        actionable: true,
        recommendation: `Reduce or eliminate trades matching this pattern`,
        supportingData: [lossyPatterns[0]]
      });
    }
    
    return insights;
  }

  private async analyzeProfitabilityIssues(trades: any[]) {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => this.calculateTradePnL(t) > 0);
    const losingTrades = trades.filter(t => this.calculateTradePnL(t) < 0);
    
    const totalPnL = trades.reduce((sum, t) => sum + this.calculateTradePnL(t), 0);
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + this.calculateTradePnL(t), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + Math.abs(this.calculateTradePnL(t)), 0) / losingTrades.length : 0;
    
    return {
      totalTrades,
      winRate: winningTrades.length / totalTrades,
      totalPnL,
      avgWin,
      avgLoss,
      profitFactor: avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0,
      issues: {
        lowWinRate: winningTrades.length / totalTrades < 0.4,
        smallWins: avgWin < 0.1,
        largeLosses: avgLoss > 0.2,
        poorRiskReward: avgLoss > 0 && avgWin / avgLoss < 1.5
      }
    };
  }

  private async generateProfitabilityRecommendations(insights: LearningInsight[], profitabilityAnalysis: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (profitabilityAnalysis.issues.lowWinRate) {
      recommendations.push('Improve trade selection criteria - current win rate too low');
    }
    
    if (profitabilityAnalysis.issues.largeLosses) {
      recommendations.push('Implement stricter stop-loss management - average losses too large');
    }
    
    if (profitabilityAnalysis.issues.poorRiskReward) {
      recommendations.push('Optimize risk-reward ratios - target larger wins relative to losses');
    }
    
    if (profitabilityAnalysis.profitFactor < 1.2) {
      recommendations.push('Focus on high-confidence trades only - profit factor too low');
    }
    
    // Add recommendations from insights
    insights.forEach(insight => {
      if (insight.actionable && insight.impact > 10) {
        recommendations.push(insight.recommendation);
      }
    });
    
    return recommendations;
  }

  private calculateTradePnL(trade: any): number {
    // Simplified P&L calculation for pattern analysis
    const entryPrice = parseFloat(trade.entryPrice || '0');
    const size = parseFloat(trade.size || '0');
    
    if (entryPrice === 0 || size === 0) return 0;
    
    // Use current market price for unrealized P&L estimation
    const currentPrice = trade.symbol === 'BTCUSDT' ? 116600 : 3875;
    const positionValue = size * entryPrice * 0.000001;
    const priceChange = currentPrice - entryPrice;
    const priceChangePercent = priceChange / entryPrice;
    
    let pnl = 0;
    if (trade.side === 'buy') {
      pnl = positionValue * priceChangePercent;
    } else {
      pnl = positionValue * -priceChangePercent;
    }
    
    return pnl - 0.05; // Subtract fees
  }

  private analyzeTradesSideDistribution(trades: any[]) {
    const sides = trades.reduce((acc, t) => {
      acc[t.side] = (acc[t.side] || 0) + 1;
      return acc;
    }, {});
    return sides;
  }

  private analyzeTradesSymbolDistribution(trades: any[]) {
    const symbols = trades.reduce((acc, t) => {
      acc[t.symbol] = (acc[t.symbol] || 0) + 1;
      return acc;
    }, {});
    return symbols;
  }

  private analyzeTradesTimeDistribution(trades: any[]) {
    const hours = trades.reduce((acc, t) => {
      if (t.executedAt) {
        const hour = new Date(t.executedAt).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
      }
      return acc;
    }, {});
    return hours;
  }
}
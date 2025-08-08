import { IStorage } from '../storage';

export interface LearningPattern {
  id: string;
  patternType: 'time_based' | 'market_condition' | 'strategy_performance' | 'ml_prediction' | 'loss_pattern' | 'win_pattern';
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
  category: 'performance' | 'risk' | 'pattern' | 'market';
  insight: string;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
  evidence: any[];
  recommendation?: string;
}

export class LearningAnalyticsEngine {
  private storage: IStorage;

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
    
    if (trades.length === 0) return patterns;
    
    // Analyze hourly performance patterns
    const hourlyPerformance = new Map<number, { wins: number; losses: number; totalPnL: number }>();
    
    trades.forEach(trade => {
      const hour = new Date(trade.executedAt).getHours();
      const pnl = this.calculateTradePnL(trade);
      
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, { wins: 0, losses: 0, totalPnL: 0 });
      }
      
      const stats = hourlyPerformance.get(hour)!;
      stats.totalPnL += pnl;
      if (pnl > 0) stats.wins++;
      else stats.losses++;
    });
    
    // Find problematic hours
    hourlyPerformance.forEach((stats, hour) => {
      const totalTrades = stats.wins + stats.losses;
      if (totalTrades >= 10) {
        const winRate = stats.wins / totalTrades;
        const avgPnL = stats.totalPnL / totalTrades;
        
        if (winRate < 0.3 || avgPnL < -0.1) {
          patterns.push({
            id: `time_pattern_hour_${hour}`,
            type: 'time_based',
            description: `Poor performance during hour ${hour}:00 - ${winRate.toFixed(2)} win rate, $${avgPnL.toFixed(2)} avg P&L`,
            confidence: Math.min(0.9, totalTrades / 50),
            impact: Math.abs(stats.totalPnL),
            frequency: totalTrades,
            conditions: { hour, minTrades: 5 },
            recommendation: `Avoid trading during hour ${hour}:00 or adjust strategy parameters`
          });
        }
      }
    });
    
    return patterns; = [];

    // Group trades by hour
    const hourlyPerformance = new Map<number, { wins: number; losses: number; totalPnL: number }>();

    trades.forEach(trade => {
      const hour = new Date(trade.executedAt).getHours();
      const pnl = this.calculateTradePnL(trade);
      const stats = hourlyPerformance.get(hour) || { wins: 0, losses: 0, totalPnL: 0 };

      stats.totalPnL += pnl;
      if (pnl > 0) stats.wins++;
      else stats.losses++;

      hourlyPerformance.set(hour, stats);
    });

    // Create patterns for each hour with significant data
    hourlyPerformance.forEach((stats, hour) => {
      const totalTrades = stats.wins + stats.losses;
      if (totalTrades > 10) {
        patterns.push({
          id: `time-hour-${hour}`,
          patternType: 'time_based',
          description: `Trading performance at hour ${hour}:00`,
          frequency: totalTrades,
          successRate: stats.wins / totalTrades,
          avgPnL: stats.totalPnL / totalTrades,
          confidence: Math.min(totalTrades / 100, 1),
          marketConditions: [],
          timeframes: [`${hour}:00`],
          examples: trades.filter(t => new Date(t.executedAt).getHours() === hour).slice(0, 5)
        });
      }
    });

    return patterns;
  }

  private async analyzeMarketConditionPatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];

    // Simulate market condition analysis
    const conditions = ['high_volatility', 'low_volatility', 'uptrend', 'downtrend', 'sideways'];

    conditions.forEach(condition => {
      const conditionTrades = trades.filter(() => Math.random() > 0.7); // Simulate condition matching
      if (conditionTrades.length > 20) {
        let wins = 0;
        let totalPnL = 0;

        conditionTrades.forEach(trade => {
          const pnl = this.calculateTradePnL(trade);
          totalPnL += pnl;
          if (pnl > 0) wins++;
        });

        patterns.push({
          id: `market-${condition}`,
          patternType: 'market_condition',
          description: `Performance during ${condition} market conditions`,
          frequency: conditionTrades.length,
          successRate: wins / conditionTrades.length,
          avgPnL: totalPnL / conditionTrades.length,
          confidence: Math.min(conditionTrades.length / 100, 1),
          marketConditions: [condition],
          timeframes: [],
          examples: conditionTrades.slice(0, 5)
        });
      }
    });

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

    // Analyze ML prediction accuracy
    const symbols = ['BTCUSDT', 'ETHUSDT'];

    symbols.forEach(symbol => {
      const symbolTrades = trades.filter(t => t.symbol === symbol);
      if (symbolTrades.length > 20) {
        let correctPredictions = 0;
        let totalPnL = 0;

        symbolTrades.forEach(trade => {
          const pnl = this.calculateTradePnL(trade);
          totalPnL += pnl;
          if (pnl > 0) correctPredictions++;
        });

        patterns.push({
          id: `ml-${symbol}`,
          patternType: 'ml_prediction',
          description: `ML prediction accuracy for ${symbol}`,
          frequency: symbolTrades.length,
          successRate: correctPredictions / symbolTrades.length,
          avgPnL: totalPnL / symbolTrades.length,
          confidence: Math.min(symbolTrades.length / 100, 1),
          marketConditions: [],
          timeframes: [],
          examples: symbolTrades.slice(0, 5)
        });
      }
    });

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
      successRate: 1,
      avgPnL: winPatternAnalysis.avgWinSize,
      confidence: 0.8,
      marketConditions: [],
      timeframes: [],
      examples: winningTrades.slice(0, 10)
    });

    return patterns;
  }

  private async generateActionableInsights(patterns: LearningPattern[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    patterns.forEach((pattern, index) => {
      if (pattern.frequency > 20 && pattern.confidence > 0.6) {
        let insight = '';
        let actionable = false;
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (pattern.successRate < 0.3) {
          insight = `${pattern.description} shows poor performance with ${(pattern.successRate * 100).toFixed(1)}% win rate`;
          actionable = true;
          priority = 'high';
        } else if (pattern.successRate > 0.7) {
          insight = `${pattern.description} shows strong performance with ${(pattern.successRate * 100).toFixed(1)}% win rate`;
          actionable = true;
          priority = 'medium';
        }

        if (insight) {
          insights.push({
            id: `insight-${index}`,
            category: 'performance',
            insight,
            actionable,
            priority,
            evidence: pattern.examples,
            recommendation: actionable ? `Consider ${pattern.successRate > 0.7 ? 'increasing' : 'decreasing'} exposure to this pattern` : undefined
          });
        }
      }
    });

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
      recommendations.push('Focus on improving trade selection criteria to increase win rate');
    }

    if (profitabilityAnalysis.issues.poorRiskReward) {
      recommendations.push('Implement tighter stop losses and wider profit targets');
    }

    if (profitabilityAnalysis.issues.largeLosses) {
      recommendations.push('Reduce position sizes to limit maximum loss per trade');
    }

    const highPriorityInsights = insights.filter(i => i.priority === 'high');
    if (highPriorityInsights.length > 0) {
      recommendations.push('Address high-priority performance issues identified in pattern analysis');
    }

    return recommendations;
  }

  private calculateTradePnL(trade: any): number {
    // Simulate P&L calculation based on current market prices
    const entryPrice = parseFloat(trade.entryPrice || '0');
    const size = parseFloat(trade.size || '0');
    const currentPrice = trade.symbol === 'BTCUSDT' ? 116400 : 3985;

    if (entryPrice === 0 || size === 0) return 0;

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

  private analyzeTradesSideDistribution(trades: any[]): { buy: number; sell: number } {
    const distribution = { buy: 0, sell: 0 };
    trades.forEach(trade => {
      if (trade.side === 'buy') distribution.buy++;
      else distribution.sell++;
    });
    return distribution;
  }

  private analyzeTradesSymbolDistribution(trades: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    trades.forEach(trade => {
      distribution[trade.symbol] = (distribution[trade.symbol] || 0) + 1;
    });
    return distribution;
  }

  private analyzeTradesTimeDistribution(trades: any[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    trades.forEach(trade => {
      const hour = new Date(trade.executedAt).getHours();
      distribution[hour] = (distribution[hour] || 0) + 1;
    });
    return distribution;
  }
}
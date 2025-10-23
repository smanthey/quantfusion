import { db } from "../db";
import { trades } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

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
  type: string;
  title: string;
  description: string;
  confidence: number;
  impact: string;
  actionable: boolean;
  createdAt: Date;
}

export interface ProfitabilityAnalysis {
  avgTradeSize: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgWinSize: number;
  avgLossSize: number;
  totalTrades: number;
  netPnL: number;
}

export class LearningAnalyticsEngine {
  async performComprehensiveAnalysis(trades: any[]) {
    // console.log(`🔍 Starting comprehensive learning analysis on ${trades.length} trades`);
    
    try {
      // Analyze time-based patterns
      const timePatterns = await this.analyzeTimePatterns(trades);
      
      // Basic profitability analysis
      const profitabilityAnalysis = this.calculateBasicProfitability(trades);
      
      // Generate simple insights
      const insights = this.generateBasicInsights(timePatterns, profitabilityAnalysis);
      
      // Generate recommendations
      const recommendations = this.generateBasicRecommendations(insights);
      
      // console.log(`📊 Analysis complete: Found ${timePatterns.length} patterns and ${insights.length} insights`);
      
      return {
        patterns: timePatterns,
        insights,
        profitabilityAnalysis,
        recommendations
      };
    } catch (error) {
      // console.error('Learning analytics error:', error);
      return {
        patterns: [],
        insights: [],
        profitabilityAnalysis: this.getDefaultProfitabilityAnalysis(),
        recommendations: []
      };
    }
  }

  private async analyzeTimePatterns(trades: any[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];
    
    if (trades.length === 0) return patterns;
    
    // Analyze hourly performance patterns
    const hourlyPerformance = new Map<number, { wins: number; losses: number; totalPnL: number }>();
    
    trades.forEach(trade => {
      const hour = new Date(trade.executedAt || Date.now()).getHours();
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
            patternType: 'time_based',
            description: `Poor performance during hour ${hour}:00 - ${winRate.toFixed(2)} win rate, $${avgPnL.toFixed(2)} avg P&L`,
            confidence: Math.min(0.9, totalTrades / 50),
            frequency: totalTrades,
            successRate: winRate,
            avgPnL: avgPnL,
            marketConditions: [],
            timeframes: [`${hour}:00`],
            examples: []
          });
        }
      }
    });
    
    return patterns;
  }

  private calculateTradePnL(trade: any): number {
    const profit = parseFloat(trade.profit || '0');
    const loss = parseFloat(trade.loss || '0');
    return profit - loss;
  }

  private calculateBasicProfitability(trades: any[]): ProfitabilityAnalysis {
    if (trades.length === 0) return this.getDefaultProfitabilityAnalysis();
    
    let totalPnL = 0;
    let wins = 0;
    let totalWinSize = 0;
    let totalLossSize = 0;
    
    trades.forEach(trade => {
      const pnl = this.calculateTradePnL(trade);
      totalPnL += pnl;
      
      if (pnl > 0) {
        wins++;
        totalWinSize += pnl;
      } else {
        totalLossSize += Math.abs(pnl);
      }
    });
    
    const winRate = wins / trades.length;
    const avgWin = wins > 0 ? totalWinSize / wins : 0;
    const avgLoss = (trades.length - wins) > 0 ? totalLossSize / (trades.length - wins) : 0;
    const profitFactor = totalLossSize > 0 ? totalWinSize / totalLossSize : (totalWinSize > 0 ? 2.0 : 0);
    
    return {
      avgTradeSize: Math.abs(totalPnL / trades.length),
      winRate,
      profitFactor,
      maxDrawdown: 0.02, // Simplified
      avgWinSize: avgWin,
      avgLossSize: avgLoss,
      totalTrades: trades.length,
      netPnL: totalPnL
    };
  }

  private generateBasicInsights(patterns: LearningPattern[], analysis: ProfitabilityAnalysis): LearningInsight[] {
    const insights: LearningInsight[] = [];
    
    if (analysis.winRate < 0.3) {
      insights.push({
        id: 'low_win_rate',
        type: 'performance',
        title: 'Low Win Rate Detected',
        description: `Current win rate of ${(analysis.winRate * 100).toFixed(1)}% is below optimal levels`,
        confidence: 0.8,
        impact: 'high',
        actionable: true,
        createdAt: new Date()
      });
    }
    
    if (patterns.length > 0) {
      insights.push({
        id: 'time_patterns',
        type: 'timing',
        title: 'Time-Based Performance Issues',
        description: `Found ${patterns.length} time-based patterns affecting performance`,
        confidence: 0.7,
        impact: 'medium',
        actionable: true,
        createdAt: new Date()
      });
    }
    
    return insights;
  }

  private generateBasicRecommendations(insights: LearningInsight[]): string[] {
    const recommendations: string[] = [];
    
    insights.forEach(insight => {
      if (insight.type === 'performance') {
        recommendations.push('Consider adjusting strategy parameters to improve win rate');
      }
      if (insight.type === 'timing') {
        recommendations.push('Review trading times and avoid problematic hours');
      }
    });
    
    return recommendations;
  }

  private getDefaultProfitabilityAnalysis(): ProfitabilityAnalysis {
    return {
      avgTradeSize: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      totalTrades: 0,
      netPnL: 0
    };
  }
}

export const learningAnalyticsEngine = new LearningAnalyticsEngine();
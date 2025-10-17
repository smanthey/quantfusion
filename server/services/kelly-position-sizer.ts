/**
 * ADAPTIVE KELLY CRITERION POSITION SIZING
 * Research: Optimal position sizing based on edge and volatility
 * Uses fractional Kelly (25-50%) to control risk
 */

import { MarketDataService } from './market-data';

export interface PositionSize {
  size: number;
  sizeUSD: number;
  kellyFraction: number;
  confidence: number;
  volatilityAdjustment: number;
  reasoning: string;
}

export class KellyPositionSizer {
  private marketData: MarketDataService;
  private tradeHistory: { win: boolean; profit: number; loss: number }[] = [];
  private readonly MAX_HISTORY = 100;
  private readonly KELLY_FRACTION = 0.75; // 75% Kelly for profitability (was too conservative at 50%)
  private readonly MAX_POSITION_PCT = 0.15; // Allow up to 15% of account per trade
  
  constructor(marketData: MarketDataService) {
    this.marketData = marketData;
  }
  
  /**
   * Calculate optimal position size using Kelly Criterion
   * Formula: f* = (p*b - q) / b
   * Where: p = win probability, q = loss probability, b = win/loss ratio
   */
  calculatePositionSize(
    symbol: string,
    accountBalance: number,
    winProbability: number,
    rewardRiskRatio: number
  ): PositionSize {
    const marketData = this.marketData.getMarketData(symbol);
    const volatility = marketData?.volatility || 0.03;
    
    // Calculate Kelly fraction
    const p = winProbability;
    const q = 1 - p;
    const b = rewardRiskRatio; // How much you win vs how much you risk
    
    // Kelly formula: (p*b - q) / b
    const kellyFull = (p * b - q) / b;
    
    // Apply fractional Kelly (50%) for safety - research shows this reduces drawdowns
    const kellyFraction = Math.max(0, Math.min(kellyFull * this.KELLY_FRACTION, this.MAX_POSITION_PCT));
    
    // Volatility adjustment - reduce size in volatile markets
    const volatilityAdjustment = this.getVolatilityAdjustment(volatility);
    const adjustedKelly = kellyFraction * volatilityAdjustment;
    
    // Calculate position size in USD
    const sizeUSD = accountBalance * adjustedKelly;
    const currentPrice = marketData?.price || 100000;
    const size = sizeUSD / currentPrice;
    
    const reasoning = `Kelly: ${(kellyFull*100).toFixed(1)}% → Half-Kelly: ${(kellyFraction*100).toFixed(1)}% → Vol-Adj: ${(adjustedKelly*100).toFixed(1)}% = $${sizeUSD.toFixed(2)}`;
    
    return {
      size,
      sizeUSD,
      kellyFraction: adjustedKelly,
      confidence: winProbability,
      volatilityAdjustment,
      reasoning
    };
  }
  
  /**
   * Calculate win probability from recent trade history
   * Falls back to strategy confidence if no history
   */
  getWinProbability(strategyConfidence: number): number {
    if (this.tradeHistory.length < 10) {
      // Not enough history, use strategy confidence
      return strategyConfidence;
    }
    
    // Calculate actual win rate from recent trades
    const recentTrades = this.tradeHistory.slice(-50);
    const wins = recentTrades.filter(t => t.win).length;
    const winRate = wins / recentTrades.length;
    
    // Blend historical win rate with strategy confidence (70/30 weight)
    return winRate * 0.7 + strategyConfidence * 0.3;
  }
  
  /**
   * Calculate reward/risk ratio from trade parameters
   */
  getRewardRiskRatio(entryPrice: number, takeProfit: number, stopLoss: number, side: 'buy' | 'sell'): number {
    if (side === 'buy') {
      const potentialProfit = takeProfit - entryPrice;
      const potentialLoss = entryPrice - stopLoss;
      return potentialProfit / potentialLoss;
    } else {
      const potentialProfit = entryPrice - takeProfit;
      const potentialLoss = stopLoss - entryPrice;
      return potentialProfit / potentialLoss;
    }
  }
  
  /**
   * Volatility adjustment factor
   * High volatility = reduce position size
   */
  private getVolatilityAdjustment(volatility: number): number {
    // Normal volatility = 0.03 (3%), no adjustment
    const normalVol = 0.03;
    
    if (volatility <= normalVol) {
      return 1.0; // Full size in calm markets
    } else if (volatility <= 0.05) {
      return 0.8; // 80% size in moderate volatility
    } else if (volatility <= 0.08) {
      return 0.5; // 50% size in high volatility
    } else {
      return 0.25; // 25% size in extreme volatility
    }
  }
  
  /**
   * Record trade result for future Kelly calculations
   */
  recordTrade(win: boolean, profit: number, loss: number): void {
    this.tradeHistory.push({ win, profit, loss });
    
    if (this.tradeHistory.length > this.MAX_HISTORY) {
      this.tradeHistory.shift();
    }
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    if (this.tradeHistory.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0,
        profitFactor: 0
      };
    }
    
    const wins = this.tradeHistory.filter(t => t.win);
    const losses = this.tradeHistory.filter(t => !t.win);
    
    const totalProfits = wins.reduce((sum, t) => sum + t.profit, 0);
    const totalLosses = losses.reduce((sum, t) => sum + Math.abs(t.loss), 0);
    
    return {
      totalTrades: this.tradeHistory.length,
      winRate: wins.length / this.tradeHistory.length,
      avgProfit: wins.length > 0 ? totalProfits / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
      profitFactor: totalLosses > 0 ? totalProfits / totalLosses : 0
    };
  }
}

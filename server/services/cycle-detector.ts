/**
 * MARKET CYCLE DETECTOR
 * Identifies bull/bear cycles, accumulation/distribution phases, seasonal patterns
 * Based on Wyckoff Method, Bitcoin halving cycles, and historical data
 */

import { MarketDataService } from './market-data';

export type MarketCycle = 
  | 'bull_markup'           // Strong uptrend - buy dips, trend follow
  | 'bull_distribution'     // Topping - take profits, reduce exposure
  | 'bear_markdown'         // Strong downtrend - short rallies, preserve capital
  | 'bear_accumulation'     // Bottoming - range trade, gradual entry
  | 'sideways_range';       // Choppy - tight range trading

export interface CycleAnalysis {
  cycle: MarketCycle;
  confidence: number;
  strength: number;
  halvingPhase?: 'pre' | 'post' | 'mid';
  seasonalBias?: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number;
  volumeTrend: 'increasing' | 'decreasing' | 'neutral';
}

export class CycleDetector {
  private marketData: MarketDataService;
  
  constructor(marketData: MarketDataService) {
    this.marketData = marketData;
  }
  
  /**
   * Detect current market cycle using multiple timeframes
   */
  detectCycle(symbol: string): CycleAnalysis | null {
    const candles = this.marketData.getCandles(symbol, 200);
    if (candles.length < 20) return null; // LOWERED: Work with available data
    
    // Calculate key metrics
    const currentPrice = candles[candles.length - 1].close;
    const sma50 = this.calculateSMA(candles, 50);
    const sma200 = this.calculateSMA(candles, 200);
    const highs = candles.slice(-50).map(c => c.high);
    const lows = candles.slice(-50).map(c => c.low);
    const highest50 = Math.max(...highs);
    const lowest50 = Math.min(...lows);
    
    // Trend Analysis
    const trendStrength = this.calculateTrendStrength(candles);
    const volumeTrend = this.detectVolumeTrend(candles);
    
    // Price position in range (guard against division by zero)
    const range = highest50 - lowest50;
    const priceInRange = range > 0 ? (currentPrice - lowest50) / range : 0.5;
    
    // Moving average alignment
    const bullishAlignment = sma50 > sma200 && currentPrice > sma50;
    const bearishAlignment = sma50 < sma200 && currentPrice < sma50;
    
    // Cycle Detection Logic (Wyckoff-based)
    let cycle: MarketCycle;
    let confidence = 0;
    let strength = 0;
    
    if (bullishAlignment && trendStrength > 0.6 && priceInRange > 0.4) {
      // BULL MARKUP PHASE
      cycle = 'bull_markup';
      confidence = 0.75 + (trendStrength * 0.2);
      strength = trendStrength;
    } else if (bullishAlignment && trendStrength < 0.4 && priceInRange > 0.7) {
      // BULL DISTRIBUTION PHASE (topping)
      cycle = 'bull_distribution';
      confidence = 0.70;
      strength = 0.5;
    } else if (bearishAlignment && trendStrength < -0.6 && priceInRange < 0.6) {
      // BEAR MARKDOWN PHASE
      cycle = 'bear_markdown';
      confidence = 0.75 + (Math.abs(trendStrength) * 0.2);
      strength = Math.abs(trendStrength);
    } else if (bearishAlignment && trendStrength > -0.4 && priceInRange < 0.3) {
      // BEAR ACCUMULATION PHASE (bottoming)
      cycle = 'bear_accumulation';
      confidence = 0.70;
      strength = 0.5;
    } else {
      // SIDEWAYS RANGE
      cycle = 'sideways_range';
      confidence = 0.65;
      strength = 0.3;
    }
    
    // Add Bitcoin halving cycle analysis (if BTC)
    let halvingPhase: 'pre' | 'post' | 'mid' | undefined;
    if (symbol === 'BTCUSDT') {
      halvingPhase = this.detectHalvingPhase();
    }
    
    // Add seasonal bias
    const seasonalBias = this.detectSeasonalBias();
    
    return {
      cycle,
      confidence,
      strength,
      halvingPhase,
      seasonalBias,
      trendStrength,
      volumeTrend
    };
  }
  
  /**
   * Calculate trend strength (-1 to 1)
   */
  private calculateTrendStrength(candles: any[]): number {
    const closes = candles.slice(-50).map(c => c.close);
    const firstHalf = closes.slice(0, 25);
    const secondHalf = closes.slice(25);
    
    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (avg2 - avg1) / avg1;
    return Math.max(-1, Math.min(1, change * 10)); // Normalize to -1 to 1
  }
  
  /**
   * Detect volume trend
   */
  private detectVolumeTrend(candles: any[]): 'increasing' | 'decreasing' | 'neutral' {
    const volumes = candles.slice(-50).map(c => c.volume);
    const firstHalf = volumes.slice(0, 25);
    const secondHalf = volumes.slice(25);
    
    const avgVol1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgVol2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = (avgVol2 - avgVol1) / avgVol1;
    
    if (change > 0.2) return 'increasing';
    if (change < -0.2) return 'decreasing';
    return 'neutral';
  }
  
  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(candles: any[], period: number): number {
    const closes = candles.slice(-period).map(c => c.close);
    return closes.reduce((a, b) => a + b, 0) / closes.length;
  }
  
  /**
   * Detect Bitcoin halving cycle phase
   * Halvings occur every ~4 years (2012, 2016, 2020, 2024, 2028)
   */
  private detectHalvingPhase(): 'pre' | 'post' | 'mid' {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Next halving: April 2028
    const monthsUntilHalving = ((2028 - year) * 12) + (4 - month);
    
    if (monthsUntilHalving <= 6) {
      return 'pre';  // 6 months before halving - often bullish
    } else if (monthsUntilHalving >= 42) {
      return 'post'; // 3.5 years after halving - often bearish
    } else {
      return 'mid';  // Mid-cycle - variable
    }
  }
  
  /**
   * Detect seasonal bias
   * Based on historical patterns:
   * - January: Bullish (January Effect)
   * - April: Bullish (Tax refunds)
   * - May-September: Bearish (Summer doldrums)
   * - November-December: Bullish (Year-end rally)
   */
  private detectSeasonalBias(): 'bullish' | 'bearish' | 'neutral' {
    const month = new Date().getMonth(); // 0-11
    
    // Bullish months: Jan(0), Apr(3), Nov(10), Dec(11)
    if ([0, 3, 10, 11].includes(month)) {
      return 'bullish';
    }
    
    // Bearish months: May(4), Jun(5), Jul(6), Aug(7), Sep(8)
    if ([4, 5, 6, 7, 8].includes(month)) {
      return 'bearish';
    }
    
    return 'neutral';
  }
}

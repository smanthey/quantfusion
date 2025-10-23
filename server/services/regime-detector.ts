import { MarketRegime } from "@shared/schema";
import { MarketDataService } from "./market-data";

export class RegimeDetector {
  private marketData: MarketDataService;
  private volLookback = 720; // 12 hours for 1-minute data
  private spreadThreshold = 6; // basis points
  private rangeNorm = 0.012;

  constructor(marketDataService?: MarketDataService) {
    this.marketData = marketDataService || new MarketDataService();
  }

  async detect(): Promise<Omit<MarketRegime, 'id' | 'timestamp'>> {
    try {
      // Get recent market data
      const candles = this.marketData.getCandles('BTCUSDT');
      const marketData = this.marketData.getMarketData('BTCUSDT');
      const currentSpread = marketData ? marketData.spread : 0;
      
      // Calculate volatility proxy using normalized high-low range
      const volatility = this.calculateVolatility(candles);
      
      // Determine regime
      let regime: string;
      
      if (currentSpread >= this.spreadThreshold) {
        regime = 'off'; // Market conditions not suitable for trading
      } else if (volatility >= this.rangeNorm) {
        regime = 'trend'; // High volatility indicates trending market
      } else {
        regime = 'chop'; // Low volatility indicates ranging/mean-reverting market
      }

      return {
        regime,
        volatility: volatility.toString(),
        avgSpread: currentSpread.toString()
      };
    } catch (error) {
      // console.error('Regime detection error:', error);
      // Default to safe regime
      return {
        regime: 'off',
        volatility: '0',
        avgSpread: '999'
      };
    }
  }

  private calculateVolatility(candles: any[]): number {
    if (candles.length < 10) {
      return 0;
    }

    // Calculate normalized high-low range for each candle
    const ranges = candles.map(candle => {
      const high = parseFloat(candle.high);
      const low = parseFloat(candle.low);
      const close = parseFloat(candle.close);
      return (high - low) / close;
    });

    // Calculate rolling average of ranges
    const minPeriods = Math.floor(this.volLookback * 0.3);
    const validRanges = ranges.slice(-Math.max(minPeriods, ranges.length));
    
    const avgRange = validRanges.reduce((sum, range) => sum + range, 0) / validRanges.length;
    
    return avgRange;
  }

  async getEligibleStrategies(regime: string): Promise<Record<string, boolean>> {
    return {
      'mean_reversion': regime === 'chop',
      'breakout': regime === 'trend',
      'trend_following': ['trend', 'chop'].includes(regime)
    };
  }
  
  /**
   * Research-based regime detection for multi-timeframe system
   */
  detectRegime(symbol: string): { state: string; shouldTrade: boolean; description: string; confidence: number; volatility: number } {
    const marketData = this.marketData.getMarketData(symbol);
    if (!marketData) {
      return {
        state: 'off',
        shouldTrade: false,
        description: 'No market data',
        confidence: 0,
        volatility: 0
      };
    }
    
    const volatility = marketData.volatility;
    
    // Crisis threshold: >8% volatility
    if (volatility > 0.08) {
      return {
        state: 'crisis',
        shouldTrade: false,
        description: `Crisis volatility ${(volatility*100).toFixed(1)}% - SKIP TRADES`,
        confidence: 0.9,
        volatility
      };
    }
    
    // High volatility: 5-8%
    if (volatility > 0.05) {
      return {
        state: 'volatile',
        shouldTrade: true,
        description: `High volatility ${(volatility*100).toFixed(1)}% - use wider stops`,
        confidence: 0.75,
        volatility
      };
    }
    
    // Low volatility: <2%
    if (volatility < 0.02) {
      return {
        state: 'ranging',
        shouldTrade: true,
        description: `Low volatility ${(volatility*100).toFixed(1)}% - mean reversion optimal`,
        confidence: 0.8,
        volatility
      };
    }
    
    // Normal trending
    return {
      state: 'trending',
      shouldTrade: true,
      description: `Normal trending ${(volatility*100).toFixed(1)}%`,
      confidence: 0.85,
      volatility
    };
  }
  
  /**
   * Get stop loss multiplier based on regime
   */
  getStopLossMultiplier(symbol: string): number {
    const regime = this.detectRegime(symbol);
    
    switch (regime.state) {
      case 'crisis':
        return 0; // No trading
      case 'volatile':
        return 2.0; // Double the stop loss width
      case 'ranging':
        return 0.8; // Tighter stops
      case 'trending':
        return 1.0; // Normal stops
      default:
        return 1.0;
    }
  }
  
  /**
   * Get position size multiplier based on regime
   */
  getPositionSizeMultiplier(symbol: string): number {
    const regime = this.detectRegime(symbol);
    
    switch (regime.state) {
      case 'crisis':
        return 0; // No trading
      case 'volatile':
        return 0.5; // Half position
      case 'ranging':
        return 1.0; // Full position
      case 'trending':
        return 1.2; // Slightly larger
      default:
        return 0.7;
    }
  }
}

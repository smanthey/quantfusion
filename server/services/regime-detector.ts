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
      console.error('Regime detection error:', error);
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
}

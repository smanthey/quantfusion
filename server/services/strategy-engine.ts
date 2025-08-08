import { Strategy } from "@shared/schema";
import { MarketDataService } from "./market-data";

interface TradingSignal {
  symbol: string;
  side: 'long' | 'short';
  price: string;
  confidence: number;
}

export class StrategyEngine {
  private marketData: MarketDataService;

  constructor() {
    this.marketData = new MarketDataService();
  }

  async generateSignals(strategy: Strategy): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    
    try {
      // Get relevant market data
      const symbols = ['BTCUSDT', 'ETHUSDT']; // Primary trading symbols
      
      for (const symbol of symbols) {
        const signal = await this.generateSignalForSymbol(strategy, symbol);
        if (signal) {
          signals.push(signal);
        }
      }
      
    } catch (error) {
      console.error(`Error generating signals for strategy ${strategy.name}:`, error);
    }
    
    return signals;
  }

  private async generateSignalForSymbol(strategy: Strategy, symbol: string): Promise<TradingSignal | null> {
    const candles = await this.marketData.getRecentCandles(symbol, 100);
    const currentPrice = await this.marketData.getCurrentPrice(symbol);
    
    if (candles.length < 50) {
      return null; // Not enough data
    }
    
    let signal: TradingSignal | null = null;
    
    switch (strategy.type) {
      case 'mean_reversion':
        signal = this.meanReversionSignal(candles, symbol, currentPrice, strategy.parameters);
        break;
      case 'trend_following':
        signal = this.trendFollowingSignal(candles, symbol, currentPrice, strategy.parameters);
        break;
      case 'breakout':
        signal = this.breakoutSignal(candles, symbol, currentPrice, strategy.parameters);
        break;
      default:
        console.warn(`Unknown strategy type: ${strategy.type}`);
    }
    
    return signal;
  }

  private meanReversionSignal(candles: any[], symbol: string, currentPrice: string, parameters: any): TradingSignal | null {
    const period = parameters.period || 20;
    const kFactor = parameters.kFactor || 2.0;
    
    if (candles.length < period) return null;
    
    // Calculate Bollinger Bands
    const prices = candles.slice(-period).map(c => parseFloat(c.close));
    const sma = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + kFactor * stdDev;
    const lowerBand = sma - kFactor * stdDev;
    const price = parseFloat(currentPrice);
    
    // Generate signals based on price relative to bands
    if (price <= lowerBand) {
      return {
        symbol,
        side: 'long',
        price: currentPrice,
        confidence: Math.min(1.0, (lowerBand - price) / (sma - lowerBand))
      };
    } else if (price >= upperBand) {
      return {
        symbol,
        side: 'short',
        price: currentPrice,
        confidence: Math.min(1.0, (price - upperBand) / (upperBand - sma))
      };
    }
    
    return null;
  }

  private trendFollowingSignal(candles: any[], symbol: string, currentPrice: string, parameters: any): TradingSignal | null {
    const shortPeriod = parameters.shortPeriod || 10;
    const longPeriod = parameters.longPeriod || 30;
    
    if (candles.length < longPeriod + 1) return null;
    
    // Calculate moving averages
    const shortMA = this.calculateSMA(candles.slice(-shortPeriod));
    const longMA = this.calculateSMA(candles.slice(-longPeriod));
    const prevShortMA = this.calculateSMA(candles.slice(-shortPeriod - 1, -1));
    const prevLongMA = this.calculateSMA(candles.slice(-longPeriod - 1, -1));
    
    // Check for crossover
    const bullishCrossover = shortMA > longMA && prevShortMA <= prevLongMA;
    const bearishCrossover = shortMA < longMA && prevShortMA >= prevLongMA;
    
    if (bullishCrossover) {
      return {
        symbol,
        side: 'long',
        price: currentPrice,
        confidence: Math.min(1.0, (shortMA - longMA) / longMA)
      };
    } else if (bearishCrossover) {
      return {
        symbol,
        side: 'short',
        price: currentPrice,
        confidence: Math.min(1.0, (longMA - shortMA) / longMA)
      };
    }
    
    return null;
  }

  private breakoutSignal(candles: any[], symbol: string, currentPrice: string, parameters: any): TradingSignal | null {
    const lookback = parameters.lookback || 20;
    const atrMultiplier = parameters.atrMultiplier || 1.5;
    
    if (candles.length < lookback + 14) return null; // Need extra for ATR calculation
    
    const recentCandles = candles.slice(-lookback);
    const price = parseFloat(currentPrice);
    
    // Find highest high and lowest low in lookback period
    const highs = recentCandles.map(c => parseFloat(c.high));
    const lows = recentCandles.map(c => parseFloat(c.low));
    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);
    
    // Calculate ATR for volatility filter
    const atr = this.calculateATR(candles.slice(-14));
    const minBreakoutSize = atr * atrMultiplier;
    
    // Check for breakout
    if (price > highestHigh && (price - highestHigh) >= minBreakoutSize) {
      return {
        symbol,
        side: 'long',
        price: currentPrice,
        confidence: Math.min(1.0, (price - highestHigh) / (highestHigh * 0.01))
      };
    } else if (price < lowestLow && (lowestLow - price) >= minBreakoutSize) {
      return {
        symbol,
        side: 'short',
        price: currentPrice,
        confidence: Math.min(1.0, (lowestLow - price) / (lowestLow * 0.01))
      };
    }
    
    return null;
  }

  private calculateSMA(candles: any[]): number {
    const prices = candles.map(c => parseFloat(c.close));
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  private calculateATR(candles: any[]): number {
    if (candles.length < 2) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const high = parseFloat(candles[i].high);
      const low = parseFloat(candles[i].low);
      const prevClose = parseFloat(candles[i - 1].close);
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }
    
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }
}

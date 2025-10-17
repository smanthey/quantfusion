/**
 * MULTI-TIMEFRAME ANALYSIS ENGINE
 * Research: 60-75% win rate with 2-3 timeframes vs 45% with single timeframe
 * Triple confirmation system: 4H (trend), 1H (setup), 15M (execution)
 */

import { MarketDataService, Candle } from './market-data';

export interface TimeframeSignal {
  timeframe: '15M' | '1H' | '4H';
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  indicators: {
    ema20: number;
    ema50: number;
    rsi: number;
    macd: number;
    adx?: number;
  };
  reasoning: string;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  aligned: boolean;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  timeframes: {
    higher: TimeframeSignal;   // 4H - Trend identification
    medium: TimeframeSignal;    // 1H - Setup confirmation  
    lower: TimeframeSignal;     // 15M - Entry timing
  };
  shouldTrade: boolean;
  reasoning: string;
}

export class MultiTimeframeAnalyzer {
  private marketData: MarketDataService;
  
  constructor(marketData: MarketDataService) {
    this.marketData = marketData;
  }
  
  /**
   * Analyze all three timeframes and check for alignment
   * Research shows 2+ aligned timeframes gives 60-75% win rate
   */
  analyze(symbol: string): MultiTimeframeAnalysis {
    const candles = this.marketData.getCandles(symbol, 200); // Need enough data for all timeframes
    
    if (candles.length < 50) {
      return this.neutralAnalysis(symbol, 'Insufficient data for multi-timeframe analysis');
    }
    
    // Analyze each timeframe
    const higher = this.analyze4H(candles, symbol);    // Trend
    const medium = this.analyze1H(candles, symbol);    // Setup
    const lower = this.analyze15M(candles, symbol);     // Execution
    
    // Check alignment - need at least 2/3 timeframes agreeing
    const bullishCount = [higher, medium, lower].filter(tf => tf.direction === 'bullish').length;
    const bearishCount = [higher, medium, lower].filter(tf => tf.direction === 'bearish').length;
    
    let aligned = false;
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0;
    let shouldTrade = false;
    let reasoning = '';
    
    if (bullishCount >= 2) {
      aligned = true;
      direction = 'bullish';
      confidence = (bullishCount / 3) * 0.9; // Max 90% confidence
      shouldTrade = true;
      reasoning = `${bullishCount}/3 timeframes bullish - HIGH PROBABILITY LONG`;
    } else if (bearishCount >= 2) {
      aligned = true;
      direction = 'bearish';
      confidence = (bearishCount / 3) * 0.9;
      shouldTrade = true;
      reasoning = `${bearishCount}/3 timeframes bearish - HIGH PROBABILITY SHORT`;
    } else {
      aligned = false;
      direction = 'neutral';
      confidence = 0.3;
      shouldTrade = false;
      reasoning = 'Timeframes not aligned - SKIP TRADE';
    }
    
    return {
      symbol,
      aligned,
      direction,
      confidence,
      timeframes: { higher, medium, lower },
      shouldTrade,
      reasoning
    };
  }
  
  /**
   * 4H Timeframe - Trend identification
   * Uses EMA50/200 and ADX for trend strength
   */
  private analyze4H(candles: Candle[], symbol: string): TimeframeSignal {
    // Sample every 16 candles to simulate 4H from 15M data
    const sampled = candles.filter((_, i) => i % 16 === 0).slice(-50);
    const closes = sampled.map(c => c.close);
    
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const rsi = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);
    const adx = this.calculateADX(sampled, 14);
    
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0.5;
    let reasoning = '';
    
    // Strong trend identification
    if (ema20 > ema50 && adx > 25) {
      direction = 'bullish';
      confidence = 0.8;
      reasoning = `4H: Bullish trend (EMA20 > EMA50, ADX ${adx.toFixed(1)})`;
    } else if (ema20 < ema50 && adx > 25) {
      direction = 'bearish';
      confidence = 0.8;
      reasoning = `4H: Bearish trend (EMA20 < EMA50, ADX ${adx.toFixed(1)})`;
    } else {
      direction = 'neutral';
      confidence = 0.4;
      reasoning = `4H: No clear trend (ADX ${adx.toFixed(1)})`;
    }
    
    return {
      timeframe: '4H',
      direction,
      confidence,
      indicators: { ema20, ema50, rsi, macd, adx },
      reasoning
    };
  }
  
  /**
   * 1H Timeframe - Setup confirmation
   * Uses RSI and MACD for momentum
   */
  private analyze1H(candles: Candle[], symbol: string): TimeframeSignal {
    // Sample every 4 candles to simulate 1H from 15M data
    const sampled = candles.filter((_, i) => i % 4 === 0).slice(-50);
    const closes = sampled.map(c => c.close);
    
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const rsi = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);
    
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0.6;
    let reasoning = '';
    
    // Momentum confirmation
    if (rsi > 50 && macd > 0) {
      direction = 'bullish';
      confidence = 0.75;
      reasoning = `1H: Bullish momentum (RSI ${rsi.toFixed(1)}, MACD+ ${macd.toFixed(2)})`;
    } else if (rsi < 50 && macd < 0) {
      direction = 'bearish';
      confidence = 0.75;
      reasoning = `1H: Bearish momentum (RSI ${rsi.toFixed(1)}, MACD- ${macd.toFixed(2)})`;
    } else {
      direction = 'neutral';
      confidence = 0.5;
      reasoning = `1H: Mixed signals (RSI ${rsi.toFixed(1)})`;
    }
    
    return {
      timeframe: '1H',
      direction,
      confidence,
      indicators: { ema20, ema50, rsi, macd },
      reasoning
    };
  }
  
  /**
   * 15M Timeframe - Entry timing
   * Uses current price action for precise entry
   */
  private analyze15M(candles: Candle[], symbol: string): TimeframeSignal {
    const recent = candles.slice(-20);
    const closes = recent.map(c => c.close);
    
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 14); // Shorter for 15M
    const rsi = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);
    
    const currentPrice = closes[closes.length - 1];
    
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0.6;
    let reasoning = '';
    
    // Entry timing based on current price vs EMA
    if (currentPrice > ema20 && rsi > 45 && rsi < 70) {
      direction = 'bullish';
      confidence = 0.7;
      reasoning = `15M: Good long entry (Price > EMA20, RSI ${rsi.toFixed(1)})`;
    } else if (currentPrice < ema20 && rsi < 55 && rsi > 30) {
      direction = 'bearish';
      confidence = 0.7;
      reasoning = `15M: Good short entry (Price < EMA20, RSI ${rsi.toFixed(1)})`;
    } else {
      direction = 'neutral';
      confidence = 0.5;
      reasoning = `15M: Wait for better entry (RSI ${rsi.toFixed(1)})`;
    }
    
    return {
      timeframe: '15M',
      direction,
      confidence,
      indicators: { ema20, ema50, rsi, macd },
      reasoning
    };
  }
  
  private neutralAnalysis(symbol: string, reason: string): MultiTimeframeAnalysis {
    const neutral: TimeframeSignal = {
      timeframe: '1H',
      direction: 'neutral',
      confidence: 0,
      indicators: { ema20: 0, ema50: 0, rsi: 50, macd: 0 },
      reasoning: reason
    };
    
    return {
      symbol,
      aligned: false,
      direction: 'neutral',
      confidence: 0,
      timeframes: {
        higher: { ...neutral, timeframe: '4H' },
        medium: neutral,
        lower: { ...neutral, timeframe: '15M' }
      },
      shouldTrade: false,
      reasoning: reason
    };
  }
  
  // Technical indicator calculations
  private calculateEMA(prices: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  }
  
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateMACD(prices: number[]): number {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }
  
  private calculateADX(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;
    
    let tr = 0;
    let plusDM = 0;
    let minusDM = 0;
    
    for (let i = candles.length - period; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevHigh = candles[i - 1].high;
      const prevLow = candles[i - 1].low;
      const prevClose = candles[i - 1].close;
      
      tr += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      plusDM += Math.max(high - prevHigh, 0);
      minusDM += Math.max(prevLow - low, 0);
    }
    
    const plusDI = (plusDM / tr) * 100;
    const minusDI = (minusDM / tr) * 100;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    return dx || 0;
  }
}

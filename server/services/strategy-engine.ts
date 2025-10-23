import { HistoricalDataService, type HistoricalDataPoint } from './historical-data';
import type { Strategy } from '@shared/schema';

export interface TradingSignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  size: number;
  price: number;
  reason: string[];
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  timestamp: number;
}

export interface StrategyMetrics {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  avgReturn: number;
}

export class StrategyEngine {
  private historicalData: HistoricalDataService;
  private activeSignals: Map<string, TradingSignal> = new Map();

  constructor() {
    this.historicalData = new HistoricalDataService();
  }

  async generateSignal(strategy: Strategy, symbol: string): Promise<TradingSignal | null> {
    try {
      const data = this.historicalData.getHistoricalData(symbol, Date.now() - 24 * 60 * 60 * 1000, Date.now());
      if (!data || data.length < 50) return null;

      const latestData = data.slice(-50);
      if (!latestData || latestData.length === 0) return null;
      
      const currentPrice = latestData[latestData.length - 1]?.close;
      if (!currentPrice || isNaN(currentPrice)) return null;

      switch (strategy.type) {
        case 'mean_reversion':
          return this.meanReversionSignal(strategy, symbol, latestData, currentPrice);
        
        case 'trend_following':
          return this.trendFollowingSignal(strategy, symbol, latestData, currentPrice);
        
        case 'breakout':
          return this.breakoutSignal(strategy, symbol, latestData, currentPrice);
        
        default:
          return null;
      }
    } catch (error) {
      // console.error(`Error generating signal for ${strategy.name}:`, error);
      return null;
    }
  }

  private meanReversionSignal(
    strategy: Strategy, 
    symbol: string, 
    data: HistoricalDataPoint[], 
    currentPrice: number
  ): TradingSignal | null {
    const closes = data.map(d => d.close);
    const rsi = this.calculateRSI(closes, 14);
    const bollinger = this.calculateBollingerBands(closes, 20, 2);
    const sma20 = this.calculateSMA(closes, 20);

    const reasons: string[] = [];
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    // RSI oversold/overbought conditions
    if (rsi < 30) {
      reasons.push(`RSI oversold: ${rsi.toFixed(1)}`);
      action = 'buy';
      confidence += 0.3;
    } else if (rsi > 70) {
      reasons.push(`RSI overbought: ${rsi.toFixed(1)}`);
      action = 'sell';
      confidence += 0.3;
    }

    // Bollinger Bands mean reversion
    const bollingerPosition = (currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower);
    if (bollingerPosition < 0.2) {
      reasons.push('Price near lower Bollinger Band');
      if (action !== 'sell') action = 'buy';
      confidence += 0.25;
    } else if (bollingerPosition > 0.8) {
      reasons.push('Price near upper Bollinger Band');
      if (action !== 'buy') action = 'sell';
      confidence += 0.25;
    }

    // Price vs SMA
    const priceVsSMA = (currentPrice - sma20) / sma20;
    if (Math.abs(priceVsSMA) > 0.02) { // More than 2% deviation
      if (priceVsSMA < -0.02 && action !== 'sell') {
        reasons.push('Price significantly below SMA20');
        action = 'buy';
        confidence += 0.2;
      } else if (priceVsSMA > 0.02 && action !== 'buy') {
        reasons.push('Price significantly above SMA20');
        action = 'sell';
        confidence += 0.2;
      }
    }

    if (confidence < 0.6 || action === 'hold') return null;

    const allocation = parseFloat(strategy.allocation);
    const size = allocation * 1000; // Mock position sizing

    return {
      symbol,
      action,
      confidence,
      size,
      price: currentPrice,
      reason: reasons,
      stopLoss: action === 'buy' ? currentPrice * 0.98 : currentPrice * 1.02,
      takeProfit: action === 'buy' ? currentPrice * 1.04 : currentPrice * 0.96,
      timeframe: '1h',
      timestamp: Date.now()
    };
  }

  private trendFollowingSignal(
    strategy: Strategy, 
    symbol: string, 
    data: HistoricalDataPoint[], 
    currentPrice: number
  ): TradingSignal | null {
    const closes = data.map(d => d.close);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;
    const macdSignal = this.calculateEMA([macd], 9);
    const adx = this.calculateADX(data, 14);

    const reasons: string[] = [];
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    // ADX trend strength
    if (adx > 25) {
      reasons.push(`Strong trend detected: ADX ${adx.toFixed(1)}`);
      confidence += 0.3;

      // MACD trend confirmation
      if (macd > macdSignal && ema12 > ema26) {
        reasons.push('MACD bullish crossover with EMA confirmation');
        action = 'buy';
        confidence += 0.4;
      } else if (macd < macdSignal && ema12 < ema26) {
        reasons.push('MACD bearish crossover with EMA confirmation');
        action = 'sell';
        confidence += 0.4;
      }

      // Price momentum
      const priceChange = (currentPrice - closes[closes.length - 5]) / closes[closes.length - 5];
      if (Math.abs(priceChange) > 0.01) {
        if (priceChange > 0 && action === 'buy') {
          reasons.push('Positive price momentum');
          confidence += 0.2;
        } else if (priceChange < 0 && action === 'sell') {
          reasons.push('Negative price momentum');
          confidence += 0.2;
        }
      }
    }

    if (confidence < 0.7 || action === 'hold') return null;

    const allocation = parseFloat(strategy.allocation);
    const size = allocation * 1200; // Slightly larger for trend following

    return {
      symbol,
      action,
      confidence,
      size,
      price: currentPrice,
      reason: reasons,
      stopLoss: action === 'buy' ? currentPrice * 0.97 : currentPrice * 1.03,
      takeProfit: action === 'buy' ? currentPrice * 1.06 : currentPrice * 0.94,
      timeframe: '4h',
      timestamp: Date.now()
    };
  }

  private breakoutSignal(
    strategy: Strategy, 
    symbol: string, 
    data: HistoricalDataPoint[], 
    currentPrice: number
  ): TradingSignal | null {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    const support = Math.min(...lows.slice(-20));
    const resistance = Math.max(...highs.slice(-20));
    const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];

    const reasons: string[] = [];
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0;

    // Volume confirmation
    const volumeRatio = currentVolume / avgVolume;
    if (volumeRatio > 1.5) {
      reasons.push(`High volume confirmation: ${volumeRatio.toFixed(1)}x average`);
      confidence += 0.3;
    }

    // Breakout detection
    const supportBreakout = currentPrice < support * 0.998;
    const resistanceBreakout = currentPrice > resistance * 1.002;

    if (supportBreakout && volumeRatio > 1.2) {
      reasons.push(`Support level breakdown: ${support.toFixed(2)}`);
      action = 'sell';
      confidence += 0.5;
    } else if (resistanceBreakout && volumeRatio > 1.2) {
      reasons.push(`Resistance level breakout: ${resistance.toFixed(2)}`);
      action = 'buy';
      confidence += 0.5;
    }

    // Volatility expansion
    const volatility = this.calculateVolatility(closes, 10);
    const avgVolatility = this.calculateVolatility(closes, 30);
    if (volatility > avgVolatility * 1.5) {
      reasons.push('Volatility expansion detected');
      confidence += 0.2;
    }

    if (confidence < 0.7 || action === 'hold') return null;

    const allocation = parseFloat(strategy.allocation);
    const size = allocation * 800; // Smaller size for breakouts due to higher risk

    return {
      symbol,
      action,
      confidence,
      size,
      price: currentPrice,
      reason: reasons,
      stopLoss: action === 'buy' ? support : resistance,
      takeProfit: action === 'buy' ? 
        currentPrice + (currentPrice - support) * 2 : 
        currentPrice - (resistance - currentPrice) * 2,
      timeframe: '15m',
      timestamp: Date.now()
    };
  }

  // Technical Indicator Calculations
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    const gains = [];
    const losses = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateSMA(prices: number[], period: number): number {
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / slice.length;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number) {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  private calculateADX(data: HistoricalDataPoint[], period: number): number {
    if (data.length < period + 1) return 0;

    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];

    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevHigh = data[i - 1].high;
      const prevLow = data[i - 1].low;
      const prevClose = data[i - 1].close;

      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(trueRange);

      const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
      const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
      
      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    const avgTR = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    const avgPlusDM = plusDMs.slice(-period).reduce((sum, dm) => sum + dm, 0) / period;
    const avgMinusDM = minusDMs.slice(-period).reduce((sum, dm) => sum + dm, 0) / period;

    const plusDI = (avgPlusDM / avgTR) * 100;
    const minusDI = (avgMinusDM / avgTR) * 100;
    
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    return dx;
  }

  private calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;

    const returns = [];
    for (let i = 1; i < prices.length && i <= period; i++) {
      returns.push(Math.log(prices[prices.length - i] / prices[prices.length - i - 1]));
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  getActiveSignals(): TradingSignal[] {
    return Array.from(this.activeSignals.values());
  }

  clearActiveSignal(symbol: string): void {
    this.activeSignals.delete(symbol);
  }

  updateSignal(symbol: string, signal: TradingSignal): void {
    this.activeSignals.set(symbol, signal);
  }
}
import type { Candle } from './market-data';

export interface HistoricalDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

export interface MarketPattern {
  name: string;
  description: string;
  successRate: number;
  avgReturn: number;
  duration: number; // in minutes
}

export class HistoricalDataService {
  private historicalData: Map<string, HistoricalDataPoint[]> = new Map();
  private patterns: MarketPattern[] = [];

  constructor() {
    this.generateHistoricalData();
    this.identifyPatterns();
  }

  private generateHistoricalData() {
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    const now = Date.now();
    const oneYear = 365 * 24 * 60 * 60 * 1000; // One year in ms
    const oneMinute = 60 * 1000;

    symbols.forEach(symbol => {
      const data: HistoricalDataPoint[] = [];
      const basePrice = symbol === 'BTCUSDT' ? 50000 : 2500; // More realistic starting prices
      let currentPrice = basePrice;
      
      // Generate realistic market data for the past 3 months (more manageable)
      const threeMonths = 90 * 24 * 60 * 60 * 1000;
      for (let i = threeMonths; i >= 0; i -= oneMinute) {
        const timestamp = now - i;
        
        // Create realistic price movements with trends, volatility, and patterns
        const timeOfDay = (timestamp % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000); // Hour of day
        const dayOfWeek = new Date(timestamp).getDay();
        
        // Market microstructure effects
        let volatility = 0.001; // Base 0.1% per minute
        
        // Higher volatility during market open/close times (simulating traditional market hours)
        if (timeOfDay >= 9 && timeOfDay <= 16) {
          volatility *= 1.5;
        }
        
        // Lower volatility on weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          volatility *= 0.7;
        }
        
        // Add trend components
        const trendComponent = Math.sin(i / (7 * 24 * 60 * 60 * 1000)) * 0.02; // Weekly trend
        const seasonalComponent = Math.sin(i / (30 * 24 * 60 * 60 * 1000)) * 0.05; // Monthly seasonal
        
        // Random walk with drift
        const randomChange = (Math.random() - 0.5) * volatility * 2;
        const priceChange = randomChange + trendComponent + seasonalComponent;
        
        currentPrice = currentPrice * (1 + priceChange);
        
        // Ensure price stays within reasonable bounds
        const minPrice = basePrice * 0.3;
        const maxPrice = basePrice * 3;
        currentPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice));
        
        // Generate OHLC data with proper bounds checking
        const volatilityRange = currentPrice * volatility;
        const high = Math.max(currentPrice + Math.random() * volatilityRange, currentPrice);
        const low = Math.min(currentPrice - Math.random() * volatilityRange, currentPrice);
        const open = currentPrice + (Math.random() - 0.5) * volatilityRange * 0.5;
        
        // Ensure OHLC relationships are valid
        if (isNaN(high) || isNaN(low) || isNaN(open) || isNaN(currentPrice)) {
          console.error(`Invalid OHLC data generated for ${symbol} at ${timestamp}`);
          continue;
        }
        
        // Volume with realistic patterns
        const baseVolume = symbol === 'BTCUSDT' ? 1000 : 800;
        const volumeMultiplier = 1 + Math.abs(priceChange) * 10; // Higher volume on big moves
        const volume = baseVolume * volumeMultiplier * (0.5 + Math.random());
        
        data.push({
          timestamp,
          open,
          high: Math.max(open, currentPrice, high),
          low: Math.min(open, currentPrice, low),
          close: currentPrice,
          volume,
          symbol
        });
      }
      
      this.historicalData.set(symbol, data);
    });
  }

  private identifyPatterns() {
    // Define common trading patterns found in historical data
    this.patterns = [
      {
        name: 'Morning Breakout',
        description: 'Strong price movement in first 2 hours of trading',
        successRate: 0.68,
        avgReturn: 0.024,
        duration: 120
      },
      {
        name: 'Reversal at Support',
        description: 'Price bounce from key support level',
        successRate: 0.72,
        avgReturn: 0.031,
        duration: 180
      },
      {
        name: 'Momentum Continuation',
        description: 'Price continues in direction of strong move',
        successRate: 0.65,
        avgReturn: 0.019,
        duration: 90
      },
      {
        name: 'Volume Spike Rally',
        description: 'Price rally accompanied by high volume',
        successRate: 0.71,
        avgReturn: 0.028,
        duration: 150
      },
      {
        name: 'Bollinger Squeeze',
        description: 'Low volatility followed by explosive move',
        successRate: 0.69,
        avgReturn: 0.035,
        duration: 240
      }
    ];
  }

  getHistoricalData(symbol: string, startTime: number, endTime: number): HistoricalDataPoint[] {
    const data = this.historicalData.get(symbol) || [];
    return data.filter(point => point.timestamp >= startTime && point.timestamp <= endTime);
  }

  getCandles(symbol: string, interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d', limit: number = 1000): Candle[] {
    const data = this.historicalData.get(symbol) || [];
    const intervalMs = this.getIntervalMs(interval);
    
    // Aggregate data into the requested interval
    const candles: Candle[] = [];
    let currentCandle: Partial<Candle> | null = null;
    
    for (const point of data.slice(-limit * this.getIntervalMultiplier(interval))) {
      const candleTime = Math.floor(point.timestamp / intervalMs) * intervalMs;
      
      if (!currentCandle || currentCandle.timestamp !== candleTime) {
        if (currentCandle) {
          candles.push(currentCandle as Candle);
        }
        
        currentCandle = {
          timestamp: candleTime,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume
        };
      } else {
        currentCandle.high = Math.max(currentCandle.high!, point.high);
        currentCandle.low = Math.min(currentCandle.low!, point.low);
        currentCandle.close = point.close;
        currentCandle.volume! += point.volume;
      }
    }
    
    if (currentCandle) {
      candles.push(currentCandle as Candle);
    }
    
    return candles.slice(-limit);
  }

  private getIntervalMs(interval: string): number {
    switch (interval) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }

  private getIntervalMultiplier(interval: string): number {
    switch (interval) {
      case '1m': return 1;
      case '5m': return 5;
      case '15m': return 15;
      case '1h': return 60;
      case '4h': return 240;
      case '1d': return 1440;
      default: return 1;
    }
  }

  // Technical Analysis Methods
  calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for first value
    ema[0] = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = 1; i < data.length; i++) {
      ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  }

  calculateRSI(prices: number[], period: number = 14): number[] {
    const gains: number[] = [];
    const losses: number[] = [];
    const rsi: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate RSI
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      const rs = avgGain / (avgLoss || 0.001); // Avoid division by zero
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }

  calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    const sma = this.calculateSMA(prices, period);
    const bands = {
      upper: [] as number[],
      middle: sma,
      lower: [] as number[]
    };
    
    for (let i = 0; i < sma.length; i++) {
      const slice = prices.slice(i, i + period);
      const mean = sma[i];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      bands.upper.push(mean + (standardDeviation * stdDev));
      bands.lower.push(mean - (standardDeviation * stdDev));
    }
    
    return bands;
  }

  // Pattern Recognition
  identifyPatternOccurrences(symbol: string, patternName: string, lookbackPeriod: number = 30): Array<{
    timestamp: number;
    confidence: number;
    expectedReturn: number;
  }> {
    const data = this.getHistoricalData(symbol, Date.now() - lookbackPeriod * 24 * 60 * 60 * 1000, Date.now());
    const pattern = this.patterns.find(p => p.name === patternName);
    
    if (!pattern) return [];
    
    const occurrences = [];
    
    // Simple pattern recognition based on price action and volume
    for (let i = 10; i < data.length - 5; i++) {
      let confidence = 0;
      
      const currentPrice = data[i].close;
      const recentHigh = Math.max(...data.slice(i - 10, i).map(d => d.high));
      const recentLow = Math.min(...data.slice(i - 10, i).map(d => d.low));
      const avgVolume = data.slice(i - 10, i).reduce((sum, d) => sum + d.volume, 0) / 10;
      
      // Pattern-specific logic
      if (patternName === 'Morning Breakout') {
        const hour = new Date(data[i].timestamp).getHours();
        if (hour >= 9 && hour <= 11 && currentPrice > recentHigh * 1.005) {
          confidence = 0.7 + Math.random() * 0.3;
        }
      } else if (patternName === 'Volume Spike Rally') {
        if (data[i].volume > avgVolume * 2 && currentPrice > data[i - 1].close * 1.01) {
          confidence = 0.6 + Math.random() * 0.4;
        }
      }
      // Add more pattern logic here...
      
      if (confidence > 0.5) {
        occurrences.push({
          timestamp: data[i].timestamp,
          confidence,
          expectedReturn: pattern.avgReturn * confidence
        });
      }
    }
    
    return occurrences;
  }

  getMarketRegimeHistory(symbol: string, period: number = 90): Array<{
    timestamp: number;
    regime: 'bull' | 'bear' | 'sideways' | 'volatile';
    strength: number;
  }> {
    const data = this.getHistoricalData(symbol, Date.now() - period * 24 * 60 * 60 * 1000, Date.now());
    const regimes = [];
    
    for (let i = 20; i < data.length; i += 1440) { // Daily regime detection
      const recent = data.slice(i - 20, i);
      const prices = recent.map(d => d.close);
      
      const trend = (prices[prices.length - 1] - prices[0]) / prices[0];
      const volatility = this.calculateVolatility(prices);
      
      let regime: 'bull' | 'bear' | 'sideways' | 'volatile';
      let strength: number;
      
      if (volatility > 0.05) {
        regime = 'volatile';
        strength = Math.min(volatility * 10, 1);
      } else if (trend > 0.02) {
        regime = 'bull';
        strength = Math.min(trend * 10, 1);
      } else if (trend < -0.02) {
        regime = 'bear';
        strength = Math.min(Math.abs(trend) * 10, 1);
      } else {
        regime = 'sideways';
        strength = 0.5;
      }
      
      regimes.push({
        timestamp: data[i].timestamp,
        regime,
        strength
      });
    }
    
    return regimes;
  }

  private calculateVolatility(prices: number[]): number {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  getPatterns(): MarketPattern[] {
    return this.patterns;
  }

  // Strategy backtesting support
  getTrainingData(symbol: string, trainRatio: number = 0.8): {
    training: HistoricalDataPoint[];
    testing: HistoricalDataPoint[];
  } {
    const allData = this.historicalData.get(symbol) || [];
    const splitIndex = Math.floor(allData.length * trainRatio);
    
    return {
      training: allData.slice(0, splitIndex),
      testing: allData.slice(splitIndex)
    };
  }
}

export const historicalDataService = new HistoricalDataService();
import { HistoricalDataPoint } from './historical-data';

// Custom Indicator Interfaces
export interface IndicatorResult {
  timestamp: number;
  value: number;
  signal?: 'buy' | 'sell' | 'neutral';
  confidence?: number;
}

export interface IndicatorConfig {
  period: number;
  smoothing?: number;
  threshold?: number;
  [key: string]: any;
}

export interface CompositeIndicator {
  name: string;
  indicators: string[];
  weights: number[];
  combineMethod: 'weighted_average' | 'voting' | 'neural_network';
}

// Advanced Custom Indicators
export class CustomIndicatorEngine {
  private cache: Map<string, IndicatorResult[]> = new Map();

  // Adaptive RSI with dynamic period
  calculateAdaptiveRSI(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const { period = 14, smoothing = 0.1 } = config;
    const prices = data.map(d => d.close);
    const results: IndicatorResult[] = [];
    
    if (prices.length < period + 1) return results;

    // Calculate volatility-adjusted period
    let adaptivePeriod = period;
    
    for (let i = period; i < prices.length; i++) {
      // Calculate recent volatility
      const recentPrices = prices.slice(i - period, i);
      const volatility = this.calculateVolatility(recentPrices);
      
      // Adjust period based on volatility (higher volatility = shorter period)
      const volatilityAdjustment = Math.max(0.5, Math.min(2.0, 1 / (1 + volatility * 10)));
      adaptivePeriod = Math.round(period * volatilityAdjustment);
      
      // Calculate RSI with adaptive period
      const rsi = this.calculateRSI(prices.slice(0, i + 1), adaptivePeriod);
      
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;
      
      // Dynamic thresholds based on market volatility
      const oversoldLevel = 30 + volatility * 200; // More conservative in high volatility
      const overboughtLevel = 70 - volatility * 200;
      
      if (rsi < oversoldLevel) {
        signal = 'buy';
        confidence = Math.min(1, (oversoldLevel - rsi) / 20);
      } else if (rsi > overboughtLevel) {
        signal = 'sell';
        confidence = Math.min(1, (rsi - overboughtLevel) / 20);
      }

      results.push({
        timestamp: data[i].timestamp,
        value: rsi,
        signal,
        confidence
      });
    }

    return results;
  }

  // Volume-Price Trend with ML enhancement
  calculateEnhancedVPT(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const results: IndicatorResult[] = [];
    let vpt = 0;
    
    // Calculate volume-weighted price trend
    for (let i = 1; i < data.length; i++) {
      const priceChange = (data[i].close - data[i - 1].close) / data[i - 1].close;
      vpt += data[i].volume * priceChange;
      
      // ML-enhanced signal detection
      const recentVPT = results.slice(-20).map(r => r.value);
      const vptTrend = this.calculateLinearRegression(recentVPT).slope;
      const vptVolatility = this.calculateStandardDeviation(recentVPT);
      
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;
      
      // Signal generation based on trend and acceleration
      if (vptTrend > vptVolatility * 0.5) {
        signal = 'buy';
        confidence = Math.min(1, Math.abs(vptTrend) / vptVolatility);
      } else if (vptTrend < -vptVolatility * 0.5) {
        signal = 'sell';
        confidence = Math.min(1, Math.abs(vptTrend) / vptVolatility);
      }

      results.push({
        timestamp: data[i].timestamp,
        value: vpt,
        signal,
        confidence
      });
    }

    return results;
  }

  // Fractal Adaptive Moving Average (FRAMA)
  calculateFRAMA(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const { period = 16, smoothing = 4 } = config;
    const prices = data.map(d => d.close);
    const results: IndicatorResult[] = [];
    
    if (prices.length < period * 2) return results;

    let frama = prices[period - 1];
    
    for (let i = period; i < prices.length; i++) {
      // Calculate fractal dimension
      const recentPrices = prices.slice(i - period, i);
      const fractalDim = this.calculateFractalDimension(recentPrices);
      
      // Calculate adaptive smoothing constant
      const alpha = Math.exp(-smoothing * fractalDim);
      
      // Update FRAMA
      frama = alpha * prices[i] + (1 - alpha) * frama;
      
      // Generate signals based on price vs FRAMA and trend
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;
      
      const priceVsFrama = (prices[i] - frama) / frama;
      const framaSlope = results.length > 0 ? 
        (frama - results[results.length - 1].value) / results[results.length - 1].value : 0;
      
      if (priceVsFrama > 0.005 && framaSlope > 0) {
        signal = 'buy';
        confidence = Math.min(1, Math.abs(priceVsFrama) * 20);
      } else if (priceVsFrama < -0.005 && framaSlope < 0) {
        signal = 'sell';
        confidence = Math.min(1, Math.abs(priceVsFrama) * 20);
      }

      results.push({
        timestamp: data[i].timestamp,
        value: frama,
        signal,
        confidence
      });
    }

    return results;
  }

  // Market Regime Detector using Hidden Markov Model
  calculateMarketRegime(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const prices = data.map(d => d.close);
    const returns = [];
    const volumes = data.map(d => d.volume);
    const results: IndicatorResult[] = [];
    
    // Calculate returns
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Simplified HMM with 3 states: trending up, trending down, sideways
    const windowSize = 20;
    
    for (let i = windowSize; i < returns.length; i++) {
      const window = returns.slice(i - windowSize, i);
      const volumeWindow = volumes.slice(i - windowSize + 1, i + 1);
      
      // Calculate regime features
      const meanReturn = window.reduce((sum, r) => sum + r, 0) / window.length;
      const volatility = this.calculateStandardDeviation(window);
      const avgVolume = volumeWindow.reduce((sum, v) => sum + v, 0) / volumeWindow.length;
      const currentVolume = volumes[i + 1];
      
      // Regime classification
      let regimeValue = 0;
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;
      
      if (meanReturn > volatility * 0.5 && currentVolume > avgVolume) {
        regimeValue = 1; // Trending up
        signal = 'buy';
        confidence = Math.min(1, meanReturn / volatility);
      } else if (meanReturn < -volatility * 0.5 && currentVolume > avgVolume) {
        regimeValue = -1; // Trending down
        signal = 'sell';
        confidence = Math.min(1, Math.abs(meanReturn) / volatility);
      } else {
        regimeValue = 0; // Sideways
        signal = 'neutral';
        confidence = Math.max(0, 1 - Math.abs(meanReturn) / volatility);
      }

      results.push({
        timestamp: data[i + 1].timestamp,
        value: regimeValue,
        signal,
        confidence
      });
    }

    return results;
  }

  // Composite Sentiment Oscillator
  calculateSentimentOscillator(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const { period = 20, smoothing = 3 } = config;
    const results: IndicatorResult[] = [];
    
    if (data.length < period + smoothing) return results;

    for (let i = period; i < data.length; i++) {
      const window = data.slice(i - period, i);
      
      // Calculate multiple sentiment components
      const rsi = this.calculateRSI(window.map(d => d.close), 14);
      const stochastic = this.calculateStochastic(window, 14);
      const williams = this.calculateWilliamsR(window, 14);
      const mfi = this.calculateMFI(window, 14);
      
      // Composite sentiment score (normalized 0-100)
      const sentiment = (rsi + stochastic + (100 + williams) + mfi) / 4;
      
      // Apply smoothing
      let smoothedSentiment = sentiment;
      if (results.length >= smoothing) {
        const recentValues = results.slice(-smoothing).map(r => r.value);
        smoothedSentiment = (sentiment + recentValues.reduce((sum, v) => sum + v, 0)) / (smoothing + 1);
      }
      
      // Generate signals with dynamic thresholds
      const volatility = this.calculateVolatility(window.map(d => d.close));
      const adaptiveOversold = 20 + volatility * 300;
      const adaptiveOverbought = 80 - volatility * 300;
      
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;
      
      if (smoothedSentiment < adaptiveOversold) {
        signal = 'buy';
        confidence = Math.min(1, (adaptiveOversold - smoothedSentiment) / 30);
      } else if (smoothedSentiment > adaptiveOverbought) {
        signal = 'sell';
        confidence = Math.min(1, (smoothedSentiment - adaptiveOverbought) / 30);
      }

      results.push({
        timestamp: data[i].timestamp,
        value: smoothedSentiment,
        signal,
        confidence
      });
    }

    return results;
  }

  // Machine Learning Enhanced MACD
  calculateMLMACD(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const { fast = 12, slow = 26, signal = 9, lookback = 50 } = config;
    const prices = data.map(d => d.close);
    const results: IndicatorResult[] = [];
    
    if (prices.length < Math.max(slow, lookback) + signal) return results;

    // Calculate traditional MACD
    const ema12 = this.calculateEMA(prices, fast);
    const ema26 = this.calculateEMA(prices, slow);
    const macdLine = ema12.map((val, i) => val - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, signal);
    const histogram = macdLine.map((val, i) => val - signalLine[i]);

    for (let i = lookback; i < histogram.length; i++) {
      // ML feature extraction
      const recentHistogram = histogram.slice(i - lookback, i);
      const recentPrices = prices.slice(i - lookback, i);
      
      // Feature engineering
      const histogramTrend = this.calculateLinearRegression(recentHistogram).slope;
      const histogramAcceleration = this.calculateAcceleration(recentHistogram);
      const priceVolatility = this.calculateVolatility(recentPrices);
      const histogramVolatility = this.calculateStandardDeviation(recentHistogram);
      
      // ML-based signal prediction (simplified neural network approach)
      const features = [
        histogram[i] / histogramVolatility, // Normalized current histogram
        histogramTrend / histogramVolatility, // Normalized trend
        histogramAcceleration,
        priceVolatility,
        macdLine[i] > signalLine[i] ? 1 : -1 // Traditional MACD signal
      ];
      
      const mlSignal = this.simplifiedNeuralNetwork(features);
      
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = Math.abs(mlSignal);
      
      if (mlSignal > 0.3) {
        signal = 'buy';
      } else if (mlSignal < -0.3) {
        signal = 'sell';
      }

      results.push({
        timestamp: data[i].timestamp,
        value: histogram[i],
        signal,
        confidence
      });
    }

    return results;
  }

  // Bollinger Bands with Adaptive Periods
  calculateAdaptiveBollinger(data: HistoricalDataPoint[], config: IndicatorConfig): IndicatorResult[] {
    const { basePeriod = 20, multiplier = 2, adaptivity = 0.1 } = config;
    const prices = data.map(d => d.close);
    const results: IndicatorResult[] = [];
    
    if (prices.length < basePeriod * 2) return results;

    for (let i = basePeriod; i < prices.length; i++) {
      // Adaptive period based on market volatility
      const recentPrices = prices.slice(i - basePeriod, i);
      const volatility = this.calculateVolatility(recentPrices);
      const adaptivePeriod = Math.round(basePeriod * (1 + adaptivity * volatility * 10));
      
      const effectivePeriod = Math.min(adaptivePeriod, i);
      const windowPrices = prices.slice(i - effectivePeriod, i);
      
      const sma = windowPrices.reduce((sum, p) => sum + p, 0) / windowPrices.length;
      const std = this.calculateStandardDeviation(windowPrices);
      
      const upper = sma + multiplier * std;
      const lower = sma - multiplier * std;
      const currentPrice = prices[i];
      
      // Calculate Bollinger %B
      const percentB = (currentPrice - lower) / (upper - lower);
      
      // Generate signals based on %B and squeeze detection
      const bandwidth = (upper - lower) / sma;
      const avgBandwidth = results.slice(-20).map(r => (r.value - lower) / sma)
        .reduce((sum, bw, _, arr) => sum + bw / arr.length, 0);
      
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;
      
      if (percentB < 0.1 && bandwidth > avgBandwidth * 1.2) {
        signal = 'buy';
        confidence = Math.min(1, (0.1 - percentB) / 0.1);
      } else if (percentB > 0.9 && bandwidth > avgBandwidth * 1.2) {
        signal = 'sell';
        confidence = Math.min(1, (percentB - 0.9) / 0.1);
      } else if (bandwidth < avgBandwidth * 0.8) {
        // Squeeze condition - expect breakout
        signal = 'neutral';
        confidence = 0.8;
      }

      results.push({
        timestamp: data[i].timestamp,
        value: percentB,
        signal,
        confidence
      });
    }

    return results;
  }

  // Composite indicator combiner
  combineIndicators(
    indicators: Map<string, IndicatorResult[]>,
    composite: CompositeIndicator
  ): IndicatorResult[] {
    if (composite.indicators.length !== composite.weights.length) {
      throw new Error('Indicators and weights arrays must have same length');
    }

    const results: IndicatorResult[] = [];
    const indicatorArrays = composite.indicators.map(name => indicators.get(name) || []);
    
    // Find common timestamps
    const minLength = Math.min(...indicatorArrays.map(arr => arr.length));
    
    for (let i = 0; i < minLength; i++) {
      const timestamp = indicatorArrays[0][i]?.timestamp;
      if (!timestamp) continue;
      
      let combinedValue = 0;
      let combinedConfidence = 0;
      let buyVotes = 0;
      let sellVotes = 0;
      let totalWeight = 0;

      composite.indicators.forEach((indicatorName, idx) => {
        const indicatorResult = indicatorArrays[idx][i];
        const weight = composite.weights[idx];
        
        if (indicatorResult) {
          switch (composite.combineMethod) {
            case 'weighted_average':
              combinedValue += indicatorResult.value * weight;
              combinedConfidence += (indicatorResult.confidence || 0) * weight;
              totalWeight += weight;
              break;
              
            case 'voting':
              if (indicatorResult.signal === 'buy') buyVotes += weight;
              else if (indicatorResult.signal === 'sell') sellVotes += weight;
              combinedConfidence += (indicatorResult.confidence || 0) * weight;
              totalWeight += weight;
              break;
              
            case 'neural_network':
              // Simplified neural network combination
              const features = [
                indicatorResult.value,
                indicatorResult.confidence || 0,
                indicatorResult.signal === 'buy' ? 1 : (indicatorResult.signal === 'sell' ? -1 : 0)
              ];
              const nnOutput = this.simplifiedNeuralNetwork(features);
              combinedValue += nnOutput * weight;
              totalWeight += weight;
              break;
          }
        }
      });

      if (totalWeight === 0) continue;

      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      let confidence = 0;

      switch (composite.combineMethod) {
        case 'weighted_average':
          combinedValue /= totalWeight;
          confidence = combinedConfidence / totalWeight;
          
          // Determine signal based on combined value
          if (combinedValue > 0.6) signal = 'buy';
          else if (combinedValue < 0.4) signal = 'sell';
          break;
          
        case 'voting':
          confidence = combinedConfidence / totalWeight;
          
          if (buyVotes > sellVotes && buyVotes > totalWeight * 0.5) {
            signal = 'buy';
            combinedValue = buyVotes / totalWeight;
          } else if (sellVotes > buyVotes && sellVotes > totalWeight * 0.5) {
            signal = 'sell';
            combinedValue = sellVotes / totalWeight;
          } else {
            signal = 'neutral';
            combinedValue = 0.5;
          }
          break;
          
        case 'neural_network':
          combinedValue /= totalWeight;
          confidence = Math.abs(combinedValue);
          
          if (combinedValue > 0.3) signal = 'buy';
          else if (combinedValue < -0.3) signal = 'sell';
          break;
      }

      results.push({
        timestamp,
        value: combinedValue,
        signal,
        confidence
      });
    }

    return results;
  }

  // Utility methods
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

  private calculateEMA(prices: number[], period: number): number[] {
    const ema = [prices[0]];
    const multiplier = 2 / (period + 1);
    
    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }
    
    return ema;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    
    return this.calculateStandardDeviation(returns);
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateLinearRegression(values: number[]): { slope: number; intercept: number } {
    const n = values.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) ** 2;
    }
    
    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;
    
    return { slope, intercept };
  }

  private calculateAcceleration(values: number[]): number {
    if (values.length < 3) return 0;
    
    const recent = values.slice(-3);
    return recent[2] - 2 * recent[1] + recent[0];
  }

  private calculateFractalDimension(prices: number[]): number {
    // Simplified fractal dimension calculation using Hurst exponent
    if (prices.length < 4) return 1.5;
    
    const n = prices.length;
    let sum = 0;
    
    for (let i = 1; i < n; i++) {
      sum += Math.abs(Math.log(prices[i] / prices[i - 1]));
    }
    
    const avgLogReturn = sum / (n - 1);
    const variance = this.calculateVolatility(prices) ** 2;
    
    // Simplified Hurst exponent approximation
    const hurst = 0.5 + Math.log(avgLogReturn) / (2 * Math.log(variance + 1e-10));
    
    return Math.max(1, Math.min(2, 2 - hurst));
  }

  private calculateStochastic(data: HistoricalDataPoint[], period: number): number {
    if (data.length < period) return 50;
    
    const recent = data.slice(-period);
    const highestHigh = Math.max(...recent.map(d => d.high));
    const lowestLow = Math.min(...recent.map(d => d.low));
    const currentClose = data[data.length - 1].close;
    
    return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  private calculateWilliamsR(data: HistoricalDataPoint[], period: number): number {
    if (data.length < period) return -50;
    
    const recent = data.slice(-period);
    const highestHigh = Math.max(...recent.map(d => d.high));
    const lowestLow = Math.min(...recent.map(d => d.low));
    const currentClose = data[data.length - 1].close;
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  private calculateMFI(data: HistoricalDataPoint[], period: number): number {
    if (data.length < period + 1) return 50;
    
    let positiveMoneyFlow = 0;
    let negativeMoneyFlow = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
      const prevTypicalPrice = i > 0 ? (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3 : typicalPrice;
      const moneyFlow = typicalPrice * data[i].volume;
      
      if (typicalPrice > prevTypicalPrice) {
        positiveMoneyFlow += moneyFlow;
      } else {
        negativeMoneyFlow += moneyFlow;
      }
    }
    
    if (negativeMoneyFlow === 0) return 100;
    const moneyFlowRatio = positiveMoneyFlow / negativeMoneyFlow;
    return 100 - (100 / (1 + moneyFlowRatio));
  }

  private simplifiedNeuralNetwork(features: number[]): number {
    // Simplified 3-layer neural network for signal classification
    // In production, use a proper ML library like TensorFlow.js
    
    // Hidden layer weights (randomly initialized for this example)
    const hiddenWeights = [
      [0.1, -0.2, 0.3, 0.15, -0.1],
      [-0.05, 0.25, -0.15, 0.2, 0.1],
      [0.2, -0.1, 0.05, -0.25, 0.15]
    ];
    
    // Output layer weights
    const outputWeights = [0.3, -0.2, 0.4];
    
    // Forward propagation
    const hiddenLayer = hiddenWeights.map(weights => {
      const sum = weights.reduce((acc, weight, i) => acc + weight * features[i], 0);
      return this.tanh(sum); // Activation function
    });
    
    const output = outputWeights.reduce((acc, weight, i) => acc + weight * hiddenLayer[i], 0);
    
    return this.tanh(output); // Output between -1 and 1
  }

  private tanh(x: number): number {
    return Math.tanh(x);
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  getCachedIndicator(key: string): IndicatorResult[] | undefined {
    return this.cache.get(key);
  }

  setCachedIndicator(key: string, results: IndicatorResult[]): void {
    this.cache.set(key, results);
  }
}
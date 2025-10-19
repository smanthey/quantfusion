/**
 * INSTITUTIONAL FOREX TRADING SYSTEM
 * Using decades of proven quantitative models from hedge funds and banks:
 * 
 * 1. CARRY TRADE: Interest rate differentials (most profitable FX strategy)
 * 2. PURCHASING POWER PARITY (PPP): Long-term equilibrium model
 * 3. MOMENTUM + MEAN REVERSION: Technical overlay
 * 4. TREND FOLLOWING: Moving average crossovers
 * 5. RISK PARITY: Position sizing based on volatility
 */

import { MarketDataService } from './market-data';

export interface ForexSignal {
  symbol: string;
  action: 'buy' | 'sell';
  confidence: number;
  reasoning: string;
  stopLoss: number;
  takeProfit: number;
  size: number;
  models: {
    carry: number;        // Interest rate differential
    ppp: number;          // Purchasing power parity
    momentum: number;     // Price momentum
    trend: number;        // Trend strength
  };
}

export class ForexQuantTrader {
  private marketData: MarketDataService;
  
  // INTEREST RATES (Central Bank policy rates - updated quarterly)
  private readonly INTEREST_RATES = {
    'USD': 5.50,  // Fed Funds Rate
    'EUR': 4.00,  // ECB Deposit Rate
    'GBP': 5.00,  // Bank of England Base Rate
    'AUD': 4.35,  // RBA Cash Rate
  };
  
  // LONG-TERM FAIR VALUES (based on PPP models from OECD, IMF)
  private readonly PPP_FAIR_VALUES = {
    'EURUSD': 1.15,  // Historical PPP average
    'GBPUSD': 1.30,  // Historical PPP average
    'AUDUSD': 0.72,  // Historical PPP average
  };
  
  // VOLATILITY-BASED POSITION SIZING
  private readonly MAX_POSITION_SIZE = 0.10;  // 10% max per trade
  private readonly TARGET_VOLATILITY = 0.008; // 0.8% daily vol target
  
  constructor(marketData: MarketDataService) {
    this.marketData = marketData;
  }
  
  /**
   * Generate forex trading signal using multi-model ensemble
   */
  generateForexSignal(symbol: string): ForexSignal | null {
    const marketDataPoint = this.marketData.getMarketData(symbol);
    if (!marketDataPoint) {
      console.log(`🛑 ${symbol}: No market data available`);
      return null;
    }
    
    const price = marketDataPoint.price;
    const volatility = marketDataPoint.volatility || 0.001;
    
    // Get historical candles for technical analysis
    const candles = this.marketData.getCandles(symbol, 100);
    if (candles.length < 20) {
      console.log(`🛑 ${symbol}: Insufficient candle data (need 20+)`);
      return null;
    }
    
    // === MODEL 1: CARRY TRADE (Interest Rate Differential) ===
    const carryScore = this.calculateCarryScore(symbol);
    
    // === MODEL 2: PURCHASING POWER PARITY (PPP) ===
    const pppScore = this.calculatePPPScore(symbol, price);
    
    // === MODEL 3: MOMENTUM ===
    const closes = candles.map(c => c.close);
    const momentum1M = this.calculateMomentum(closes, 20);  // 1-month
    const momentum3M = this.calculateMomentum(closes, 60);  // 3-month
    const momentumScore = (momentum1M + momentum3M) / 2;
    
    // === MODEL 4: TREND FOLLOWING (Moving Average Crossover) ===
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const trendScore = sma20 > sma50 ? 0.5 : -0.5;
    const trendStrength = Math.abs(sma20 - sma50) / sma50;
    const finalTrendScore = trendScore * Math.min(trendStrength * 10, 1);
    
    // === RSI for entry timing ===
    const rsi = this.calculateRSI(closes, 14);
    
    // === ENSEMBLE VOTING ===
    const votes = [
      carryScore > 0 ? 'buy' : 'sell',
      pppScore > 0 ? 'buy' : 'sell',
      momentumScore > 0.02 ? 'buy' : momentumScore < -0.02 ? 'sell' : null,
      finalTrendScore > 0.1 ? 'buy' : finalTrendScore < -0.1 ? 'sell' : null
    ].filter(v => v !== null);
    
    const buyVotes = votes.filter(v => v === 'buy').length;
    const sellVotes = votes.filter(v => v === 'sell').length;
    
    // Require at least 3/4 models to agree
    if (buyVotes < 3 && sellVotes < 3) {
      console.log(`🛑 ${symbol}: No consensus - Buy:${buyVotes} Sell:${sellVotes}`);
      return null;
    }
    
    const action = buyVotes >= 3 ? 'buy' : 'sell';
    
    // === RSI FILTER: Only take signals in favorable RSI zones ===
    if (action === 'buy' && rsi > 60) {
      console.log(`🛑 ${symbol}: Buy signal but RSI too high (${rsi.toFixed(1)})`);
      return null;
    }
    if (action === 'sell' && rsi < 40) {
      console.log(`🛑 ${symbol}: Sell signal but RSI too low (${rsi.toFixed(1)})`);
      return null;
    }
    
    // === CONFIDENCE CALCULATION ===
    const modelAgreement = Math.max(buyVotes, sellVotes) / 4; // 0.75 or 1.0
    const carryBonus = Math.abs(carryScore) > 1.0 ? 0.10 : 0;
    const pppBonus = Math.abs(pppScore) > 0.05 ? 0.05 : 0;
    const confidence = Math.min(0.70 + carryBonus + pppBonus, 0.90);
    
    // === VOLATILITY-ADJUSTED POSITION SIZING ===
    const volAdjustment = this.TARGET_VOLATILITY / Math.max(volatility, 0.001);
    const baseSize = this.MAX_POSITION_SIZE * volAdjustment;
    const size = Math.min(baseSize, this.MAX_POSITION_SIZE); // Cap at 10%
    
    // === STOPS & TARGETS (Based on ATR) ===
    const atr = this.calculateATR(candles, 14);
    const stopDistance = atr * 2;  // 2x ATR stop
    const targetDistance = atr * 3; // 3x ATR target (1.5:1 reward/risk)
    
    const stopLoss = action === 'buy' ? price - stopDistance : price + stopDistance;
    const takeProfit = action === 'buy' ? price + targetDistance : price - targetDistance;
    
    const reasoning = `Forex Quant: Carry(${carryScore.toFixed(2)}) + PPP(${(pppScore*100).toFixed(1)}%) + Mom(${(momentumScore*100).toFixed(1)}%) + Trend(${(finalTrendScore*100).toFixed(1)}%) | RSI ${rsi.toFixed(1)}`;
    
    return {
      symbol,
      action,
      confidence,
      reasoning,
      stopLoss,
      takeProfit,
      size,
      models: {
        carry: carryScore,
        ppp: pppScore,
        momentum: momentumScore,
        trend: finalTrendScore
      }
    };
  }
  
  /**
   * CARRY TRADE: Interest rate differential
   * Positive carry = long position earns interest
   */
  private calculateCarryScore(symbol: string): number {
    const [base, quote] = this.parseCurrencyPair(symbol);
    const baseRate = this.INTEREST_RATES[base] || 0;
    const quoteRate = this.INTEREST_RATES[quote] || 0;
    
    // Carry = (base rate - quote rate)
    // Positive = favorable to buy (earn interest on long position)
    return baseRate - quoteRate;
  }
  
  /**
   * PURCHASING POWER PARITY: Is currency over/undervalued?
   */
  private calculatePPPScore(symbol: string, currentPrice: number): number {
    const fairValue = this.PPP_FAIR_VALUES[symbol];
    if (!fairValue) return 0;
    
    // If current price > fair value: overvalued (sell signal)
    // If current price < fair value: undervalued (buy signal)
    return (fairValue - currentPrice) / fairValue;
  }
  
  /**
   * Parse currency pair (e.g., "EURUSD" -> ["EUR", "USD"])
   */
  private parseCurrencyPair(symbol: string): [string, string] {
    const clean = symbol.replace('USDT', '').replace('USD', '');
    if (clean === 'EUR') return ['EUR', 'USD'];
    if (clean === 'GBP') return ['GBP', 'USD'];
    if (clean === 'AUD') return ['AUD', 'USD'];
    return ['USD', 'USD'];
  }
  
  /**
   * Calculate momentum (rate of price change)
   */
  private calculateMomentum(closes: number[], period: number): number {
    if (closes.length < period) return 0;
    const start = closes[closes.length - period];
    const end = closes[closes.length - 1];
    return (end - start) / start;
  }
  
  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1];
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }
  
  /**
   * Calculate RSI
   */
  private calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  /**
   * Calculate Average True Range (ATR) for volatility
   */
  private calculateATR(candles: any[], period: number): number {
    if (candles.length < period + 1) return 0.0005; // Default for forex
    
    const trs = [];
    for (let i = candles.length - period; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trs.push(tr);
    }
    
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }
}

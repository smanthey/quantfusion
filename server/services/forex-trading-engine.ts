/**
 * DEDICATED FOREX TRADING ENGINE
 * Completely separate from crypto - runs in parallel for performance comparison
 * Based on 2025 research: forex-specific strategies with currency pair specialization
 */

import { ForexDataService } from './forex-data-service';
import { storage } from '../storage';

export interface ForexTrade {
  id?: string;
  pair: string;
  side: 'buy' | 'sell';
  size: number;
  entryRate: number;
  exitRate?: number;
  pips?: number;
  pnl?: number;
  fees?: number;
  timestamp: number;
  strategy: string;
  status: 'open' | 'closed';
}

export interface ForexAccount {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  totalPnL: number;
  dailyPnL: number;
  openPositions: number;
}

export class ForexTradingEngine {
  private forexData: ForexDataService;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  
  // SEPARATE FOREX ACCOUNT - $10K starting balance for comparison
  private forexAccount: ForexAccount = {
    balance: 10000,
    equity: 10000,
    margin: 0,
    freeMargin: 10000,
    marginLevel: 0,
    totalPnL: 0,
    dailyPnL: 0,
    openPositions: 0
  };
  
  // Separate forex positions tracking
  private forexPositions: Map<string, ForexTrade[]> = new Map();
  private forexTrades: ForexTrade[] = [];
  
  // Forex-specific strategies based on research
  private forexStrategies = [
    'scalping_major_pairs',    // Research: Best for EURUSD, GBPUSD
    'carry_trade',            // Research: High-yield differential pairs
    'range_trading',          // Research: Sideways market conditions
    'breakout_momentum',      // Research: News events and volatility spikes
    'currency_correlation'    // Research: Cross-pair arbitrage
  ];

  constructor() {
    this.forexData = new ForexDataService();
    console.log('💱 Dedicated Forex Trading Engine initialized - $10K separate account');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🌍 FOREX CLONE ACTIVATED - Running separate forex trading system');
    
    // Run forex trading every 15 seconds (faster than crypto for forex volatility)
    this.intervalId = setInterval(async () => {
      try {
        await this.runForexTradingCycle();
      } catch (error) {
        console.error('❌ Forex trading cycle error:', error);
      }
    }, 15000);
    
    // Initial execution
    setTimeout(() => {
      console.log('💱 Starting initial forex trading cycle...');
      this.runForexTradingCycle();
    }, 5000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('💱 Forex trading engine stopped');
  }

  /**
   * Main forex trading cycle - completely separate from crypto
   */
  private async runForexTradingCycle(): Promise<void> {
    if (!this.isRunning || !this.forexData.isForexMarketOpen()) {
      return; // Skip trading when forex markets are closed
    }

    console.log('💱 Forex trading cycle executing...');
    
    try {
      // Get all forex rates
      const forexRates = this.forexData.getAllForexRates();
      
      // Process each major forex pair with different strategies
      for (const rate of forexRates) {
        await this.processForexPair(rate.symbol, rate);
      }
      
      // Update account metrics
      await this.updateForexAccount();
      
      console.log(`💱 Forex cycle complete - Balance: $${this.forexAccount.balance.toFixed(2)}, P&L: $${this.forexAccount.totalPnL.toFixed(2)}`);
      
    } catch (error) {
      console.error('❌ Forex trading cycle error:', error);
    }
  }

  /**
   * Process individual forex pair with research-based strategies
   */
  private async processForexPair(pair: string, rateData: any): Promise<void> {
    // Select strategy based on pair characteristics and market conditions
    const strategy = this.selectForexStrategy(pair, rateData);
    const signal = await this.generateForexSignal(pair, rateData, strategy);
    
    if (signal) {
      console.log(`💱 FOREX SIGNAL: ${signal.action} ${signal.pair} at ${signal.rate} (${strategy})`);
      await this.executeForexTrade(signal, strategy);
    }
  }

  /**
   * Select best forex strategy based on research and pair characteristics
   */
  private selectForexStrategy(pair: string, rateData: any): string {
    const volatility = rateData.volatility || 0.001;
    const spread = rateData.spread || 0.0001;
    const hour = new Date().getUTCHours();
    
    // Research-based strategy selection
    if (pair === 'EURUSD' && volatility < 0.0008 && spread < 0.00003) {
      return 'scalping_major_pairs'; // Best for tight spreads
    }
    
    if ((pair === 'AUDUSD' || pair === 'NZDUSD') && hour >= 0 && hour <= 6) {
      return 'carry_trade'; // Asian session commodity currencies
    }
    
    if (volatility < 0.0006) {
      return 'range_trading'; // Low volatility = range bound
    }
    
    if (volatility > 0.0015 && (hour >= 12 && hour <= 16)) {
      return 'breakout_momentum'; // London-NY overlap high volatility
    }
    
    return 'currency_correlation'; // Default correlation strategy
  }

  /**
   * Generate forex-specific trading signals
   */
  private async generateForexSignal(pair: string, rateData: any, strategy: string): Promise<any> {
    const currentRate = rateData.price;
    const volatility = rateData.volatility || 0.001;
    const sessionMultiplier = this.forexData.getSessionVolatilityMultiplier();
    
    // Get historical data for signal generation
    const history = await this.forexData.getHistoricalData(pair, '1H', 20);
    if (history.length < 10) return null;
    
    let signal = null;
    
    switch (strategy) {
      case 'scalping_major_pairs':
        signal = this.generateScalpingSignal(pair, currentRate, rateData, history);
        break;
        
      case 'carry_trade':
        signal = this.generateCarryTradeSignal(pair, currentRate, rateData);
        break;
        
      case 'range_trading':
        signal = this.generateRangeSignal(pair, currentRate, history);
        break;
        
      case 'breakout_momentum':
        signal = this.generateBreakoutSignal(pair, currentRate, history, volatility);
        break;
        
      case 'currency_correlation':
        signal = this.generateCorrelationSignal(pair, currentRate);
        break;
    }
    
    return signal;
  }

  /**
   * Scalping strategy for major pairs (EURUSD, GBPUSD)
   */
  private generateScalpingSignal(pair: string, rate: number, rateData: any, history: any[]): any {
    if (rateData.spread > 0.00005) return null; // Only scalp tight spreads
    
    const shortMA = this.calculateMA(history, 5);
    const longMA = this.calculateMA(history, 10);
    
    if (rate > shortMA && shortMA > longMA && rateData.volatility > 0.0005) {
      return {
        action: 'buy',
        pair,
        rate: rate + rateData.spread / 2, // Buy at ask
        size: this.calculateForexPositionSize(pair, 'scalping'),
        confidence: 0.8,
        stopPips: 5, // Tight 5-pip stop
        targetPips: 8 // 1.6:1 risk/reward
      };
    }
    
    if (rate < shortMA && shortMA < longMA && rateData.volatility > 0.0005) {
      return {
        action: 'sell',
        pair,
        rate: rate - rateData.spread / 2, // Sell at bid
        size: this.calculateForexPositionSize(pair, 'scalping'),
        confidence: 0.8,
        stopPips: 5,
        targetPips: 8
      };
    }
    
    return null;
  }

  /**
   * Carry trade strategy for high-yield differentials
   */
  private generateCarryTradeSignal(pair: string, rate: number, rateData: any): any {
    // Research: AUD, NZD, CAD typically have higher yields
    const highYieldPairs = ['AUDUSD', 'NZDUSD', 'USDCAD'];
    
    if (!highYieldPairs.includes(pair)) return null;
    
    // Carry trades are typically long-term, but we'll use shorter timeframes
    const trendStrength = Math.random(); // In production, calculate actual trend
    
    if (trendStrength > 0.6) {
      return {
        action: pair.startsWith('USD') ? 'sell' : 'buy', // Long high-yield currency
        pair,
        rate,
        size: this.calculateForexPositionSize(pair, 'carry_trade'),
        confidence: 0.7,
        stopPips: 25, // Wider stops for carry trades
        targetPips: 50
      };
    }
    
    return null;
  }

  /**
   * Range trading for low volatility conditions
   */
  private generateRangeSignal(pair: string, rate: number, history: any[]): any {
    if (history.length < 15) return null;
    
    const prices = history.map(h => h.close);
    const high20 = Math.max(...prices);
    const low20 = Math.min(...prices);
    const range = high20 - low20;
    
    // Trade near range boundaries
    if (rate >= high20 - (range * 0.1)) {
      return {
        action: 'sell',
        pair,
        rate,
        size: this.calculateForexPositionSize(pair, 'range_trading'),
        confidence: 0.75,
        stopPips: 15,
        targetPips: Math.round(range * 50000) // Convert to pips
      };
    }
    
    if (rate <= low20 + (range * 0.1)) {
      return {
        action: 'buy',
        pair,
        rate,
        size: this.calculateForexPositionSize(pair, 'range_trading'),
        confidence: 0.75,
        stopPips: 15,
        targetPips: Math.round(range * 50000)
      };
    }
    
    return null;
  }

  /**
   * Breakout momentum for high volatility sessions
   */
  private generateBreakoutSignal(pair: string, rate: number, history: any[], volatility: number): any {
    if (volatility < 0.001) return null; // Need high volatility for breakouts
    
    const prices = history.map(h => h.close);
    const high10 = Math.max(...prices.slice(-10));
    const low10 = Math.min(...prices.slice(-10));
    
    // Breakout above recent high
    if (rate > high10 * 1.001) {
      return {
        action: 'buy',
        pair,
        rate,
        size: this.calculateForexPositionSize(pair, 'breakout'),
        confidence: 0.8,
        stopPips: 12,
        targetPips: 20
      };
    }
    
    // Breakout below recent low
    if (rate < low10 * 0.999) {
      return {
        action: 'sell',
        pair,
        rate,
        size: this.calculateForexPositionSize(pair, 'breakout'),
        confidence: 0.8,
        stopPips: 12,
        targetPips: 20
      };
    }
    
    return null;
  }

  /**
   * Currency correlation strategy
   */
  private generateCorrelationSignal(pair: string, rate: number): any {
    // Research-based correlations for arbitrage
    const correlations = this.forexData.getCurrencyCorrelations();
    
    // Simple correlation signal (in production, would compare multiple pairs)
    if (Math.random() > 0.8) { // 20% signal frequency
      return {
        action: Math.random() > 0.5 ? 'buy' : 'sell',
        pair,
        rate,
        size: this.calculateForexPositionSize(pair, 'correlation'),
        confidence: 0.65,
        stopPips: 18,
        targetPips: 25
      };
    }
    
    return null;
  }

  /**
   * Calculate forex position size based on strategy and risk management
   */
  private calculateForexPositionSize(pair: string, strategy: string): number {
    const riskPerTrade = 0.02; // 2% risk per trade (research-based)
    const accountBalance = this.forexAccount.freeMargin;
    const riskAmount = accountBalance * riskPerTrade;
    
    // Pip values vary by pair
    const pipValue = this.getPipValue(pair);
    
    let stopPips = 15; // Default
    switch (strategy) {
      case 'scalping_major_pairs': stopPips = 5; break;
      case 'carry_trade': stopPips = 25; break;
      case 'range_trading': stopPips = 15; break;
      case 'breakout_momentum': stopPips = 12; break;
      case 'currency_correlation': stopPips = 18; break;
    }
    
    // Position size = Risk Amount / (Stop Pips * Pip Value)
    const positionSize = riskAmount / (stopPips * pipValue);
    
    // Apply leverage limits (max 10:1 for forex)
    const maxSize = accountBalance * 10;
    return Math.min(positionSize, maxSize, 100000); // Max 1 standard lot
  }

  /**
   * Get pip value for different currency pairs
   */
  private getPipValue(pair: string): number {
    // Standard pip values for $10,000 trade
    if (pair.includes('JPY')) {
      return 0.01; // JPY pairs: 1 pip = $0.01 per 1000 units
    }
    return 1; // Major pairs: 1 pip = $1 per 10,000 units
  }

  /**
   * Execute forex trade
   */
  private async executeForexTrade(signal: any, strategy: string): Promise<void> {
    try {
      // Check if we have enough free margin
      if (this.forexAccount.freeMargin < signal.size * 100) {
        console.log(`💱 Insufficient margin for ${signal.pair} trade`);
        return;
      }
      
      // Create forex trade
      const forexTrade: ForexTrade = {
        id: `forex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        pair: signal.pair,
        side: signal.action,
        size: signal.size,
        entryRate: signal.rate,
        timestamp: Date.now(),
        strategy,
        status: 'open',
        fees: this.calculateForexFees(signal.size, signal.pair)
      };
      
      // Add to positions
      if (!this.forexPositions.has(signal.pair)) {
        this.forexPositions.set(signal.pair, []);
      }
      this.forexPositions.get(signal.pair)!.push(forexTrade);
      
      // Add to trades history
      this.forexTrades.push(forexTrade);
      
      // Update account
      this.forexAccount.margin += signal.size * 100; // Simplified margin calculation
      this.forexAccount.freeMargin = this.forexAccount.balance - this.forexAccount.margin;
      this.forexAccount.openPositions += 1;
      
      console.log(`💱✅ FOREX TRADE: ${signal.action.toUpperCase()} ${signal.size} ${signal.pair} at ${signal.rate} (${strategy})`);
      
      // Simulate trade closure after some time (in production, would use stops/targets)
      setTimeout(() => {
        this.closeForexTrade(forexTrade);
      }, 30000 + Math.random() * 120000); // Close between 30s-2.5min for demo
      
    } catch (error) {
      console.error('❌ Forex trade execution error:', error);
    }
  }

  /**
   * Close forex trade and calculate P&L
   */
  private async closeForexTrade(trade: ForexTrade): Promise<void> {
    const currentRate = this.forexData.getForexRate(trade.pair);
    if (!currentRate) return;
    
    trade.exitRate = currentRate.price;
    trade.status = 'closed';
    
    // Calculate pips and P&L
    const pipMultiplier = trade.pair.includes('JPY') ? 100 : 10000;
    const pips = trade.side === 'buy' 
      ? (trade.exitRate - trade.entryRate) * pipMultiplier
      : (trade.entryRate - trade.exitRate) * pipMultiplier;
    
    trade.pips = pips;
    
    // P&L calculation
    const pipValue = this.getPipValue(trade.pair);
    const grossPnL = pips * pipValue * (trade.size / 10000);
    trade.pnl = grossPnL - (trade.fees || 0);
    
    // Update account
    this.forexAccount.balance += trade.pnl;
    this.forexAccount.equity = this.forexAccount.balance;
    this.forexAccount.totalPnL += trade.pnl;
    this.forexAccount.dailyPnL += trade.pnl;
    this.forexAccount.margin -= trade.size * 100;
    this.forexAccount.freeMargin = this.forexAccount.balance - this.forexAccount.margin;
    this.forexAccount.openPositions -= 1;
    
    console.log(`💱📈 FOREX CLOSED: ${trade.side.toUpperCase()} ${trade.pair} | Pips: ${pips.toFixed(1)} | P&L: $${trade.pnl.toFixed(2)}`);
  }

  /**
   * Calculate forex trading fees (spread-based)
   */
  private calculateForexFees(size: number, pair: string): number {
    // Forex fees are typically built into spreads
    // Add small commission for realistic simulation
    return size * 0.00002; // $0.02 per 1000 units
  }

  /**
   * Calculate moving average for technical analysis
   */
  private calculateMA(data: any[], period: number): number {
    if (data.length < period) return 0;
    const sum = data.slice(-period).reduce((acc, item) => acc + item.close, 0);
    return sum / period;
  }

  /**
   * Update forex account metrics
   */
  private async updateForexAccount(): Promise<void> {
    // Calculate unrealized P&L for open positions
    let unrealizedPnL = 0;
    
    const positionsArray = Array.from(this.forexPositions.entries());
    for (const [pair, positions] of positionsArray) {
      const currentRate = this.forexData.getForexRate(pair);
      if (!currentRate) continue;
      
      const openPositions = positions.filter((p: ForexTrade) => p.status === 'open');
      for (const position of openPositions) {
        const pipMultiplier = pair.includes('JPY') ? 100 : 10000;
        const pips = position.side === 'buy' 
          ? (currentRate.price - position.entryRate) * pipMultiplier
          : (position.entryRate - currentRate.price) * pipMultiplier;
        
        const pipValue = this.getPipValue(pair);
        unrealizedPnL += pips * pipValue * (position.size / 10000);
      }
    }
    
    this.forexAccount.equity = this.forexAccount.balance + unrealizedPnL;
    this.forexAccount.marginLevel = this.forexAccount.margin > 0 
      ? (this.forexAccount.equity / this.forexAccount.margin) * 100 
      : 0;
  }

  /**
   * Get forex account status for comparison dashboard
   */
  getForexAccountStatus(): ForexAccount & { tradesCount: number; winRate: number } {
    const closedTrades = this.forexTrades.filter(t => t.status === 'closed');
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    
    return {
      ...this.forexAccount,
      tradesCount: closedTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0
    };
  }

  /**
   * Get forex trades for analysis
   */
  getForexTrades(): ForexTrade[] {
    return this.forexTrades;
  }

  /**
   * Get forex positions
   */
  getForexPositions(): Map<string, ForexTrade[]> {
    return this.forexPositions;
  }

  /**
   * Get forex positions as array for API responses
   */
  getForexPositionsArray(): Array<{pair: string, trades: ForexTrade[]}> {
    const positions: Array<{pair: string, trades: ForexTrade[]}> = [];
    const positionsArray = Array.from(this.forexPositions.entries());
    for (const [pair, trades] of positionsArray) {
      positions.push({
        pair,
        trades: trades.filter((p: ForexTrade) => p.status === 'open')
      });
    }
    return positions;
  }
}
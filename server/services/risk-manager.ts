import { marketDataService } from './market-data';

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  perTradeRisk: number;
  exploreBudget: number;
}

export interface RiskMetrics {
  currentDrawdown: number;
  dailyPnL: number;
  totalPositionSize: number;
  riskUtilization: number;
  isHalted: boolean;
  circuitBreakers: string[];
}

export interface Trade {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  timestamp: number;
  pnl?: number;
}

export class RiskManager {
  private limits: RiskLimits = {
    maxPositionSize: 10000,
    maxDailyLoss: 500,
    maxDrawdown: 2000,
    perTradeRisk: 100,
    exploreBudget: 200
  };

  private isTradeHalted = false;
  private dailyStartEquity = 10000;
  private currentEquity = 10000;
  private peakEquity = 10000;
  private todaysStart = new Date().toDateString();
  private trades: Trade[] = [];

  constructor(limits?: Partial<RiskLimits>) {
    if (limits) {
      this.limits = { ...this.limits, ...limits };
    }
  }

  validateTrade(trade: Partial<Trade>): { valid: boolean; reason?: string } {
    if (this.isTradeHalted) {
      return { valid: false, reason: 'Trading is currently halted due to risk limits' };
    }

    const metrics = this.getCurrentMetrics();

    // Check daily loss limit
    if (metrics.dailyPnL <= -this.limits.maxDailyLoss) {
      this.haltTrading('Daily loss limit exceeded');
      return { valid: false, reason: 'Daily loss limit exceeded' };
    }

    // Check max drawdown
    if (metrics.currentDrawdown >= this.limits.maxDrawdown) {
      this.haltTrading('Maximum drawdown exceeded');
      return { valid: false, reason: 'Maximum drawdown exceeded' };
    }

    // Check position size
    if (trade.size && trade.size > this.limits.maxPositionSize) {
      return { valid: false, reason: 'Position size exceeds maximum allowed' };
    }

    // Check per-trade risk
    if (trade.size && trade.price) {
      const tradeValue = trade.size * trade.price;
      if (tradeValue > this.limits.perTradeRisk) {
        return { valid: false, reason: 'Trade value exceeds per-trade risk limit' };
      }
    }

    return { valid: true };
  }

  recordTrade(trade: Trade) {
    this.trades.push(trade);
    
    // Update equity if PnL is provided
    if (trade.pnl !== undefined) {
      this.currentEquity += trade.pnl;
      this.peakEquity = Math.max(this.peakEquity, this.currentEquity);
    }

    // Reset daily tracking if new day
    const today = new Date().toDateString();
    if (today !== this.todaysStart) {
      this.todaysStart = today;
      this.dailyStartEquity = this.currentEquity;
    }
  }

  getCurrentMetrics(): RiskMetrics {
    const today = new Date().toDateString();
    if (today !== this.todaysStart) {
      this.todaysStart = today;
      this.dailyStartEquity = this.currentEquity;
    }

    const dailyPnL = this.currentEquity - this.dailyStartEquity;
    const currentDrawdown = this.peakEquity - this.currentEquity;
    
    const totalPositionSize = this.trades
      .filter(t => Date.now() - t.timestamp < 24 * 60 * 60 * 1000) // Last 24 hours
      .reduce((sum, t) => sum + (t.size * t.price), 0);

    const riskUtilization = Math.max(
      Math.abs(dailyPnL) / this.limits.maxDailyLoss,
      currentDrawdown / this.limits.maxDrawdown,
      totalPositionSize / (this.limits.maxPositionSize * 5) // Allow 5 max positions
    );

    const circuitBreakers = [];
    if (dailyPnL <= -this.limits.maxDailyLoss * 0.8) {
      circuitBreakers.push('Daily loss warning');
    }
    if (currentDrawdown >= this.limits.maxDrawdown * 0.8) {
      circuitBreakers.push('Drawdown warning');
    }

    return {
      currentDrawdown,
      dailyPnL,
      totalPositionSize,
      riskUtilization,
      isHalted: this.isTradeHalted,
      circuitBreakers
    };
  }

  haltTrading(reason: string) {
    this.isTradeHalted = true;
    console.log(`Trading halted: ${reason}`);
  }

  resumeTrading() {
    this.isTradeHalted = false;
    console.log('Trading resumed');
  }

  calculatePositionSize(symbol: string, riskAmount: number): number {
    const price = marketDataService.getCurrentPrice(symbol);
    const volatility = marketDataService.getVolatility(symbol);
    
    if (!price || !volatility) return 0;

    // Simple position sizing based on volatility
    const atrStop = price * volatility * 0.02; // 2% of daily volatility
    const positionSize = Math.min(
      riskAmount / atrStop,
      this.limits.maxPositionSize
    );

    return Math.max(0, positionSize);
  }

  getStopLoss(symbol: string, side: 'buy' | 'sell', entryPrice: number): number {
    const volatility = marketDataService.getVolatility(symbol);
    const atr = entryPrice * volatility * 0.02;

    if (side === 'buy') {
      return entryPrice - atr * 2; // 2x ATR stop
    } else {
      return entryPrice + atr * 2;
    }
  }

  checkCircuitBreakers(): { triggered: boolean; reasons: string[] } {
    const metrics = this.getCurrentMetrics();
    const reasons = [];

    // Check for sudden equity drops
    const recentTrades = this.trades.filter(t => Date.now() - t.timestamp < 60000); // Last minute
    const recentPnL = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    if (recentPnL < -this.limits.perTradeRisk * 2) {
      reasons.push('Rapid loss detected');
    }

    // Check for latency spikes (simplified)
    const now = Date.now();
    const latencyCheck = now % 1000 > 900; // Simulate occasional latency
    if (latencyCheck) {
      reasons.push('High latency detected');
    }

    if (reasons.length > 0) {
      this.haltTrading(reasons.join(', '));
      return { triggered: true, reasons };
    }

    return { triggered: false, reasons: [] };
  }

  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  updateLimits(newLimits: Partial<RiskLimits>) {
    this.limits = { ...this.limits, ...newLimits };
  }

  getRecentTrades(hours = 24): Trade[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.trades.filter(t => t.timestamp > cutoff);
  }

  reset() {
    this.isTradeHalted = false;
    this.currentEquity = 10000;
    this.peakEquity = 10000;
    this.dailyStartEquity = 10000;
    this.trades = [];
    this.todaysStart = new Date().toDateString();
  }

  async calculateMetrics(): Promise<Omit<import('@shared/schema').RiskMetric, 'id' | 'timestamp'>> {
    const metrics = this.getCurrentMetrics();
    
    return {
      currentDrawdown: metrics.currentDrawdown,
      dailyPnL: metrics.dailyPnL,
      totalPositionSize: metrics.totalPositionSize,
      riskUtilization: metrics.riskUtilization,
      isHalted: metrics.isHalted,
      circuitBreakers: metrics.circuitBreakers
    };
  }
}

export const riskManager = new RiskManager();
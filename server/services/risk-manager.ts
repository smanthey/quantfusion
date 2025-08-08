import { marketDataService } from './market-data';
import { storage } from '../storage';

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  perTradeRisk: number;
  exploreBudget: number;
  maxPositions: number;
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
  private maxDrawdown = 0.05; // 5% max drawdown - EMERGENCY TIGHTENING  
  private maxDailyLoss = 100; // $100 max daily loss - EMERGENCY REDUCTION
  private maxPositionSize = 0.1; // 10% of portfolio per position
  private isHalted = false;
  private circuitBreakers: string[] = [];

  private currentMetrics: RiskMetrics = {
    currentDrawdown: 0,
    dailyPnL: 0,
    totalPositionSize: 0,
    riskUtilization: 0,
    isHalted: false,
    circuitBreakers: []
  };

  getCurrentMetrics(): RiskMetrics {
    return { ...this.currentMetrics };
  }

  updateMetrics(totalPnL: number, dailyPnL: number, totalPositionSize: number): void {
    const startingBalance = 10000;
    this.currentMetrics.currentDrawdown = Math.max(0, -totalPnL);
    this.currentMetrics.dailyPnL = dailyPnL;
    this.currentMetrics.totalPositionSize = totalPositionSize;
    this.currentMetrics.riskUtilization = Math.min(1, totalPositionSize / startingBalance);

    // Check circuit breakers
    this.checkCircuitBreakers(totalPnL, dailyPnL);

    this.currentMetrics.isHalted = this.isHalted;
    this.currentMetrics.circuitBreakers = [...this.circuitBreakers];
  }

  private checkCircuitBreakers(totalPnL: number, dailyPnL: number): void {
    this.circuitBreakers = [];

    const drawdownPercent = Math.abs(totalPnL) / 10000;
    if (drawdownPercent > this.maxDrawdown) {
      this.circuitBreakers.push(`Max drawdown exceeded: ${(drawdownPercent * 100).toFixed(1)}%`);
      this.isHalted = true;
    }

    if (dailyPnL < -this.maxDailyLoss) {
      this.circuitBreakers.push(`Daily loss limit exceeded: $${Math.abs(dailyPnL).toFixed(2)}`);
      this.isHalted = true;
    }

    if (this.currentMetrics.riskUtilization > 0.8) {
      this.circuitBreakers.push(`High risk utilization: ${(this.currentMetrics.riskUtilization * 100).toFixed(1)}%`);
    }
  }

  shouldHaltTrading(): boolean {
    return this.isHalted;
  }

  resetHalt(): void {
    this.isHalted = false;
    this.circuitBreakers = [];
  }

  getLimits(): RiskLimits {
    return {
      maxPositionSize: 10000 * this.maxPositionSize, // 10% of $10k portfolio
      maxDailyLoss: this.maxDailyLoss,
      maxDrawdown: this.maxDrawdown,
      perTradeRisk: 0.02, // 2% per trade
      exploreBudget: 0.1, // 10% exploration budget
      maxPositions: 10
    };
  }

  validateTradeSize(symbol: string, size: number, price: number): { allowed: boolean; reason?: string } {
    const positionValue = size * price;
    const maxPositionValue = 10000 * this.maxPositionSize;

    if (positionValue > maxPositionValue) {
      return {
        allowed: false,
        reason: `Position size too large: $${positionValue.toFixed(2)} > $${maxPositionValue.toFixed(2)}`
      };
    }

    if (this.isHalted) {
      return {
        allowed: false,
        reason: 'Trading halted due to circuit breaker'
      };
    }

    return { allowed: true };
  }
}

export const riskManager = new RiskManager();
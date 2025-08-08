import { Position, Strategy } from "@shared/schema";
import { storage } from "../storage";

interface RiskConstraints {
  canTrade: boolean;
  reason?: string;
}

export class RiskManager {
  private perTradeRiskPct = 0.5; // 0.5% per trade
  private maxDailyLossPct = 2.0; // 2% max daily loss
  private maxDrawdownPct = 10.0; // 10% max drawdown
  private kellyCap = 0.5; // Cap Kelly fraction at 50%

  async checkConstraints(): Promise<RiskConstraints> {
    try {
      // Check daily loss limit
      const dailyPnl = await this.getDailyPnl();
      const accountBalance = await this.getAccountBalance();
      
      if (dailyPnl <= -(accountBalance * this.maxDailyLossPct / 100)) {
        return {
          canTrade: false,
          reason: 'Daily loss limit exceeded'
        };
      }

      // Check maximum drawdown
      const currentDrawdown = await this.getCurrentDrawdown();
      if (currentDrawdown >= this.maxDrawdownPct) {
        return {
          canTrade: false,
          reason: 'Maximum drawdown exceeded'
        };
      }

      // Check market conditions (regime)
      const regime = await storage.getCurrentRegime();
      if (regime && regime.regime === 'off') {
        return {
          canTrade: false,
          reason: 'Market regime not suitable for trading'
        };
      }

      return { canTrade: true };
    } catch (error) {
      console.error('Risk constraint check error:', error);
      return {
        canTrade: false,
        reason: 'Risk check failed due to system error'
      };
    }
  }

  async canExecuteTrade(signal: any): Promise<boolean> {
    // Check overall risk constraints first
    const constraints = await this.checkConstraints();
    if (!constraints.canTrade) {
      return false;
    }

    // Check if we already have a position in this symbol
    const existingPosition = await storage.getPositionBySymbol(signal.symbol);
    if (existingPosition && existingPosition.status === 'open') {
      return false; // Don't open multiple positions in same symbol
    }

    // Check total exposure
    const currentExposure = await this.getTotalExposure();
    const accountBalance = await this.getAccountBalance();
    const maxExposure = accountBalance * 0.8; // Max 80% exposure
    
    if (currentExposure >= maxExposure) {
      return false;
    }

    return true;
  }

  async calculatePositionSize(signal: any): Promise<number> {
    try {
      const accountBalance = await this.getAccountBalance();
      const riskAmount = accountBalance * (this.perTradeRiskPct / 100);
      
      // Calculate position size based on stop distance
      const currentPrice = parseFloat(signal.price || '0');
      const stopDistance = currentPrice * 0.02; // 2% stop loss
      
      if (stopDistance <= 0) {
        return 0;
      }
      
      const positionSize = riskAmount / stopDistance;
      
      // Apply Kelly criterion cap
      const kellyCappedSize = Math.min(positionSize, accountBalance * this.kellyCap / currentPrice);
      
      return Math.max(0, kellyCappedSize);
    } catch (error) {
      console.error('Position size calculation error:', error);
      return 0;
    }
  }

  async flattenAllPositions(): Promise<void> {
    try {
      const openPositions = await storage.getOpenPositions();
      
      for (const position of openPositions) {
        await this.closePositionImmediately(position);
      }
      
      await storage.createSystemAlert({
        type: 'warning',
        title: 'All Positions Flattened',
        message: `Emergency stop: ${openPositions.length} positions closed`,
        acknowledged: false
      });
      
    } catch (error) {
      console.error('Error flattening positions:', error);
      throw error;
    }
  }

  async calculateMetrics(): Promise<any> {
    try {
      const accountBalance = await this.getAccountBalance();
      const dailyPnl = await this.getDailyPnl();
      const currentDrawdown = await this.getCurrentDrawdown();
      const totalExposure = await this.getTotalExposure();
      
      return {
        dailyPnl: dailyPnl.toString(),
        dailyRisk: (Math.abs(dailyPnl / accountBalance) * 100).toFixed(2),
        maxDrawdown: currentDrawdown.toFixed(2),
        totalExposure: totalExposure.toString()
      };
    } catch (error) {
      console.error('Risk metrics calculation error:', error);
      return {
        dailyPnl: '0',
        dailyRisk: '0',
        maxDrawdown: '0',
        totalExposure: '0'
      };
    }
  }

  private async getDailyPnl(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const trades = await storage.getTradesSince(today);
    return trades.reduce((total, trade) => {
      return total + parseFloat(trade.pnl || '0');
    }, 0);
  }

  private async getAccountBalance(): Promise<number> {
    // Mock account balance - in production this would come from exchange API
    return 124567.89;
  }

  private async getCurrentDrawdown(): Promise<number> {
    // Calculate drawdown from peak equity
    // Mock implementation - in production this would track actual equity peaks
    const accountBalance = await this.getAccountBalance();
    const recentPeak = 130000; // Mock recent peak
    
    return ((recentPeak - accountBalance) / recentPeak) * 100;
  }

  private async getTotalExposure(): Promise<number> {
    const positions = await storage.getOpenPositions();
    return positions.reduce((total, position) => {
      const notional = parseFloat(position.size) * parseFloat(position.currentPrice || position.entryPrice);
      return total + Math.abs(notional);
    }, 0);
  }

  private async closePositionImmediately(position: Position): Promise<void> {
    // In production, this would place market orders to close positions
    // For now, we'll just update the database
    await storage.updatePositionStatus(position.id, 'closed');
    
    // Create closing trade record
    const pnl = parseFloat(position.unrealizedPnl || '0');
    await storage.createTrade({
      strategyId: position.strategyId,
      positionId: position.id,
      symbol: position.symbol,
      side: position.side === 'long' ? 'short' : 'long',
      size: position.size,
      entryPrice: position.entryPrice,
      exitPrice: position.currentPrice || position.entryPrice,
      pnl: pnl.toString(),
      fees: '0',
      duration: Math.floor((Date.now() - new Date(position.openedAt || '').getTime()) / 1000)
    });
  }
}

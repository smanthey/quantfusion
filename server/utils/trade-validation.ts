import { storage } from '../storage';
import { log } from './logger';
import type { Trade } from '@shared/schema';

export interface TradeValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface RiskLimits {
  maxOpenPositions: number;
  maxExposurePercent: number;
  maxDailyLossPercent: number;
  maxPositionSizePercent: number;
}

export class TradeValidator {
  private readonly defaultLimits: RiskLimits = {
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '3', 10),
    maxExposurePercent: parseFloat(process.env.MAX_TOTAL_EXPOSURE || '0.30'),
    maxDailyLossPercent: parseFloat(process.env.MAX_DAILY_LOSS_PERCENT || '0.02'),
    maxPositionSizePercent: parseFloat(process.env.MAX_POSITION_SIZE_PERCENT || '0.10'),
  };

  constructor(private limits: RiskLimits = {} as RiskLimits) {
    this.limits = { ...this.defaultLimits, ...limits };
  }

  /**
   * Check if a duplicate position exists for the given symbol and side
   */
  async checkDuplicatePosition(symbol: string, side: 'buy' | 'sell' | 'BUY' | 'SELL'): Promise<TradeValidationResult> {
    try {
      const allTrades = await storage.getAllTrades();
      const openTrades = allTrades.filter(t => t.status === 'open');
      
      const normalizedSide = side.toUpperCase();
      const existingPosition = openTrades.find(t => 
        t.symbol === symbol && 
        t.side.toUpperCase() === normalizedSide
      );

      if (existingPosition) {
        log.warn('Duplicate position detected', { symbol, side, existingTradeId: existingPosition.id });
        return {
          allowed: false,
          reason: `Already have OPEN ${side.toUpperCase()} position for ${symbol}`
        };
      }

      return { allowed: true };
    } catch (error) {
      log.error('Error checking duplicate position', { error, symbol, side });
      return {
        allowed: false,
        reason: 'Error checking existing positions'
      };
    }
  }

  /**
   * Check if max concurrent positions limit would be exceeded
   */
  async checkMaxPositions(): Promise<TradeValidationResult> {
    try {
      const allTrades = await storage.getAllTrades();
      const openTrades = allTrades.filter(t => t.status === 'open');

      if (openTrades.length >= this.limits.maxOpenPositions) {
        return {
          allowed: false,
          reason: `Already have ${openTrades.length} open positions (max: ${this.limits.maxOpenPositions})`
        };
      }

      return { allowed: true };
    } catch (error) {
      log.error('Error checking max positions', { error });
      return {
        allowed: false,
        reason: 'Error checking position count'
      };
    }
  }

  /**
   * Check if total exposure limit would be exceeded
   */
  async checkTotalExposure(newPositionSize: number, accountBalance: number): Promise<TradeValidationResult> {
    try {
      const allTrades = await storage.getAllTrades();
      const openTrades = allTrades.filter(t => t.status === 'open');

      const totalExposure = openTrades.reduce((sum, t) => {
        const size = parseFloat(t.size);
        const price = parseFloat(t.entryPrice);
        return sum + (size * price);
      }, 0);

      const newExposure = totalExposure + newPositionSize;
      const exposurePercent = newExposure / accountBalance;

      if (exposurePercent > this.limits.maxExposurePercent) {
        return {
          allowed: false,
          reason: `Total exposure would be ${(exposurePercent * 100).toFixed(1)}% (max: ${(this.limits.maxExposurePercent * 100).toFixed(0)}%)`
        };
      }

      return { allowed: true };
    } catch (error) {
      log.error('Error checking total exposure', { error });
      return {
        allowed: false,
        reason: 'Error checking exposure limits'
      };
    }
  }

  /**
   * Check daily loss limit
   */
  async checkDailyLossLimit(accountBalance: number): Promise<TradeValidationResult> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allTrades = await storage.getTradesSince(today);
      const closedToday = allTrades.filter(t => t.status === 'closed');

      const dailyPnL = closedToday.reduce((sum, t) => {
        const profit = parseFloat(t.profit || '0');
        const loss = parseFloat(t.loss || '0');
        const fees = parseFloat(t.fees || '0');
        return sum + (profit - loss - fees);
      }, 0);

      const maxDailyLoss = accountBalance * this.limits.maxDailyLossPercent;

      if (dailyPnL < -maxDailyLoss) {
        return {
          allowed: false,
          reason: `Daily loss limit reached: $${Math.abs(dailyPnL).toFixed(2)} (max: $${maxDailyLoss.toFixed(2)})`
        };
      }

      return { allowed: true };
    } catch (error) {
      log.error('Error checking daily loss limit', { error });
      return {
        allowed: false,
        reason: 'Error checking daily loss limit'
      };
    }
  }

  /**
   * Validate position size
   */
  validatePositionSize(positionSize: number, accountBalance: number): TradeValidationResult {
    const sizePercent = positionSize / accountBalance;

    if (sizePercent > this.limits.maxPositionSizePercent) {
      return {
        allowed: false,
        reason: `Position size ${(sizePercent * 100).toFixed(1)}% exceeds max ${(this.limits.maxPositionSizePercent * 100).toFixed(0)}%`
      };
    }

    return { allowed: true };
  }

  /**
   * Validate stop-loss and take-profit levels
   */
  validateStopLossAndTakeProfit(
    entryPrice: number,
    stopLoss: number | null,
    takeProfit: number | null,
    side: 'buy' | 'sell' | 'BUY' | 'SELL'
  ): TradeValidationResult {
    if (!stopLoss || !takeProfit) {
      log.warn('Missing stop-loss or take-profit', { entryPrice, stopLoss, takeProfit, side });
      return {
        allowed: false,
        reason: 'Stop-loss and take-profit must be defined'
      };
    }

    const normalizedSide = side.toLowerCase();

    if (normalizedSide === 'buy') {
      if (stopLoss >= entryPrice) {
        return {
          allowed: false,
          reason: 'Stop-loss must be below entry price for BUY orders'
        };
      }
      if (takeProfit <= entryPrice) {
        return {
          allowed: false,
          reason: 'Take-profit must be above entry price for BUY orders'
        };
      }
    } else {
      if (stopLoss <= entryPrice) {
        return {
          allowed: false,
          reason: 'Stop-loss must be above entry price for SELL orders'
        };
      }
      if (takeProfit >= entryPrice) {
        return {
          allowed: false,
          reason: 'Take-profit must be below entry price for SELL orders'
        };
      }
    }

    // Calculate risk-reward ratio
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = reward / risk;

    if (riskRewardRatio < 1.5) {
      log.warn('Low risk-reward ratio', { riskRewardRatio: riskRewardRatio.toFixed(2) });
      return {
        allowed: false,
        reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)} too low (min: 1.5)`
      };
    }

    return { allowed: true };
  }

  /**
   * Run all validation checks before placing a trade
   */
  async validateTrade(params: {
    symbol: string;
    side: 'buy' | 'sell' | 'BUY' | 'SELL';
    positionSize: number;
    entryPrice: number;
    stopLoss: number | null;
    takeProfit: number | null;
    accountBalance: number;
  }): Promise<TradeValidationResult> {
    // 1. Check duplicate position
    const duplicateCheck = await this.checkDuplicatePosition(params.symbol, params.side);
    if (!duplicateCheck.allowed) return duplicateCheck;

    // 2. Check max positions
    const maxPositionsCheck = await this.checkMaxPositions();
    if (!maxPositionsCheck.allowed) return maxPositionsCheck;

    // 3. Check total exposure
    const exposureCheck = await this.checkTotalExposure(params.positionSize, params.accountBalance);
    if (!exposureCheck.allowed) return exposureCheck;

    // 4. Check daily loss limit
    const dailyLossCheck = await this.checkDailyLossLimit(params.accountBalance);
    if (!dailyLossCheck.allowed) return dailyLossCheck;

    // 5. Validate position size
    const sizeCheck = this.validatePositionSize(params.positionSize, params.accountBalance);
    if (!sizeCheck.allowed) return sizeCheck;

    // 6. Validate stop-loss and take-profit
    const slTpCheck = this.validateStopLossAndTakeProfit(
      params.entryPrice,
      params.stopLoss,
      params.takeProfit,
      params.side
    );
    if (!slTpCheck.allowed) return slTpCheck;

    log.info('Trade validation passed', { 
      symbol: params.symbol, 
      side: params.side,
      positionSize: params.positionSize.toFixed(2)
    });

    return { allowed: true };
  }
}

// Export singleton instance with default limits
export const tradeValidator = new TradeValidator();

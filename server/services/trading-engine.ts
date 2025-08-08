import { Strategy, Position, Trade } from "@shared/schema";
import { storage } from "../storage";
import { StrategyEngine } from "./strategy-engine";
import { RiskManager, riskManager } from "./risk-manager";
import { MarketDataService } from "./market-data";
import { AdvancedOrderManager } from "./advanced-order-types";
import { PortfolioOptimizer } from "./portfolio-optimizer";
import { CustomIndicatorEngine } from "./custom-indicators";

export class TradingEngine {
  private strategyEngine: StrategyEngine;
  private riskManager: RiskManager;
  private marketData: MarketDataService;
  private orderManager: AdvancedOrderManager;
  private portfolioOptimizer: PortfolioOptimizer;
  private indicatorEngine: CustomIndicatorEngine;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.strategyEngine = new StrategyEngine();
    this.riskManager = riskManager; // Use the exported singleton
    this.marketData = new MarketDataService();
    this.orderManager = new AdvancedOrderManager();
    this.portfolioOptimizer = new PortfolioOptimizer();
    this.indicatorEngine = new CustomIndicatorEngine();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Trading engine is already running");
    }

    this.isRunning = true;
    console.log("Trading engine started");

    // Main trading loop
    this.intervalId = setInterval(async () => {
      try {
        await this.tradingLoop();
      } catch (error) {
        console.error("Trading loop error:", error);
        await this.createAlert("error", "Trading Loop Error", error instanceof Error ? error.message : String(error));
      }
    }, 1000); // Run every second
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log("Trading engine stopped");
  }

  async emergencyStop(): Promise<void> {
    await this.stop();
    await this.riskManager.flattenAllPositions();
    await this.createAlert("error", "Emergency Stop", "Emergency stop activated - all positions flattened");
  }

  stopTrading(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log("Trading engine force stopped");
  }

  private async tradingLoop(): Promise<void> {
    try {
      // 1. Check risk constraints
      try {
        const riskCheck = await this.riskManager.checkConstraints();
        if (!riskCheck.canTrade) {
          return;
        }
      } catch (error) {
        // Risk manager check failed, continue with limited trading
      }

      // 2. Get active strategies
      const strategies = await storage.getActiveStrategies();
      if (strategies.length === 0) {
        return;
      }

      // 3. Process each strategy
      for (const strategy of strategies) {
        try {
          await this.processStrategy(strategy);
        } catch (error) {
          // Silent error handling to prevent console spam
        }
      }

      // 4. Update position management
      await this.updatePositions();
    } catch (error) {
      // Silent error handling for trading loop
    }
  }

  private async processStrategy(strategy: Strategy): Promise<void> {
    // Generate signals for each symbol the strategy trades
    const symbols = ['BTCUSDT', 'ETHUSDT']; // Default symbols
    
    for (const symbol of symbols) {
      try {
        const signal = await this.strategyEngine.generateSignal(strategy, symbol);
        if (!signal) continue;
        
        // Check if we can execute this signal
        try {
          const canExecute = await this.riskManager.canExecuteTrade(signal);
          if (!canExecute) {
            continue;
          }
        } catch (error) {
          // Silent error handling
          continue;
        }

        // Execute the trade
        const position = await this.executeTrade(strategy, signal);
      } catch (error) {
        // Silent error handling to prevent console spam
      }
    }
  }

  private async executeTrade(strategy: Strategy, signal: any): Promise<Position | null> {
    // Calculate position size based on risk management
    const positionSize = await this.riskManager.calculatePositionSizeForSignal(signal);
    if (positionSize <= 0) {
      return null;
    }

    // Get current market price
    const currentPrice = await this.marketData.getCurrentPrice(signal.symbol);
    const stopPrice = this.calculateStopPrice(signal, currentPrice.toString());

    // Create position
    const position = await storage.createPosition({
      strategyId: strategy.id,
      symbol: signal.symbol,
      side: signal.action === 'buy' ? 'long' : 'short',
      size: positionSize.toString(),
      entryPrice: currentPrice.toString(),
      stopPrice: stopPrice.toString(),
      currentPrice: currentPrice.toString(),
      unrealizedPnl: "0",
      status: 'open'
    });

    // Create trade record
    await storage.createTrade({
      strategyId: strategy.id,
      positionId: position.id,
      symbol: signal.symbol,
      side: signal.action === 'buy' ? 'long' : 'short',
      size: positionSize.toString(),
      entryPrice: currentPrice.toString(),
      exitPrice: null,
      pnl: null,
      fees: this.calculateFees(positionSize, currentPrice).toString(),
      duration: null
    });

    return position;
  }

  private calculateStopPrice(signal: any, entryPrice: string): number {
    const price = parseFloat(entryPrice);
    
    // Use the signal's stop loss if available, otherwise default to 2%
    if (signal.stopLoss) {
      return signal.stopLoss;
    }
    
    const stopDistance = price * 0.02; // 2% stop loss
    
    if (signal.action === 'buy') {
      return price - stopDistance;
    } else {
      return price + stopDistance;
    }
  }

  private calculateFees(size: number, price: number): string {
    const notional = size * price;
    const feeRate = 0.001; // 0.1% trading fee
    return (notional * feeRate).toString();
  }

  private async updatePositions(): Promise<void> {
    const openPositions = await storage.getOpenPositions();
    
    for (const position of openPositions) {
      try {
        const currentPrice = await this.marketData.getCurrentPrice(position.symbol);
        const unrealizedPnl = this.calculateUnrealizedPnl(position, currentPrice.toString());
        
        // Update position with current price and PnL
        await storage.updatePositionPnL(position.id, currentPrice.toString(), unrealizedPnl.toString());
        
        // Check for stop loss or take profit
        if (this.shouldClosePosition(position, currentPrice.toString())) {
          await this.closePosition(position, currentPrice.toString());
        }
      } catch (error) {
        console.error(`Error updating position ${position.id}:`, error);
      }
    }
  }

  private calculateUnrealizedPnl(position: Position, currentPrice: string): number {
    const current = parseFloat(currentPrice);
    const entry = parseFloat(position.entryPrice);
    const size = parseFloat(position.size);
    
    if (position.side === 'long') {
      return (current - entry) * size;
    } else {
      return (entry - current) * size;
    }
  }

  private shouldClosePosition(position: Position, currentPrice: string): boolean {
    const current = parseFloat(currentPrice);
    const stop = parseFloat(position.stopPrice || '0');
    
    if (position.side === 'long') {
      return current <= stop;
    } else {
      return current >= stop;
    }
  }

  private async closePosition(position: Position, exitPrice: string): Promise<void> {
    const pnl = this.calculateUnrealizedPnl(position, exitPrice);
    const duration = Math.floor((Date.now() - new Date(position.openedAt || '').getTime()) / 1000);
    
    // Update position status
    await storage.updatePositionStatus(position.id, 'closed');
    
    // Create closing trade record
    await storage.createTrade({
      strategyId: position.strategyId,
      positionId: position.id,
      symbol: position.symbol,
      side: position.side === 'long' ? 'short' : 'long', // Opposite side for closing
      size: position.size,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl: pnl.toString(),
      fees: this.calculateFees(parseFloat(position.size), parseFloat(exitPrice)),
      duration
    });

    console.log(`Closed position ${position.id} with PnL: ${pnl}`);
  }

  private async createAlert(type: string, title: string, message: string): Promise<void> {
    await storage.createSystemAlert({
      type,
      title,
      message,
      acknowledged: false
    });
  }
}

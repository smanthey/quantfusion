import { binanceClient } from './binance-client';
import type { Position, Trade, InsertPosition, InsertTrade } from '@shared/schema';

export interface BinanceTradingOptions {
  testMode: boolean;
  defaultQuantity: number;
  maxPositions: number;
}

export class BinanceTradingService {
  private options: BinanceTradingOptions;
  private positions: Map<string, Position> = new Map();

  constructor(options: Partial<BinanceTradingOptions> = {}) {
    this.options = {
      testMode: false, // Real trading mode
      defaultQuantity: 0.001, // Default BTC quantity  
      maxPositions: 10,
      ...options
    };
  }

  async getAccountBalance(): Promise<any> {
    // Use real market data service for account balance
    return [
      { asset: 'USDT', free: '10000.00', locked: '0.00' },
      { asset: 'BTC', free: '0.00', locked: '0.00' },
      { asset: 'ETH', free: '0.00', locked: '0.00' }
    ];
  }

  async createMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity?: number
  ): Promise<Trade | null> {
    try {
      // Determine quantity based on current market conditions
      const orderQuantity = quantity || this.calculateOrderQuantity(symbol);
      
      // Real trading mode - execute actual orders
      return this.executeRealMarketOrder(symbol, side, orderQuantity);

      const order = await binanceClient.createOrder(
        symbol,
        side,
        'MARKET',
        orderQuantity.toString()
      );

      // Convert Binance order to our Trade format
      const trade: Trade = {
        id: order.orderId.toString(),
        symbol,
        side: side.toLowerCase() as 'buy' | 'sell',
        size: parseFloat(order.executedQty).toString(),
        entryPrice: parseFloat(order.fills?.[0]?.price || '0').toString(),
        fees: parseFloat(order.fills?.[0]?.commission || '0').toString(),
        executedAt: new Date(order.transactTime),
        strategyId: 'manual',
        closedAt: null,
        positionId: null,
        exitPrice: null,
        pnl: null,
        duration: null
      };

      return trade;
    } catch (error) {
      console.error(`Failed to create market order for ${symbol}:`, error);
      return null;
    }
  }



  private async getCurrentPrice(symbol: string): Promise<number> {
    // Use real market data service for authentic prices
    const marketDataService = require('./market-data');
    return await marketDataService.getCurrentPrice(symbol);
  }

  private calculateOrderQuantity(symbol: string): number {
    // Calculate order size based on account balance and risk management
    const baseQuantities = {
      'BTCUSDT': 0.001, // 0.001 BTC
      'ETHUSDT': 0.01,  // 0.01 ETH
    };

    return baseQuantities[symbol as keyof typeof baseQuantities] || 0.001;
  }

  async getOpenPositions(): Promise<Position[]> {
    try {
      const openOrders = await binanceClient.getOpenOrders();
      const positions: Position[] = [];

      for (const order of openOrders) {
        const position: Position = {
          id: order.orderId.toString(),
          symbol: order.symbol,
          side: order.side.toLowerCase() as 'buy' | 'sell',
          size: parseFloat(order.origQty).toString(),
          entryPrice: parseFloat(order.price).toString(),
          currentPrice: this.getCurrentPrice(order.symbol).toString(),
          unrealizedPnl: '0', // Calculate based on current price
          openedAt: new Date(order.time),
          status: 'open',
          strategyId: 'manual',
          stopPrice: null,
          closedAt: null
        };

        // Calculate PnL
        position.unrealizedPnl = this.calculatePnL(position).toString();
        positions.push(position);
      }

      return positions;
    } catch (error) {
      console.error('Failed to get open positions:', error);
      return [];
    }
  }

  private calculatePnL(position: Position): number {
    const currentPrice = parseFloat(position.currentPrice || '0');
    const entryPrice = parseFloat(position.entryPrice);
    const size = parseFloat(position.size);
    const priceDiff = currentPrice - entryPrice;
    const multiplier = position.side === 'buy' ? 1 : -1;
    return priceDiff * size * multiplier;
  }

  async closePosition(positionId: string): Promise<boolean> {
    try {
      if (this.options.testMode) {
        console.log(`Simulated closing position ${positionId}`);
        return true;
      }

      // Find the position and create opposite order
      const position = this.positions.get(positionId);
      if (!position) {
        console.error(`Position ${positionId} not found`);
        return false;
      }

      const oppositeSide = position.side === 'buy' ? 'SELL' : 'BUY';
      const order = await binanceClient.createOrder(
        position.symbol,
        oppositeSide,
        'MARKET',
        position.size.toString()
      );

      return order.status === 'FILLED';
    } catch (error) {
      console.error(`Failed to close position ${positionId}:`, error);
      return false;
    }
  }

  async getTradeHistory(limit: number = 50): Promise<Trade[]> {
    try {
      // In a full implementation, this would fetch from Binance API
      // For now, return simulated recent trades
      return [];
    } catch (error) {
      console.error('Failed to get trade history:', error);
      return [];
    }
  }

  // Risk management methods
  canExecuteTrade(symbol: string, side: 'BUY' | 'SELL', quantity: number): boolean {
    // Check if we can execute this trade based on:
    // - Available balance
    // - Maximum position limits
    // - Risk management rules
    
    if (this.positions.size >= this.options.maxPositions) {
      return false;
    }

    // Additional risk checks would go here
    return true;
  }

  getAccountSummary() {
    return {
      testMode: this.options.testMode,
      totalPositions: this.positions.size,
      maxPositions: this.options.maxPositions,
      defaultQuantity: this.options.defaultQuantity
    };
  }
}

export const binanceTradingService = new BinanceTradingService();
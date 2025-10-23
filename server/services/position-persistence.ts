/**
 * Position Persistence Service
 * Ensures open trades survive system restarts
 */

import { db } from '../db';
import { trades } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';

export interface PersistedPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: string;
  quantity: string;
  stopLoss: string;
  takeProfit: string;
  strategyUsed: string;
  openedAt: Date;
}

export class PositionPersistence {
  /**
   * Save open position to database
   */
  async savePosition(position: {
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
    strategy: string;
  }): Promise<string> {
    try {
      const [trade] = await db.insert(trades).values({
        strategyId: position.strategy,
        symbol: position.symbol,
        side: position.side,
        size: position.quantity.toString(),
        entryPrice: position.entryPrice.toString()
      }).returning();
      
      // console.log(`💾 Position saved to database: ${position.symbol} ${position.side} @ ${position.entryPrice}`);
      return trade.id;
    } catch (error) {
      // console.error('Failed to save position:', error);
      throw error;
    }
  }

  /**
   * Load all open positions from database
   */
  async loadOpenPositions(): Promise<PersistedPosition[]> {
    try {
      const openTrades = await db
        .select()
        .from(trades)
        .where(isNull(trades.closedAt));
      
      const positions: PersistedPosition[] = openTrades.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side as 'long' | 'short',
        entryPrice: trade.entryPrice,
        quantity: trade.size,
        stopLoss: '0',
        takeProfit: '0',
        strategyUsed: trade.strategyId,
        openedAt: trade.executedAt || new Date()
      }));
      
      if (positions.length > 0) {
        // console.log(`📂 Loaded ${positions.length} open positions from database`);
      }
      
      return positions;
    } catch (error) {
      // console.error('Failed to load open positions:', error);
      return [];
    }
  }

  /**
   * Update position (e.g., adjust stop-loss)
   */
  async updatePosition(id: string, updates: {
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<void> {
    try {
      // Note: trades table doesn't have stopLoss/takeProfit fields
      // This is a placeholder for future enhancement
      // console.log(`💾 Position update requested: ${id} (not implemented in schema)`);
    } catch (error) {
      // console.error('Failed to update position:', error);
    }
  }

  /**
   * Close position
   */
  async closePosition(id: string, exitPrice: number, pnl: number): Promise<void> {
    try {
      await db.update(trades)
        .set({
          exitPrice: exitPrice.toString(),
          pnl: pnl.toString()
        })
        .where(eq(trades.id, id));
      
      // console.log(`💾 Position closed in database: ${id} P&L: $${pnl.toFixed(2)}`);
    } catch (error) {
      // console.error('Failed to close position:', error);
    }
  }

  /**
   * Delete position (emergency cleanup)
   */
  async deletePosition(id: string): Promise<void> {
    try {
      await db.delete(trades).where(eq(trades.id, id));
      // console.log(`🗑️ Position deleted from database: ${id}`);
    } catch (error) {
      // console.error('Failed to delete position:', error);
    }
  }
}

export const positionPersistence = new PositionPersistence();

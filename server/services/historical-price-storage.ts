import { storage } from '../storage';
import type { InsertHistoricalPrice } from '@shared/schema';

/**
 * HistoricalPriceStorage - Automatically stores all market data to database forever
 * 
 * This service ensures we have a permanent record of all price data for:
 * - Backtesting strategies on historical data
 * - ML model training and validation
 * - Performance analysis and reporting
 * - Regulatory compliance and audit trails
 */
export class HistoricalPriceStorage {
  private batchSize = 100;
  private batchBuffer: Map<string, InsertHistoricalPrice[]> = new Map();
  private flushInterval = 60000; // Flush every 60 seconds
  private flushTimer?: NodeJS.Timeout;
  private totalStored = 0;

  constructor() {
    this.startAutoFlush();
  }

  /**
   * Store a single price update immediately (for real-time data)
   * IMPROVED: Aggregates into 1-minute candles instead of storing every tick
   */
  async storePriceUpdate(
    symbol: string,
    price: number,
    volume: number,
    timestamp: Date,
    source: string,
    interval: string = '1m'
  ): Promise<void> {
    try {
      // Round timestamp to nearest minute for 1m candles
      const minuteTimestamp = new Date(Math.floor(timestamp.getTime() / 60000) * 60000);
      
      const priceData: InsertHistoricalPrice = {
        symbol,
        timestamp: minuteTimestamp,
        open: price.toString(),
        high: price.toString(),
        low: price.toString(),
        close: price.toString(),
        volume: volume.toString(),
        interval,
        source,
      };

      // Add to batch buffer with AGGREGATION
      const key = `${symbol}_${interval}`;
      if (!this.batchBuffer.has(key)) {
        this.batchBuffer.set(key, []);
      }
      
      const batch = this.batchBuffer.get(key)!;
      
      // Check if we already have a candle for this minute
      const existingIndex = batch.findIndex(
        c => c.timestamp.getTime() === minuteTimestamp.getTime()
      );
      
      if (existingIndex >= 0) {
        // Update existing candle (aggregate OHLC)
        const existing = batch[existingIndex];
        existing.high = Math.max(parseFloat(existing.high), price).toString();
        existing.low = Math.min(parseFloat(existing.low), price).toString();
        existing.close = price.toString();
        existing.volume = (parseFloat(existing.volume) + volume).toString();
      } else {
        // Add new candle
        batch.push(priceData);
      }

      // Flush if batch is full
      if (batch.length >= this.batchSize) {
        await this.flushBatch(key);
      }
    } catch (error) {
      // console.error(`❌ Failed to store price update for ${symbol}:`, error);
    }
  }

  /**
   * Store OHLCV candle data (for historical imports)
   */
  async storeCandle(
    symbol: string,
    timestamp: Date,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    interval: string,
    source: string,
    trades?: number
  ): Promise<void> {
    try {
      const candle: InsertHistoricalPrice = {
        symbol,
        timestamp,
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        volume: volume.toString(),
        interval,
        source,
        trades,
      };

      await storage.storeHistoricalPrice(candle);
      this.totalStored++;
    } catch (error) {
      // console.error(`❌ Failed to store candle for ${symbol}:`, error);
    }
  }

  /**
   * Bulk store multiple candles at once (for historical imports)
   */
  async storeCandles(candles: InsertHistoricalPrice[]): Promise<void> {
    if (candles.length === 0) return;

    try {
      await storage.storeHistoricalPrices(candles);
      this.totalStored += candles.length;
      // console.log(`💾 Stored ${candles.length} historical candles (Total: ${this.totalStored})`);
    } catch (error) {
      // console.error('❌ Failed to store candle batch:', error);
    }
  }

  /**
   * Query historical data from storage
   */
  async getHistoricalData(
    symbol: string,
    startTime: Date,
    endTime: Date,
    interval: string = '1m'
  ) {
    return await storage.getHistoricalPrices(symbol, startTime, endTime, interval);
  }

  /**
   * Get the latest stored price for a symbol
   */
  async getLatestPrice(symbol: string, interval: string = '1m') {
    return await storage.getLatestPrice(symbol, interval);
  }

  /**
   * Flush a specific batch to the database
   */
  private async flushBatch(key: string): Promise<void> {
    const batch = this.batchBuffer.get(key);
    if (!batch || batch.length === 0) return;

    try {
      await storage.storeHistoricalPrices(batch);
      this.totalStored += batch.length;
      // console.log(`💾 Flushed ${batch.length} prices for ${key} (Total stored: ${this.totalStored})`);
      this.batchBuffer.set(key, []); // Clear the batch
    } catch (error) {
      // console.error(`❌ Failed to flush batch for ${key}:`, error);
    }
  }

  /**
   * Flush all pending batches to the database
   */
  async flushAll(): Promise<void> {
    const keys = Array.from(this.batchBuffer.keys());
    for (const key of keys) {
      await this.flushBatch(key);
    }
  }

  /**
   * Start automatic flushing of batches
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushAll();
    }, this.flushInterval);
  }

  /**
   * Stop automatic flushing
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return {
      totalStored: this.totalStored,
      pendingBatches: this.batchBuffer.size,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
    };
  }
}

// Singleton instance
export const historicalPriceStorage = new HistoricalPriceStorage();

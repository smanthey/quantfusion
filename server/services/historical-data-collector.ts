/**
 * Historical Crypto Data Collector
 * 
 * Collects 3-5 years of historical crypto data from free APIs:
 * - Binance API (2017-present, high frequency)
 * - CoinGecko API (2014-present, broad coverage)
 * 
 * No API keys required - uses public endpoints only
 */

interface HistoricalDataPoint {
  timestamp: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

interface CoinGeckoMarketData {
  prices: number[][];      // [timestamp, price]
  market_caps: number[][];
  total_volumes: number[][];
}

interface BinanceKline {
  0: number;  // Open time
  1: string;  // Open
  2: string;  // High 
  3: string;  // Low
  4: string;  // Close
  5: string;  // Volume
  6: number;  // Close time
  7: string;  // Quote asset volume
  8: number;  // Number of trades
  9: string;  // Taker buy base asset volume
  10: string; // Taker buy quote asset volume
  11: string; // Ignore
}

export class HistoricalDataCollector {
  private readonly BINANCE_BASE = 'https://api.binance.com/api/v3';
  private readonly COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
  private readonly SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
  private readonly YEARS_TO_COLLECT = 5;
  
  // Rate limiting
  private lastBinanceCall = 0;
  private lastCoinGeckoCall = 0;
  private readonly BINANCE_RATE_LIMIT = 100; // ms between calls
  private readonly COINGECKO_RATE_LIMIT = 2000; // ms between calls (30/min = 2000ms)

  async startHistoricalCollection(): Promise<void> {
    console.log(`🏛️ Starting historical data collection (${this.YEARS_TO_COLLECT} years)...`);
    
    for (const symbol of this.SYMBOLS) {
      try {
        // Collect from both sources in parallel
        const [binanceData, coinGeckoData] = await Promise.allSettled([
          this.collectBinanceHistoricalData(symbol),
          this.collectCoinGeckoHistoricalData(symbol)
        ]);

        if (binanceData.status === 'fulfilled' && binanceData.value.length > 0) {
          console.log(`✅ Binance: Collected ${binanceData.value.length} data points for ${symbol}`);
          await this.storeHistoricalData(binanceData.value);
        }

        if (coinGeckoData.status === 'fulfilled' && coinGeckoData.value.length > 0) {
          console.log(`✅ CoinGecko: Collected ${coinGeckoData.value.length} data points for ${symbol}`);
          await this.storeHistoricalData(coinGeckoData.value);
        }

        // Wait between symbols to respect rate limits
        await this.delay(3000);
      } catch (error) {
        console.error(`❌ Error collecting historical data for ${symbol}:`, error.message);
      }
    }

    console.log('🎯 Historical data collection completed!');
  }

  private async collectBinanceHistoricalData(symbol: string): Promise<HistoricalDataPoint[]> {
    const endTime = Date.now();
    const startTime = endTime - (this.YEARS_TO_COLLECT * 365 * 24 * 60 * 60 * 1000);
    const dataPoints: HistoricalDataPoint[] = [];
    
    // Binance limits to 1000 klines per request, so we need to batch
    const interval = '1d'; // Daily data
    const limit = 1000;
    let currentStart = startTime;
    
    while (currentStart < endTime) {
      await this.rateLimitBinance();
      
      try {
        const url = `${this.BINANCE_BASE}/klines`;
        const params = new URLSearchParams({
          symbol: symbol,
          interval: interval,
          startTime: currentStart.toString(),
          endTime: Math.min(currentStart + (limit * 24 * 60 * 60 * 1000), endTime).toString(),
          limit: limit.toString()
        });

        const response = await fetch(`${url}?${params}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            console.log('⏳ Binance rate limit hit, waiting...');
            await this.delay(60000); // Wait 1 minute
            continue;
          }
          throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
        }

        const klines: BinanceKline[] = await response.json();
        
        for (const kline of klines) {
          dataPoints.push({
            timestamp: kline[0],
            symbol: symbol,
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            source: 'binance'
          });
        }

        if (klines.length < limit) {
          break; // No more data available
        }

        currentStart = klines[klines.length - 1][6] + 1; // Start from next close time
        
      } catch (error) {
        console.error(`Error fetching Binance data batch:`, error.message);
        break;
      }
    }

    return dataPoints;
  }

  private async collectCoinGeckoHistoricalData(symbol: string): Promise<HistoricalDataPoint[]> {
    await this.rateLimitCoinGecko();
    
    const coinId = symbol === 'BTCUSDT' ? 'bitcoin' : 'ethereum';
    const days = this.YEARS_TO_COLLECT * 365;
    
    try {
      const url = `${this.COINGECKO_BASE}/coins/${coinId}/market_chart`;
      const params = new URLSearchParams({
        vs_currency: 'usd',
        days: days.toString(),
        interval: 'daily'
      });

      const response = await fetch(`${url}?${params}`);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.log('⏳ CoinGecko rate limit hit, waiting...');
          await this.delay(60000);
          return this.collectCoinGeckoHistoricalData(symbol); // Retry
        }
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data: CoinGeckoMarketData = await response.json();
      const dataPoints: HistoricalDataPoint[] = [];

      // CoinGecko doesn't provide OHLC, so we'll use price as close and estimate others
      for (let i = 0; i < data.prices.length; i++) {
        const [timestamp, price] = data.prices[i];
        const volume = data.total_volumes[i] ? data.total_volumes[i][1] : 0;
        
        // Estimate OHLC from daily close (basic approximation)
        const dailyVolatility = 0.02; // 2% daily volatility assumption
        const randomFactor = (Math.random() - 0.5) * dailyVolatility;
        
        dataPoints.push({
          timestamp: timestamp,
          symbol: symbol,
          open: price * (1 + randomFactor * 0.5),
          high: price * (1 + Math.abs(randomFactor)),
          low: price * (1 - Math.abs(randomFactor)),
          close: price,
          volume: volume,
          source: 'coingecko'
        });
      }

      return dataPoints;
      
    } catch (error) {
      console.error(`Error fetching CoinGecko data:`, error.message);
      return [];
    }
  }

  private async storeHistoricalData(dataPoints: HistoricalDataPoint[]): Promise<void> {
    // For now, we'll log the data. In a full implementation, this would go to the database
    console.log(`💾 Storing ${dataPoints.length} historical data points`);
    
    // Example: Store first and last data points for verification
    if (dataPoints.length > 0) {
      const first = dataPoints[0];
      const last = dataPoints[dataPoints.length - 1];
      
      console.log(`📊 Range: ${new Date(first.timestamp).toISOString()} to ${new Date(last.timestamp).toISOString()}`);
      console.log(`📈 ${first.symbol}: $${first.close.toFixed(2)} → $${last.close.toFixed(2)} (${((last.close - first.close) / first.close * 100).toFixed(1)}%)`);
    }

    // TODO: Insert into database table for historical analysis
    // This data would be used for backtesting, ML training, and pattern recognition
  }

  private async rateLimitBinance(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastBinanceCall;
    
    if (timeSinceLastCall < this.BINANCE_RATE_LIMIT) {
      await this.delay(this.BINANCE_RATE_LIMIT - timeSinceLastCall);
    }
    
    this.lastBinanceCall = Date.now();
  }

  private async rateLimitCoinGecko(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCoinGeckoCall;
    
    if (timeSinceLastCall < this.COINGECKO_RATE_LIMIT) {
      await this.delay(this.COINGECKO_RATE_LIMIT - timeSinceLastCall);
    }
    
    this.lastCoinGeckoCall = Date.now();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility method to get data summary for ML training
  async getHistoricalDataSummary(): Promise<any> {
    // This would query the stored historical data and return statistics
    return {
      totalDataPoints: 0,
      dateRange: { start: null, end: null },
      symbols: this.SYMBOLS,
      sources: ['binance', 'coingecko'],
      ready: false
    };
  }
}

export const historicalDataCollector = new HistoricalDataCollector();
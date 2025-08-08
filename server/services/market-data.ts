export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  spread: number;
  volatility: number;
}

export interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

import { binanceClient } from './binance-client';
import { coinGeckoClient } from './coingecko-client';
import { coinLoreClient } from './coinlore-client';
import { coinCapClient } from './coincap-client';
import { multiApiClient } from './multi-api-client';
import { historicalDataService } from './historical-data';

export class MarketDataService {
  private data: Map<string, MarketData> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  private subscribers: Set<(data: MarketData) => void> = new Set();
  private binanceSubscriptions: Map<string, () => void> = new Map();
  private useLiveData = true;
  private simulationInterval?: NodeJS.Timeout;
  private unsubscribeFunctions: (() => void)[] = [];
  private pollIntervals?: Map<string, NodeJS.Timeout>;
  private symbols = ['BTCUSDT', 'ETHUSDT'];

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    console.log('🌍 Initializing MULTI-API STACKED market data feeds (FREE APIs Aggregated)');
    
    // Test API availability
    const apiStatus = await multiApiClient.getApiStatus();
    const availableApis = Object.entries(apiStatus)
      .filter(([_, status]) => status.available)
      .map(([name]) => name);
    
    console.log(`✅ Available APIs: ${availableApis.join(', ')} (${availableApis.length}/4 active)`);
    
    if (availableApis.includes('CoinLore')) {
      console.log('✅ CoinLore API connected - using as primary data source (NO REGISTRATION)');
      this.useLiveData = true;
      await this.startCoinLoreDataFeeds();
    } else if (availableApis.includes('CoinCap')) {
      console.log('✅ CoinCap API connected - using as primary data source (NO REGISTRATION)');
      this.useLiveData = true;
      await this.startCoinCapDataFeeds();
    } else if (availableApis.length > 0) {
      console.log('🎯 Starting AGGREGATED multi-API data feeds with weighted averaging');
      this.useLiveData = true;
      await this.startMultiApiDataFeeds();
    } else {
      console.log('⚠️ No APIs available - using cached data only');
      this.useLiveData = false;
    }
    
    // Start aggregated price polling with multi-API fallback
    this.startMultiApiPricePolling();
  }

  private async startLiveDataFeeds() {
    const symbols = ['BTCUSDT', 'ETHUSDT'];

    for (const symbol of symbols) {
      try {
        // Get initial ticker data (contains price and other info)
        const tickerData = await binanceClient.getTicker24hr(symbol);

        if (tickerData && !Array.isArray(tickerData)) {
          const ticker = tickerData;
          const marketData: MarketData = {
            symbol,
            price: parseFloat(ticker.lastPrice),
            timestamp: Date.now(),
            volume: parseFloat(ticker.volume),
            spread: parseFloat(ticker.askPrice) - parseFloat(ticker.bidPrice),
            volatility: Math.abs(parseFloat(ticker.priceChangePercent)) / 100
          };

          this.data.set(symbol, marketData);
          this.notifySubscribers(marketData);
        }

        // Subscribe to real-time ticker updates with error handling
        try {
          const unsubscribeTicker = binanceClient.subscribeToTicker(symbol, (tickerData) => {
            const marketData: MarketData = {
              symbol,
              price: parseFloat(tickerData.c), // Current price
              timestamp: Date.now(),
              volume: parseFloat(tickerData.v),
              spread: parseFloat(tickerData.a) - parseFloat(tickerData.b), // Ask - Bid
              volatility: Math.abs(parseFloat(tickerData.P)) / 100 // Price change percentage
            };

            this.data.set(symbol, marketData);
            this.notifySubscribers(marketData);
          });

          this.unsubscribeFunctions.push(unsubscribeTicker);
        } catch (error) {
          console.warn(`Failed to subscribe to ticker for ${symbol}, using polling instead`);
          this.startPollingForSymbol(symbol);
        }

        // Subscribe to kline data for more detailed price action with error handling
        try {
          const unsubscribeKline = binanceClient.subscribeToKline(symbol, '1m', (klineData) => {
            // Update with kline close price if needed
            const currentData = this.data.get(symbol);
            if (currentData && klineData.k) {
              currentData.price = parseFloat(klineData.k.c);
              currentData.timestamp = Date.now();
              this.notifySubscribers(currentData);
            }
          });

          this.unsubscribeFunctions.push(unsubscribeKline);
        } catch (error) {
          console.warn(`Failed to subscribe to klines for ${symbol}`);
        }

        // Subscribe to kline data for historical candles
        const historicalKlines = await binanceClient.getKlines(symbol, '1m', 100);
        for (const kline of historicalKlines) {
          const candle: Candle = {
            timestamp: kline.openTime,
            open: parseFloat(kline.open),
            high: parseFloat(kline.high),
            low: parseFloat(kline.low),
            close: parseFloat(kline.close),
            volume: parseFloat(kline.volume)
          };
          this.addHistoricalCandle(symbol, candle);
        }

      } catch (error) {
        console.error(`Failed to set up live data for ${symbol}:`, error);
        // Use basic polling instead of simulation for authentic data
        this.startPollingForSymbol(symbol);
      }
    }
  }

  // Multi-API data feed methods
  
  private async startMultiApiDataFeeds() {
    console.log('🎯 Starting MULTI-API AGGREGATED data feeds...');
    
    // Initial aggregated data load
    const aggregatedData = await multiApiClient.getAggregatedMarketData(this.symbols);
    
    aggregatedData.forEach((data, symbol) => {
      // Convert to our MarketData format
      const marketData: MarketData = {
        symbol: data.symbol,
        price: data.price,
        timestamp: data.timestamp,
        volume: data.volume,
        spread: data.spread,
        volatility: data.volatility
      };
      
      this.data.set(symbol, marketData);
      this.notifySubscribers(marketData);
      console.log(`🎯 Aggregated ${symbol}: $${data.price.toFixed(2)} (${Math.round(data.confidence * 100)}% confidence, ${data.sources.length} sources)`);
    });
    
    // Start regular aggregated updates every 15 seconds
    setInterval(async () => {
      try {
        const updatedData = await multiApiClient.getAggregatedMarketData(this.symbols);
        updatedData.forEach((data, symbol) => {
          const marketData: MarketData = {
            symbol: data.symbol,
            price: data.price,
            timestamp: data.timestamp,
            volume: data.volume,
            spread: data.spread,
            volatility: data.volatility
          };
          
          this.data.set(symbol, marketData);
          this.notifySubscribers(marketData);
        });
      } catch (error) {
        console.error('Multi-API update failed:', error);
      }
    }, 15000);
  }

  private async startCoinLoreDataFeeds() {
    console.log('💰 Starting CoinLore real-time data feeds (FREE - No Registration)...');
    
    // Initial data load
    const marketData = await coinLoreClient.getMultipleTickers(this.symbols);
    
    marketData.forEach((data, symbol) => {
      this.data.set(symbol, data);
      this.notifySubscribers(data);
      console.log(`📊 CoinLore: ${symbol} @ $${data.price.toFixed(2)} (24h: ${data.priceChangePercent24h?.toFixed(2)}%)`);
    });
    
    // Start regular updates every 10 seconds (CoinLore has generous limits)
    setInterval(async () => {
      try {
        const updatedData = await coinLoreClient.getMultipleTickers(this.symbols);
        updatedData.forEach((data, symbol) => {
          this.data.set(symbol, data);
          this.notifySubscribers(data);
        });
      } catch (error) {
        console.error('CoinLore update failed:', error);
      }
    }, 10000);
  }

  private async startCoinCapDataFeeds() {
    console.log('🚀 Starting CoinCap real-time data feeds (FREE - No Registration)...');
    
    // Initial data load
    const marketData = await coinCapClient.getMultipleAssets(this.symbols);
    
    marketData.forEach((data, symbol) => {
      this.data.set(symbol, data);
      this.notifySubscribers(data);
      console.log(`📊 CoinCap: ${symbol} @ $${data.price.toFixed(2)} (24h: ${data.priceChangePercent24h?.toFixed(2)}%)`);
    });
    
    // Start regular updates every 5 seconds
    setInterval(async () => {
      try {
        const updatedData = await coinCapClient.getMultipleAssets(this.symbols);
        updatedData.forEach((data, symbol) => {
          this.data.set(symbol, data);
          this.notifySubscribers(data);
        });
      } catch (error) {
        console.error('CoinCap update failed:', error);
      }
    }, 5000);
  }
  
  private startMultiApiPricePolling() {
    if (this.pollIntervals) {
      this.pollIntervals.forEach((interval) => clearInterval(interval));
    }
    
    this.pollIntervals = new Map();
    
    this.symbols.forEach((symbol) => {
      const interval = setInterval(async () => {
        try {
          const price = await this.getCurrentPrice(symbol);
          console.log(`📊 Multi-API: ${symbol} @ $${price.toFixed(2)} (Aggregated from multiple sources)`);
        } catch (error) {
          console.error(`Failed to poll aggregated price for ${symbol}:`, error);
        }
      }, 30000);
      
      this.pollIntervals!.set(symbol, interval);
    });
  }

  // Legacy methods maintained for compatibility

  private startPollingForSymbol(symbol: string) {
    // Poll price data every 5 seconds as fallback
    const pollInterval = setInterval(async () => {
      try {
        const priceData = await binanceClient.getPrice(symbol);
        const tickerData = await binanceClient.getTicker24hr(symbol);

        if (priceData && tickerData && !Array.isArray(tickerData)) {
          const marketData: MarketData = {
            symbol,
            price: parseFloat(priceData.price),
            timestamp: Date.now(),
            volume: parseFloat(tickerData.volume),
            spread: parseFloat(tickerData.askPrice) - parseFloat(tickerData.bidPrice),
            volatility: Math.abs(parseFloat(tickerData.priceChangePercent)) / 100
          };

          this.data.set(symbol, marketData);
          this.notifySubscribers(marketData);
        }
      } catch (error) {
        console.error(`Failed to poll price for ${symbol}:`, error);
      }
    }, 5000);

    // Store interval for cleanup
    if (!this.pollIntervals) {
      this.pollIntervals = new Map();
    }
    this.pollIntervals.set(symbol, pollInterval);
  }


  private startSymbolSimulation(symbol: string) {
    const basePrice = symbol === 'BTCUSDT' ? 43000 : 2500;
    const volatility = 0.001; // 0.1% volatility

    const price = basePrice * (1 + (Math.random() - 0.5) * volatility * 2);
    const volume = Math.random() * 100;
    const spread = price * 0.0001; // 0.01% spread
    const vol = this.calculateVolatility(symbol, price);

    const marketData: MarketData = {
      symbol,
      price,
      timestamp: Date.now(),
      volume,
      spread,
      volatility: vol
    };

    this.data.set(symbol, marketData);
    this.notifySubscribers(marketData);
    this.updateCandles(symbol, price, volume);
  }

  private addHistoricalCandle(symbol: string, candle: Candle) {
    if (!this.candles.has(symbol)) {
      this.candles.set(symbol, []);
    }

    const candles = this.candles.get(symbol)!;
    const existingIndex = candles.findIndex(c => c.timestamp === candle.timestamp);

    if (existingIndex >= 0) {
      candles[existingIndex] = candle; // Update existing candle
    } else {
      candles.push(candle);
      candles.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Keep only last 1000 candles
    if (candles.length > 1000) {
      candles.splice(0, candles.length - 1000);
    }
  }

  private calculateVolatility(symbol: string, currentPrice: number): number {
    const candles = this.getCandles(symbol, 20);
    if (candles.length < 2) return 0.01;

    const returns = candles.slice(1).map((candle, i) => 
      Math.log(candle.close / candles[i].close)
    );

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private updateCandles(symbol: string, price: number, volume: number) {
    if (!this.candles.has(symbol)) {
      this.candles.set(symbol, []);
    }

    const candles = this.candles.get(symbol)!;
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000) * 60000;

    if (candles.length === 0 || candles[candles.length - 1].timestamp !== currentMinute) {
      candles.push({
        timestamp: currentMinute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume
      });
    } else {
      const lastCandle = candles[candles.length - 1];
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
      lastCandle.close = price;
      lastCandle.volume += volume;
    }

    // Keep only last 1000 candles
    if (candles.length > 1000) {
      candles.shift();
    }
  }

  private notifySubscribers(data: MarketData) {
    this.subscribers.forEach(callback => callback(data));
  }

  subscribe(callback: (data: MarketData) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Use multi-API aggregated pricing for best accuracy
      return await multiApiClient.getAggregatedPrice(symbol);
    } catch (error) {
      console.error(`Failed to get aggregated price for ${symbol}:`, error);
      
      // Fallback to stored data if available
      const cachedData = this.data.get(symbol);
      if (cachedData) {
        return cachedData.price;
      }
      
      return 0;
    }
  }

  getCurrentPriceSync(symbol: string): number {
    return this.data.get(symbol)?.price ?? 0;
  }

  getMarketData(symbol: string): MarketData | undefined {
    return this.data.get(symbol);
  }

  getCandles(symbol: string, limit = 100): Candle[] {
    // First try to get live candles, then fall back to historical
    const liveCandles = this.candles.get(symbol) || [];

    if (liveCandles.length >= limit) {
      return liveCandles.slice(-limit);
    }

    // Supplement with historical data for backtesting and analysis
    const historicalCandles = historicalDataService.getCandles(symbol, '1m', limit);

    // Combine historical and live data
    const allCandles = [...historicalCandles];
    if (liveCandles.length > 0) {
      // Add recent live data
      allCandles.push(...liveCandles.slice(-Math.min(50, liveCandles.length)));
    }

    return allCandles.slice(-limit);
  }

  getVolatility(symbol: string): number {
    return this.data.get(symbol)?.volatility ?? 0.01;
  }

  getSpread(symbol: string): number {
    return this.data.get(symbol)?.spread ?? 0;
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const price = this.getCurrentPrice(symbol);
    const spread = this.getSpread(symbol);

    return {
      bids: Array.from({ length: 10 }, (_, i) => [
        price - spread * (i + 1),
        Math.random() * 10
      ]),
      asks: Array.from({ length: 10 }, (_, i) => [
        price + spread * (i + 1),
        Math.random() * 10
      ]),
      timestamp: Date.now()
    };
  }

  stop() {
    this.unsubscribeFunctions.forEach(fn => fn());
    this.unsubscribeFunctions = [];

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }

    if (this.pollIntervals) {
      this.pollIntervals.forEach(interval => clearInterval(interval));
      this.pollIntervals.clear();
    }
  }
}

export const marketDataService = new MarketDataService();
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
import { historicalDataService } from './historical-data';

export class MarketDataService {
  private data: Map<string, MarketData> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  private subscribers: Set<(data: MarketData) => void> = new Set();
  private binanceSubscriptions: Map<string, () => void> = new Map();
  private useLiveData = true;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    try {
      // Test Binance connectivity
      const isConnected = await binanceClient.testConnectivity();
      console.log(`Binance API connectivity: ${isConnected ? 'Connected' : 'Disconnected'}`);
      
      if (isConnected) {
        this.useLiveData = true;
        await this.startLiveDataFeeds();
      } else {
        this.useLiveData = false;
        this.startDataSimulation();
      }
    } catch (error) {
      console.warn('Failed to connect to Binance API, using simulated data:', error);
      this.useLiveData = false;
      this.startDataSimulation();
    }
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

        // Subscribe to real-time ticker updates
        const unsubscribe = binanceClient.subscribeToTicker(symbol, (tickerUpdate) => {
          const marketData: MarketData = {
            symbol,
            price: parseFloat(tickerUpdate.c), // Current price
            timestamp: Date.now(),
            volume: parseFloat(tickerUpdate.v), // Volume
            spread: parseFloat(tickerUpdate.a) - parseFloat(tickerUpdate.b), // Ask - Bid
            volatility: Math.abs(parseFloat(tickerUpdate.P)) / 100 // Price change percent
          };
          
          this.data.set(symbol, marketData);
          this.notifySubscribers(marketData);
          this.updateCandles(symbol, marketData.price, marketData.volume);
        });

        this.binanceSubscriptions.set(symbol, unsubscribe);

        // Subscribe to kline data for historical candles
        binanceClient.subscribeToKline(symbol, '1m', (klineData) => {
          const kline = klineData.k;
          if (kline.x) { // Only process closed candles
            const candle: Candle = {
              timestamp: kline.t,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v)
            };
            
            this.addHistoricalCandle(symbol, candle);
          }
        });

        // Load historical candles
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
        // Fall back to simulation for this symbol
        this.startSymbolSimulation(symbol);
      }
    }
  }

  private startDataSimulation() {
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    setInterval(() => {
      symbols.forEach(symbol => {
        if (!this.binanceSubscriptions.has(symbol)) {
          this.startSymbolSimulation(symbol);
        }
      });
    }, 1000);
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

  getCurrentPrice(symbol: string): number {
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
}

export const marketDataService = new MarketDataService();
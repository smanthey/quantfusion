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

export class MarketDataService {
  private data: Map<string, MarketData> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  private subscribers: Set<(data: MarketData) => void> = new Set();

  constructor() {
    this.startDataSimulation();
  }

  private startDataSimulation() {
    // Simulate real-time market data for BTCUSDT and ETHUSDT
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    setInterval(() => {
      symbols.forEach(symbol => {
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
      });
    }, 1000);
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
    const candles = this.candles.get(symbol) || [];
    return candles.slice(-limit);
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
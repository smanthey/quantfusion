import crypto from 'crypto';
import WebSocket from 'ws';

export interface BinanceTickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

export interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  fills: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private wsUrl: string;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private connections: Map<string, WebSocket> = new Map();

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_SECRET_KEY || '';

    // Use public API if credentials not available
    // Note: API key warnings are expected when using public endpoints only
    if (!this.apiKey || !this.apiSecret) {
      console.warn('⚠️ Binance API credentials not found, using public endpoints only');
    }

    // Use testnet API which was working before geo-restrictions
    this.baseUrl = 'https://testnet.binance.vision/api';
    // WebSocket disabled due to geo-blocking, using REST polling only
    this.wsUrl = 'wss://stream.binance.com:9443/ws';
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makePublicRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    // Convert all values to strings for URLSearchParams
    const stringParams: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      stringParams[key] = String(value);
    });

    const queryString = new URLSearchParams(stringParams).toString();
    const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Binance API request failed:', error);
      throw error;
    }
  }

  private async makePrivateRequest(endpoint: string, params: Record<string, any> = {}, method: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<any> {
    const timestamp = Date.now().toString();
    const queryParams = { ...params, timestamp };

    // Convert all values to strings for URLSearchParams
    const stringParams: Record<string, string> = {};
    Object.entries(queryParams).forEach(([key, value]) => {
      stringParams[key] = String(value);
    });

    const queryString = new URLSearchParams(stringParams).toString();
    const signature = this.createSignature(queryString);

    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const headers = {
      'X-MBX-APIKEY': this.apiKey,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, { method, headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Binance API request failed:', error);
      throw error;
    }
  }

  // Market Data Methods (Public)
  async getTicker24hr(symbol?: string): Promise<BinanceTickerData | BinanceTickerData[]> {
    try {
      const params = symbol ? { symbol } : {};
      const response = await this.makePublicRequest('/v3/ticker/24hr', params);
      return response;
    } catch (error) {
      console.error('Failed to get ticker data:', error);
      throw error;
    }
  }

  async getPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    return this.makePublicRequest('/v3/ticker/price', { symbol });
  }

  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<BinanceKline[]> {
    const response = await this.makePublicRequest('/v3/klines', {
      symbol,
      interval,
      limit
    });

    return response.map((kline: any[]) => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteAssetVolume: kline[7],
      numberOfTrades: kline[8],
      takerBuyBaseAssetVolume: kline[9],
      takerBuyQuoteAssetVolume: kline[10],
    }));
  }

  // Account Methods (Private)
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    return this.makePrivateRequest('/v3/account');
  }

  async getBalance(asset?: string): Promise<any> {
    const accountInfo = await this.getAccountInfo();
    if (asset) {
      return accountInfo.balances.find(balance => balance.asset === asset) || null;
    }
    return accountInfo.balances;
  }

  // Trading Methods
  async createOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT',
    quantity: string,
    price?: string,
    timeInForce?: 'GTC' | 'IOC' | 'FOK'
  ): Promise<BinanceOrderResponse> {
    const params: any = {
      symbol,
      side,
      type,
      quantity,
    };

    if (type === 'LIMIT') {
      if (!price) throw new Error('Price is required for LIMIT orders');
      params.price = price;
      params.timeInForce = timeInForce || 'GTC';
    }

    return this.makePrivateRequest('/v3/order', params, 'POST');
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return this.makePrivateRequest('/v3/order', { symbol, orderId }, 'DELETE');
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params = symbol ? { symbol } : {};
    return this.makePrivateRequest('/v3/openOrders', params);
  }

  // WebSocket Methods
  subscribeToTicker(symbol: string, callback: (data: any) => void): () => void {
    const stream = `${symbol.toLowerCase()}@ticker`;

    if (!this.subscribers.has(stream)) {
      this.subscribers.set(stream, new Set());
    }

    this.subscribers.get(stream)!.add(callback);

    if (!this.connections.has(stream)) {
      this.connectToStream(stream);
    }

    // Return unsubscribe function
    return () => {
      const streamSubscribers = this.subscribers.get(stream);
      if (streamSubscribers) {
        streamSubscribers.delete(callback);
        if (streamSubscribers.size === 0) {
          this.disconnectFromStream(stream);
        }
      }
    };
  }

  subscribeToKline(symbol: string, interval: string, callback: (data: any) => void): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;

    if (!this.subscribers.has(stream)) {
      this.subscribers.set(stream, new Set());
    }

    this.subscribers.get(stream)!.add(callback);

    if (!this.connections.has(stream)) {
      this.connectToStream(stream);
    }

    return () => {
      const streamSubscribers = this.subscribers.get(stream);
      if (streamSubscribers) {
        streamSubscribers.delete(callback);
        if (streamSubscribers.size === 0) {
          this.disconnectFromStream(stream);
        }
      }
    };
  }

  private connectToStream(stream: string) {
    const ws = new WebSocket(`${this.wsUrl}/${stream}`);

    ws.on('open', () => {
      console.log(`Connected to Binance stream: ${stream}`);
    });

    ws.on('message', (data) => {
      try {
        const parsedData = JSON.parse(data.toString());
        const subscribers = this.subscribers.get(stream);
        if (subscribers) {
          subscribers.forEach(callback => callback(parsedData));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${stream}:`, error);
      // If geo-blocked (451), start REST fallback immediately
      if (error.message.includes('451')) {
        console.log(`🔄 WebSocket geo-blocked. Switching to REST polling for ${stream}`);
        this.startRestPolling(stream);
      }
    });

    ws.on('close', () => {
      console.log(`Disconnected from Binance stream: ${stream}`);
      this.connections.delete(stream);

      // Start REST polling as fallback instead of reconnecting WebSocket
      if (this.subscribers.has(stream) && this.subscribers.get(stream)!.size > 0) {
        console.log(`🔄 Starting REST polling fallback for ${stream}`);
        this.startRestPolling(stream);
      }
    });

    this.connections.set(stream, ws);
  }

  private disconnectFromStream(stream: string) {
    const ws = this.connections.get(stream);
    if (ws) {
      ws.close();
      this.connections.delete(stream);
    }
    this.subscribers.delete(stream);
  }

  // Utility Methods
  async testConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v3/ping`);
      if (response.status === 451) {
        console.warn('Binance API is geo-restricted in this region');
        return false;
      }
      return response.ok;
    } catch (error) {
      console.warn('Binance connectivity test failed:', error);
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/v3/time`);
    const data = await response.json();
    return data.serverTime;
  }

  private startRestPolling(stream: string) {
    // Avoid multiple polling intervals for the same stream
    const pollKey = `${stream}_poll`;
    if (this.connections.has(pollKey)) {
      return;
    }

    const [symbol, type] = stream.split('@');
    console.log(`📊 Starting REST API polling for ${symbol.toUpperCase()} (${type})`);
    
    const pollInterval = setInterval(async () => {
      try {
        if (type === 'ticker') {
          const tickerData = await this.getTicker24hr(symbol.toUpperCase());
          if (tickerData && !Array.isArray(tickerData)) {
            const ticker = tickerData;
            // Convert to WebSocket ticker format for compatibility
            const wsFormat = {
              s: ticker.symbol,
              c: ticker.lastPrice,
              P: ticker.priceChangePercent,
              a: ticker.askPrice || ticker.lastPrice,
              b: ticker.bidPrice || ticker.lastPrice,
              v: ticker.volume,
              o: ticker.openPrice,
              h: ticker.highPrice,
              l: ticker.lowPrice
            };
            
            const subscribers = this.subscribers.get(stream);
            if (subscribers) {
              subscribers.forEach(cb => cb(wsFormat));
            }
          }
        } else if (type.includes('kline')) {
          // For kline data, use recent klines
          const klines = await this.getKlines(symbol.toUpperCase(), '1m', 1);
          if (klines && klines.length > 0) {
            const kline = klines[0];
            const wsFormat = {
              k: {
                t: kline.openTime,
                T: kline.closeTime,
                s: symbol.toUpperCase(),
                o: kline.open,
                h: kline.high,
                l: kline.low,
                c: kline.close,
                v: kline.volume,
                x: true // Kline is closed
              }
            };
            
            const subscribers = this.subscribers.get(stream);
            if (subscribers) {
              subscribers.forEach(cb => cb(wsFormat));
            }
          }
        }
      } catch (error) {
        console.error(`REST polling error for ${stream}:`, error);
      }
    }, 5000); // Poll every 5 seconds

    this.connections.set(pollKey, pollInterval as any);
  }

  close() {
    this.connections.forEach((connection, key) => {
      if (key.includes('_poll')) {
        clearInterval(connection as any);
      } else {
        (connection as WebSocket).close();
      }
    });
    this.connections.clear();
    this.subscribers.clear();
  }
}

// Create singleton instance
export const binanceClient = new BinanceClient();
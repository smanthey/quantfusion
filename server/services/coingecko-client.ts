export interface CoinGeckoTicker {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  ath: number;
  atl: number;
  last_updated: string;
}

export interface CoinGeckoOHLC {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

import { ExponentialBackoff, AdaptiveRateLimiter, isRetryableError } from './exponential-backoff';
import { circuitBreakerManager } from './circuit-breaker';

export class CoinGeckoClient {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private lastRequestTime = 0;
  private minRequestInterval = 100; // 10 requests per second limit
  private backoff: ExponentialBackoff;
  private rateLimiter: AdaptiveRateLimiter;
  
  private symbolMap = new Map([
    ['BTCUSDT', 'bitcoin'],
    ['ETHUSDT', 'ethereum'],
    ['ADAUSDT', 'cardano'],
    ['DOTUSDT', 'polkadot'],
    ['LINKUSDT', 'chainlink'],
    ['LTCUSDT', 'litecoin'],
    ['BCHUSDT', 'bitcoin-cash'],
    ['XLMUSDT', 'stellar'],
    ['EOSUSDT', 'eos'],
    ['TRXUSDT', 'tron']
  ]);

  constructor() {
    this.backoff = new ExponentialBackoff({
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitter: true
    });
    this.rateLimiter = new AdaptiveRateLimiter(10); // 10 req/sec
    
    // Create circuit breaker for CoinGecko
    circuitBreakerManager.createBreaker({
      name: 'coingecko_api',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000
    });
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const breaker = circuitBreakerManager.getBreaker('coingecko_api')!;
    
    // Check circuit breaker first
    return await breaker.execute(async () => {
      // Adaptive rate limiting
      await this.rateLimiter.throttle();
      
      // Exponential backoff retry
      return await this.backoff.execute(async () => {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url);
        this.lastRequestTime = Date.now();
        
        if (!response.ok) {
          const error: any = new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
          error.response = { status: response.status };
          
          if (response.status === 429) {
            this.rateLimiter.onError(); // Slow down on rate limit
          }
          
          throw error;
        }
        
        this.rateLimiter.onSuccess(); // Speed up on success
        return await response.json();
      }, isRetryableError);
    });
  }

  private getGeckoId(symbol: string): string {
    return this.symbolMap.get(symbol) || symbol.replace('USDT', '').toLowerCase();
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const geckoId = this.getGeckoId(symbol);
      const data = await this.makeRequest('/simple/price', {
        ids: geckoId,
        vs_currencies: 'usd'
      });
      
      return data[geckoId]?.usd || 0;
    } catch (error) {
      // console.error(`Failed to get price for ${symbol}:`, error);
      return 0;
    }
  }

  async getTicker24hr(symbol: string): Promise<CoinGeckoTicker | null> {
    try {
      const geckoId = this.getGeckoId(symbol);
      const data = await this.makeRequest('/coins/markets', {
        vs_currency: 'usd',
        ids: geckoId,
        order: 'market_cap_desc',
        per_page: 1,
        page: 1,
        sparkline: false
      });
      
      if (data && data.length > 0) {
        const ticker = data[0];
        return {
          id: ticker.id,
          symbol: ticker.symbol.toUpperCase() + 'USDT',
          name: ticker.name,
          current_price: ticker.current_price,
          price_change_24h: ticker.price_change_24h,
          price_change_percentage_24h: ticker.price_change_percentage_24h,
          market_cap: ticker.market_cap,
          market_cap_rank: ticker.market_cap_rank,
          fully_diluted_valuation: ticker.fully_diluted_valuation,
          total_volume: ticker.total_volume,
          high_24h: ticker.high_24h,
          low_24h: ticker.low_24h,
          ath: ticker.ath,
          atl: ticker.atl,
          last_updated: ticker.last_updated
        };
      }
      
      return null;
    } catch (error) {
      // console.error(`Failed to get 24hr ticker for ${symbol}:`, error);
      return null;
    }
  }

  async getOHLC(symbol: string, days: number = 1): Promise<CoinGeckoOHLC[]> {
    try {
      const geckoId = this.getGeckoId(symbol);
      const data = await this.makeRequest(`/coins/${geckoId}/ohlc`, {
        vs_currency: 'usd',
        days: days
      });
      
      if (Array.isArray(data)) {
        return data.map(([timestamp, open, high, low, close]: number[]) => ({
          timestamp,
          open,
          high,
          low,
          close
        }));
      }
      
      return [];
    } catch (error) {
      // console.error(`Failed to get OHLC for ${symbol}:`, error);
      return [];
    }
  }

  async getMarketData(symbols: string[]): Promise<Map<string, any>> {
    const marketData = new Map();
    
    try {
      const geckoIds = symbols.map(s => this.getGeckoId(s));
      const data = await this.makeRequest('/coins/markets', {
        vs_currency: 'usd',
        ids: geckoIds.join(','),
        order: 'market_cap_desc',
        per_page: symbols.length,
        page: 1,
        sparkline: false,
        price_change_percentage: '1h,24h,7d'
      });
      
      if (Array.isArray(data)) {
        data.forEach((coin: any) => {
          const symbol = coin.symbol.toUpperCase() + 'USDT';
          marketData.set(symbol, {
            symbol,
            price: coin.current_price,
            timestamp: new Date(coin.last_updated).getTime(),
            volume: coin.total_volume,
            spread: 0.001, // Estimated spread for crypto
            volatility: Math.abs(coin.price_change_percentage_24h || 0) / 100,
            high24h: coin.high_24h,
            low24h: coin.low_24h,
            priceChange24h: coin.price_change_24h,
            priceChangePercent24h: coin.price_change_percentage_24h,
            marketCap: coin.market_cap
          });
        });
      }
    } catch (error) {
      // console.error('Failed to get market data:', error);
    }
    
    return marketData;
  }

  async getPing(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/ping');
      return response && response.gecko_says === "(V3) To the Moon!";
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
export const coinGeckoClient = new CoinGeckoClient();
export interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
}

export interface CoinCapResponse<T> {
  data: T;
  timestamp: number;
}

import { ExponentialBackoff, AdaptiveRateLimiter, isRetryableError } from './exponential-backoff';
import { circuitBreakerManager } from './circuit-breaker';

export class CoinCapClient {
  private baseUrl = 'https://api.coincap.io/v2';
  private lastRequestTime = 0;
  private minRequestInterval = 500; // 2 requests per second limit
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
    this.rateLimiter = new AdaptiveRateLimiter(2); // 2 req/sec
    
    // Create circuit breaker for CoinCap
    circuitBreakerManager.createBreaker({
      name: 'coincap_api',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000
    });
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const breaker = circuitBreakerManager.getBreaker('coincap_api')!;
    
    return await breaker.execute(async () => {
      await this.rateLimiter.throttle();
      
      return await this.backoff.execute(async () => {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url);
        this.lastRequestTime = Date.now();
        
        if (!response.ok) {
          const error: any = new Error(`CoinCap API error: ${response.status} ${response.statusText}`);
          error.response = { status: response.status };
          
          if (response.status === 429) {
            this.rateLimiter.onError();
          }
          
          throw error;
        }
        
        this.rateLimiter.onSuccess();
        return await response.json();
      }, isRetryableError);
    });
  }

  private getAssetId(symbol: string): string {
    return this.symbolMap.get(symbol) || symbol.replace('USDT', '').toLowerCase();
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const assetId = this.getAssetId(symbol);
      const response: CoinCapResponse<CoinCapAsset> = await this.makeRequest(`/assets/${assetId}`);
      
      return parseFloat(response.data.priceUsd) || 0;
    } catch (error) {
      console.error(`Failed to get price for ${symbol}:`, error);
      return 0;
    }
  }

  async getAsset(symbol: string): Promise<CoinCapAsset | null> {
    try {
      const assetId = this.getAssetId(symbol);
      const response: CoinCapResponse<CoinCapAsset> = await this.makeRequest(`/assets/${assetId}`);
      
      return response.data;
    } catch (error) {
      console.error(`Failed to get asset for ${symbol}:`, error);
      return null;
    }
  }

  async getMultipleAssets(symbols: string[]): Promise<Map<string, any>> {
    const marketData = new Map();
    
    try {
      // Get asset IDs
      const assetIds = symbols.map(s => this.getAssetId(s)).join(',');
      const response: CoinCapResponse<CoinCapAsset[]> = await this.makeRequest(`/assets?ids=${assetIds}`);
      
      if (Array.isArray(response.data)) {
        response.data.forEach((asset: CoinCapAsset) => {
          const symbol = asset.symbol.toUpperCase() + 'USDT';
          marketData.set(symbol, {
            symbol,
            price: parseFloat(asset.priceUsd),
            timestamp: response.timestamp,
            volume: parseFloat(asset.volumeUsd24Hr) || 0,
            spread: 0.001, // Estimated spread
            volatility: Math.abs(parseFloat(asset.changePercent24Hr) || 0) / 100,
            priceChange24h: parseFloat(asset.changePercent24Hr) || 0,
            priceChangePercent24h: parseFloat(asset.changePercent24Hr) || 0,
            marketCap: parseFloat(asset.marketCapUsd) || 0,
            rank: parseInt(asset.rank) || 0,
            supply: parseFloat(asset.supply) || 0,
            maxSupply: parseFloat(asset.maxSupply) || 0
          });
        });
      }
    } catch (error) {
      console.error('Failed to get multiple assets:', error);
    }
    
    return marketData;
  }

  async getTopAssets(limit: number = 50): Promise<CoinCapAsset[]> {
    try {
      const response: CoinCapResponse<CoinCapAsset[]> = await this.makeRequest(`/assets?limit=${limit}`);
      
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get top assets:', error);
      return [];
    }
  }

  async getPing(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/assets/bitcoin');
      return response && response.data && response.data.id === 'bitcoin';
    } catch (error) {
      console.warn('CoinCap ping failed, but continuing with other APIs:', error.message);
      return false;
    }
  }
}

// Create singleton instance
export const coinCapClient = new CoinCapClient();
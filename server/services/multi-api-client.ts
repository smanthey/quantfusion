import { coinLoreClient } from './coinlore-client';
import { coinCapClient } from './coincap-client';
import { coinGeckoClient } from './coingecko-client';
import { binanceClient } from './binance-client';

export interface AggregatedMarketData {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  spread: number;
  volatility: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  marketCap: number;
  rank?: number;
  confidence: number; // 0-1 based on data source reliability
  sources: string[]; // Which APIs provided data
}

export interface HistoricalDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

export class MultiApiClient {
  private apiPriority = [
    { name: 'CoinLore', client: coinLoreClient, weight: 0.9, rateLimitMs: 1000 },
    { name: 'CoinCap', client: coinCapClient, weight: 0.85, rateLimitMs: 500 },
    { name: 'CoinGecko', client: coinGeckoClient, weight: 0.8, rateLimitMs: 2000 },
    { name: 'Binance', client: binanceClient, weight: 0.7, rateLimitMs: 100 }
  ];
  
  private lastRequestTimes = new Map<string, number>();
  private failureCount = new Map<string, number>();
  private dataCache = new Map<string, { data: any; timestamp: number }>();
  private cacheValidityMs = 30000; // 30 seconds

  private async canMakeRequest(apiName: string, rateLimitMs: number): Promise<boolean> {
    const lastRequest = this.lastRequestTimes.get(apiName) || 0;
    const timeSince = Date.now() - lastRequest;
    
    if (timeSince < rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, rateLimitMs - timeSince));
    }
    
    this.lastRequestTimes.set(apiName, Date.now());
    return true;
  }

  private getCachedData(key: string): any | null {
    const cached = this.dataCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheValidityMs) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.dataCache.set(key, { data, timestamp: Date.now() });
  }

  async getAggregatedPrice(symbol: string): Promise<number> {
    const cacheKey = `price_${symbol}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const prices: { price: number; weight: number; source: string }[] = [];

    // Try each API in priority order
    for (const api of this.apiPriority) {
      try {
        await this.canMakeRequest(api.name, api.rateLimitMs);
        
        let price = 0;
        if (api.name === 'CoinLore') {
          price = await coinLoreClient.getCurrentPrice(symbol);
        } else if (api.name === 'CoinCap') {
          price = await coinCapClient.getCurrentPrice(symbol);
        } else if (api.name === 'CoinGecko') {
          price = await coinGeckoClient.getCurrentPrice(symbol);
        } else if (api.name === 'Binance') {
          const priceData = await binanceClient.getPrice(symbol);
          price = parseFloat(priceData.price);
        }

        if (price > 0) {
          prices.push({ price, weight: api.weight, source: api.name });
          this.failureCount.set(api.name, 0); // Reset failure count on success
        }
      } catch (error) {
        const failures = this.failureCount.get(api.name) || 0;
        this.failureCount.set(api.name, failures + 1);
        console.warn(`${api.name} failed for ${symbol}:`, error.message);
        
        // Temporarily reduce weight if too many failures
        if (failures > 3) {
          api.weight *= 0.8;
        }
      }
    }

    if (prices.length === 0) {
      return 0;
    }

    // Calculate weighted average
    const totalWeight = prices.reduce((sum, p) => sum + p.weight, 0);
    const weightedPrice = prices.reduce((sum, p) => sum + (p.price * p.weight), 0) / totalWeight;
    
    this.setCachedData(cacheKey, weightedPrice);
    console.log(`📊 Aggregated ${symbol}: $${weightedPrice.toFixed(2)} from ${prices.map(p => p.source).join(', ')}`);
    
    return weightedPrice;
  }

  async getAggregatedMarketData(symbols: string[]): Promise<Map<string, AggregatedMarketData>> {
    const results = new Map<string, AggregatedMarketData>();
    
    // Collect data from all available APIs
    const apiResults = new Map<string, Map<string, any>>();

    for (const api of this.apiPriority) {
      try {
        await this.canMakeRequest(api.name, api.rateLimitMs);
        
        let marketData: Map<string, any>;
        
        if (api.name === 'CoinLore') {
          marketData = await coinLoreClient.getMultipleTickers(symbols);
        } else if (api.name === 'CoinCap') {
          marketData = await coinCapClient.getMultipleAssets(symbols);
        } else if (api.name === 'CoinGecko') {
          marketData = await coinGeckoClient.getMarketData(symbols);
        } else {
          continue; // Skip Binance for bulk data due to rate limits
        }
        
        if (marketData.size > 0) {
          apiResults.set(api.name, marketData);
          this.failureCount.set(api.name, 0);
        }
      } catch (error) {
        const failures = this.failureCount.get(api.name) || 0;
        this.failureCount.set(api.name, failures + 1);
        console.warn(`${api.name} bulk data failed:`, error.message);
      }
    }

    // Aggregate data for each symbol
    for (const symbol of symbols) {
      const prices: number[] = [];
      const volumes: number[] = [];
      const changes: number[] = [];
      const marketCaps: number[] = [];
      const sources: string[] = [];
      let bestTimestamp = 0;
      let totalWeight = 0;
      let weightedPrice = 0;
      let weightedVolume = 0;
      let weightedChange = 0;
      let weightedMarketCap = 0;

      // Collect data from all APIs for this symbol
      for (const [apiName, data] of apiResults) {
        const symbolData = data.get(symbol);
        if (symbolData && symbolData.price > 0) {
          const api = this.apiPriority.find(a => a.name === apiName);
          const weight = api?.weight || 0.5;
          
          prices.push(symbolData.price);
          volumes.push(symbolData.volume || 0);
          changes.push(symbolData.priceChangePercent24h || 0);
          marketCaps.push(symbolData.marketCap || 0);
          sources.push(apiName);
          
          weightedPrice += symbolData.price * weight;
          weightedVolume += (symbolData.volume || 0) * weight;
          weightedChange += (symbolData.priceChangePercent24h || 0) * weight;
          weightedMarketCap += (symbolData.marketCap || 0) * weight;
          totalWeight += weight;
          
          if (symbolData.timestamp > bestTimestamp) {
            bestTimestamp = symbolData.timestamp;
          }
        }
      }

      if (prices.length > 0 && totalWeight > 0) {
        // Calculate confidence based on number of sources and price consistency
        const priceVariance = prices.length > 1 ? 
          Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - (weightedPrice / totalWeight), 2), 0) / prices.length) : 0;
        const priceStdDev = priceVariance / (weightedPrice / totalWeight);
        const confidence = Math.max(0.3, Math.min(1.0, 
          (sources.length / 4) * 0.5 + // Source diversity
          Math.max(0, 1 - priceStdDev * 10) * 0.5 // Price consistency
        ));

        const aggregatedData: AggregatedMarketData = {
          symbol,
          price: weightedPrice / totalWeight,
          timestamp: bestTimestamp || Date.now(),
          volume: weightedVolume / totalWeight,
          spread: 0.001, // Estimated
          volatility: Math.abs(weightedChange / totalWeight) / 100,
          priceChange24h: weightedChange / totalWeight,
          priceChangePercent24h: weightedChange / totalWeight,
          marketCap: weightedMarketCap / totalWeight,
          rank: Math.min(...marketCaps.map((_, i) => apiResults.get(sources[i])?.get(symbol)?.rank).filter(r => r > 0)) || undefined,
          confidence,
          sources
        };

        results.set(symbol, aggregatedData);
        console.log(`🎯 ${symbol}: $${aggregatedData.price.toFixed(2)} (${Math.round(confidence * 100)}% confidence from ${sources.join(', ')})`);
      }
    }

    return results;
  }

  async getHistoricalData(symbol: string, days: number = 7): Promise<HistoricalDataPoint[]> {
    const cacheKey = `history_${symbol}_${days}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const historicalData: HistoricalDataPoint[] = [];

    // Try CoinGecko first for historical data (best free historical API)
    try {
      await this.canMakeRequest('CoinGecko', 2000);
      const geckoData = await coinGeckoClient.getOHLC(symbol, days);
      
      if (geckoData.length > 0) {
        geckoData.forEach(point => {
          historicalData.push({
            timestamp: point.timestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: 0, // CoinGecko OHLC doesn't include volume
            source: 'CoinGecko'
          });
        });
      }
    } catch (error) {
      console.warn('CoinGecko historical data failed:', error.message);
    }

    // If no historical data from CoinGecko, create fallback data points
    if (historicalData.length === 0) {
      try {
        // Get current price and generate historical approximation
        const currentPrice = await coinLoreClient.getCurrentPrice(symbol);
        if (currentPrice > 0) {
          const now = Date.now();
          for (let i = days; i >= 0; i--) {
            const timestamp = now - (i * 24 * 60 * 60 * 1000);
            const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
            const price = currentPrice * (1 + variation);
            historicalData.push({
              timestamp,
              open: price * 0.999,
              high: price * 1.002,
              low: price * 0.998,
              close: price,
              volume: Math.random() * 1000000,
              source: 'Approximated'
            });
          }
        }
      } catch (error) {
        console.warn('Failed to generate historical approximation:', error.message);
      }
    }

    // Cache results for 5 minutes
    if (historicalData.length > 0) {
      this.setCachedData(cacheKey, historicalData);
    }

    return historicalData;
  }

  async getApiStatus(): Promise<Record<string, { available: boolean; lastSuccess: number; failures: number }>> {
    const status: Record<string, { available: boolean; lastSuccess: number; failures: number }> = {};

    for (const api of this.apiPriority) {
      const failures = this.failureCount.get(api.name) || 0;
      let available = false;

      try {
        await this.canMakeRequest(api.name, api.rateLimitMs);
        
        if (api.name === 'CoinLore') {
          available = await coinLoreClient.getPing();
        } else if (api.name === 'CoinCap') {
          available = await coinCapClient.getPing();
        } else if (api.name === 'CoinGecko') {
          available = await coinGeckoClient.getPing();
        } else if (api.name === 'Binance') {
          const result = await binanceClient.testConnectivity();
          available = result && typeof result === 'object';
        }
      } catch (error) {
        available = false;
      }

      status[api.name] = {
        available,
        lastSuccess: available ? Date.now() : 0,
        failures
      };
    }

    return status;
  }
}

// Create singleton instance
export const multiApiClient = new MultiApiClient();
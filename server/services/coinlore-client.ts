export interface CoinLoreTickerData {
  id: string;
  symbol: string;
  name: string;
  price_usd: string;
  percent_change_24h: string;
  percent_change_1h: string;
  percent_change_7d: string;
  price_btc: string;
  market_cap_usd: string;
  volume24: string;
  volume24a: string;
  csupply: string;
  tsupply: string;
  max_supply: string;
  rank: number;
  last_updated: number;
}

export class CoinLoreClient {
  private baseUrl = 'https://api.coinlore.net/api';
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests
  
  private symbolMap = new Map([
    ['BTCUSDT', '90'],
    ['ETHUSDT', '80'], 
    ['ADAUSDT', '257'],
    ['DOTUSDT', '3635'],
    ['LINKUSDT', '1975'],
    ['LTCUSDT', '1'],
    ['BCHUSDT', '2321'],
    ['XLMUSDT', '2'],
    ['EOSUSDT', '2490'],
    ['TRXUSDT', '2457']
  ]);

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await fetch(url);
      this.lastRequestTime = Date.now();
      
      if (!response.ok) {
        throw new Error(`CoinLore API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      // console.error('CoinLore API request failed:', error);
      throw error;
    }
  }

  private getCoinId(symbol: string): string {
    return this.symbolMap.get(symbol) || '90'; // Default to Bitcoin
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const coinId = this.getCoinId(symbol);
      const data = await this.makeRequest('/ticker/', { id: coinId });
      
      if (Array.isArray(data) && data.length > 0) {
        return parseFloat(data[0].price_usd) || 0;
      }
      
      return 0;
    } catch (error) {
      // console.error(`Failed to get price for ${symbol}:`, error);
      return 0;
    }
  }

  async getTicker(symbol: string): Promise<CoinLoreTickerData | null> {
    try {
      const coinId = this.getCoinId(symbol);
      const data = await this.makeRequest('/ticker/', { id: coinId });
      
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      
      return null;
    } catch (error) {
      // console.error(`Failed to get ticker for ${symbol}:`, error);
      return null;
    }
  }

  async getMultipleTickers(symbols: string[]): Promise<Map<string, any>> {
    const marketData = new Map();
    
    try {
      // Get coin IDs for all symbols
      const coinIds = symbols.map(s => this.getCoinId(s));
      const data = await this.makeRequest('/ticker/', { id: coinIds.join(',') });
      
      if (Array.isArray(data)) {
        data.forEach((ticker: CoinLoreTickerData, index: number) => {
          const symbol = symbols[index];
          marketData.set(symbol, {
            symbol,
            price: parseFloat(ticker.price_usd),
            timestamp: ticker.last_updated * 1000, // Convert to milliseconds
            volume: parseFloat(ticker.volume24) || 0,
            spread: 0.001, // Estimated spread
            volatility: Math.abs(parseFloat(ticker.percent_change_24h) || 0) / 100,
            priceChange24h: parseFloat(ticker.percent_change_24h) || 0,
            priceChangePercent24h: parseFloat(ticker.percent_change_24h) || 0,
            marketCap: parseFloat(ticker.market_cap_usd) || 0,
            rank: ticker.rank
          });
        });
      }
    } catch (error) {
      // console.error('Failed to get multiple tickers:', error);
    }
    
    return marketData;
  }

  async getAllTickers(): Promise<CoinLoreTickerData[]> {
    try {
      const data = await this.makeRequest('/tickers/');
      
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
      
      return [];
    } catch (error) {
      // console.error('Failed to get all tickers:', error);
      return [];
    }
  }

  async getPing(): Promise<boolean> {
    try {
      const data = await this.makeRequest('/global/');
      return data && typeof data === 'object';
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
export const coinLoreClient = new CoinLoreClient();
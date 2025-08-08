export class MarketDataService {
  private mockPrices: Record<string, number> = {
    'BTCUSDT': 42387.20,
    'ETHUSDT': 2834.56,
    'ADAUSDT': 0.4589
  };

  async getCurrentPrice(symbol: string): Promise<string> {
    // In production, this would fetch from exchange API
    const basePrice = this.mockPrices[symbol] || 50000;
    
    // Add some random variation to simulate real market movements
    const variation = 1 + (Math.random() - 0.5) * 0.002; // ±0.1% variation
    const currentPrice = basePrice * variation;
    
    // Update the mock price for next time
    this.mockPrices[symbol] = currentPrice;
    
    return currentPrice.toFixed(2);
  }

  async getCurrentSpread(symbol: string): Promise<number> {
    // Mock spread in basis points
    const baseSpread = 4.2;
    const volatilityFactor = Math.random() * 2; // 0-2x multiplier
    return baseSpread * (1 + volatilityFactor);
  }

  async getRecentCandles(symbol: string, count: number): Promise<any[]> {
    // Generate mock candle data
    const candles = [];
    const now = new Date();
    const basePrice = this.mockPrices[symbol] || 50000;
    
    let currentPrice = basePrice;
    
    for (let i = count; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000); // 1-minute intervals
      
      // Simulate price movement
      const change = (Math.random() - 0.5) * 0.01; // ±0.5% max change per minute
      currentPrice *= (1 + change);
      
      const high = currentPrice * (1 + Math.random() * 0.002);
      const low = currentPrice * (1 - Math.random() * 0.002);
      const volume = Math.random() * 100 + 50; // Random volume
      
      candles.push({
        timestamp: timestamp.toISOString(),
        open: currentPrice.toFixed(2),
        high: high.toFixed(2),
        low: low.toFixed(2),
        close: currentPrice.toFixed(2),
        volume: volume.toFixed(2)
      });
    }
    
    return candles;
  }

  async getHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Generate mock historical data for backtesting
    const candles = [];
    const totalMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
    const basePrice = this.mockPrices[symbol] || 50000;
    
    let currentPrice = basePrice * (0.8 + Math.random() * 0.4); // Start with ±20% variation
    
    for (let i = 0; i < totalMinutes; i += 5) { // 5-minute intervals for historical data
      const timestamp = new Date(startDate.getTime() + i * 60000);
      
      // Simulate more realistic price movements with trends
      const trendFactor = Math.sin(i / 1000) * 0.001; // Long-term trend
      const randomFactor = (Math.random() - 0.5) * 0.005; // Random noise
      const volatilityCluster = Math.sin(i / 100) * 0.002; // Volatility clustering
      
      const change = trendFactor + randomFactor + volatilityCluster;
      currentPrice *= (1 + change);
      
      const volatility = 0.001 + Math.abs(volatilityCluster) * 2;
      const high = currentPrice * (1 + Math.random() * volatility);
      const low = currentPrice * (1 - Math.random() * volatility);
      const volume = Math.random() * 200 + 100;
      
      candles.push({
        timestamp: timestamp.toISOString(),
        open: currentPrice.toFixed(2),
        high: high.toFixed(2),
        low: low.toFixed(2),
        close: currentPrice.toFixed(2),
        volume: volume.toFixed(2)
      });
    }
    
    return candles;
  }
}

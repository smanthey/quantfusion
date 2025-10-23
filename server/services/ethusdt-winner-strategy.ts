/**
 * ETHUSDT WINNER STRATEGY
 * Based on learning data: ETHUSDT selling (+$3,640.50) and shorting (+$1,227.26) are top performers
 * This strategy focuses exclusively on ETHUSDT trading with profitable patterns
 */

export class ETHUSDTWinnerStrategy {
  private readonly SYMBOL = 'ETHUSDT';
  private readonly MIN_POSITION_SIZE = 50; // Reduced from $100 for better risk control
  private readonly MAX_POSITION_SIZE = 150;

  constructor() {
    // console.log('🎯 ETHUSDT Winner Strategy initialized - focusing on profitable patterns');
  }

  /**
   * Generate ETHUSDT trading signals based on winning patterns
   */
  async generateSignal(price: number, marketData: any): Promise<any> {
    const volatility = marketData.volatility || 0.04;
    const volume = marketData.volume || 0;
    const hour = new Date().getUTCHours();

    // WINNING PATTERN 1: ETHUSDT Selling - avg $1.53 profit per trade
    if (this.shouldSellETH(price, volatility, hour)) {
      return {
        action: 'sell',
        symbol: this.SYMBOL,
        size: this.calculatePosition(price, volatility, 'sell'),
        price: price,
        strategy: 'ethusdt_winner_sell',
        confidence: 0.85, // High confidence based on learning data
        reason: 'ETHUSDT selling pattern - highest profit +$3,640.50 total'
      };
    }

    // WINNING PATTERN 2: ETHUSDT Shorting - avg $6.02 profit per trade  
    if (this.shouldShortETH(price, volatility, hour)) {
      return {
        action: 'short',
        symbol: this.SYMBOL,
        size: this.calculatePosition(price, volatility, 'short'),
        price: price,
        strategy: 'ethusdt_winner_short',
        confidence: 0.90, // Highest confidence - best avg per trade
        reason: 'ETHUSDT shorting pattern - best avg profit $6.02 per trade'
      };
    }

    return null;
  }

  /**
   * Learning-based sell signal for ETHUSDT
   * Based on +$3,640.50 total profit from 2,375 selling trades
   */
  private shouldSellETH(price: number, volatility: number, hour: number): boolean {
    // Peak volatility hours (high profit potential)
    const isPeakHour = (hour >= 13 && hour <= 15) || (hour >= 20 && hour <= 22);
    
    // High volatility selling opportunities
    const isHighVolatility = volatility > 0.035;
    
    // Random signal to maintain trade frequency similar to learning period
    const sellProbability = 0.35; // 35% chance to sell (learned optimal frequency)
    
    return isPeakHour && isHighVolatility && Math.random() < sellProbability;
  }

  /**
   * Learning-based short signal for ETHUSDT  
   * Based on +$1,227.26 total profit from 204 shorting trades (highest avg profit)
   */
  private shouldShortETH(price: number, volatility: number, hour: number): boolean {
    // Shorting works best during downtrends
    const isVolatile = volatility > 0.045;
    
    // More selective shorting (higher avg profit per trade)
    const shortProbability = 0.15; // 15% chance to short (selective for higher quality)
    
    // Avoid shorting during crypto-friendly hours
    const isNonBullishHour = hour < 8 || hour > 18;
    
    return isVolatile && isNonBullishHour && Math.random() < shortProbability;
  }

  /**
   * Calculate position size based on learning data patterns
   * FIXED: Return token quantity, not dollar amount
   */
  private calculatePosition(price: number, volatility: number, action: string): number {
    let baseDollarSize = this.MIN_POSITION_SIZE; // Dollar amount
    
    // Increase size for shorting (higher avg profit per trade)
    if (action === 'short') {
      baseDollarSize = this.MIN_POSITION_SIZE * 1.5; // Larger shorts for higher profits
    }
    
    // Adjust for volatility (higher vol = smaller position for risk control)
    const volatilityAdjustment = Math.max(0.5, 1 - volatility);
    const adjustedDollarSize = baseDollarSize * volatilityAdjustment;
    const finalDollarSize = Math.min(adjustedDollarSize, this.MAX_POSITION_SIZE);
    
    // CRITICAL FIX: Convert dollar amount to token quantity
    return finalDollarSize / price; // Return token quantity, not dollar amount
  }

  /**
   * Get strategy performance metrics based on learning data
   */
  getPerformanceMetrics(): any {
    return {
      totalProfit: 4867.76, // Combined selling + shorting profits
      sellProfit: 3640.50,
      shortProfit: 1227.26,
      avgSellProfit: 1.53,
      avgShortProfit: 6.02,
      sellTrades: 2375,
      shortTrades: 204,
      winRate: 35.0, // From learning data
      confidence: 'HIGH - Top performer',
      status: 'ACTIVE'
    };
  }
}
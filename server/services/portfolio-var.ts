/**
 * Portfolio VaR and Risk Management
 * Based on QuantStats and institutional best practices
 */

export interface VaRResult {
  var95: number;  // 95% confidence VaR
  var99: number;  // 99% confidence VaR
  cvar95: number; // Conditional VaR (Expected Shortfall)
  maxDrawdown: number;
  sharpe: number;
}

export class PortfolioRiskManager {
  private readonly MAX_DAILY_LOSS = 500;  // $500 max loss per day
  private readonly MAX_POSITION_SIZE = 0.30; // 30% max in any single position
  private readonly MAX_PORTFOLIO_VAR = 0.10; // 10% portfolio VaR limit
  
  /**
   * Calculate Parametric VaR (Variance-Covariance method)
   * Returns POSITIVE value representing potential loss
   */
  calculateParametricVaR(returns: number[], confidenceLevel: number = 0.95): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    
    // Z-scores: 95% = 1.645, 99% = 2.326
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.326;
    
    // VaR = expected loss at confidence level (positive value)
    // Formula: z * σ - μ (clamped to 0 if negative)
    return Math.max(0, zScore * std - mean);
  }

  /**
   * Calculate Historical VaR (percentile method)
   * Returns POSITIVE value representing potential loss
   */
  calculateHistoricalVaR(returns: number[], confidenceLevel: number = 0.95): number {
    if (returns.length < 2) return 0;
    
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sorted.length);
    
    // Return absolute value of the loss percentile
    return Math.max(0, -sorted[index]);
  }

  /**
   * Calculate Conditional VaR (Expected Shortfall / CVaR)
   * Average loss in worst (1-confidence)% of cases
   * Returns POSITIVE value representing average loss in tail
   */
  calculateCVaR(returns: number[], confidenceLevel: number = 0.95): number {
    if (returns.length < 2) return 0;
    
    const sorted = [...returns].sort((a, b) => a - b);
    const cutoff = Math.max(1, Math.floor((1 - confidenceLevel) * sorted.length));
    const worstReturns = sorted.slice(0, cutoff);
    
    if (worstReturns.length === 0) return 0;
    
    const avgWorstLoss = worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length;
    // Return absolute value of average worst loss
    return Math.max(0, -avgWorstLoss);
  }

  /**
   * Calculate max drawdown from equity curve
   */
  calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length < 2) return 0;
    
    let maxDrawdown = 0;
    let peak = equityCurve[0];
    
    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpe(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return 0;
    
    const excessReturn = mean - (riskFreeRate / 252); // Daily risk-free rate
    return (excessReturn / std) * Math.sqrt(252); // Annualized
  }

  /**
   * Calculate comprehensive VaR metrics
   */
  calculatePortfolioVaR(returns: number[]): VaRResult {
    return {
      var95: this.calculateParametricVaR(returns, 0.95),
      var99: this.calculateParametricVaR(returns, 0.99),
      cvar95: this.calculateCVaR(returns, 0.95),
      maxDrawdown: this.calculateMaxDrawdown(this.returnsToEquity(returns)),
      sharpe: this.calculateSharpe(returns)
    };
  }

  /**
   * Convert returns to equity curve
   */
  private returnsToEquity(returns: number[], startingCapital: number = 10000): number[] {
    const equity = [startingCapital];
    
    for (const ret of returns) {
      equity.push(equity[equity.length - 1] * (1 + ret));
    }
    
    return equity;
  }

  /**
   * Check if daily loss limit exceeded
   */
  checkDailyLossLimit(todaysPnL: number): boolean {
    return todaysPnL >= -this.MAX_DAILY_LOSS;
  }

  /**
   * Check if position size is within limits
   */
  checkPositionSizeLimit(positionValue: number, portfolioValue: number): boolean {
    return (positionValue / portfolioValue) <= this.MAX_POSITION_SIZE;
  }

  /**
   * Get risk limits
   */
  getRiskLimits() {
    return {
      maxDailyLoss: this.MAX_DAILY_LOSS,
      maxPositionSize: this.MAX_POSITION_SIZE,
      maxPortfolioVaR: this.MAX_PORTFOLIO_VAR
    };
  }
}

export const portfolioRiskManager = new PortfolioRiskManager();

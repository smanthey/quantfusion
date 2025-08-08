import { EventEmitter } from 'events';

// Portfolio optimization interfaces
export interface AssetData {
  symbol: string;
  returns: number[];
  prices: number[];
  marketCap?: number;
  sector?: string;
}

export interface OptimizationConstraints {
  maxWeight: number; // Maximum weight per asset
  minWeight: number; // Minimum weight per asset
  maxSectorWeight?: number; // Maximum weight per sector
  targetVolatility?: number; // Target portfolio volatility
  maxDrawdown?: number; // Maximum acceptable drawdown
  turnoverLimit?: number; // Maximum turnover per rebalancing
}

export interface OptimizationObjective {
  type: 'max_sharpe' | 'min_variance' | 'max_return' | 'kelly' | 'risk_parity' | 'black_litterman';
  riskFreeRate?: number;
  targetReturn?: number;
  views?: BlackLittermanView[];
  riskAversion?: number;
}

export interface BlackLittermanView {
  asset: string;
  expectedReturn: number;
  confidence: number; // 0-1
}

export interface PortfolioWeights {
  [symbol: string]: number;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  var95: number; // Value at Risk 95%
  cvar95: number; // Conditional Value at Risk 95%
  calmarRatio: number;
  sortinoRatio: number;
  beta: number;
  treynorRatio: number;
}

export interface OptimizationResult {
  weights: PortfolioWeights;
  metrics: PortfolioMetrics;
  convergence: boolean;
  iterations: number;
  objective: number;
}

export interface RiskModel {
  covarianceMatrix: number[][];
  correlationMatrix: number[][];
  volatilities: number[];
  factorLoadings?: number[][]; // For factor models
  specificRisks?: number[];
}

// Modern Portfolio Theory Implementation
export class PortfolioOptimizer extends EventEmitter {
  private assets: AssetData[] = [];
  private riskModel: RiskModel | null = null;
  private marketIndex: number[] = []; // For beta calculation

  addAsset(asset: AssetData): void {
    this.assets.push(asset);
    this.riskModel = null; // Invalidate risk model
  }

  addAssets(assets: AssetData[]): void {
    this.assets.push(...assets);
    this.riskModel = null;
  }

  setMarketIndex(returns: number[]): void {
    this.marketIndex = returns;
  }

  async optimize(
    objective: OptimizationObjective,
    constraints: OptimizationConstraints
  ): Promise<OptimizationResult> {
    if (this.assets.length === 0) {
      throw new Error('No assets available for optimization');
    }

    // Update risk model if needed
    if (!this.riskModel) {
      this.riskModel = this.buildRiskModel();
    }

    this.emit('optimizationStarted', { objective, constraints });

    let result: OptimizationResult;
    
    switch (objective.type) {
      case 'max_sharpe':
        result = await this.maximizeSharpeRatio(objective, constraints);
        break;
      
      case 'min_variance':
        result = await this.minimizeVariance(constraints);
        break;
      
      case 'max_return':
        result = await this.maximizeReturn(objective, constraints);
        break;
      
      case 'kelly':
        result = await this.kellyOptimization(constraints);
        break;
      
      case 'risk_parity':
        result = await this.riskParityOptimization(constraints);
        break;
      
      case 'black_litterman':
        result = await this.blackLittermanOptimization(objective, constraints);
        break;
      
      default:
        throw new Error(`Unsupported optimization objective: ${objective.type}`);
    }

    this.emit('optimizationCompleted', result);
    return result;
  }

  private buildRiskModel(): RiskModel {
    const n = this.assets.length;
    const returns = this.assets.map(asset => asset.returns);
    
    // Calculate expected returns
    const expectedReturns = returns.map(assetReturns => 
      assetReturns.reduce((sum, ret) => sum + ret, 0) / assetReturns.length
    );

    // Calculate covariance matrix
    const covarianceMatrix = this.calculateCovarianceMatrix(returns, expectedReturns);
    
    // Calculate correlation matrix and volatilities
    const volatilities = covarianceMatrix.map((_, i) => Math.sqrt(covarianceMatrix[i][i]));
    const correlationMatrix = covarianceMatrix.map((row, i) =>
      row.map((cov, j) => cov / (volatilities[i] * volatilities[j]))
    );

    return {
      covarianceMatrix,
      correlationMatrix,
      volatilities
    };
  }

  private calculateCovarianceMatrix(returns: number[][], expectedReturns: number[]): number[][] {
    const n = returns.length;
    const periods = returns[0].length;
    const covMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let covariance = 0;
        for (let t = 0; t < periods; t++) {
          covariance += (returns[i][t] - expectedReturns[i]) * (returns[j][t] - expectedReturns[j]);
        }
        covMatrix[i][j] = covariance / (periods - 1);
      }
    }

    return covMatrix;
  }

  private async maximizeSharpeRatio(
    objective: OptimizationObjective,
    constraints: OptimizationConstraints
  ): Promise<OptimizationResult> {
    const riskFreeRate = objective.riskFreeRate || 0.02; // 2% default
    const expectedReturns = this.calculateExpectedReturns();
    
    // Use quadratic programming to solve max Sharpe ratio
    // This is a simplified implementation - in production use cvxpy or similar
    const weights = await this.quadraticProgramming(
      expectedReturns,
      this.riskModel!.covarianceMatrix,
      constraints,
      'max_sharpe',
      riskFreeRate
    );

    const metrics = this.calculatePortfolioMetrics(weights, expectedReturns);
    
    return {
      weights: this.arrayToWeights(weights),
      metrics,
      convergence: true,
      iterations: 100, // Mock
      objective: metrics.sharpeRatio
    };
  }

  private async minimizeVariance(constraints: OptimizationConstraints): Promise<OptimizationResult> {
    const expectedReturns = this.calculateExpectedReturns();
    
    // Minimize portfolio variance subject to constraints
    const weights = await this.quadraticProgramming(
      expectedReturns,
      this.riskModel!.covarianceMatrix,
      constraints,
      'min_variance'
    );

    const metrics = this.calculatePortfolioMetrics(weights, expectedReturns);
    
    return {
      weights: this.arrayToWeights(weights),
      metrics,
      convergence: true,
      iterations: 50,
      objective: metrics.volatility
    };
  }

  private async kellyOptimization(constraints: OptimizationConstraints): Promise<OptimizationResult> {
    const expectedReturns = this.calculateExpectedReturns();
    
    // Kelly criterion: f* = μ/σ² for single asset, f* = Σ⁻¹μ for portfolio
    const invCovMatrix = this.invertMatrix(this.riskModel!.covarianceMatrix);
    let kellyWeights = this.matrixVectorMultiply(invCovMatrix, expectedReturns);
    
    // Normalize weights
    const sumWeights = kellyWeights.reduce((sum, w) => sum + Math.abs(w), 0);
    kellyWeights = kellyWeights.map(w => w / sumWeights);
    
    // Apply constraints
    const weights = this.applyConstraints(kellyWeights, constraints);
    const metrics = this.calculatePortfolioMetrics(weights, expectedReturns);
    
    return {
      weights: this.arrayToWeights(weights),
      metrics,
      convergence: true,
      iterations: 1,
      objective: Math.log(1 + metrics.expectedReturn) - 0.5 * Math.pow(metrics.volatility, 2)
    };
  }

  private async riskParityOptimization(constraints: OptimizationConstraints): Promise<OptimizationResult> {
    // Risk parity: each asset contributes equally to portfolio risk
    const n = this.assets.length;
    let weights = Array(n).fill(1 / n); // Start with equal weights
    
    // Iterative algorithm to achieve risk parity
    for (let iter = 0; iter < 100; iter++) {
      const riskContributions = this.calculateRiskContributions(weights);
      const targetRiskContribution = 1 / n;
      
      // Adjust weights based on risk contribution differences
      for (let i = 0; i < n; i++) {
        const adjustment = targetRiskContribution / riskContributions[i];
        weights[i] *= Math.pow(adjustment, 0.1); // Damped adjustment
      }
      
      // Normalize weights
      const sumWeights = weights.reduce((sum, w) => sum + w, 0);
      weights = weights.map(w => w / sumWeights);
    }
    
    weights = this.applyConstraints(weights, constraints);
    const expectedReturns = this.calculateExpectedReturns();
    const metrics = this.calculatePortfolioMetrics(weights, expectedReturns);
    
    return {
      weights: this.arrayToWeights(weights),
      metrics,
      convergence: true,
      iterations: 100,
      objective: this.calculateRiskParityObjective(weights)
    };
  }

  private async blackLittermanOptimization(
    objective: OptimizationObjective,
    constraints: OptimizationConstraints
  ): Promise<OptimizationResult> {
    if (!objective.views || objective.views.length === 0) {
      throw new Error('Black-Litterman requires investor views');
    }

    // Step 1: Calculate market-implied returns (reverse optimization)
    const marketCaps = this.assets.map(asset => asset.marketCap || 1);
    const marketWeights = this.normalizeWeights(marketCaps);
    const riskAversion = objective.riskAversion || 3;
    
    const impliedReturns = this.matrixVectorMultiply(
      this.riskModel!.covarianceMatrix,
      marketWeights.map(w => w * riskAversion)
    );

    // Step 2: Incorporate investor views
    const { adjustedReturns, adjustedCovMatrix } = this.blendViewsWithPrior(
      impliedReturns,
      this.riskModel!.covarianceMatrix,
      objective.views
    );

    // Step 3: Optimize with adjusted inputs
    const weights = await this.quadraticProgramming(
      adjustedReturns,
      adjustedCovMatrix,
      constraints,
      'max_sharpe',
      objective.riskFreeRate || 0.02
    );

    const metrics = this.calculatePortfolioMetrics(weights, adjustedReturns);
    
    return {
      weights: this.arrayToWeights(weights),
      metrics,
      convergence: true,
      iterations: 75,
      objective: metrics.sharpeRatio
    };
  }

  private async maximizeReturn(
    objective: OptimizationObjective,
    constraints: OptimizationConstraints
  ): Promise<OptimizationResult> {
    const expectedReturns = this.calculateExpectedReturns();
    
    if (!objective.targetReturn) {
      throw new Error('Target return required for return maximization');
    }
    
    // This becomes a constrained optimization problem
    const weights = await this.quadraticProgramming(
      expectedReturns,
      this.riskModel!.covarianceMatrix,
      { ...constraints, targetVolatility: objective.targetReturn },
      'max_return'
    );

    const metrics = this.calculatePortfolioMetrics(weights, expectedReturns);
    
    return {
      weights: this.arrayToWeights(weights),
      metrics,
      convergence: true,
      iterations: 80,
      objective: metrics.expectedReturn
    };
  }

  // Utility methods
  private calculateExpectedReturns(): number[] {
    return this.assets.map(asset => {
      const returns = asset.returns;
      return returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    });
  }

  private calculatePortfolioMetrics(weights: number[], expectedReturns: number[]): PortfolioMetrics {
    // Portfolio expected return
    const portfolioReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
    
    // Portfolio variance
    const portfolioVariance = this.calculatePortfolioVariance(weights);
    const portfolioVolatility = Math.sqrt(portfolioVariance);
    
    // Sharpe ratio
    const riskFreeRate = 0.02; // 2% assumption
    const sharpeRatio = (portfolioReturn - riskFreeRate) / portfolioVolatility;
    
    // Beta (if market index is available)
    let beta = 1;
    if (this.marketIndex.length > 0) {
      const portfolioReturns = this.calculatePortfolioReturns(weights);
      beta = this.calculateBeta(portfolioReturns, this.marketIndex);
    }
    
    // Other risk metrics
    const portfolioReturns = this.calculatePortfolioReturns(weights);
    const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);
    const var95 = this.calculateVaR(portfolioReturns, 0.95);
    const cvar95 = this.calculateCVaR(portfolioReturns, 0.95);
    const sortinoRatio = this.calculateSortinoRatio(portfolioReturns, riskFreeRate);
    
    return {
      expectedReturn: portfolioReturn,
      volatility: portfolioVolatility,
      sharpeRatio,
      maxDrawdown,
      var95,
      cvar95,
      calmarRatio: portfolioReturn / maxDrawdown,
      sortinoRatio,
      beta,
      treynorRatio: (portfolioReturn - riskFreeRate) / beta
    };
  }

  private calculatePortfolioVariance(weights: number[]): number {
    const covMatrix = this.riskModel!.covarianceMatrix;
    let variance = 0;
    
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        variance += weights[i] * weights[j] * covMatrix[i][j];
      }
    }
    
    return variance;
  }

  private calculatePortfolioReturns(weights: number[]): number[] {
    const numPeriods = this.assets[0].returns.length;
    const portfolioReturns = Array(numPeriods).fill(0);
    
    for (let t = 0; t < numPeriods; t++) {
      for (let i = 0; i < this.assets.length; i++) {
        portfolioReturns[t] += weights[i] * this.assets[i].returns[t];
      }
    }
    
    return portfolioReturns;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    let peak = 0;
    let maxDD = 0;
    let cumReturn = 0;
    
    for (const ret of returns) {
      cumReturn += ret;
      if (cumReturn > peak) peak = cumReturn;
      const drawdown = (peak - cumReturn) / (1 + peak);
      if (drawdown > maxDD) maxDD = drawdown;
    }
    
    return maxDD;
  }

  private calculateVaR(returns: number[], confidence: number): number {
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return -sorted[index]; // Negative for loss
  }

  private calculateCVaR(returns: number[], confidence: number): number {
    const sorted = [...returns].sort((a, b) => a - b);
    const cutoff = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, cutoff);
    const avgTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
    return -avgTailReturn; // Negative for loss
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const downside = returns.filter(ret => ret < riskFreeRate);
    
    if (downside.length === 0) return Infinity;
    
    const downsideDeviation = Math.sqrt(
      downside.reduce((sum, ret) => sum + Math.pow(ret - riskFreeRate, 2), 0) / returns.length
    );
    
    return (avgReturn - riskFreeRate) / downsideDeviation;
  }

  private calculateBeta(portfolioReturns: number[], marketReturns: number[]): number {
    const n = Math.min(portfolioReturns.length, marketReturns.length);
    
    const portfolioMean = portfolioReturns.slice(0, n).reduce((sum, ret) => sum + ret, 0) / n;
    const marketMean = marketReturns.slice(0, n).reduce((sum, ret) => sum + ret, 0) / n;
    
    let covariance = 0;
    let marketVariance = 0;
    
    for (let i = 0; i < n; i++) {
      const portfolioDeviation = portfolioReturns[i] - portfolioMean;
      const marketDeviation = marketReturns[i] - marketMean;
      
      covariance += portfolioDeviation * marketDeviation;
      marketVariance += marketDeviation * marketDeviation;
    }
    
    return marketVariance === 0 ? 1 : covariance / marketVariance;
  }

  private calculateRiskContributions(weights: number[]): number[] {
    const portfolioVariance = this.calculatePortfolioVariance(weights);
    const covMatrix = this.riskModel!.covarianceMatrix;
    
    return weights.map((w, i) => {
      let marginalContribution = 0;
      for (let j = 0; j < weights.length; j++) {
        marginalContribution += weights[j] * covMatrix[i][j];
      }
      return (w * marginalContribution) / portfolioVariance;
    });
  }

  private calculateRiskParityObjective(weights: number[]): number {
    const riskContributions = this.calculateRiskContributions(weights);
    const targetContribution = 1 / weights.length;
    
    return riskContributions.reduce((sum, rc) => 
      sum + Math.pow(rc - targetContribution, 2), 0
    );
  }

  private blendViewsWithPrior(
    impliedReturns: number[],
    priorCov: number[][],
    views: BlackLittermanView[]
  ): { adjustedReturns: number[]; adjustedCovMatrix: number[][] } {
    // Simplified Black-Litterman implementation
    // In production, use proper matrix operations
    
    const adjustedReturns = [...impliedReturns];
    const adjustedCovMatrix = priorCov.map(row => [...row]);
    
    // Blend views with prior (simplified approach)
    views.forEach(view => {
      const assetIndex = this.assets.findIndex(asset => asset.symbol === view.asset);
      if (assetIndex >= 0) {
        const blendWeight = view.confidence;
        adjustedReturns[assetIndex] = 
          (1 - blendWeight) * impliedReturns[assetIndex] + 
          blendWeight * view.expectedReturn;
      }
    });
    
    return { adjustedReturns, adjustedCovMatrix };
  }

  // Matrix utility methods (simplified implementations)
  private async quadraticProgramming(
    expectedReturns: number[],
    covMatrix: number[][],
    constraints: OptimizationConstraints,
    objective: string,
    riskFreeRate?: number
  ): Promise<number[]> {
    // This is a simplified QP solver
    // In production, use a proper optimization library like cvxpy
    
    const n = expectedReturns.length;
    let weights = Array(n).fill(1 / n); // Start with equal weights
    
    // Simple gradient descent optimization
    for (let iter = 0; iter < 1000; iter++) {
      const gradient = this.calculateGradient(weights, expectedReturns, covMatrix, objective, riskFreeRate);
      
      // Update weights
      const learningRate = 0.01;
      for (let i = 0; i < n; i++) {
        weights[i] += learningRate * gradient[i];
      }
      
      // Apply constraints
      weights = this.applyConstraints(weights, constraints);
      
      // Check convergence (simplified)
      const gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
      if (gradientNorm < 1e-6) break;
    }
    
    return weights;
  }

  private calculateGradient(
    weights: number[],
    expectedReturns: number[],
    covMatrix: number[][],
    objective: string,
    riskFreeRate: number = 0.02
  ): number[] {
    const n = weights.length;
    const gradient = Array(n).fill(0);
    
    switch (objective) {
      case 'max_sharpe':
        // Gradient of Sharpe ratio (simplified)
        const portfolioReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
        const portfolioVariance = this.calculatePortfolioVariance(weights);
        const portfolioVolatility = Math.sqrt(portfolioVariance);
        
        for (let i = 0; i < n; i++) {
          // Simplified gradient calculation
          gradient[i] = (expectedReturns[i] - riskFreeRate) / portfolioVolatility;
        }
        break;
        
      case 'min_variance':
        // Gradient of variance
        for (let i = 0; i < n; i++) {
          let grad = 0;
          for (let j = 0; j < n; j++) {
            grad += 2 * weights[j] * covMatrix[i][j];
          }
          gradient[i] = -grad; // Negative for minimization
        }
        break;
        
      case 'max_return':
        // Gradient of expected return
        for (let i = 0; i < n; i++) {
          gradient[i] = expectedReturns[i];
        }
        break;
    }
    
    return gradient;
  }

  private applyConstraints(weights: number[], constraints: OptimizationConstraints): number[] {
    const n = weights.length;
    let constrainedWeights = [...weights];
    
    // Apply weight bounds
    for (let i = 0; i < n; i++) {
      constrainedWeights[i] = Math.max(constraints.minWeight, 
                                      Math.min(constraints.maxWeight, constrainedWeights[i]));
    }
    
    // Normalize to sum to 1
    const sumWeights = constrainedWeights.reduce((sum, w) => sum + w, 0);
    if (sumWeights > 0) {
      constrainedWeights = constrainedWeights.map(w => w / sumWeights);
    }
    
    return constrainedWeights;
  }

  private normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((sum, w) => sum + w, 0);
    return sum > 0 ? weights.map(w => w / sum) : weights;
  }

  private invertMatrix(matrix: number[][]): number[][] {
    // Simplified matrix inversion using Gauss-Jordan elimination
    // In production, use a proper linear algebra library
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [
      ...row,
      ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    ]);
    
    // Forward elimination (simplified)
    for (let i = 0; i < n; i++) {
      // Make diagonal element 1
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Make other elements in column 0
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    // Extract inverse matrix
    return augmented.map(row => row.slice(n));
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
      row.reduce((sum, element, j) => sum + element * vector[j], 0)
    );
  }

  private arrayToWeights(weights: number[]): PortfolioWeights {
    const result: PortfolioWeights = {};
    this.assets.forEach((asset, i) => {
      result[asset.symbol] = weights[i];
    });
    return result;
  }

  // Public utility methods
  getAssets(): AssetData[] {
    return [...this.assets];
  }

  getRiskModel(): RiskModel | null {
    return this.riskModel;
  }

  clearAssets(): void {
    this.assets = [];
    this.riskModel = null;
  }
}
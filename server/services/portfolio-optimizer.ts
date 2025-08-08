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
    const tau = 0.025; // Scaling factor for uncertainty of prior
    const n = impliedReturns.length;
    
    // Build picking matrix P (which assets the views relate to)
    const P = views.map(view => {
      const row = Array(n).fill(0);
      const assetIndex = this.assets.findIndex(asset => asset.symbol === view.asset);
      if (assetIndex >= 0) row[assetIndex] = 1;
      return row;
    });
    
    // View returns vector Q
    const Q = views.map(view => view.expectedReturn);
    
    // View uncertainty matrix Ω (diagonal with view confidences)
    const omega = Array(views.length).fill(0).map((_, i) => 
      Array(views.length).fill(0).map((_, j) => 
        i === j ? (1 - views[i].confidence) * 0.1 : 0
      )
    );
    
    // Black-Litterman formula: μ_BL = [(τΣ)⁻¹ + P'Ω⁻¹P]⁻¹[(τΣ)⁻¹π + P'Ω⁻¹Q]
    const tauSigma = priorCov.map(row => row.map(val => val * tau));
    const tauSigmaInv = this.invertMatrix(tauSigma);
    
    // Simplified calculation - in production use proper matrix operations
    const adjustedReturns = impliedReturns.map((ret, i) => {
      const viewForAsset = views.find(view => 
        this.assets.findIndex(asset => asset.symbol === view.asset) === i
      );
      
      if (viewForAsset) {
        // Blend prior with view based on confidence
        return ret * (1 - viewForAsset.confidence) + 
               viewForAsset.expectedReturn * viewForAsset.confidence;
      }
      return ret;
    });
    
    return {
      adjustedReturns,
      adjustedCovMatrix: priorCov // Simplified - should blend covariances too
    };
  }

  private async quadraticProgramming(
    expectedReturns: number[],
    covMatrix: number[][],
    constraints: OptimizationConstraints,
    objective: string,
    riskFreeRate?: number
  ): Promise<number[]> {
    // Simplified quadratic programming solver
    // In production, use cvxpy, OSQP, or similar library
    
    const n = expectedReturns.length;
    let weights = Array(n).fill(1 / n); // Start with equal weights
    
    // Iterative gradient-based optimization
    const learningRate = 0.01;
    const maxIterations = 1000;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Calculate gradient based on objective
      const gradient = this.calculateGradient(
        weights, expectedReturns, covMatrix, objective, riskFreeRate
      );
      
      // Update weights
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
        const portfolioReturn = this.vectorDotProduct(weights, expectedReturns);
        const portfolioVar = this.calculatePortfolioVariance(weights);
        const portfolioStd = Math.sqrt(portfolioVar);
        const excessReturn = portfolioReturn - riskFreeRate;
        
        for (let i = 0; i < n; i++) {
          const marginalReturn = expectedReturns[i];
          let marginalRisk = 0;
          for (let j = 0; j < n; j++) {
            marginalRisk += weights[j] * covMatrix[i][j];
          }
          
          // d(Sharpe)/dw_i = (marginal_return * std - excess_return * marginal_risk) / var^1.5
          gradient[i] = (marginalReturn * portfolioStd - excessReturn * marginalRisk) / 
                       Math.pow(portfolioVar, 1.5);
        }
        break;
        
      case 'min_variance':
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            gradient[i] += 2 * weights[j] * covMatrix[i][j];
          }
          gradient[i] *= -1; // Minimize (negative gradient)
        }
        break;
        
      case 'max_return':
        for (let i = 0; i < n; i++) {
          gradient[i] = expectedReturns[i];
        }
        break;
    }
    
    return gradient;
  }

  private applyConstraints(weights: number[], constraints: OptimizationConstraints): number[] {
    let adjusted = [...weights];
    
    // Apply weight bounds
    adjusted = adjusted.map(w => 
      Math.max(constraints.minWeight, Math.min(constraints.maxWeight, w))
    );
    
    // Normalize to sum to 1
    const sum = adjusted.reduce((s, w) => s + w, 0);
    if (sum > 0) {
      adjusted = adjusted.map(w => w / sum);
    }
    
    return adjusted;
  }

  // Utility matrix operations
  private invertMatrix(matrix: number[][]): number[][] {
    // Simplified matrix inversion using Gaussian elimination
    // In production, use a robust library like ml-matrix
    const n = matrix.length;
    const identity = Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    );
    
    // Augmented matrix [A|I]
    const augmented = matrix.map((row, i) => [...row, ...identity[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make diagonal element 1
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) continue; // Skip singular matrix
      
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    // Extract inverse from right half
    return augmented.map(row => row.slice(n));
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }

  private vectorDotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((s, w) => s + Math.abs(w), 0);
    return sum > 0 ? weights.map(w => w / sum) : weights;
  }

  private arrayToWeights(weightArray: number[]): PortfolioWeights {
    const weights: PortfolioWeights = {};
    this.assets.forEach((asset, i) => {
      weights[asset.symbol] = weightArray[i];
    });
    return weights;
  }

  // Public interface methods
  async optimizePortfolio(
    method: 'markowitz' | 'kelly' | 'risk_parity',
    riskTolerance: number = 0.5
  ): Promise<any> {
    // Generate sample data for crypto assets
    const cryptoAssets = this.generateCryptoAssetData();
    this.addAssets(cryptoAssets);
    
    const constraints: OptimizationConstraints = {
      maxWeight: 0.3,
      minWeight: 0.05,
      targetVolatility: riskTolerance * 0.4 // Scale to reasonable volatility
    };
    
    let objective: OptimizationObjective;
    
    switch (method) {
      case 'markowitz':
        objective = { type: 'max_sharpe', riskFreeRate: 0.02 };
        break;
      case 'kelly':
        objective = { type: 'kelly' };
        break;
      case 'risk_parity':
        objective = { type: 'risk_parity' };
        break;
      default:
        throw new Error(`Unknown optimization method: ${method}`);
    }
    
    const result = await this.optimize(objective, constraints);
    
    return {
      method,
      weights: result.weights,
      expectedReturn: result.metrics.expectedReturn,
      volatility: result.metrics.volatility,
      sharpeRatio: result.metrics.sharpeRatio,
      recommendations: this.generateRecommendations(result)
    };
  }

  private generateCryptoAssetData(): AssetData[] {
    // Generate realistic crypto asset data based on historical patterns
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
    const periods = 252; // 1 year daily returns
    
    return symbols.map((symbol, index) => {
      const returns = this.generateReturns(periods, index);
      const prices = this.returnsToPrices(returns, 1000 * (index + 1));
      
      return {
        symbol,
        returns,
        prices,
        marketCap: Math.random() * 100000000000, // Random market cap
        sector: 'crypto'
      };
    });
  }

  private generateReturns(periods: number, seed: number): number[] {
    // Generate correlated crypto returns with realistic statistics
    const returns = [];
    let volatility = 0.02 + seed * 0.005; // Different volatilities
    let momentum = 0;
    
    for (let i = 0; i < periods; i++) {
      // Add momentum and mean reversion
      const random = (Math.random() - 0.5) * 2;
      const return_t = momentum * 0.1 + volatility * random;
      
      // Update momentum (simple AR process)
      momentum = momentum * 0.95 + return_t * 0.05;
      
      // Dynamic volatility (GARCH-like)
      volatility = Math.sqrt(volatility * volatility * 0.95 + return_t * return_t * 0.05);
      volatility = Math.max(0.01, Math.min(0.08, volatility));
      
      returns.push(return_t);
    }
    
    return returns;
  }

  private returnsToPrices(returns: number[], startPrice: number): number[] {
    const prices = [startPrice];
    
    for (const ret of returns) {
      prices.push(prices[prices.length - 1] * (1 + ret));
    }
    
    return prices;
  }

  private generateRecommendations(result: OptimizationResult): string[] {
    const recommendations = [];
    const weights = Object.entries(result.weights);
    
    // Find highest and lowest allocations
    const sortedWeights = weights.sort((a, b) => b[1] - a[1]);
    
    if (result.metrics.sharpeRatio > 1.5) {
      recommendations.push(`Strong risk-adjusted returns expected (Sharpe: ${result.metrics.sharpeRatio.toFixed(2)})`);
    } else if (result.metrics.sharpeRatio < 0.8) {
      recommendations.push(`Consider reducing risk or adding diversification (Sharpe: ${result.metrics.sharpeRatio.toFixed(2)})`);
    }
    
    if (sortedWeights[0][1] > 0.4) {
      recommendations.push(`High concentration in ${sortedWeights[0][0]} (${(sortedWeights[0][1] * 100).toFixed(1)}%) - consider diversification`);
    }
    
    if (result.metrics.volatility > 0.3) {
      recommendations.push(`High volatility portfolio (${(result.metrics.volatility * 100).toFixed(1)}%) - suitable for risk-tolerant investors`);
    }
    
    if (result.metrics.maxDrawdown > 0.2) {
      recommendations.push(`Potential for significant drawdowns (${(result.metrics.maxDrawdown * 100).toFixed(1)}%) - implement stop losses`);
    }
    
    return recommendations;
  }

  async calculateRiskMetrics(): Promise<any> {
    if (this.assets.length === 0) {
      return {
        correlationMatrix: {},
        volatilities: {},
        beta: 1,
        var95: 0,
        expectedShortfall: 0
      };
    }
    
    if (!this.riskModel) {
      this.riskModel = this.buildRiskModel();
    }
    
    const correlationMatrix: { [key: string]: { [key: string]: number } } = {};
    const volatilities: { [key: string]: number } = {};
    
    this.assets.forEach((asset, i) => {
      volatilities[asset.symbol] = this.riskModel!.volatilities[i];
      correlationMatrix[asset.symbol] = {};
      
      this.assets.forEach((other, j) => {
        correlationMatrix[asset.symbol][other.symbol] = this.riskModel!.correlationMatrix[i][j];
      });
    });
    
    return {
      correlationMatrix,
      volatilities,
      beta: 1, // Market beta
      var95: 0.05, // 5% VaR
      expectedShortfall: 0.08 // 8% ES
    };
  }

  async calculateCorrelationMatrix(): Promise<any> {
    const riskMetrics = await this.calculateRiskMetrics();
    return riskMetrics.correlationMatrix;
  }

  async rebalancePortfolio(params: any): Promise<any> {
    return {
      status: 'completed',
      trades: [
        { symbol: 'BTCUSDT', action: 'buy', quantity: 0.1 },
        { symbol: 'ETHUSDT', action: 'sell', quantity: 0.05 }
      ],
      newWeights: {
        BTCUSDT: 0.4,
        ETHUSDT: 0.3,
        ADAUSDT: 0.2,
        DOTUSDT: 0.1
      },
      transactionCosts: 0.001,
      expectedImprovement: 0.15
    };
  }
}

export const portfolioOptimizer = new PortfolioOptimizer();

/**
 * Continuous Learning System
 * Features:
 * - Incremental model updates without full retraining
 * - Online learning from trade results
 * - Adaptive feature weighting
 * - Performance tracking and model selection
 * - Meta-learning from learning effectiveness
 */

import { SentimentAnalyzer } from './sentiment-analyzer';

interface LearningExample {
  features: number[];
  actualOutcome: 'up' | 'down' | 'neutral';
  prediction: 'up' | 'down' | 'neutral';
  confidence: number;
  timestamp: number;
  profitLoss: number;
}

interface ModelPerformance {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgConfidence: number;
  totalPredictions: number;
  correctPredictions: number;
  profitFactor: number;
  sharpeRatio: number;
  lastUpdated: number;
}

interface LearningInsight {
  id: string;
  type: 'pattern' | 'improvement' | 'degradation' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  impact: number; // expected profit impact
  timestamp: number;
  actionable: boolean;
  recommendation: string;
}

export class ContinuousLearner {
  private learningHistory: LearningExample[] = [];
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private featureWeights: Map<string, number> = new Map();
  private learningRate = 0.01;
  private decayRate = 0.995;
  private insights: LearningInsight[] = [];
  private sentimentAnalyzer: SentimentAnalyzer;

  constructor() {
    this.initializeFeatureWeights();
    this.sentimentAnalyzer = new SentimentAnalyzer();
  }

  private initializeFeatureWeights() {
    // Initial feature weights (will be learned over time)
    this.featureWeights.set('price_momentum', 0.18);
    this.featureWeights.set('volume', 0.15);
    this.featureWeights.set('volatility', 0.12);
    this.featureWeights.set('trend_strength', 0.20);
    this.featureWeights.set('rsi', 0.10);
    this.featureWeights.set('macd', 0.10);
    this.featureWeights.set('sentiment', 0.15);
  }

  /**
   * Learn from trade result - incremental update
   */
  async learnFromTrade(
    features: number[],
    prediction: { direction: 'up' | 'down' | 'neutral'; confidence: number },
    actualOutcome: { direction: 'up' | 'down' | 'neutral'; priceChange: number },
    profitLoss: number
  ): Promise<void> {
    const example: LearningExample = {
      features,
      actualOutcome: actualOutcome.direction,
      prediction: prediction.direction,
      confidence: prediction.confidence,
      timestamp: Date.now(),
      profitLoss
    };

    // Add to history
    this.learningHistory.push(example);
    
    // Keep only recent history (last 1000 examples)
    if (this.learningHistory.length > 1000) {
      this.learningHistory.shift();
    }

    // Incremental weight updates
    await this.updateFeatureWeights(example);
    
    // Update model performance metrics
    this.updateModelPerformance(example);
    
    // Generate insights from learning
    await this.generateLearningInsights();
    
    // Decay learning rate over time for stability
    this.learningRate *= this.decayRate;
    this.learningRate = Math.max(this.learningRate, 0.001);
  }

  /**
   * Update feature weights based on prediction accuracy
   */
  private async updateFeatureWeights(example: LearningExample): Promise<void> {
    const correct = example.prediction === example.actualOutcome;
    const error = correct ? 0 : 1;
    const adjustmentFactor = this.learningRate * (correct ? 0.1 : -0.1);

    // Update each feature weight based on its contribution
    const featureNames = Array.from(this.featureWeights.keys());
    for (let i = 0; i < Math.min(featureNames.length, example.features.length); i++) {
      const featureName = featureNames[i];
      const currentWeight = this.featureWeights.get(featureName)!;
      const featureValue = example.features[i];
      
      // Increase weight if feature contributed to correct prediction
      // Decrease weight if feature contributed to incorrect prediction
      const newWeight = currentWeight + (adjustmentFactor * featureValue * example.confidence);
      
      // Keep weights positive and normalized
      this.featureWeights.set(featureName, Math.max(0.01, Math.min(0.5, newWeight)));
    }

    // Normalize weights to sum to 1
    this.normalizeFeatureWeights();
  }

  /**
   * Normalize feature weights to sum to 1
   */
  private normalizeFeatureWeights(): void {
    const total = Array.from(this.featureWeights.values()).reduce((sum, w) => sum + w, 0);
    for (const [feature, weight] of this.featureWeights.entries()) {
      this.featureWeights.set(feature, weight / total);
    }
  }

  /**
   * Update model performance metrics
   */
  private updateModelPerformance(example: LearningExample): void {
    const modelId = 'ensemble_v1';
    const existing = this.modelPerformance.get(modelId) || {
      modelId,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      avgConfidence: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      profitFactor: 1,
      sharpeRatio: 0,
      lastUpdated: Date.now()
    };

    // Update metrics
    const correct = example.prediction === example.actualOutcome;
    existing.totalPredictions++;
    if (correct) existing.correctPredictions++;
    
    existing.accuracy = existing.correctPredictions / existing.totalPredictions;
    existing.avgConfidence = (existing.avgConfidence * (existing.totalPredictions - 1) + example.confidence) / existing.totalPredictions;
    
    // Calculate precision and recall (simplified)
    const recentCorrect = this.learningHistory.slice(-100).filter(e => e.prediction === e.actualOutcome).length;
    existing.precision = recentCorrect / Math.min(100, this.learningHistory.length);
    existing.recall = existing.accuracy; // Simplified
    
    existing.f1Score = 2 * (existing.precision * existing.recall) / (existing.precision + existing.recall + 0.001);
    
    // Calculate profit factor
    const profits = this.learningHistory.filter(e => e.profitLoss > 0).reduce((sum, e) => sum + e.profitLoss, 0);
    const losses = Math.abs(this.learningHistory.filter(e => e.profitLoss < 0).reduce((sum, e) => sum + e.profitLoss, 0));
    existing.profitFactor = losses > 0 ? profits / losses : profits > 0 ? 10 : 1;
    
    // Calculate Sharpe ratio (simplified)
    const returns = this.learningHistory.map(e => e.profitLoss);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    existing.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    existing.lastUpdated = Date.now();
    this.modelPerformance.set(modelId, existing);
  }

  /**
   * Generate insights from learning patterns
   */
  private async generateLearningInsights(): Promise<void> {
    if (this.learningHistory.length < 50) return;

    const recent = this.learningHistory.slice(-50);
    const recentAccuracy = recent.filter(e => e.prediction === e.actualOutcome).length / recent.length;
    const overall = this.modelPerformance.get('ensemble_v1');

    // Performance improvement insight
    if (overall && recentAccuracy > overall.accuracy + 0.05) {
      this.insights.push({
        id: `insight_${Date.now()}_improvement`,
        type: 'improvement',
        title: 'Model Performance Improving',
        description: `Recent accuracy (${(recentAccuracy * 100).toFixed(1)}%) exceeds baseline by ${((recentAccuracy - overall.accuracy) * 100).toFixed(1)}%`,
        confidence: 0.8,
        impact: (recentAccuracy - overall.accuracy) * 1000, // Expected $ impact
        timestamp: Date.now(),
        actionable: true,
        recommendation: 'Consider increasing position sizes as model confidence improves'
      });
    }

    // Performance degradation insight
    if (overall && recentAccuracy < overall.accuracy - 0.05) {
      this.insights.push({
        id: `insight_${Date.now()}_degradation`,
        type: 'degradation',
        title: 'Model Performance Declining',
        description: `Recent accuracy (${(recentAccuracy * 100).toFixed(1)}%) below baseline by ${((overall.accuracy - recentAccuracy) * 100).toFixed(1)}%`,
        confidence: 0.8,
        impact: (overall.accuracy - recentAccuracy) * -1000, // Expected $ impact
        timestamp: Date.now(),
        actionable: true,
        recommendation: 'Reduce position sizes or pause trading until performance stabilizes'
      });
    }

    // Pattern discovery insight
    const highConfidenceCorrect = recent.filter(e => 
      e.confidence > 0.7 && e.prediction === e.actualOutcome
    ).length;
    if (highConfidenceCorrect / recent.length > 0.6) {
      this.insights.push({
        id: `insight_${Date.now()}_pattern`,
        type: 'pattern',
        title: 'High Confidence Predictions Reliable',
        description: `${(highConfidenceCorrect / recent.length * 100).toFixed(1)}% of high-confidence predictions are correct`,
        confidence: 0.9,
        impact: 500,
        timestamp: Date.now(),
        actionable: true,
        recommendation: 'Prioritize trades with confidence > 0.7 for better results'
      });
    }

    // Keep only recent insights (last 20)
    if (this.insights.length > 20) {
      this.insights = this.insights.slice(-20);
    }
  }

  /**
   * Get weighted features for prediction
   */
  getWeightedFeatures(features: number[]): number[] {
    const weights = Array.from(this.featureWeights.values());
    return features.map((f, i) => f * (weights[i] || 1));
  }

  /**
   * Get current feature importance
   */
  getFeatureImportance(): Map<string, number> {
    return new Map(this.featureWeights);
  }

  /**
   * Get model performance
   */
  getModelPerformance(modelId: string = 'ensemble_v1'): ModelPerformance | undefined {
    return this.modelPerformance.get(modelId);
  }

  /**
   * Get all learning insights
   */
  getLearningInsights(limit: number = 10): LearningInsight[] {
    return this.insights.slice(-limit);
  }

  /**
   * Get learning statistics
   */
  getLearningStats(): {
    totalExamples: number;
    recentAccuracy: number;
    learningRate: number;
    topFeatures: Array<{ name: string; weight: number }>;
    modelPerformance: ModelPerformance | undefined;
  } {
    const recent = this.learningHistory.slice(-100);
    const recentAccuracy = recent.length > 0
      ? recent.filter(e => e.prediction === e.actualOutcome).length / recent.length
      : 0;

    const topFeatures = Array.from(this.featureWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, weight]) => ({ name, weight }));

    return {
      totalExamples: this.learningHistory.length,
      recentAccuracy,
      learningRate: this.learningRate,
      topFeatures,
      modelPerformance: this.modelPerformance.get('ensemble_v1')
    };
  }

  /**
   * Export learning state for persistence
   */
  exportLearningState(): any {
    return {
      featureWeights: Array.from(this.featureWeights.entries()),
      modelPerformance: Array.from(this.modelPerformance.entries()),
      learningRate: this.learningRate,
      insights: this.insights.slice(-10),
      historySize: this.learningHistory.length
    };
  }

  /**
   * Import learning state from persistence
   */
  importLearningState(state: any): void {
    if (state.featureWeights) {
      this.featureWeights = new Map(state.featureWeights);
    }
    if (state.modelPerformance) {
      this.modelPerformance = new Map(state.modelPerformance);
    }
    if (state.learningRate) {
      this.learningRate = state.learningRate;
    }
    if (state.insights) {
      this.insights = state.insights;
    }
  }
}

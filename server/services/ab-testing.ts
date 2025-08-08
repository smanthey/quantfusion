import { storage } from '../storage';

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number[];  // [50, 50] for 50/50 split
  metrics: string[];       // ['winRate', 'pnl', 'sharpeRatio']
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'completed' | 'paused';
}

export interface ABTestVariant {
  id: string;
  name: string;
  config: any;
  description: string;
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  metrics: {
    [key: string]: number;
  };
  sampleSize: number;
  confidence: number;
  statisticalSignificance: boolean;
}

export class ABTestingService {
  private activeTests: Map<string, ABTestConfig> = new Map();
  private testAssignments: Map<string, string> = new Map(); // userId -> variantId
  private testResults: Map<string, ABTestResult[]> = new Map();

  constructor() {
    this.initializeDefaultTests();
  }

  private async initializeDefaultTests(): Promise<void> {
    // Position Sizing A/B Test
    const positionSizingTest: ABTestConfig = {
      id: 'position-sizing-v1',
      name: 'Position Sizing Optimization',
      description: 'Test conservative vs aggressive position sizing',
      variants: [
        {
          id: 'conservative',
          name: 'Conservative Sizing',
          config: {
            baseSize: 200,
            confidenceMultiplier: 0.8,
            maxRiskPerTrade: 0.01
          },
          description: 'Smaller positions, lower risk'
        },
        {
          id: 'aggressive',
          name: 'Aggressive Sizing', 
          config: {
            baseSize: 400,
            confidenceMultiplier: 1.2,
            maxRiskPerTrade: 0.02
          },
          description: 'Larger positions, higher potential returns'
        }
      ],
      trafficSplit: [50, 50],
      metrics: ['winRate', 'totalPnL', 'maxDrawdown', 'sharpeRatio'],
      startDate: new Date(),
      status: 'running'
    };

    // Stop Loss Strategy A/B Test
    const stopLossTest: ABTestConfig = {
      id: 'stop-loss-v1',
      name: 'Stop Loss Strategy',
      description: 'Test different stop loss approaches',
      variants: [
        {
          id: 'tight-stops',
          name: 'Tight Stop Losses',
          config: {
            stopLossPercent: 0.005, // 0.5%
            takeProfitPercent: 0.01, // 1%
            timeLimit: 180 // 3 minutes
          },
          description: 'Quick exits, minimize losses'
        },
        {
          id: 'wide-stops',
          name: 'Wide Stop Losses',
          config: {
            stopLossPercent: 0.02, // 2%
            takeProfitPercent: 0.03, // 3%
            timeLimit: 600 // 10 minutes
          },
          description: 'Give trades room to breathe'
        }
      ],
      trafficSplit: [50, 50],
      metrics: ['winRate', 'totalPnL', 'avgTradeReturn', 'avgTradeDuration'],
      startDate: new Date(),
      status: 'running'
    };

    // ML Confidence Threshold Test
    const mlConfidenceTest: ABTestConfig = {
      id: 'ml-confidence-v1', 
      name: 'ML Confidence Thresholds',
      description: 'Test different ML confidence requirements',
      variants: [
        {
          id: 'high-confidence',
          name: 'High Confidence Only',
          config: {
            minConfidence: 0.75,
            adaptiveThreshold: true
          },
          description: 'Only trade when ML is very confident'
        },
        {
          id: 'medium-confidence',
          name: 'Medium Confidence',
          config: {
            minConfidence: 0.55,
            adaptiveThreshold: false
          },
          description: 'Trade with moderate ML confidence'
        }
      ],
      trafficSplit: [50, 50],
      metrics: ['winRate', 'totalPnL', 'tradesPerHour', 'accuracy'],
      startDate: new Date(),
      status: 'running'
    };

    // Strategy Mix A/B Test
    const strategyMixTest: ABTestConfig = {
      id: 'strategy-mix-v1',
      name: 'Strategy Portfolio Mix',
      description: 'Test different strategy allocations',
      variants: [
        {
          id: 'balanced-mix',
          name: 'Balanced Portfolio',
          config: {
            meanReversionWeight: 0.4,
            trendFollowingWeight: 0.4,
            breakoutWeight: 0.2
          },
          description: 'Equal weight across strategies'
        },
        {
          id: 'trend-heavy',
          name: 'Trend Following Heavy',
          config: {
            meanReversionWeight: 0.2,
            trendFollowingWeight: 0.6,
            breakoutWeight: 0.2
          },
          description: 'Focus on trend following'
        }
      ],
      trafficSplit: [50, 50],
      metrics: ['winRate', 'totalPnL', 'consistency', 'volatility'],
      startDate: new Date(),
      status: 'running'
    };

    // Store tests
    this.activeTests.set(positionSizingTest.id, positionSizingTest);
    this.activeTests.set(stopLossTest.id, stopLossTest);
    this.activeTests.set(mlConfidenceTest.id, mlConfidenceTest);
    this.activeTests.set(strategyMixTest.id, strategyMixTest);

    console.log('🧪 A/B Testing initialized with 4 active tests');
  }

  public getVariantForStrategy(strategyId: string, testId: string): ABTestVariant | null {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') return null;

    // Consistent assignment based on strategy ID
    let assignment = this.testAssignments.get(strategyId);
    
    if (!assignment) {
      // Assign variant based on hash of strategy ID for consistency
      const hash = this.hashString(strategyId);
      const splitPoint = test.trafficSplit[0];
      const variantIndex = (hash % 100) < splitPoint ? 0 : 1;
      assignment = test.variants[variantIndex].id;
      this.testAssignments.set(strategyId, assignment);
    }

    return test.variants.find(v => v.id === assignment) || null;
  }

  public async recordTestResult(testId: string, variantId: string, metrics: any): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) return;

    if (!this.testResults.has(testId)) {
      this.testResults.set(testId, []);
    }

    const results = this.testResults.get(testId)!;
    const existingResult = results.find(r => r.variantId === variantId);

    if (existingResult) {
      // Update existing metrics
      Object.keys(metrics).forEach(key => {
        if (typeof metrics[key] === 'number') {
          existingResult.metrics[key] = this.updateRunningAverage(
            existingResult.metrics[key],
            metrics[key],
            existingResult.sampleSize
          );
        }
      });
      existingResult.sampleSize++;
    } else {
      // Create new result
      results.push({
        testId,
        variantId,
        metrics: { ...metrics },
        sampleSize: 1,
        confidence: 0,
        statisticalSignificance: false
      });
    }

    // Calculate statistical significance every 100 samples
    if (results.length >= 2 && results[0].sampleSize % 100 === 0) {
      this.calculateSignificance(testId);
    }
  }

  private updateRunningAverage(currentAvg: number, newValue: number, sampleSize: number): number {
    return (currentAvg * (sampleSize - 1) + newValue) / sampleSize;
  }

  private calculateSignificance(testId: string): void {
    const results = this.testResults.get(testId);
    if (!results || results.length < 2) return;

    // Simplified t-test for win rate comparison
    const [variant1, variant2] = results;
    const n1 = variant1.sampleSize;
    const n2 = variant2.sampleSize;
    
    if (n1 < 30 || n2 < 30) return; // Need minimum sample size

    // Compare win rates (primary metric)
    const p1 = variant1.metrics.winRate || 0;
    const p2 = variant2.metrics.winRate || 0;
    
    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    const zScore = Math.abs(p1 - p2) / se;
    
    // Check for statistical significance (95% confidence)
    const isSignificant = zScore > 1.96;
    const confidence = this.zScoreToConfidence(zScore);
    
    variant1.confidence = confidence;
    variant2.confidence = confidence;
    variant1.statisticalSignificance = isSignificant;
    variant2.statisticalSignificance = isSignificant;

    if (isSignificant) {
      const winner = p1 > p2 ? variant1 : variant2;
      console.log(`🏆 A/B Test Winner: ${testId} - Variant ${winner.variantId} (${(confidence * 100).toFixed(1)}% confidence)`);
    }
  }

  private zScoreToConfidence(zScore: number): number {
    // Approximate conversion from z-score to confidence level
    if (zScore >= 2.58) return 0.99;
    if (zScore >= 1.96) return 0.95;
    if (zScore >= 1.65) return 0.90;
    if (zScore >= 1.28) return 0.80;
    return Math.max(0.5, 0.5 + (zScore / 4));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public getTestResults(): { [testId: string]: ABTestResult[] } {
    const allResults: { [testId: string]: ABTestResult[] } = {};
    
    this.testResults.forEach((results, testId) => {
      allResults[testId] = [...results];
    });
    
    return allResults;
  }

  public getActiveTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values()).filter(test => test.status === 'running');
  }

  public pauseTest(testId: string): void {
    const test = this.activeTests.get(testId);
    if (test) {
      test.status = 'paused';
      console.log(`⏸️ A/B Test paused: ${testId}`);
    }
  }

  public resumeTest(testId: string): void {
    const test = this.activeTests.get(testId);
    if (test) {
      test.status = 'running';
      console.log(`▶️ A/B Test resumed: ${testId}`);
    }
  }

  public generateTestReport(): string {
    const results = this.getTestResults();
    let report = '\n🧪 A/B TESTING COMPREHENSIVE REPORT\n';
    report += '================================================\n\n';

    for (const [testId, testResults] of Object.entries(results)) {
      const test = this.activeTests.get(testId);
      if (!test) continue;

      report += `📊 ${test.name}\n`;
      report += `${test.description}\n`;
      report += `Status: ${test.status.toUpperCase()}\n\n`;

      if (testResults.length >= 2) {
        const [variant1, variant2] = testResults;
        
        report += `Variant A: ${variant1.variantId} (${variant1.sampleSize} samples)\n`;
        Object.entries(variant1.metrics).forEach(([metric, value]) => {
          report += `  ${metric}: ${typeof value === 'number' ? value.toFixed(4) : value}\n`;
        });
        
        report += `\nVariant B: ${variant2.variantId} (${variant2.sampleSize} samples)\n`;
        Object.entries(variant2.metrics).forEach(([metric, value]) => {
          report += `  ${metric}: ${typeof value === 'number' ? value.toFixed(4) : value}\n`;
        });

        if (variant1.statisticalSignificance) {
          const winner = variant1.metrics.winRate > variant2.metrics.winRate ? variant1 : variant2;
          report += `\n🏆 WINNER: ${winner.variantId} (${(winner.confidence * 100).toFixed(1)}% confidence)\n`;
        } else {
          report += `\n⏳ Test still running - no statistical significance yet\n`;
        }
      }
      
      report += '\n' + '-'.repeat(50) + '\n\n';
    }

    return report;
  }
}

export const abTesting = new ABTestingService();
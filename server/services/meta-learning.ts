import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { 
  learningRules, 
  learningRuleApplications, 
  learningInsights, 
  metaLearningFeedback,
  trades 
} from "../../shared/schema";

interface MetaLearningService {
  // Track learning rule effectiveness
  recordRuleApplication(ruleId: string, tradeId: string, originalPrediction: any, modifiedPrediction: any, appliedAction: string): Promise<void>;
  updateRuleOutcome(applicationId: string, actualOutcome: 'win' | 'loss', effectiveness: number): Promise<void>;
  
  // Track learning insights accuracy
  createInsight(type: string, title: string, description: string, confidence: number, expectedImpact: number, basedOnTrades: number, metadata?: any): Promise<string>;
  validateInsight(insightId: string, actualImpact: number, accuracy: number): Promise<void>;
  
  // Meta-learning feedback
  recordLearningFeedback(type: string, subjectId: string, subjectType: string, expectedOutcome: any, actualOutcome: any, performance: number, context?: any): Promise<void>;
  
  // Analysis
  getMetaLearningAnalysis(): Promise<any>;
  getLearningEffectiveness(): Promise<any>;
}

export class DatabaseMetaLearning implements MetaLearningService {
  
  async recordRuleApplication(ruleId: string, tradeId: string, originalPrediction: any, modifiedPrediction: any, appliedAction: string): Promise<void> {
    try {
      await db.insert(learningRuleApplications).values({
        ruleId,
        tradeId,
        appliedAction,
        originalPrediction,
        modifiedPrediction,
        actualOutcome: null, // Will be filled later when trade outcome is known
        ruleEffectiveness: null
      });
      
      console.log(`📝 META-LEARNING: Recorded rule application - ${ruleId} applied to trade ${tradeId}`);
    } catch (error) {
      console.error('Failed to record rule application:', error);
    }
  }
  
  async updateRuleOutcome(applicationId: string, actualOutcome: 'win' | 'loss', effectiveness: number): Promise<void> {
    try {
      await db
        .update(learningRuleApplications)
        .set({
          actualOutcome,
          ruleEffectiveness: effectiveness.toString()
        })
        .where(eq(learningRuleApplications.id, applicationId));
      
      console.log(`🔄 META-LEARNING: Updated rule outcome - ${actualOutcome} with effectiveness ${effectiveness}`);
    } catch (error) {
      console.error('Failed to update rule outcome:', error);
    }
  }
  
  async createInsight(type: string, title: string, description: string, confidence: number, expectedImpact: number, basedOnTrades: number, metadata?: any): Promise<string> {
    try {
      const [insight] = await db.insert(learningInsights).values({
        insightType: type,
        title,
        description,
        confidence: confidence.toString(),
        expectedImpact: expectedImpact.toString(),
        actualImpact: null,
        accuracy: null,
        basedOnTrades,
        validationTrades: 0,
        status: 'active',
        metadata
      }).returning();
      
      console.log(`💡 META-LEARNING: Created insight - "${title}" based on ${basedOnTrades} trades`);
      return insight.id;
    } catch (error) {
      console.error('Failed to create insight:', error);
      throw error;
    }
  }
  
  async validateInsight(insightId: string, actualImpact: number, accuracy: number): Promise<void> {
    try {
      const status = accuracy > 0.7 ? 'validated' : accuracy < 0.3 ? 'invalidated' : 'under_review';
      
      await db
        .update(learningInsights)
        .set({
          actualImpact: actualImpact.toString(),
          accuracy: accuracy.toString(),
          status,
          lastValidated: new Date()
        })
        .where(eq(learningInsights.id, insightId));
      
      console.log(`✅ META-LEARNING: Validated insight ${insightId} - accuracy: ${(accuracy*100).toFixed(1)}%, status: ${status}`);
    } catch (error) {
      console.error('Failed to validate insight:', error);
    }
  }
  
  async recordLearningFeedback(type: string, subjectId: string, subjectType: string, expectedOutcome: any, actualOutcome: any, performance: number, context?: any): Promise<void> {
    try {
      await db.insert(metaLearningFeedback).values({
        feedbackType: type,
        subjectId,
        subjectType,
        expectedOutcome,
        actualOutcome,
        performance: performance.toString(),
        context,
        learningAdjustment: null // To be filled based on how we adjust our learning
      });
      
      console.log(`🧠 META-LEARNING: Recorded feedback on ${subjectType} ${subjectId} - performance: ${(performance*100).toFixed(1)}%`);
    } catch (error) {
      console.error('Failed to record learning feedback:', error);
    }
  }
  
  async getMetaLearningAnalysis(): Promise<any> {
    try {
      // Get learning rules effectiveness
      const ruleApplications = await db
        .select()
        .from(learningRuleApplications)
        .where(eq(learningRuleApplications.actualOutcome, 'win'))
        .limit(1000)
        .orderBy(desc(learningRuleApplications.timestamp));
      
      // Get insights accuracy
      const insights = await db
        .select()
        .from(learningInsights)
        .orderBy(desc(learningInsights.createdAt))
        .limit(100);
      
      // Get meta-learning feedback
      const feedback = await db
        .select()
        .from(metaLearningFeedback)
        .orderBy(desc(metaLearningFeedback.timestamp))
        .limit(100);
      
      const validatedInsights = insights.filter((i: any) => i.accuracy !== null);
      const avgInsightAccuracy = validatedInsights.length > 0 
        ? validatedInsights.reduce((sum: number, i: any) => sum + parseFloat(i.accuracy || '0'), 0) / validatedInsights.length
        : 0;
      
      const effectiveRules = ruleApplications.filter((r: any) => parseFloat(r.ruleEffectiveness || '0') > 0.6);
      const avgRuleEffectiveness = ruleApplications.length > 0
        ? ruleApplications.reduce((sum: number, r: any) => sum + parseFloat(r.ruleEffectiveness || '0'), 0) / ruleApplications.length
        : 0;
      
      return {
        metaLearningStats: {
          totalRuleApplications: ruleApplications.length,
          effectiveRules: effectiveRules.length,
          avgRuleEffectiveness,
          totalInsights: insights.length,
          validatedInsights: validatedInsights.length,
          avgInsightAccuracy,
          feedbackRecords: feedback.length
        },
        learningEvolution: {
          rulesLearningRate: effectiveRules.length / Math.max(ruleApplications.length, 1),
          insightAccuracyTrend: avgInsightAccuracy,
          metaLearningEffectiveness: (avgRuleEffectiveness + avgInsightAccuracy) / 2
        },
        recentLearningActions: feedback.slice(0, 10).map((f: any) => ({
          type: f.feedbackType,
          subjectType: f.subjectType,
          performance: parseFloat(f.performance || '0'),
          timestamp: f.timestamp
        }))
      };
    } catch (error) {
      console.error('Meta-learning analysis error:', error);
      return {
        metaLearningStats: {
          totalRuleApplications: 0,
          effectiveRules: 0,
          avgRuleEffectiveness: 0,
          totalInsights: 0,
          validatedInsights: 0,
          avgInsightAccuracy: 0,
          feedbackRecords: 0
        },
        learningEvolution: {
          rulesLearningRate: 0,
          insightAccuracyTrend: 0,
          metaLearningEffectiveness: 0
        },
        recentLearningActions: []
      };
    }atch (error) {
      console.error('Meta-learning analysis error:', error);
      return {
        metaLearningStats: {
          totalRuleApplications: 0,
          effectiveRules: 0,
          avgRuleEffectiveness: 0,
          totalInsights: 0,
          validatedInsights: 0,
          avgInsightAccuracy: 0,
          feedbackRecords: 0
        },
        learningEvolution: {
          rulesLearningRate: 0,
          insightAccuracyTrend: 0,
          metaLearningEffectiveness: 0
        },
        recentLearningActions: []
      };
    }
  }
  
  async getLearningEffectiveness(): Promise<any> {
    try {
      const recentApplications = await db
        .select()
        .from(learningRuleApplications)
        .orderBy(desc(learningRuleApplications.timestamp))
        .limit(500);
      
      const winningApplications = recentApplications.filter((a: any) => a.actualOutcome === 'win');
      const losingApplications = recentApplications.filter((a: any) => a.actualOutcome === 'loss');
      
      return {
        totalApplications: recentApplications.length,
        winningApplications: winningApplications.length,
        losingApplications: losingApplications.length,
        learningWinRate: recentApplicationions.length > 0 ? winningApplications.length / recentApplications.length : 0,
        avgEffectiveness: recentApplications.length > 0 
          ? recentApplications.reduce((sum: number, a: any) => sum + parseFloat(a.ruleEffectiveness || '0'), 0) / recentApplications.length 
          : 0
      };
    } catch (error) {
      console.error('Learning effectiveness error:', error);
      return {
        totalApplications: 0,
        winningApplications: 0,
        losingApplications: 0,
        learningWinRate: 0,
        avgEffectiveness: 0
      };
    }
  }atch (error) {
      console.error('Learning effectiveness error:', error);
      return {
        totalApplications: 0,
        winningApplications: 0,
        losingApplications: 0,
        learningWinRate: 0,
        avgEffectiveness: 0
      };
    }
  }
}

export const metaLearning = new DatabaseMetaLearning();
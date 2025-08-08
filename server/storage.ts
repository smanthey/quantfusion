import { 
  users, 
  strategies, 
  positions, 
  trades, 
  marketRegimes, 
  backtestResults, 
  systemAlerts, 
  riskMetrics,
  type User, 
  type InsertUser,
  type Strategy,
  type InsertStrategy,
  type Position,
  type InsertPosition,
  type Trade,
  type InsertTrade,
  type MarketRegime,
  type BacktestResult,
  type InsertBacktestResult,
  type SystemAlert,
  type InsertSystemAlert,
  type RiskMetric,
  type InsertRiskMetric
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, and } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Strategy management
  getStrategies(): Promise<Strategy[]>;
  getActiveStrategies(): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategyStatus(id: string, status: string): Promise<Strategy>;
  updateStrategyAllocation(id: string, allocation: string): Promise<Strategy>;
  
  // Position management
  getOpenPositions(): Promise<Position[]>;
  getPositionBySymbol(symbol: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePositionPnL(id: string, currentPrice: string, unrealizedPnl: string): Promise<Position>;
  updatePositionStatus(id: string, status: string): Promise<Position>;
  
  // Trade management
  getAllTrades(): Promise<Trade[]>;
  getRecentTrades(limit: number): Promise<Trade[]>;
  getTradesSince(date: Date): Promise<Trade[]>;
  getTradesByStrategy(strategyId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  
  // Market regime
  getCurrentRegime(): Promise<MarketRegime | undefined>;
  createMarketRegime(regime: Omit<MarketRegime, 'id' | 'timestamp'>): Promise<MarketRegime>;
  
  // Backtest results
  getBacktestResults(strategyId: string): Promise<BacktestResult[]>;
  createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;
  
  // System alerts
  getSystemAlerts(limit: number): Promise<SystemAlert[]>;
  createSystemAlert(alert: InsertSystemAlert): Promise<SystemAlert>;
  acknowledgeAlert(id: string): Promise<void>;
  
  // Risk metrics
  getCurrentRiskMetrics(): Promise<RiskMetric | undefined>;
  createRiskMetric(metrics: Omit<RiskMetric, 'id' | 'timestamp'>): Promise<RiskMetric>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Strategy management
  async getStrategies(): Promise<Strategy[]> {
    return await db.select().from(strategies).orderBy(desc(strategies.createdAt));
  }

  async getActiveStrategies(): Promise<Strategy[]> {
    return await db
      .select()
      .from(strategies)
      .where(eq(strategies.status, 'active'))
      .orderBy(desc(strategies.createdAt));
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const [newStrategy] = await db
      .insert(strategies)
      .values({
        ...strategy,
        updatedAt: new Date()
      })
      .returning();
    return newStrategy;
  }

  async updateStrategyStatus(id: string, status: string): Promise<Strategy> {
    const [updated] = await db
      .update(strategies)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(strategies.id, id))
      .returning();
    return updated;
  }

  async updateStrategyAllocation(id: string, allocation: string): Promise<Strategy> {
    const [updated] = await db
      .update(strategies)
      .set({ 
        allocation,
        updatedAt: new Date()
      })
      .where(eq(strategies.id, id))
      .returning();
    return updated;
  }

  // Position management
  async getOpenPositions(): Promise<Position[]> {
    return await db
      .select()
      .from(positions)
      .where(eq(positions.status, 'open'))
      .orderBy(desc(positions.openedAt));
  }

  async getPositionBySymbol(symbol: string): Promise<Position | undefined> {
    const [position] = await db
      .select()
      .from(positions)
      .where(and(
        eq(positions.symbol, symbol),
        eq(positions.status, 'open')
      ));
    return position || undefined;
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const [newPosition] = await db
      .insert(positions)
      .values(position)
      .returning();
    return newPosition;
  }

  async updatePositionPnL(id: string, currentPrice: string, unrealizedPnl: string): Promise<Position> {
    const [updated] = await db
      .update(positions)
      .set({ 
        currentPrice,
        unrealizedPnl
      })
      .where(eq(positions.id, id))
      .returning();
    return updated;
  }

  async updatePositionStatus(id: string, status: string): Promise<Position> {
    const [updated] = await db
      .update(positions)
      .set({ 
        status,
        closedAt: status === 'closed' ? new Date() : undefined
      })
      .where(eq(positions.id, id))
      .returning();
    return updated;
  }

  // Trade management
  async getAllTrades(): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(desc(trades.executedAt));
  }

  async getRecentTrades(limit: number): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .orderBy(desc(trades.executedAt))
      .limit(limit);
  }

  async getTradesSince(date: Date): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(gte(trades.executedAt, date))
      .orderBy(desc(trades.executedAt));
  }

  async getTradesByStrategy(strategyId: string): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(eq(trades.strategyId, strategyId))
      .orderBy(desc(trades.executedAt));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db
      .insert(trades)
      .values(trade)
      .returning();
    return newTrade;
  }

  // Market regime
  async getCurrentRegime(): Promise<MarketRegime | undefined> {
    const [regime] = await db
      .select()
      .from(marketRegimes)
      .orderBy(desc(marketRegimes.timestamp))
      .limit(1);
    return regime || undefined;
  }

  async createMarketRegime(regime: Omit<MarketRegime, 'id' | 'timestamp'>): Promise<MarketRegime> {
    const [newRegime] = await db
      .insert(marketRegimes)
      .values(regime)
      .returning();
    return newRegime;
  }

  // Backtest results
  async getBacktestResults(strategyId: string): Promise<BacktestResult[]> {
    return await db
      .select()
      .from(backtestResults)
      .where(eq(backtestResults.strategyId, strategyId))
      .orderBy(desc(backtestResults.createdAt));
  }

  async createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    const [newResult] = await db
      .insert(backtestResults)
      .values(result)
      .returning();
    return newResult;
  }

  // System alerts
  async getSystemAlerts(limit: number): Promise<SystemAlert[]> {
    return await db
      .select()
      .from(systemAlerts)
      .where(eq(systemAlerts.acknowledged, false))
      .orderBy(desc(systemAlerts.createdAt))
      .limit(limit);
  }

  async createSystemAlert(alert: InsertSystemAlert): Promise<SystemAlert> {
    const [newAlert] = await db
      .insert(systemAlerts)
      .values(alert)
      .returning();
    return newAlert;
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await db
      .update(systemAlerts)
      .set({ acknowledged: true })
      .where(eq(systemAlerts.id, id));
  }

  // Risk metrics
  async getCurrentRiskMetrics(): Promise<RiskMetric | undefined> {
    const [metrics] = await db
      .select()
      .from(riskMetrics)
      .orderBy(desc(riskMetrics.timestamp))
      .limit(1);
    return metrics || undefined;
  }

  async createRiskMetric(metrics: InsertRiskMetric): Promise<RiskMetric> {
    const [newMetrics] = await db
      .insert(riskMetrics)
      .values(metrics)
      .returning();
    return newMetrics;
  }
}

export const storage = new DatabaseStorage();

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const strategies = pgTable("strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'mean_reversion', 'trend_following', 'breakout'
  status: text("status").notNull().default('inactive'), // 'active', 'inactive', 'paused'
  parameters: jsonb("parameters").notNull(),
  allocation: decimal("allocation", { precision: 5, scale: 4 }).notNull().default('0'),
  profitFactor: decimal("profit_factor", { precision: 10, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }),
  winRate: decimal("win_rate", { precision: 5, scale: 4 }),
  totalTrades: integer("total_trades").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => strategies.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'long', 'short'
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }),
  stopPrice: decimal("stop_price", { precision: 18, scale: 8 }),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 8 }),
  status: text("status").notNull().default('open'), // 'open', 'closed'
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => strategies.id),
  positionId: varchar("position_id").references(() => positions.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  size: decimal("size", { precision: 18, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 18, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 18, scale: 8 }),
  pnl: decimal("pnl", { precision: 18, scale: 8 }),
  fees: decimal("fees", { precision: 18, scale: 8 }),
  duration: integer("duration"), // in seconds
  executedAt: timestamp("executed_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const marketRegimes = pgTable("market_regimes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regime: text("regime").notNull(), // 'trend', 'chop', 'off'
  volatility: decimal("volatility", { precision: 10, scale: 6 }).notNull(),
  avgSpread: decimal("avg_spread", { precision: 10, scale: 4 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const backtestResults = pgTable("backtest_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => strategies.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalReturn: decimal("total_return", { precision: 10, scale: 4 }).notNull(),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }),
  profitFactor: decimal("profit_factor", { precision: 10, scale: 4 }),
  winRate: decimal("win_rate", { precision: 5, scale: 4 }),
  totalTrades: integer("total_trades").notNull(),
  parameters: jsonb("parameters").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemAlerts = pgTable("system_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'success'
  title: text("title").notNull(),
  message: text("message").notNull(),
  acknowledged: boolean("acknowledged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const riskMetrics = pgTable("risk_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dailyPnl: decimal("daily_pnl", { precision: 18, scale: 8 }).notNull(),
  dailyRisk: decimal("daily_risk", { precision: 5, scale: 4 }).notNull(),
  maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 4 }).notNull(),
  totalExposure: decimal("total_exposure", { precision: 18, scale: 8 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations
export const strategiesRelations = relations(strategies, ({ many }) => ({
  positions: many(positions),
  trades: many(trades),
  backtestResults: many(backtestResults),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  strategy: one(strategies, { fields: [positions.strategyId], references: [strategies.id] }),
  trades: many(trades),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  strategy: one(strategies, { fields: [trades.strategyId], references: [strategies.id] }),
  position: one(positions, { fields: [trades.positionId], references: [positions.id] }),
}));

export const backtestResultsRelations = relations(backtestResults, ({ one }) => ({
  strategy: one(strategies, { fields: [backtestResults.strategyId], references: [strategies.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  apiKey: true,
  apiSecret: true,
});

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
  closedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
  closedAt: true,
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({
  id: true,
  createdAt: true,
});

export const insertSystemAlertSchema = createInsertSchema(systemAlerts).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategies.$inferSelect;

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResults.$inferSelect;

export type InsertSystemAlert = z.infer<typeof insertSystemAlertSchema>;
export type SystemAlert = typeof systemAlerts.$inferSelect;

export type MarketRegime = typeof marketRegimes.$inferSelect;
export type RiskMetric = typeof riskMetrics.$inferSelect;

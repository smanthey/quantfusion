import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, uuid, unique, index } from "drizzle-orm/pg-core";
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
  stopLoss: decimal("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: decimal("take_profit", { precision: 18, scale: 8 }),
  pnl: decimal("pnl", { precision: 18, scale: 8 }),
  profit: decimal("profit", { precision: 10, scale: 2 }).default('0'), // Separate profit field
  loss: decimal("loss", { precision: 10, scale: 2 }).default('0'), // Separate loss field
  fees: decimal("fees", { precision: 18, scale: 8 }),
  duration: integer("duration"), // in seconds
  executedAt: timestamp("executed_at").defaultNow(),
  closedAt: timestamp("closed_at"),
  status: text("status").notNull().default('open'), // 'open', 'closed'
  archived: boolean("archived").default(false).notNull(), // Filter out old buggy trades
  strategy: text("strategy"), // Track which strategy made this trade
}, (t) => ({
  // Indices for performance optimization
  idxSymbolStatus: index("trades_symbol_status_idx").on(t.symbol, t.status),
  idxExecutedAt: index("trades_executed_at_idx").on(t.executedAt),
  idxStrategyId: index("trades_strategy_id_idx").on(t.strategyId),
  idxArchivedStatus: index("trades_archived_status_idx").on(t.archived, t.status),
}));

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

// Historical Market Data - Store all price data forever for backtesting and analysis
// Note: Deduplication handled via UPSERT in code (symbol+timestamp+interval unique)
export const historicalPrices = pgTable("historical_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(), // 'BTCUSDT', 'ETHUSDT', 'EURUSD', etc.
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 18, scale: 8 }).notNull(),
  high: decimal("high", { precision: 18, scale: 8 }).notNull(),
  low: decimal("low", { precision: 18, scale: 8 }).notNull(),
  close: decimal("close", { precision: 18, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 24, scale: 8 }).notNull(),
  trades: integer("trades"), // Number of trades in this candle
  interval: text("interval").notNull(), // '1m', '5m', '15m', '1h', '4h', '1d'
  source: text("source").notNull(), // 'binance', 'coingecko', 'coinlore', 'forex', etc.
}, (t) => ({
  // Indices for efficient historical data queries
  idxSymbolTimestamp: index("historical_prices_symbol_timestamp_idx").on(t.symbol, t.timestamp),
  idxSymbolInterval: index("historical_prices_symbol_interval_idx").on(t.symbol, t.interval),
}));

// Alternative Data Sources - Politicians' Trades, Options Flow, Whale Tracking
export const politicianTrades = pgTable("politician_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  politician: text("politician").notNull(),
  position: text("position").notNull(), // 'Senator', 'Representative'
  party: text("party").notNull(), // 'Democrat', 'Republican', 'Independent'
  symbol: text("symbol").notNull(),
  transactionType: text("transaction_type").notNull(), // 'purchase', 'sale'
  amountMin: decimal("amount_min", { precision: 18, scale: 2 }).notNull(),
  amountMax: decimal("amount_max", { precision: 18, scale: 2 }).notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  disclosureDate: timestamp("disclosure_date").notNull(),
  assetType: text("asset_type").notNull(),
  committee: text("committee"), // Committee membership
  source: text("source").notNull(), // 'quiver', 'capitol_trades', 'fmp'
  filingUrl: text("filing_url"),
});

export const optionsFlow = pgTable("options_flow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  optionType: text("option_type").notNull(), // 'CALL', 'PUT'
  strike: decimal("strike", { precision: 18, scale: 2 }).notNull(),
  expiration: timestamp("expiration").notNull(),
  volume: integer("volume").notNull(),
  openInterest: integer("open_interest").notNull(),
  premium: decimal("premium", { precision: 18, scale: 2 }).notNull(),
  spotPrice: decimal("spot_price", { precision: 18, scale: 2 }).notNull(),
  isUnusual: boolean("is_unusual").default(false), // Flagged as unusual activity
  sentiment: text("sentiment"), // 'BULLISH', 'BEARISH', 'NEUTRAL'
  timestamp: timestamp("timestamp").notNull(),
  source: text("source").notNull(),
});

export const whaleTransactions = pgTable("whale_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  blockchain: text("blockchain").notNull(), // 'ethereum', 'bitcoin', 'solana', etc.
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: decimal("amount", { precision: 24, scale: 8 }).notNull(),
  valueUSD: decimal("value_usd", { precision: 18, scale: 2 }).notNull(),
  txHash: text("tx_hash").notNull().unique(),
  blockNumber: integer("block_number").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  isExchange: boolean("is_exchange").default(false), // From/To exchange wallet
  source: text("source").notNull(),
});

// Meta-Learning Tables: Learn from our learning process
export const learningRules = pgTable("learning_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text("rule_id").notNull().unique(),
  condition: text("condition").notNull(),
  action: text("action").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  successRate: decimal("success_rate", { precision: 5, scale: 4 }).notNull(),
  timesApplied: integer("times_applied").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastApplied: timestamp("last_applied"),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
});

export const learningRuleApplications = pgTable("learning_rule_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text("rule_id").notNull(),
  tradeId: varchar("trade_id").notNull().references(() => trades.id),
  appliedAction: text("applied_action").notNull(), // what we did
  originalPrediction: jsonb("original_prediction").notNull(), // what we would have done
  modifiedPrediction: jsonb("modified_prediction").notNull(), // what we actually did
  actualOutcome: text("actual_outcome"), // win/loss - filled later
  ruleEffectiveness: decimal("rule_effectiveness", { precision: 5, scale: 4 }), // did this rule help?
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const learningInsights = pgTable("learning_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  insightType: text("insight_type").notNull(), // 'pattern_discovered', 'rule_effectiveness', 'meta_learning'
  title: text("title").notNull(),
  description: text("description").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  expectedImpact: decimal("expected_impact", { precision: 10, scale: 4 }), // predicted $ impact
  actualImpact: decimal("actual_impact", { precision: 10, scale: 4 }), // actual $ impact after time
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }), // how accurate was our insight?
  basedOnTrades: integer("based_on_trades").notNull(), // number of trades this insight is based on
  validationTrades: integer("validation_trades").default(0), // trades used to validate insight
  status: text("status").default('active'), // 'active', 'validated', 'invalidated', 'under_review'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastValidated: timestamp("last_validated"),
  metadata: jsonb("metadata"),
});

export const metaLearningFeedback = pgTable("meta_learning_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedbackType: text("feedback_type").notNull(), // 'rule_performance', 'insight_accuracy', 'learning_effectiveness'
  subjectId: text("subject_id").notNull(), // ID of rule, insight, or learning session being evaluated
  subjectType: text("subject_type").notNull(), // 'rule', 'insight', 'learning_session'
  expectedOutcome: jsonb("expected_outcome").notNull(), // what we thought would happen
  actualOutcome: jsonb("actual_outcome").notNull(), // what actually happened
  performance: decimal("performance", { precision: 5, scale: 4 }).notNull(), // 0-1 score of how well it worked
  context: jsonb("context"), // market conditions, etc. when this happened
  learningAdjustment: jsonb("learning_adjustment"), // how we adjusted our learning based on this
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 18, scale: 8 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  source: text("source").notNull(),
  metadata: jsonb("metadata"),
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

// Meta-Learning Relations
export const learningRulesRelations = relations(learningRules, ({ many }) => ({
  applications: many(learningRuleApplications),
}));

export const learningRuleApplicationsRelations = relations(learningRuleApplications, ({ one }) => ({
  trade: one(trades, { fields: [learningRuleApplications.tradeId], references: [trades.id] }),
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

export const insertRiskMetricSchema = createInsertSchema(riskMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertHistoricalPriceSchema = createInsertSchema(historicalPrices).omit({
  id: true,
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

export type InsertRiskMetric = z.infer<typeof insertRiskMetricSchema>;
export type RiskMetric = typeof riskMetrics.$inferSelect;

export type InsertHistoricalPrice = z.infer<typeof insertHistoricalPriceSchema>;
export type HistoricalPrice = typeof historicalPrices.$inferSelect;

export type MarketRegime = typeof marketRegimes.$inferSelect;

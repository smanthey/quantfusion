import { z } from 'zod';

// Dashboard Data Schema
export const DashboardDataSchema = z.object({
  strategies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['active', 'paused', 'stopped']),
    performance: z.object({
      totalTrades: z.number(),
      winRate: z.number(),
      profitFactor: z.number(),
      totalPnL: z.number(),
    }).optional(),
  })),
  positions: z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    side: z.enum(['buy', 'sell', 'BUY', 'SELL']),
    size: z.string(),
    entryPrice: z.string(),
    currentPrice: z.number().optional(),
    pnl: z.number().optional(),
  })),
  recentTrades: z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    side: z.enum(['buy', 'sell', 'BUY', 'SELL']),
    size: z.string(),
    entryPrice: z.string(),
    exitPrice: z.string().nullable(),
    pnl: z.string().nullable(),
    status: z.enum(['open', 'closed']),
    executedAt: z.string().or(z.date()),
  })),
  performance: z.object({
    totalPnl: z.number(),
    dailyPnL: z.number(),
    winRate: z.number(),
    profitFactor: z.number(),
    sharpeRatio: z.number(),
    totalTrades: z.number(),
    winningTrades: z.number(),
    losingTrades: z.number(),
  }).optional(),
  systemStatus: z.object({
    trading: z.boolean(),
    isHalted: z.boolean(),
    circuitBreakers: z.array(z.any()).optional(),
  }).optional(),
});

export type DashboardData = z.infer<typeof DashboardDataSchema>;

// Account Data Schema
export const AccountDataSchema = z.object({
  balances: z.array(z.object({
    asset: z.string(),
    free: z.string(),
    locked: z.string(),
  })),
  totalValue: z.number().optional(),
  tradingEnabled: z.boolean().optional(),
});

export type AccountData = z.infer<typeof AccountDataSchema>;

// System Status Schema
export const SystemStatusSchema = z.object({
  trading: z.boolean(),
  isHalted: z.boolean(),
  uptime: z.number().optional(),
  circuitBreakers: z.array(z.object({
    name: z.string(),
    state: z.enum(['OPEN', 'CLOSED', 'HALF_OPEN']),
  })).optional(),
});

export type SystemStatus = z.infer<typeof SystemStatusSchema>;

// Health Check Schema
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number().optional(),
  memory: z.object({
    used: z.number(),
    total: z.number(),
  }).optional(),
  database: z.object({
    connected: z.boolean(),
    totalTrades: z.number(),
    openTrades: z.number(),
  }).optional(),
  services: z.object({
    marketData: z.string(),
    workingTrader: z.string(),
  }).optional(),
  error: z.string().optional(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// Helper function to validate API responses
export function validateApiResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

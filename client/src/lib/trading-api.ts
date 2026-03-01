import { apiRequest } from '@/lib/queryClient';

export interface DashboardData {
  strategies: StrategyStatus[];
  positions: PositionData[];
  recentTrades: TradeData[];
  systemAlerts: Alert[];
  performance: PerformanceMetrics;
  marketData: MarketData;
  riskMetrics: RiskMetrics;
}

export interface StrategyStatus {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'paused';
  allocation: number;
  pnl: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  isExploring: boolean;
}

export interface PositionData {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopPrice?: number;
  duration: number;
}

export interface TradeData {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  profit?: number;
  loss?: number;
  fees: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
  strategy: string;
  executedAt?: string;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface PerformanceMetrics {
  totalPnl: number;
  dailyPnl: number;
  drawdown: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  equity: number[];
}

export interface MarketData {
  BTCUSDT: {
    price: number;
    change: number;
    volume: number;
    volatility: number;
  };
  ETHUSDT: {
    price: number;
    change: number;
    volume: number;
    volatility: number;
  };
  regime: {
    current: string;
    strength: number;
    confidence: number;
  };
}

export interface RiskMetrics {
  currentDrawdown: number;
  dailyPnL: number;
  totalPositionSize: number;
  riskUtilization: number;
  isHalted: boolean;
  circuitBreakers: string[];
}

export const tradingApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await apiRequest('GET', '/api/dashboard');
    return res.json();
  },
  
  startTrading: () =>
    apiRequest('POST', '/api/trading/start'),
  
  stopTrading: () =>
    apiRequest('POST', '/api/trading/stop'),
  
  emergencyStop: () =>
    apiRequest('POST', '/api/trading/emergency-stop'),
  
  updateStrategy: (strategyId: string, data: Partial<StrategyStatus>) =>
    apiRequest('PATCH', `/api/strategies/${strategyId}`, data),
  
  closePosition: (positionId: string) =>
    apiRequest('POST', `/api/positions/${positionId}/close`),
  
  acknowledgeAlert: (alertId: string) =>
    apiRequest('POST', `/api/alerts/${alertId}/acknowledge`),
  
  runBacktest: (strategyId: string, params: any) =>
    apiRequest('POST', '/api/backtest', { strategyId, params }),
  
  updateRiskLimits: (limits: Partial<RiskMetrics>) =>
    apiRequest('PATCH', '/api/risk/limits', limits),
  
  getPerformanceHistory: async (timeframe: '1d' | '7d' | '30d') => {
    const res = await apiRequest('GET', `/api/performance/history?timeframe=${timeframe}`);
    return res.json();
  },
  
  exportTrades: async (startDate: string, endDate: string) => {
    const res = await apiRequest('GET', `/api/trades/export?startDate=${startDate}&endDate=${endDate}`);
    return res.json();
  },
  
  getMarketData: async (symbol: string) => {
    const res = await apiRequest('GET', `/api/market-data/${symbol}`);
    return res.json();
  },
  
  getStrategyMetrics: async (strategyId: string) => {
    const res = await apiRequest('GET', `/api/strategies/${strategyId}/metrics`);
    return res.json();
  },
  
  getAllocations: async () => {
    const res = await apiRequest('GET', '/api/allocations');
    return res.json();
  },
  
  updateAllocations: (allocations: any[]) =>
    apiRequest('PUT', '/api/allocations', allocations)
};

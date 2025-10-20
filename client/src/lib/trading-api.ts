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
  getDashboard: (): Promise<DashboardData> => 
    apiRequest('/api/dashboard'),
  
  startTrading: () => 
    apiRequest('/api/trading/start', { method: 'POST' }),
  
  stopTrading: () => 
    apiRequest('/api/trading/stop', { method: 'POST' }),
  
  emergencyStop: () => 
    apiRequest('/api/trading/emergency-stop', { method: 'POST' }),
  
  updateStrategy: (strategyId: string, data: Partial<StrategyStatus>) =>
    apiRequest(`/api/strategies/${strategyId}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
  
  closePosition: (positionId: string) =>
    apiRequest(`/api/positions/${positionId}/close`, { method: 'POST' }),
  
  acknowledgeAlert: (alertId: string) =>
    apiRequest(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' }),
  
  runBacktest: (strategyId: string, params: any) =>
    apiRequest('/api/backtest', {
      method: 'POST',
      body: JSON.stringify({ strategyId, params })
    }),
  
  updateRiskLimits: (limits: Partial<RiskMetrics>) =>
    apiRequest('/api/risk/limits', {
      method: 'PATCH',
      body: JSON.stringify(limits)
    }),
  
  getPerformanceHistory: (timeframe: '1d' | '7d' | '30d') =>
    apiRequest(`/api/performance/history?timeframe=${timeframe}`),
  
  exportTrades: (startDate: string, endDate: string) =>
    apiRequest(`/api/trades/export?startDate=${startDate}&endDate=${endDate}`),
  
  getMarketData: (symbol: string) =>
    apiRequest(`/api/market-data/${symbol}`),
  
  getStrategyMetrics: (strategyId: string) =>
    apiRequest(`/api/strategies/${strategyId}/metrics`),
  
  getAllocations: () =>
    apiRequest('/api/allocations'),
  
  updateAllocations: (allocations: any[]) =>
    apiRequest('/api/allocations', {
      method: 'PUT',
      body: JSON.stringify(allocations)
    })
};
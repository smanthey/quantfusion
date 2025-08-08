import { apiRequest } from "./queryClient";

export { apiRequest };

// Trading-specific API functions
export const tradingApi = {
  // Dashboard data
  getDashboardData: () => apiRequest('GET', '/api/dashboard'),
  
  // Strategy management
  getStrategies: () => apiRequest('GET', '/api/strategies'),
  createStrategy: (data: any) => apiRequest('POST', '/api/strategies', data),
  updateStrategyStatus: (id: string, status: string) => 
    apiRequest('PUT', `/api/strategies/${id}/status`, { status }),
  
  // Position management
  getPositions: () => apiRequest('GET', '/api/positions'),
  
  // Trading operations
  startTrading: () => apiRequest('POST', '/api/trading/start'),
  stopTrading: () => apiRequest('POST', '/api/trading/stop'),
  emergencyStop: () => apiRequest('POST', '/api/trading/emergency-stop'),
  
  // Backtesting
  runBacktest: (config: {
    strategyId: string;
    startDate: string;
    endDate: string;
    parameters: any;
  }) => apiRequest('POST', '/api/backtest', config),
  getBacktestResults: (strategyId: string) => 
    apiRequest('GET', `/api/backtest/results/${strategyId}`),
  
  // Risk management
  getRiskMetrics: () => apiRequest('GET', '/api/risk/metrics'),
  
  // System alerts
  getAlerts: () => apiRequest('GET', '/api/alerts'),
  acknowledgeAlert: (id: string) => 
    apiRequest('POST', `/api/alerts/${id}/acknowledge`),
  
  // Market data
  getMarketRegime: () => apiRequest('GET', '/api/market/regime'),
};

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
}

// Trading signal interface
export interface TradingSignal {
  symbol: string;
  side: 'long' | 'short';
  price: string;
  confidence: number;
  strategy: string;
}

// Risk metrics interface
export interface RiskMetrics {
  dailyPnl: string;
  dailyRisk: string;
  maxDrawdown: string;
  totalExposure: string;
}

// Backtest configuration interface
export interface BacktestConfig {
  strategyId: string;
  startDate: Date;
  endDate: Date;
  parameters: Record<string, any>;
}

// Strategy performance interface
export interface StrategyPerformance {
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  totalReturn: number;
}

// Market regime interface
export interface MarketRegime {
  regime: 'trend' | 'chop' | 'off';
  volatility: number;
  avgSpread: number;
  timestamp: string;
}

// Position interface
export interface Position {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  currentPrice?: string;
  stopPrice?: string;
  unrealizedPnl: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
}

// Trade interface
export interface Trade {
  id: string;
  strategyId: string;
  positionId?: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  exitPrice?: string;
  pnl?: string;
  fees: string;
  duration?: number;
  executedAt: string;
  closedAt?: string;
}

// System alert interface
export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

// Strategy configuration interface
export interface StrategyConfig {
  name: string;
  type: 'mean_reversion' | 'trend_following' | 'breakout';
  parameters: Record<string, any>;
  allocation: number;
  enabled: boolean;
}

// Helper functions for formatting
export const formatters = {
  currency: (value: number, precision = 2): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  },
  
  percentage: (value: number, precision = 2): string => {
    return `${(value * 100).toFixed(precision)}%`;
  },
  
  number: (value: number, precision = 4): string => {
    return value.toFixed(precision);
  },
  
  timestamp: (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  },
  
  duration: (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  },
};

// Constants for trading platform
export const TRADING_CONSTANTS = {
  // Risk management defaults
  DEFAULT_RISK_PER_TRADE: 0.005, // 0.5%
  MAX_DAILY_LOSS: 0.02, // 2%
  MAX_DRAWDOWN: 0.1, // 10%
  
  // Strategy types
  STRATEGY_TYPES: {
    MEAN_REVERSION: 'mean_reversion',
    TREND_FOLLOWING: 'trend_following',
    BREAKOUT: 'breakout',
  },
  
  // Position sides
  SIDES: {
    LONG: 'long',
    SHORT: 'short',
  },
  
  // Strategy statuses
  STRATEGY_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PAUSED: 'paused',
  },
  
  // Market regimes
  REGIMES: {
    TREND: 'trend',
    CHOP: 'chop',
    OFF: 'off',
  },
  
  // WebSocket message types
  WS_MESSAGE_TYPES: {
    CONNECTION: 'connection',
    MARKET_UPDATE: 'market_update',
    POSITION_UPDATE: 'position_update',
    TRADE_EXECUTED: 'trade_executed',
    STRATEGY_STATUS: 'strategy_status_updated',
    EMERGENCY_STOP: 'emergency_stop',
    TRADING_STARTED: 'trading_started',
    TRADING_STOPPED: 'trading_stopped',
    ALERT: 'alert',
  },
};

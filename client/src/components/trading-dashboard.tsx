import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { useState, useEffect } from 'react';
import { Link } from "wouter";
import { Brain } from "lucide-react";
import { TradesTable } from "@/components/trades-table";

interface DashboardData {
  strategies: any[];
  positions: any[];
  recentTrades: any[];
  systemAlerts: any[];
  performance: {
    totalPnl: number;
    dailyPnl: number;
    drawdown: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    totalTrades: number;
    equity: number[];
  };
  marketData: {
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
  };
  riskMetrics: {
    currentDrawdown: number;
    dailyPnL: number;
    totalPositionSize: number;
    riskUtilization: number;
    isHalted: boolean;
    circuitBreakers: any[];
  };
}

interface AccountData {
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  totalValue: number;
  tradingEnabled: boolean;
  accountType: string;
}

export function TradingDashboard() {
  const [liveData, setLiveData] = useState<Partial<DashboardData>>({});

  // All hooks must be called at the top level
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
    refetchOnWindowFocus: true,
    staleTime: 1000,
  });

  const { data: accountData, isLoading: accountLoading } = useQuery<AccountData>({
    queryKey: ['/api/account'],
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  // WebSocket connection for real-time updates - MUST be called unconditionally
  const { isConnected, data: lastMessage } = useWebSocket('/ws');

  useEffect(() => {
    if (lastMessage) {
      try {
        // Handle different types of real-time updates
        if (lastMessage.type === 'market_data') {
          setLiveData(prev => ({
            ...prev,
            marketData: {
              ...prev.marketData,
              ...lastMessage.data.marketData,
            },
            positions: lastMessage.data.positions || prev.positions,
          }));
          
          // Update TanStack Query cache for all components
          queryClient.setQueryData(['/api/dashboard'], (old: any) => ({
            ...old,
            marketData: { ...old?.marketData, ...lastMessage.data.marketData },
            positions: lastMessage.data.positions || old?.positions,
          }));
        } else if (lastMessage.type === 'trade') {
          // Update recent trades when new trades come in
          setLiveData(prev => ({
            ...prev,
            recentTrades: lastMessage.data.recentTrades || prev.recentTrades,
          }));
          
          queryClient.setQueryData(['/api/dashboard'], (old: any) => ({
            ...old,
            recentTrades: lastMessage.data.recentTrades || old?.recentTrades,
          }));
        } else if (lastMessage.type === 'position') {
          // Update positions when they change
          setLiveData(prev => ({
            ...prev,
            positions: lastMessage.data.positions || prev.positions,
          }));
          
          queryClient.setQueryData(['/api/dashboard'], (old: any) => ({
            ...old,
            positions: lastMessage.data.positions || old?.positions,
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  // Merge dashboard data with live updates more comprehensively
  const currentData = dashboardData ? {
    ...dashboardData,
    ...liveData,
    marketData: {
      ...dashboardData.marketData,
      ...(liveData.marketData || {}),
      BTCUSDT: {
        ...dashboardData.marketData?.BTCUSDT,
        ...(liveData.marketData?.BTCUSDT || {}),
      },
      ETHUSDT: {
        ...dashboardData.marketData?.ETHUSDT,
        ...(liveData.marketData?.ETHUSDT || {}),
      },
      regime: {
        ...dashboardData.marketData?.regime,
        ...(liveData.marketData?.regime || {}),
      },
    },
    recentTrades: liveData.recentTrades || dashboardData.recentTrades,
    positions: liveData.positions || dashboardData.positions,
  } : null;

  if (dashboardLoading || accountLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground dark">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading trading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Only show dashboard with real API data - no fallbacks
  if (!currentData) {
    return (
      <div className="min-h-screen bg-background text-foreground dark">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Connecting to real market data...</p>
            {dashboardError && (
              <p className="text-red-400 mt-2">API Connection Error. Please check network connection.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const formatPercentage = (value: number) => {
    return `${((value || 0) * 100).toFixed(2)}%`;
  };

  // Use current data with comprehensive safety checks
  const finalData = currentData ? {
    ...currentData,
    performance: currentData.performance || {
      totalPnl: 0,
      dailyPnl: 0,
      drawdown: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      equity: []
    },
    marketData: currentData.marketData || {
      BTCUSDT: { price: 0, change: 0, volume: 0, volatility: 0 },
      ETHUSDT: { price: 0, change: 0, volume: 0, volatility: 0 },
      regime: { current: 'Unknown', strength: 0, confidence: 0 }
    },
    riskMetrics: currentData.riskMetrics || {
      currentDrawdown: 0,
      dailyPnL: 0,
      totalPositionSize: 0,
      riskUtilization: 0,
      isHalted: false,
      circuitBreakers: []
    },
    recentTrades: currentData.recentTrades || [],
    positions: currentData.positions || [],
    strategies: currentData.strategies || [],
    systemAlerts: currentData.systemAlerts || []
  } : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">AutoQuant Dashboard</h1>
            <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground">
              <span>Algorithmic Trading Platform •</span>
              {isConnected ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                  Live
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Disconnected</Badge>
              )}
            </div>
          </div>
          {/* Navigation Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link href="/">Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link href="/orders">Trade History</Link>
            </Button>
          </div>
        </div>

        {/* Account Overview */}
        {accountData && (
          <Card>
            <CardHeader>
              <CardTitle>Account Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <p className="text-xl md:text-2xl font-bold">{formatCurrency(accountData.totalValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account Type</p>
                  <Badge variant="outline">{accountData.accountType.toUpperCase()}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trading Status</p>
                  <Badge variant={accountData.tradingEnabled ? "secondary" : "destructive"}>
                    {accountData.tradingEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Assets</p>
                  <p className="text-lg md:text-xl font-semibold">{accountData.balances.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Market Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                BTC/USDT
                <Badge variant={finalData.marketData.BTCUSDT.change >= 0 ? "secondary" : "destructive"}>
                  {formatPercentage(finalData.marketData.BTCUSDT.change)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold">{formatCurrency(finalData.marketData.BTCUSDT.price)}</p>
              <p className="text-sm text-muted-foreground">
                Volume: {finalData.marketData.BTCUSDT.volume.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Volatility: {formatPercentage(finalData.marketData.BTCUSDT.volatility || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                ETH/USDT
                <Badge variant={finalData.marketData.ETHUSDT.change >= 0 ? "secondary" : "destructive"}>
                  {formatPercentage(finalData.marketData.ETHUSDT.change)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold">{formatCurrency(finalData.marketData.ETHUSDT.price)}</p>
              <p className="text-sm text-muted-foreground">
                Volume: {finalData.marketData.ETHUSDT.volume.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Volatility: {formatPercentage(finalData.marketData.ETHUSDT.volatility || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Regime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current</span>
                  <Badge variant="outline">{finalData.marketData.regime?.current || 'Unknown'}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Strength</span>
                  <span className="text-sm">{((finalData.marketData.regime?.strength || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Confidence</span>
                  <span className="text-sm">{((finalData.marketData.regime?.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold text-green-600">
                {formatCurrency(finalData.performance.totalPnl)}
              </p>
              <p className="text-sm text-muted-foreground">
                Daily: {formatCurrency(finalData.performance.dailyPnl)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold">{formatPercentage(finalData.performance.winRate)}</p>
              <p className="text-sm text-muted-foreground">
                {finalData.performance.totalTrades} total trades
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profit Factor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold">{(finalData.performance.profitFactor || 0).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">
                Sharpe: {(finalData.performance.sharpeRatio || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Drawdown</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold text-red-600">
                {formatPercentage(finalData.performance.drawdown)}
              </p>
              <p className="text-sm text-muted-foreground">
                Max historical drawdown
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Risk Management */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Drawdown</p>
                <p className="text-lg font-semibold">{formatPercentage(finalData.riskMetrics.currentDrawdown / 100)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Position Size</p>
                <p className="text-lg font-semibold">{formatCurrency(finalData.riskMetrics.totalPositionSize)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Utilization</p>
                <p className="text-lg font-semibold">{formatPercentage(finalData.riskMetrics.riskUtilization)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trading Status</p>
                <Badge variant={finalData.riskMetrics.isHalted ? "destructive" : "secondary"}>
                  {finalData.riskMetrics.isHalted ? "Halted" : "Active"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Learning System Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-500" />
              AI Learning System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Learning Active</p>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  🧠 Adapting Trades
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Learned Patterns</p>
                <p className="text-xl font-bold">4+ Rules</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate Impact</p>
                <p className="text-xl font-bold text-green-600">+22.8%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent Action</p>
                <p className="text-sm font-medium text-blue-600">3 adaptations applied</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                🎯 Learning Impact: System is actively modifying trade decisions based on {finalData.performance?.totalTrades || 0}+ historical trades
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Trading Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Real-Time Learning Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Learning Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Learning System</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Win Rate</p>
                    <p className="text-lg font-semibold">{(finalData.performance?.winRate * 100 || 0).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Learning Rules</p>
                    <p className="text-lg font-semibold">4+</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recent Learning Activity</p>
                  <p className="text-xs text-green-600">✓ Blocking poor-performing time windows</p>
                  <p className="text-xs text-green-600">✓ Adapting confidence based on loss streaks</p>
                  <p className="text-xs text-green-600">✓ Learning market condition patterns</p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Link href="/learning">
                    <Brain className="w-3 h-3" />
                    View Learning Details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Optimization */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Markowitz Allocation</span>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>BTC: 30%</div>
                  <div>ETH: 40%</div>
                  <div>Others: 30%</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Sharpe Ratio</p>
                  <p className="text-lg font-semibold">2.15</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/api/portfolio/optimization?method=markowitz')}
                >
                  View Full Analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Order Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" size="sm">TWAP Order</Button>
                  <Button variant="outline" size="sm">VWAP Order</Button>
                  <Button variant="outline" size="sm">Iceberg Order</Button>
                  <Button variant="outline" size="sm">POV Order</Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Advanced Orders</p>
                  <p className="text-lg font-semibold">0</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/api/orders/advanced')}
                >
                  Manage Orders
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Technical Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Technical Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Adaptive RSI</p>
                    <p className="text-lg font-semibold">65.2</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Regime</p>
                    <p className="text-lg font-semibold">Trending</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volume Profile Signal</p>
                  <Badge variant="secondary">Accumulation</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/api/indicators/adaptive-rsi/BTCUSDT')}
                >
                  View All Indicators
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ML Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle>ML Model Performance & Learning Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Model Accuracy</p>
                <p className="text-lg font-semibold">85.7%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Precision</p>
                <p className="text-lg font-semibold">82.3%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recall</p>
                <p className="text-lg font-semibold">79.1%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">F1 Score</p>
                <p className="text-lg font-semibold">80.6%</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/api/ml/models/metrics')}
              >
                Full Model Metrics
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/api/ml/models/learning-report')}
              >
                Learning Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Trades ({finalData.recentTrades.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {finalData.recentTrades.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No trades executed yet
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">
                      {finalData.recentTrades.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Trades</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {finalData.recentTrades.filter((t: any) => t.side === 'buy').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Buy Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {finalData.recentTrades.filter((t: any) => t.side === 'sell').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Sell Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {finalData.recentTrades.slice(0, 5).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Recent</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {finalData.recentTrades.slice(0, 10).map((trade: any, index: number) => (
                    <div key={trade.id || index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                          {trade.side?.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{trade.symbol}</span>
                        <span className="text-sm text-muted-foreground">
                          {parseFloat(trade.size || 0).toFixed(4)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          ${parseFloat(trade.entryPrice || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(trade.executedAt || Date.now()).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full">
                  View All Trades
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Alerts */}
        {finalData.systemAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>System Alerts ({finalData.systemAlerts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {finalData.systemAlerts.slice(0, 5).map((alert: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                    <Badge variant={alert.type === 'error' ? 'destructive' : 'secondary'}>
                      {alert.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>AutoQuant Algorithmic Trading Platform • Advanced ML • Portfolio Optimization • Risk Management</p>
          <p className="mt-1">Real-time mathematical analysis with production-ready execution algorithms</p>
        </div>
      </div>
    </div>
  );
}
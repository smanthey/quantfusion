import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Play, 
  Square, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  Activity,
  DollarSign,
  TrendingUp,
  Shield,
  Settings
} from "lucide-react";

import { tradingApi, DashboardData } from "@/lib/trading-api";
import { StrategyPanel } from "@/components/strategy-panel";
import { PerformanceMetricsComponent } from "@/components/performance-metrics";
import { PositionsPanel } from "@/components/positions-panel";
import { EquityChart } from "@/components/equity-chart";
import { TradesTable } from "@/components/trades-table";

export function TradingDashboard() {
  const { toast } = useToast();
  const { data: wsData, isConnected } = useWebSocket('/ws');

  const {
    data: dashboard,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/dashboard'],
    queryFn: () => tradingApi.getDashboard(),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Default dashboard data structure for when no data is available
  const defaultDashboard: DashboardData = {
    strategies: [],
    positions: [],
    recentTrades: [],
    systemAlerts: [],
    performance: {
      totalPnl: 0,
      dailyPnl: 0,
      drawdown: 0,
      winRate: 0,
      profitFactor: 1.0,
      sharpeRatio: 0,
      totalTrades: 0,
      equity: []
    },
    marketData: {
      BTCUSDT: {
        price: 45000,
        change: 0.02,
        volume: 1250000,
        volatility: 0.035
      },
      ETHUSDT: {
        price: 2800,
        change: -0.015,
        volume: 850000,
        volatility: 0.042
      },
      regime: {
        current: 'Neutral',
        strength: 0.6,
        confidence: 0.75
      }
    },
    riskMetrics: {
      currentDrawdown: 0,
      dailyPnL: 0,
      totalPositionSize: 0,
      riskUtilization: 0.3,
      isHalted: false,
      circuitBreakers: []
    }
  };

  const data = dashboard || defaultDashboard;

  const handleStartTrading = async () => {
    try {
      await tradingApi.startTrading();
      toast({
        title: "Trading Started",
        description: "Algorithmic trading engine is now active",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start trading engine",
        variant: "destructive",
      });
    }
  };

  const handleStopTrading = async () => {
    try {
      await tradingApi.stopTrading();
      toast({
        title: "Trading Stopped", 
        description: "Algorithmic trading engine has been stopped",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop trading engine",
        variant: "destructive",
      });
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await tradingApi.emergencyStop();
      toast({
        title: "Emergency Stop Activated",
        description: "All positions closed and trading halted",
        variant: "destructive",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute emergency stop",
        variant: "destructive",
      });
    }
  };

  const handleToggleStrategy = async (id: string, running: boolean) => {
    try {
      await tradingApi.updateStrategy(id, { 
        status: running ? 'running' : 'stopped' 
      });
      toast({
        title: running ? "Strategy Started" : "Strategy Stopped",
        description: `Strategy has been ${running ? 'activated' : 'deactivated'}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update strategy status",
        variant: "destructive",
      });
    }
  };

  const handleConfigureStrategy = (id: string) => {
    toast({
      title: "Strategy Configuration",
      description: "Strategy configuration panel coming soon",
    });
  };

  const handleClosePosition = async (id: string) => {
    try {
      await tradingApi.closePosition(id);
      toast({
        title: "Position Closed",
        description: "Position has been successfully closed",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to close position",
        variant: "destructive",
      });
    }
  };

  const handleExportTrades = () => {
    toast({
      title: "Export Trades",
      description: "Trade export functionality coming soon",
    });
  };

  const getRegimeBadge = (regime: string, confidence: number) => {
    const color = regime === 'Bullish' ? 'green' : 
                 regime === 'Bearish' ? 'red' : 'yellow';
    return (
      <Badge className={`bg-${color}-100 text-${color}-800 dark:bg-${color}-900 dark:text-${color}-200`}>
        {regime} ({(confidence * 100).toFixed(0)}%)
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading trading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">Failed to load dashboard data</p>
          <Button onClick={() => refetch()} className="mt-2">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time algorithmic trading system with multi-strategy execution
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-500">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-500">Disconnected</span>
              </>
            )}
          </div>
          
          <Button onClick={handleStartTrading} className="bg-green-600 hover:bg-green-700">
            <Play className="h-4 w-4 mr-2" />
            Start Trading
          </Button>
          
          <Button onClick={handleStopTrading} variant="secondary">
            <Square className="h-4 w-4 mr-2" />
            Stop Trading
          </Button>
          
          <Button onClick={handleEmergencyStop} variant="destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Emergency Stop
          </Button>
        </div>
      </div>

      {/* System Alerts */}
      {data.systemAlerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-5 w-5" />
              System Alerts ({data.systemAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.systemAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
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

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">BTC/USDT</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.marketData.BTCUSDT.price.toLocaleString()}
            </div>
            <p className={`text-xs ${data.marketData.BTCUSDT.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.marketData.BTCUSDT.change >= 0 ? '+' : ''}{(data.marketData.BTCUSDT.change * 100).toFixed(2)}% 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ETH/USDT</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.marketData.ETHUSDT.price.toLocaleString()}
            </div>
            <p className={`text-xs ${data.marketData.ETHUSDT.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.marketData.ETHUSDT.change >= 0 ? '+' : ''}{(data.marketData.ETHUSDT.change * 100).toFixed(2)}% 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Regime</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {getRegimeBadge(data.marketData.regime.current, data.marketData.regime.confidence)}
            </div>
            <p className="text-xs text-muted-foreground">
              Strength: {(data.marketData.regime.strength * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <PerformanceMetricsComponent 
        performance={data.performance}
        riskMetrics={data.riskMetrics}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="strategies" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
        </TabsList>
        
        <TabsContent value="strategies" className="space-y-4">
          <StrategyPanel
            strategies={data.strategies}
            onToggleStrategy={handleToggleStrategy}
            onConfigureStrategy={handleConfigureStrategy}
          />
        </TabsContent>
        
        <TabsContent value="positions" className="space-y-4">
          <PositionsPanel
            positions={data.positions}
            onClosePosition={handleClosePosition}
          />
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-4">
          <EquityChart
            equity={data.performance.equity}
            timeframe="1d"
          />
        </TabsContent>
        
        <TabsContent value="trades" className="space-y-4">
          <TradesTable
            trades={data.recentTrades}
            onExportTrades={handleExportTrades}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
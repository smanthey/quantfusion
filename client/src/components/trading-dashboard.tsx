import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/trading-api";
import StrategyPanel from "./strategy-panel";
import PerformanceMetrics from "./performance-metrics";
import PositionsPanel from "./positions-panel";
import EquityChart from "./equity-chart";
import TradesTable from "./trades-table";

interface DashboardData {
  strategies: any[];
  positions: any[];
  recentTrades: any[];
  currentRegime: any;
  riskMetrics: any;
  systemAlerts: any[];
  accountBalance: number;
  dailyPnl: number;
}

export default function TradingDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // WebSocket connection for real-time updates
  const { isConnected, lastMessage } = useWebSocket('/ws');

  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage);
        
        switch (message.type) {
          case 'market_update':
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
            break;
          case 'emergency_stop':
            toast({
              title: "Emergency Stop Activated",
              description: "All positions have been flattened",
              variant: "destructive",
            });
            break;
          case 'trading_started':
            toast({
              title: "Trading Started",
              description: "Trading engine is now active",
            });
            break;
          case 'trading_stopped':
            toast({
              title: "Trading Stopped",
              description: "Trading engine has been stopped",
              variant: "destructive",
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage, queryClient, toast]);

  const handleEmergencyStop = async () => {
    try {
      await apiRequest('POST', '/api/trading/emergency-stop');
      toast({
        title: "Emergency Stop Executed",
        description: "All positions have been closed immediately",
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Emergency Stop Failed",
        description: "Failed to execute emergency stop",
        variant: "destructive",
      });
    }
  };

  const handleStartTrading = async () => {
    try {
      await apiRequest('POST', '/api/trading/start');
      toast({
        title: "Trading Started",
        description: "Trading engine has been activated",
      });
    } catch (error) {
      toast({
        title: "Failed to Start Trading",
        description: "Could not start the trading engine",
        variant: "destructive",
      });
    }
  };

  const handleStopTrading = async () => {
    try {
      await apiRequest('POST', '/api/trading/stop');
      toast({
        title: "Trading Stopped",
        description: "Trading engine has been stopped",
      });
    } catch (error) {
      toast({
        title: "Failed to Stop Trading",
        description: "Could not stop the trading engine",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-text-primary">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-danger">Error loading dashboard data</div>
      </div>
    );
  }

  const tabs = ["Dashboard", "Strategies", "Backtesting", "Risk Management", "Live Trading", "Analytics"];

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary">
      {/* Header */}
      <header className="bg-dark-secondary border-b border-dark-tertiary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-chart-line text-success text-xl"></i>
              <h1 className="text-xl font-bold">AutoQuant</h1>
            </div>
            <div className="text-sm text-text-secondary">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                isConnected ? 'bg-success text-dark-bg' : 'bg-danger text-white'
              }`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
              <span className="ml-2">
                {isConnected ? 'Connected to Exchange' : 'Connection Lost'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="text-text-secondary">Account:</span>
              <span className="font-mono">
                ${dashboardData?.accountBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-text-secondary">Daily PnL:</span>
              <span className={`font-mono ${
                (dashboardData?.dailyPnl || 0) >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {(dashboardData?.dailyPnl || 0) >= 0 ? '+' : ''}
                ${dashboardData?.dailyPnl?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmergencyStop}
              className="bg-danger hover:bg-red-700 text-white"
            >
              <i className="fas fa-stop mr-2"></i>
              Emergency Stop
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-dark-secondary border-b border-dark-tertiary">
        <div className="px-6">
          <div className="flex space-x-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-success text-success'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* Left Panel - Strategy Overview */}
        <div className="w-80 bg-dark-secondary border-r border-dark-tertiary overflow-y-auto">
          <StrategyPanel 
            strategies={dashboardData?.strategies || []}
            currentRegime={dashboardData?.currentRegime}
            riskMetrics={dashboardData?.riskMetrics}
            onStartTrading={handleStartTrading}
            onStopTrading={handleStopTrading}
          />
        </div>

        {/* Center Panel - Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <PerformanceMetrics 
            strategies={dashboardData?.strategies || []}
            accountBalance={dashboardData?.accountBalance || 0}
            dailyPnl={dashboardData?.dailyPnl || 0}
          />
          
          <EquityChart />
          
          <TradesTable trades={dashboardData?.recentTrades || []} />
        </div>

        {/* Right Panel - Live Positions & Alerts */}
        <div className="w-80 bg-dark-secondary border-l border-dark-tertiary overflow-y-auto">
          <PositionsPanel 
            positions={dashboardData?.positions || []}
            alerts={dashboardData?.systemAlerts || []}
          />
        </div>
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-dark-secondary border-t border-dark-tertiary px-6 py-2">
        <div className="flex justify-between items-center text-xs text-text-secondary">
          <div className="flex space-x-4">
            <span>Latency: <span className="font-mono text-success">12ms</span></span>
            <span>Fill Ratio: <span className="font-mono text-success">98.7%</span></span>
            <span>Maker/Taker: <span className="font-mono">73%/27%</span></span>
          </div>
          <div className="flex space-x-4">
            <span>Last Update: <span className="font-mono">{new Date().toLocaleTimeString()} UTC</span></span>
            <span>Version: <span className="font-mono">v2.1.4</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

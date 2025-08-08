import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Position {
  id: string;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  currentPrice: string;
  stopPrice: string;
  unrealizedPnl: string;
}

interface SystemAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

interface PositionsPanelProps {
  positions: Position[];
  alerts: SystemAlert[];
}

export default function PositionsPanel({ positions, alerts }: PositionsPanelProps) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return 'fas fa-exclamation-circle text-danger';
      case 'warning': return 'fas fa-exclamation-triangle text-warning';
      case 'success': return 'fas fa-check-circle text-success';
      case 'info': return 'fas fa-info-circle text-info';
      default: return 'fas fa-info-circle text-info';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)} hours ago`;
    } else {
      return `${Math.floor(diffMins / 1440)} days ago`;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Open Positions */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-chart-area text-success mr-2"></i>
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {positions.length === 0 ? (
            <div className="text-text-secondary text-sm text-center py-4">
              No open positions
            </div>
          ) : (
            positions.map((position) => (
              <div key={position.id} className="border border-dark-tertiary rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{position.symbol}</span>
                  <Badge className={position.side === 'long' ? 'bg-success text-dark-bg' : 'bg-danger text-white'}>
                    {position.side.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Size:</span>
                    <span className="font-mono">{parseFloat(position.size).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Entry:</span>
                    <span className="font-mono">${parseFloat(position.entryPrice).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Mark:</span>
                    <span className="font-mono">
                      ${parseFloat(position.currentPrice || position.entryPrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">PnL:</span>
                    <span className={`font-mono ${
                      parseFloat(position.unrealizedPnl) >= 0 ? 'text-success' : 'text-danger'
                    }`}>
                      {parseFloat(position.unrealizedPnl) >= 0 ? '+' : ''}
                      ${parseFloat(position.unrealizedPnl).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Stop:</span>
                    <span className="font-mono">
                      ${parseFloat(position.stopPrice || '0').toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* System Alerts */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-exclamation-triangle text-warning mr-2"></i>
            System Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <div className="text-text-secondary text-sm text-center py-4">
              No recent alerts
            </div>
          ) : (
            alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start space-x-2 p-2 bg-dark-secondary rounded text-xs">
                <i className={`${getAlertIcon(alert.type)} mt-0.5`}></i>
                <div className="flex-1">
                  <div className="font-medium">{alert.title}</div>
                  <div className="text-text-secondary">{alert.message}</div>
                  <div className="text-text-secondary">{formatTime(alert.createdAt)}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Exploration Status */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-search text-info mr-2"></i>
            Exploration (10% Budget)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Active Trials:</span>
            <span className="font-mono text-sm">3</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Best Trial PF:</span>
            <span className="font-mono text-sm text-success">1.34</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Promotions Today:</span>
            <span className="font-mono text-sm">1</span>
          </div>
          <div className="mt-3">
            <div className="text-xs text-text-secondary mb-1">Current Trials:</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Mean Rev v2.1</span>
                <span className="text-success">Running</span>
              </div>
              <div className="flex justify-between">
                <span>Momentum v1.3</span>
                <span className="text-warning">Testing</span>
              </div>
              <div className="flex justify-between">
                <span>Arbitrage v3.0</span>
                <span className="text-info">Validating</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-bolt text-warning mr-2"></i>
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full bg-info hover:bg-blue-600 text-white text-sm font-medium">
            <i className="fas fa-play mr-2"></i>Run Backtest
          </Button>
          <Button className="w-full bg-warning hover:bg-yellow-600 text-dark-bg text-sm font-medium">
            <i className="fas fa-sync mr-2"></i>Optimize Parameters
          </Button>
          <Button 
            variant="outline"
            className="w-full bg-dark-tertiary hover:bg-gray-600 text-text-primary border-dark-tertiary text-sm font-medium"
          >
            <i className="fas fa-download mr-2"></i>Export Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

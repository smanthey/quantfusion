import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target, Shield, AlertTriangle } from "lucide-react";
import { PerformanceMetrics, RiskMetrics } from "@/lib/trading-api";

interface PerformanceMetricsProps {
  performance: PerformanceMetrics;
  riskMetrics: RiskMetrics;
}

export function PerformanceMetricsComponent({ performance, riskMetrics }: PerformanceMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
        {isPositive ? "+" : ""}{(value * 100).toFixed(2)}%
      </span>
    );
  };

  const getRiskColor = (utilization: number) => {
    if (utilization >= 0.8) return "text-red-500";
    if (utilization >= 0.6) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* P&L Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          {performance.totalPnl >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(performance.totalPnl)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Daily: {formatCurrency(performance.dailyPnl)}
          </p>
        </CardContent>
      </Card>

      {/* Drawdown Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
          <Shield className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPercentage(-Math.abs(performance.drawdown))}
          </div>
          <Progress 
            value={Math.abs(performance.drawdown * 100)} 
            className="mt-2"
            max={20} // 20% max for visualization
          />
        </CardContent>
      </Card>

      {/* Win Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <Target className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(performance.winRate * 100).toFixed(1)}%
          </div>
          <Progress 
            value={performance.winRate * 100} 
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Profit Factor Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performance.profitFactor.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {performance.profitFactor > 1.5 ? "Excellent" : 
             performance.profitFactor > 1.2 ? "Good" : 
             performance.profitFactor > 1.0 ? "Profitable" : "Losing"}
          </p>
        </CardContent>
      </Card>

      {/* Sharpe Ratio Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
          <Target className="h-4 w-4 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {performance.sharpeRatio.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Risk-adjusted return
          </p>
        </CardContent>
      </Card>

      {/* Risk Utilization Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Risk Utilization</CardTitle>
          {riskMetrics.isHalted ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <Shield className="h-4 w-4 text-green-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getRiskColor(riskMetrics.riskUtilization)}`}>
            {(riskMetrics.riskUtilization * 100).toFixed(1)}%
          </div>
          <Progress 
            value={riskMetrics.riskUtilization * 100} 
            className="mt-2"
          />
          {riskMetrics.circuitBreakers.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-red-600 font-medium">Active Warnings:</p>
              {riskMetrics.circuitBreakers.map((warning, index) => (
                <p key={index} className="text-xs text-muted-foreground">
                  • {warning}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Trades Card */}
      <div className="md:col-span-2 lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Trading Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold">{performance.totalTrades}</div>
                <p className="text-xs text-muted-foreground">Total Trades</p>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">
                  {Math.round(performance.totalTrades * performance.winRate)}
                </div>
                <p className="text-xs text-muted-foreground">Winning Trades</p>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">
                  {Math.round(performance.totalTrades * (1 - performance.winRate))}
                </div>
                <p className="text-xs text-muted-foreground">Losing Trades</p>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">
                  {formatCurrency(performance.totalPnl / Math.max(performance.totalTrades, 1))}
                </div>
                <p className="text-xs text-muted-foreground">Avg P&L per Trade</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
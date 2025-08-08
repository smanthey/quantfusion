import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Strategy {
  id: string;
  name: string;
  profitFactor: string | null;
  winRate: string | null;
  totalTrades: number;
}

interface PerformanceMetricsProps {
  strategies: Strategy[];
  accountBalance: number;
  dailyPnl: number;
}

export default function PerformanceMetrics({ strategies, accountBalance, dailyPnl }: PerformanceMetricsProps) {
  // Calculate aggregate metrics
  const totalTrades = strategies.reduce((sum, s) => sum + s.totalTrades, 0);
  const avgWinRate = strategies.length > 0 
    ? strategies.reduce((sum, s) => sum + parseFloat(s.winRate || '0'), 0) / strategies.length
    : 0;
  
  const totalReturn = ((accountBalance - 100000) / 100000) * 100; // Assuming $100k initial
  const sharpeRatio = 1.89; // Mock Sharpe ratio - in production, calculate from returns

  return (
    <div className="grid grid-cols-3 gap-6 mb-6">
      <Card className="bg-dark-secondary border-dark-tertiary">
        <CardContent className="p-4">
          <h4 className="font-medium text-sm text-text-secondary mb-2">Total Return</h4>
          <div className={`text-2xl font-mono font-bold ${totalReturn >= 0 ? 'text-success' : 'text-danger'}`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
          <div className="text-xs text-text-secondary">Since inception</div>
        </CardContent>
      </Card>

      <Card className="bg-dark-secondary border-dark-tertiary">
        <CardContent className="p-4">
          <h4 className="font-medium text-sm text-text-secondary mb-2">Sharpe Ratio</h4>
          <div className="text-2xl font-mono font-bold">{sharpeRatio.toFixed(2)}</div>
          <div className="text-xs text-text-secondary">Annualized</div>
        </CardContent>
      </Card>

      <Card className="bg-dark-secondary border-dark-tertiary">
        <CardContent className="p-4">
          <h4 className="font-medium text-sm text-text-secondary mb-2">Win Rate</h4>
          <div className="text-2xl font-mono font-bold">{(avgWinRate * 100).toFixed(1)}%</div>
          <div className="text-xs text-text-secondary">{totalTrades} total trades</div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, Settings, TrendingUp, TrendingDown } from "lucide-react";
import { StrategyStatus } from "@/lib/trading-api";

interface StrategyPanelProps {
  strategies: StrategyStatus[];
  onToggleStrategy: (id: string, running: boolean) => void;
  onConfigureStrategy: (id: string) => void;
}

export function StrategyPanel({ strategies, onToggleStrategy, onConfigureStrategy }: StrategyPanelProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500 text-white">Running</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500 text-white">Paused</Badge>;
      case 'stopped':
        return <Badge className="bg-gray-500 text-white">Stopped</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatPnL = (pnl: number) => {
    const isPositive = pnl >= 0;
    return (
      <span className={isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
        {isPositive ? "+" : ""}{pnl.toFixed(2)}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Active Strategies
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {strategies.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No active strategies configured
            </p>
          ) : (
            strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{strategy.name}</h3>
                    {getStatusBadge(strategy.status)}
                    {strategy.isExploring && (
                      <Badge variant="outline" className="text-xs">
                        Exploring
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">PnL:</span>
                      <div className="font-medium">{formatPnL(strategy.pnl)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Allocation:</span>
                      <div className="font-medium">{(strategy.allocation * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Win Rate:</span>
                      <div className="font-medium">{(strategy.winRate * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PF:</span>
                      <div className="font-medium">{strategy.profitFactor.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <Switch
                    checked={strategy.status === 'running'}
                    onCheckedChange={(checked) => onToggleStrategy(strategy.id, checked)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onConfigureStrategy(strategy.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Strategy Types:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>• <strong>Mean Reversion:</strong> Trades against price extremes using Bollinger Bands</div>
            <div>• <strong>Trend Following:</strong> Follows market momentum using moving averages</div>
            <div>• <strong>Breakout:</strong> Captures breakouts from consolidation ranges using ATR</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
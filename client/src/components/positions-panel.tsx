import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, X, Clock } from "lucide-react";
import { PositionData } from "@/lib/trading-api";

interface PositionsPanelProps {
  positions: PositionData[];
  onClosePosition: (id: string) => void;
}

export function PositionsPanel({ positions, onClosePosition }: PositionsPanelProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Open Positions ({positions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No open positions
          </p>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <div
                key={position.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{position.symbol}</h3>
                    <Badge 
                      variant={position.side === 'long' ? 'default' : 'secondary'}
                      className={
                        position.side === 'long' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }
                    >
                      {position.side === 'long' ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {position.side.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDuration(position.duration)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Size:</span>
                      <div className="font-medium">{position.size.toFixed(4)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entry:</span>
                      <div className="font-medium">{formatCurrency(position.entryPrice)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <div className="font-medium">{formatCurrency(position.currentPrice)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unrealized P&L:</span>
                      <div className={`font-medium ${getPnLColor(position.unrealizedPnl)}`}>
                        {formatCurrency(position.unrealizedPnl)}
                      </div>
                    </div>
                    {position.stopPrice && (
                      <div>
                        <span className="text-muted-foreground">Stop:</span>
                        <div className="font-medium">{formatCurrency(position.stopPrice)}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Return:</span>
                      <div className={`font-medium ${getPnLColor(position.unrealizedPnl)}`}>
                        {((position.unrealizedPnl / (position.size * position.entryPrice)) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="ml-4 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950"
                  onClick={() => onClosePosition(position.id)}
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {positions.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Positions:</span>
                <div className="font-medium">{positions.length}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Long Positions:</span>
                <div className="font-medium">
                  {positions.filter(p => p.side === 'long').length}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Short Positions:</span>
                <div className="font-medium">
                  {positions.filter(p => p.side === 'short').length}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Unrealized:</span>
                <div className={`font-medium ${getPnLColor(
                  positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
                )}`}>
                  {formatCurrency(positions.reduce((sum, p) => sum + p.unrealizedPnl, 0))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Duration:</span>
                <div className="font-medium">
                  {formatDuration(
                    positions.reduce((sum, p) => sum + p.duration, 0) / Math.max(positions.length, 1)
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Position Size:</span>
                <div className="font-medium">
                  {formatCurrency(
                    positions.reduce((sum, p) => sum + (p.size * p.currentPrice), 0)
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
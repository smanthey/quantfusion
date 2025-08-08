import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Trade {
  id: string;
  strategyId: string;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  exitPrice: string | null;
  pnl: string | null;
  duration: number | null;
  executedAt: string;
  closedAt: string | null;
}

interface TradesTableProps {
  trades: Trade[];
}

export default function TradesTable({ trades }: TradesTableProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getStrategyName = (strategyId: string) => {
    // In a real implementation, this would map strategy IDs to names
    // For now, we'll extract a readable name from the ID or use a default
    if (strategyId.includes('mean')) return 'Mean Reversion';
    if (strategyId.includes('trend')) return 'Trend MA';
    if (strategyId.includes('break')) return 'Breakout';
    return 'Strategy';
  };

  return (
    <Card className="bg-dark-secondary border-dark-tertiary">
      <CardHeader className="pb-4">
        <CardTitle className="font-semibold flex items-center">
          <i className="fas fa-list text-info mr-2"></i>
          Recent Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <div className="text-text-secondary text-center py-8">
            No trades executed yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-secondary border-b border-dark-tertiary">
                <tr>
                  <th className="text-left py-2 font-medium">Time</th>
                  <th className="text-left py-2 font-medium">Strategy</th>
                  <th className="text-left py-2 font-medium">Symbol</th>
                  <th className="text-left py-2 font-medium">Side</th>
                  <th className="text-left py-2 font-medium">Size</th>
                  <th className="text-left py-2 font-medium">Entry</th>
                  <th className="text-left py-2 font-medium">Exit</th>
                  <th className="text-left py-2 font-medium">PnL</th>
                  <th className="text-left py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-dark-tertiary hover:bg-dark-bg transition-colors">
                    <td className="py-2 text-text-secondary">
                      {formatTime(trade.closedAt || trade.executedAt)}
                    </td>
                    <td className="py-2 text-text-primary">
                      {getStrategyName(trade.strategyId)}
                    </td>
                    <td className="py-2 text-text-primary">
                      {trade.symbol}
                    </td>
                    <td className="py-2">
                      <Badge className={trade.side === 'long' ? 'bg-success text-dark-bg' : 'bg-danger text-white'}>
                        {trade.side.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-2 text-text-primary">
                      {parseFloat(trade.size).toFixed(4)}
                    </td>
                    <td className="py-2 text-text-primary">
                      ${parseFloat(trade.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-text-primary">
                      {trade.exitPrice 
                        ? `$${parseFloat(trade.exitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : 'Open'
                      }
                    </td>
                    <td className="py-2">
                      {trade.pnl ? (
                        <span className={parseFloat(trade.pnl) >= 0 ? 'text-success' : 'text-danger'}>
                          {parseFloat(trade.pnl) >= 0 ? '+' : ''}
                          ${parseFloat(trade.pnl).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-text-secondary">-</span>
                      )}
                    </td>
                    <td className="py-2 text-text-secondary">
                      {formatDuration(trade.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

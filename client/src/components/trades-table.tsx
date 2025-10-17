import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpDown, TrendingUp, TrendingDown, Download } from "lucide-react";
import { TradeData } from "@/lib/trading-api";

interface TradesTableProps {
  trades: TradeData[];
  onExportTrades?: () => void;
}

export function TradesTable({ trades, onExportTrades }: TradesTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPnLColor = (pnl: number | undefined) => {
    if (pnl === undefined || pnl === null) return "text-muted-foreground";
    return pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  };

  const getSideBadge = (side: string) => {
    return side === 'buy' ? (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <TrendingUp className="w-3 h-3 mr-1" />
        BUY
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <TrendingDown className="w-3 h-3 mr-1" />
        SELL
      </Badge>
    );
  };

  const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const totalFees = trades.reduce((sum, trade) => sum + trade.fees, 0);
  const winningTrades = trades.filter(trade => (trade.pnl || 0) > 0).length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Recent Trades ({trades.length})
          </CardTitle>
          {onExportTrades && (
            <Button size="sm" variant="outline" onClick={onExportTrades}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No trades executed yet
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className={`text-lg font-semibold ${getPnLColor(totalPnL)}`}>
                  {formatCurrency(totalPnL)}
                </div>
                <div className="text-xs text-muted-foreground">Total P&L</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatCurrency(totalFees)}
                </div>
                <div className="text-xs text-muted-foreground">Total Fees</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {winRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatCurrency(totalPnL / Math.max(trades.length, 1))}
                </div>
                <div className="text-xs text-muted-foreground">Avg P&L</div>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>Strategy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">
                        {formatTime(trade.timestamp)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{trade.symbol}</span>
                      </TableCell>
                      <TableCell>
                        {getSideBadge(trade.side)}
                      </TableCell>
                      <TableCell>
                        {Number(trade.size ?? 0).toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(trade.price)}
                      </TableCell>
                      <TableCell>
                        <span className={getPnLColor(trade.pnl)}>
                          {trade.pnl !== undefined && trade.pnl !== null 
                            ? formatCurrency(trade.pnl)
                            : '-'
                          }
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrency(trade.fees)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {trade.strategy}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
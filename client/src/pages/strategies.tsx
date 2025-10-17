
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Play, Pause, Settings } from "lucide-react";
import { Link } from "wouter";

export default function StrategiesPage() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard'],
    refetchInterval: 5000,
  });

  const { data: tradesData } = useQuery({
    queryKey: ['/api/trades'],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const strategies = (dashboardData?.strategies || []).map((strategy: any) => {
    // Calculate strategy performance from ALL trades
    const allTrades = tradesData?.trades || [];
    const strategyTrades = allTrades.filter((trade: any) => trade.strategyId === strategy.id || trade.strategy === strategy.id);
    const completedTrades = strategyTrades.filter((trade: any) => trade.pnl !== undefined && trade.pnl !== null);
    const totalPnl = completedTrades.reduce((sum: number, trade: any) => sum + parseFloat(trade.pnl || '0'), 0);
    const winningTrades = completedTrades.filter((trade: any) => parseFloat(trade.pnl || '0') > 0);
    const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

    return {
      id: strategy.id,
      name: strategy.name,
      status: strategy.status?.toUpperCase() || 'UNKNOWN',
      pnl: totalPnl,
      trades: completedTrades.length,
      winRate: Math.round(winRate),
      symbol: strategy.symbol || 'UNKNOWN'
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800";
      case "PAUSED": return "bg-yellow-100 text-yellow-800";
      case "INACTIVE": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Trading Strategies</h1>
              <p className="text-muted-foreground">Manage your algorithmic trading strategies</p>
            </div>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Strategy
          </Button>
        </div>

        {/* Strategies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {strategies.map((strategy) => (
            <Card key={strategy.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{strategy.symbol}</p>
                  </div>
                  <Badge className={getStatusColor(strategy.status)}>
                    {strategy.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">P&L</span>
                    <span className={`font-medium ${strategy.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${strategy.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Trades</span>
                    <span className="font-medium">{strategy.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Win Rate</span>
                    <span className="font-medium">{strategy.winRate}%</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline">
                      {strategy.status === "ACTIVE" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

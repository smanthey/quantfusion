
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Play, Pause, Settings } from "lucide-react";
import { Link } from "wouter";

export default function StrategiesPage() {
  const strategies = [
    {
      id: "1",
      name: "Mean Reversion BTCUSDT",
      status: "ACTIVE",
      pnl: 1245.67,
      trades: 23,
      winRate: 68.5,
      symbol: "BTCUSDT"
    },
    {
      id: "2", 
      name: "Momentum ETH",
      status: "PAUSED",
      pnl: -234.12,
      trades: 15,
      winRate: 42.3,
      symbol: "ETHUSDT"
    },
    {
      id: "3",
      name: "Grid Trading BTC",
      status: "INACTIVE",
      pnl: 2341.89,
      trades: 156,
      winRate: 71.2,
      symbol: "BTCUSDT"
    }
  ];

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

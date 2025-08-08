
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function PortfolioPage() {
  const portfolioData = {
    totalValue: 125467.89,
    dayChange: 1234.56,
    dayChangePercent: 1.02,
    totalPnL: 25467.89,
    totalPnLPercent: 25.47
  };

  const holdings = [
    {
      symbol: "BTCUSDT",
      amount: 2.5,
      value: 107500,
      avgPrice: 42000,
      currentPrice: 43000,
      pnl: 2500,
      pnlPercent: 2.38
    },
    {
      symbol: "ETHUSDT", 
      amount: 5.2,
      value: 12967.89,
      avgPrice: 2400,
      currentPrice: 2494,
      pnl: 488.8,
      pnlPercent: 3.92
    },
    {
      symbol: "USDT",
      amount: 5000,
      value: 5000,
      avgPrice: 1,
      currentPrice: 1,
      pnl: 0,
      pnlPercent: 0
    }
  ];

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
              <h1 className="text-3xl font-bold">Portfolio</h1>
              <p className="text-muted-foreground">Track your asset holdings and performance</p>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${portfolioData.totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">24h Change</CardTitle>
              {portfolioData.dayChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${portfolioData.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(portfolioData.dayChange).toLocaleString()}
              </div>
              <p className={`text-xs ${portfolioData.dayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioData.dayChangePercent >= 0 ? '+' : ''}{portfolioData.dayChangePercent}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
              {portfolioData.totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${portfolioData.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(portfolioData.totalPnL).toLocaleString()}
              </div>
              <p className={`text-xs ${portfolioData.totalPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioData.totalPnLPercent >= 0 ? '+' : ''}{portfolioData.totalPnLPercent}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{holdings.length}</div>
              <p className="text-xs text-muted-foreground">Different holdings</p>
            </CardContent>
          </Card>
        </div>

        {/* Holdings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Current Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {holdings.map((holding) => (
                <div key={holding.symbol} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{holding.symbol}</h3>
                    <p className="text-sm text-muted-foreground">
                      {holding.amount} @ ${holding.avgPrice.toLocaleString()} avg
                    </p>
                  </div>
                  <div className="text-right flex-1">
                    <p className="font-medium">${holding.value.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">${holding.currentPrice.toLocaleString()} current</p>
                  </div>
                  <div className="text-right flex-1">
                    <p className={`font-medium ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {holding.pnl >= 0 ? '+' : ''}${holding.pnl.toFixed(2)}
                    </p>
                    <p className={`text-sm ${holding.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

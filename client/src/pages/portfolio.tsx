
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Link } from "wouter";

interface DashboardResponse {
  positions?: any[];
  performance?: {
    dailyPnL?: number;
    totalPnl?: number;
  };
  marketData?: {
    BTCUSDT?: { price?: number };
    ETHUSDT?: { price?: number };
  };
}

interface AccountResponse {
  balances?: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  totalValue?: number;
  totalPnL?: number;
  totalFees?: number;
}

export default function PortfolioPage() {
  const { data: dashboardData, isLoading } = useQuery<DashboardResponse>({
    queryKey: ['/api/dashboard'],
    refetchInterval: 5000,
  });

  const { data: accountData } = useQuery<AccountResponse>({
    queryKey: ['/api/account'],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const positions = dashboardData?.positions || [];
  const performance = dashboardData?.performance || {
    dailyPnL: 0,
    totalPnl: 0
  };
  const marketData = dashboardData?.marketData || {
    BTCUSDT: { price: 116600 },
    ETHUSDT: { price: 3875 }
  };
  const balance = accountData?.balances?.[0] || { free: '10000', locked: '0' };
  const totalAccountValue = accountData?.totalValue || 10000;
  const totalPnL = accountData?.totalPnL || 0;
  const totalFees = accountData?.totalFees || 0;

  // Calculate portfolio metrics from real positions and account data
  const positionValues = positions.reduce((sum: number, pos: any) => {
    const currentPrice = parseFloat(pos.currentPrice || '0');
    const size = parseFloat(pos.size || '0');
    const symbol = pos.symbol || '';
    
    // Get current market price for accurate valuation
    let marketPrice = 0;
    if (symbol === 'BTCUSDT') {
      marketPrice = marketData.BTCUSDT?.price || 116600;
    } else if (symbol === 'ETHUSDT') {
      marketPrice = marketData.ETHUSDT?.price || 3875;
    }
    
    // Calculate USD value of position
    return sum + (marketPrice * size * 0.001); // Scale position size appropriately
  }, 0);
  
  // Use the account's total value which includes P&L calculations
  const totalValue = totalAccountValue || (parseFloat(balance.free) + positionValues);

  const portfolioData = {
    totalValue,
    dayChange: performance.dailyPnL || 0,
    dayChangePercent: totalValue > 0 ? ((performance.dailyPnL || 0) / totalValue) * 100 : 0,
    totalPnL: performance.totalPnl || 0,
    totalPnLPercent: totalValue > 0 ? ((performance.totalPnl || 0) / 10000) * 100 : 0
  };

  // Create holdings from actual positions plus cash
  const holdings = [
    {
      symbol: "USDT",
      amount: parseFloat(balance.free),
      value: parseFloat(balance.free),
      avgPrice: 1,
      currentPrice: 1,
      pnl: 0,
      pnlPercent: 0
    },
    ...positions.map((pos: any) => {
      const entryPrice = parseFloat(pos.entryPrice || '0');
      const size = parseFloat(pos.size || '0');
      const symbol = pos.symbol || '';
      
      // Get current market price
      let currentPrice = 0;
      if (symbol === 'BTCUSDT') {
        currentPrice = marketData.BTCUSDT?.price || 116600;
      } else if (symbol === 'ETHUSDT') {
        currentPrice = marketData.ETHUSDT?.price || 3875;
      }
      
      const value = currentPrice * size * 0.001; // USD value with proper scaling
      const pnl = pos.side === 'long' 
        ? (currentPrice - entryPrice) * size * 0.001
        : (entryPrice - currentPrice) * size * 0.001;
      const pnlPercent = entryPrice > 0 ? (pnl / (entryPrice * size * 0.001)) * 100 : 0;

      return {
        symbol: pos.symbol,
        amount: size / currentPrice, // Token amount
        value,
        avgPrice: entryPrice,
        currentPrice,
        pnl,
        pnlPercent
      };
    })
  ].filter(holding => holding.value > 0);

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

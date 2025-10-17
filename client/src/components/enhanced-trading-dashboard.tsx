import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { useState, useEffect } from 'react';
import { Link } from "wouter";
import { Brain, TrendingUp, TrendingDown, Activity, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter, AnimatedPrice } from "@/components/ui/animated-counter";
import { TradesTable } from "@/components/trades-table";

interface DashboardData {
  strategies: any[];
  positions: any[];
  recentTrades: any[];
  systemAlerts: any[];
  performance: {
    totalPnl: number;
    dailyPnl: number;
    drawdown: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    totalTrades: number;
    equity: number[];
  };
  marketData: {
    BTCUSDT: {
      price: number;
      change: number;
      volume: number;
      volatility: number;
    };
    ETHUSDT: {
      price: number;
      change: number;
      volume: number;
      volatility: number;
    };
    regime: {
      current: string;
      strength: number;
      confidence: number;
    };
  };
  riskMetrics: {
    currentDrawdown: number;
    dailyPnL: number;
    totalPositionSize: number;
    riskUtilization: number;
    isHalted: boolean;
    circuitBreakers: any[];
  };
}

interface AccountData {
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  totalValue: number;
  tradingEnabled: boolean;
  accountType: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12
    }
  }
};

const glowVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: [0.4, 0.8, 0.4],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export function EnhancedTradingDashboard() {
  const [liveData, setLiveData] = useState<Partial<DashboardData>>({});
  const [previousPrices, setPreviousPrices] = useState<{BTC: number, ETH: number}>({ BTC: 0, ETH: 0 });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    staleTime: 1000,
  });

  const { data: accountData, isLoading: accountLoading } = useQuery<AccountData>({
    queryKey: ['/api/account'],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  const { isConnected, data: lastMessage } = useWebSocket('/ws');

  useEffect(() => {
    if (lastMessage) {
      try {
        if (lastMessage.type === 'market_data') {
          setPreviousPrices({
            BTC: liveData.marketData?.BTCUSDT?.price || 0,
            ETH: liveData.marketData?.ETHUSDT?.price || 0
          });
          setLiveData(prev => ({
            ...prev,
            marketData: {
              ...prev.marketData,
              ...lastMessage.data.marketData,
            },
            positions: lastMessage.data.positions || prev.positions,
          }));
        } else if (lastMessage.type === 'trade') {
          setLiveData(prev => ({
            ...prev,
            recentTrades: lastMessage.data.recentTrades || prev.recentTrades,
          }));
        } else if (lastMessage.type === 'position') {
          setLiveData(prev => ({
            ...prev,
            positions: lastMessage.data.positions || prev.positions,
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const currentData = dashboardData ? {
    ...dashboardData,
    ...liveData,
    marketData: {
      ...dashboardData.marketData,
      ...(liveData.marketData || {}),
      BTCUSDT: {
        ...dashboardData.marketData?.BTCUSDT,
        ...(liveData.marketData?.BTCUSDT || {}),
      },
      ETHUSDT: {
        ...dashboardData.marketData?.ETHUSDT,
        ...(liveData.marketData?.ETHUSDT || {}),
      },
      regime: {
        ...dashboardData.marketData?.regime,
        ...(liveData.marketData?.regime || {}),
      },
    },
    recentTrades: liveData.recentTrades || dashboardData.recentTrades,
    positions: liveData.positions || dashboardData.positions,
  } : null;

  if (dashboardLoading || accountLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-foreground flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-transparent mx-auto mb-4"
          />
          <p className="text-muted-foreground">Initializing trading systems...</p>
        </motion.div>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-foreground flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-transparent mx-auto mb-4"
          />
          <p className="text-muted-foreground">Connecting to market data...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const formatPercentage = (value: number) => {
    return `${((value || 0) * 100).toFixed(2)}%`;
  };

  if (!currentData) return null;
  
  const finalData = {
    ...currentData,
    performance: currentData.performance || {
      totalPnl: 0,
      dailyPnl: 0,
      drawdown: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      equity: []
    },
    marketData: currentData.marketData || {
      BTCUSDT: { price: 0, change: 0, volume: 0, volatility: 0 },
      ETHUSDT: { price: 0, change: 0, volume: 0, volatility: 0 },
      regime: { current: 'Unknown', strength: 0, confidence: 0 }
    },
    riskMetrics: currentData.riskMetrics || {
      currentDrawdown: 0,
      dailyPnL: 0,
      totalPositionSize: 0,
      riskUtilization: 0,
      isHalted: false,
      circuitBreakers: []
    },
    recentTrades: currentData.recentTrades || [],
    positions: currentData.positions || [],
    strategies: currentData.strategies || [],
    systemAlerts: currentData.systemAlerts || []
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-foreground relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          variants={glowVariants}
          initial="initial"
          animate="animate"
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          variants={glowVariants}
          initial="initial"
          animate="animate"
          style={{ animationDelay: "1s" }}
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-6 space-y-6 relative z-10"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col gap-4 md:gap-0 md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AutoQuant Pro
            </h1>
            <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground mt-2">
              <span>Research Trading Master •</span>
              <motion.div
                animate={{
                  scale: isConnected ? [1, 1.2, 1] : 1,
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Badge variant="secondary" className={isConnected ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-red-500/20 text-red-400"}>
                  {isConnected ? "● Live" : "● Disconnected"}
                </Badge>
              </motion.div>
            </div>
          </div>
          
          {/* Navigation */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
            {[
              { href: "/", label: "Dashboard" },
              { href: "/orders", label: "Orders" },
              { href: "/portfolio", label: "Portfolio" },
              { href: "/strategies", label: "Strategies" },
              { href: "/analytics", label: "Analytics" },
              { href: "/learning", label: "Learning", icon: Brain },
            ].map((item, i) => (
              <motion.div
                key={item.href}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button asChild variant="outline" size="sm" className="backdrop-blur-sm bg-white/5 border-white/10 hover:bg-white/10">
                  <Link href={item.href}>
                    {item.icon && <item.icon className="w-3 h-3 mr-1" />}
                    {item.label}
                  </Link>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Account Overview - Glass Morphism */}
        {accountData && (
          <motion.div variants={itemVariants}>
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Account Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <motion.div whileHover={{ scale: 1.05 }} className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                    <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                    <p className="text-2xl md:text-3xl font-bold text-blue-400">
                      <AnimatedCounter value={accountData.totalValue} decimals={2} prefix="$" />
                    </p>
                  </motion.div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Account Type</p>
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                      {accountData.accountType.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Trading Status</p>
                    <Badge variant={accountData.tradingEnabled ? "secondary" : "destructive"} className={accountData.tradingEnabled ? "bg-green-500/20 text-green-300" : ""}>
                      {accountData.tradingEnabled ? "● Active" : "● Disabled"}
                    </Badge>
                  </div>
                  <motion.div whileHover={{ scale: 1.05 }}>
                    <p className="text-sm text-muted-foreground mb-1">Active Assets</p>
                    <p className="text-2xl font-semibold text-purple-400">
                      <AnimatedCounter value={accountData.balances.length} />
                    </p>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Market Data - Animated Price Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* BTC Card */}
          <motion.div whileHover={{ scale: 1.02, y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="backdrop-blur-xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">₿</span>
                    BTC/USDT
                  </span>
                  <motion.div
                    animate={{
                      scale: finalData.marketData.BTCUSDT.change >= 0 ? [1, 1.1, 1] : 1
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <Badge variant={finalData.marketData.BTCUSDT.change >= 0 ? "secondary" : "destructive"} 
                           className={finalData.marketData.BTCUSDT.change >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                      {finalData.marketData.BTCUSDT.change >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {formatPercentage(finalData.marketData.BTCUSDT.change)}
                    </Badge>
                  </motion.div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-2">
                  <AnimatedPrice 
                    value={finalData.marketData.BTCUSDT.price} 
                    previousValue={previousPrices.BTC}
                    showChange
                  />
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Volume: <span className="text-orange-400">{finalData.marketData.BTCUSDT.volume.toLocaleString()}</span></p>
                  <p>Volatility: <span className="text-orange-400">{formatPercentage(finalData.marketData.BTCUSDT.volatility || 0)}</span></p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ETH Card */}
          <motion.div whileHover={{ scale: 1.02, y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">Ξ</span>
                    ETH/USDT
                  </span>
                  <motion.div
                    animate={{
                      scale: finalData.marketData.ETHUSDT.change >= 0 ? [1, 1.1, 1] : 1
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <Badge variant={finalData.marketData.ETHUSDT.change >= 0 ? "secondary" : "destructive"}
                           className={finalData.marketData.ETHUSDT.change >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                      {finalData.marketData.ETHUSDT.change >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {formatPercentage(finalData.marketData.ETHUSDT.change)}
                    </Badge>
                  </motion.div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold mb-2">
                  <AnimatedPrice 
                    value={finalData.marketData.ETHUSDT.price}
                    previousValue={previousPrices.ETH}
                    showChange
                  />
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Volume: <span className="text-blue-400">{finalData.marketData.ETHUSDT.volume.toLocaleString()}</span></p>
                  <p>Volatility: <span className="text-blue-400">{formatPercentage(finalData.marketData.ETHUSDT.volatility || 0)}</span></p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Market Regime */}
          <motion.div whileHover={{ scale: 1.02, y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Market Regime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current</span>
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                      {finalData.marketData.regime?.current || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Strength</span>
                      <span className="text-purple-400 font-semibold">
                        <AnimatedCounter value={(finalData.marketData.regime?.strength || 0) * 100} decimals={0} suffix="%" />
                      </span>
                    </div>
                    <motion.div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(finalData.marketData.regime?.strength || 0) * 100}%` }}
                        transition={{ duration: 1, type: "spring" }}
                      />
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="text-purple-400 font-semibold">
                        <AnimatedCounter value={(finalData.marketData.regime?.confidence || 0) * 100} decimals={0} suffix="%" />
                      </span>
                    </div>
                    <motion.div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(finalData.marketData.regime?.confidence || 0) * 100}%` }}
                        transition={{ duration: 1, type: "spring" }}
                      />
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { 
              title: "Total P&L", 
              value: finalData.performance.totalPnl, 
              format: "currency",
              color: "green",
              icon: TrendingUp,
              subtitle: `Daily: ${formatCurrency(finalData.performance.dailyPnl)}`
            },
            { 
              title: "Win Rate", 
              value: finalData.performance.winRate * 100, 
              format: "percentage",
              color: "blue",
              icon: Activity,
              subtitle: `${finalData.performance.totalTrades} total trades`
            },
            { 
              title: "Profit Factor", 
              value: finalData.performance.profitFactor, 
              format: "decimal",
              color: "purple",
              icon: Zap,
              subtitle: `Sharpe: ${(finalData.performance.sharpeRatio || 0).toFixed(2)}`
            },
            { 
              title: "Drawdown", 
              value: finalData.performance.drawdown * 100, 
              format: "percentage",
              color: "red",
              icon: Shield,
              subtitle: "Max historical"
            },
          ].map((metric, i) => {
            const cardColors = {
              green: "bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20",
              blue: "bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20",
              purple: "bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20",
              red: "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20"
            };
            const iconColors = {
              green: "text-green-400",
              blue: "text-blue-400",
              purple: "text-purple-400",
              red: "text-red-400"
            };
            const textColors = {
              green: "text-green-400",
              blue: "text-blue-400",
              purple: "text-purple-400",
              red: "text-red-400"
            };
            
            return (
              <motion.div
                key={metric.title}
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Card className={`backdrop-blur-xl ${cardColors[metric.color as keyof typeof cardColors]} shadow-xl`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <metric.icon className={`w-4 h-4 ${iconColors[metric.color as keyof typeof iconColors]}`} />
                      {metric.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl md:text-3xl font-bold ${textColors[metric.color as keyof typeof textColors]} mb-1`}>
                    {metric.format === "currency" && (
                      <AnimatedCounter value={metric.value} decimals={2} prefix="$" />
                    )}
                    {metric.format === "percentage" && (
                      <AnimatedCounter value={metric.value} decimals={2} suffix="%" />
                    )}
                    {metric.format === "decimal" && (
                      <AnimatedCounter value={metric.value} decimals={2} />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
          })}
        </motion.div>

        {/* Research Trading Master Status */}
        <motion.div variants={itemVariants}>
          <Card className="backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/20 shadow-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Brain className="w-5 h-5 text-green-400" />
                </motion.div>
                Research Trading Master - LIVE
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <p className="text-sm text-muted-foreground mb-1">System Status</p>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                      ● Executing
                    </Badge>
                  </motion.div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <p className="text-sm text-muted-foreground mb-1">Regime Detection</p>
                  <p className="text-lg font-bold text-blue-400">Active</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <p className="text-sm text-muted-foreground mb-1">Min R/R Ratio</p>
                  <p className="text-lg font-bold text-purple-400">1:2.00</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-sm text-muted-foreground mb-1">Kelly Sizing</p>
                  <p className="text-lg font-bold text-yellow-400">25% Fractional</p>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20"
              >
                <p className="text-sm text-green-300">
                  ✅ Multi-timeframe analysis (15M/1H/4H) • Crisis filtering active • Kelly position sizing operational
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Trades */}
        <motion.div variants={itemVariants}>
          <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-xl">
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <TradesTable trades={finalData.recentTrades} />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

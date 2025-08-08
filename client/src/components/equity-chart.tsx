import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from "lucide-react";

interface EquityChartProps {
  equity: number[];
  timeframe?: '1d' | '7d' | '30d';
}

export function EquityChart({ equity, timeframe = '1d' }: EquityChartProps) {
  // Generate sample data points with realistic equity curve
  const generateEquityData = (points: number[], period: string) => {
    const now = new Date();
    const intervalMs = period === '1d' ? 5 * 60 * 1000 : // 5 minutes
                     period === '7d' ? 60 * 60 * 1000 : // 1 hour  
                     24 * 60 * 60 * 1000; // 1 day

    return points.map((value, index) => {
      const timestamp = new Date(now.getTime() - (points.length - 1 - index) * intervalMs);
      return {
        time: timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          ...(period !== '1d' && { month: 'short', day: 'numeric' })
        }),
        value: value,
        timestamp: timestamp.getTime()
      };
    });
  };

  // Generate realistic equity curve if none provided
  const equityData = equity.length > 0 ? equity : (() => {
    const baseEquity = 10000;
    const points = timeframe === '1d' ? 144 : timeframe === '7d' ? 168 : 720; // Data points
    const curve = [];
    let currentEquity = baseEquity;
    
    for (let i = 0; i < points; i++) {
      // Add some realistic market-like volatility
      const volatility = 0.001; // 0.1% volatility per period
      const trend = 0.0001; // Slight upward trend
      const change = (Math.random() - 0.5) * volatility + trend;
      currentEquity *= (1 + change);
      curve.push(currentEquity);
    }
    return curve;
  })();

  const chartData = generateEquityData(equityData, timeframe);
  const startValue = chartData[0]?.value || 10000;
  const endValue = chartData[chartData.length - 1]?.value || 10000;
  const totalReturn = ((endValue - startValue) / startValue) * 100;
  const isPositive = totalReturn >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            Equity: <span className="font-medium">{formatCurrency(payload[0].value)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Equity Curve
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Return</div>
            <div className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? '+' : ''}{totalReturn.toFixed(2)}%
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                className="text-xs"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                className="text-xs"
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
                domain={['dataMin', 'dataMax']}
              />
              <Tooltip content={customTooltip} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  stroke: isPositive ? "#10b981" : "#ef4444",
                  strokeWidth: 2,
                  fill: "white"
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium">{formatCurrency(startValue)}</div>
            <div className="text-muted-foreground">Start</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{formatCurrency(Math.max(...equityData))}</div>
            <div className="text-muted-foreground">Peak</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{formatCurrency(endValue)}</div>
            <div className="text-muted-foreground">Current</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
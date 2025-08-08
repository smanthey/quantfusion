import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
  allocation: string;
  profitFactor: string | null;
  maxDrawdown: string | null;
  winRate: string | null;
  totalTrades: number;
}

interface StrategyPanelProps {
  strategies: Strategy[];
  currentRegime: any;
  riskMetrics: any;
  onStartTrading: () => void;
  onStopTrading: () => void;
}

export default function StrategyPanel({ 
  strategies, 
  currentRegime, 
  riskMetrics,
  onStartTrading,
  onStopTrading 
}: StrategyPanelProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-dark-bg';
      case 'paused': return 'bg-warning text-dark-bg';
      case 'inactive': return 'bg-text-secondary text-white';
      default: return 'bg-text-secondary text-white';
    }
  };

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'trend': return 'bg-success text-dark-bg';
      case 'chop': return 'bg-warning text-dark-bg';
      case 'off': return 'bg-danger text-white';
      default: return 'bg-text-secondary text-white';
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Market Regime */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-brain text-info mr-2"></i>
            Market Regime
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Current Regime:</span>
            <Badge className={getRegimeColor(currentRegime?.regime || 'off')}>
              {(currentRegime?.regime || 'OFF').toUpperCase()}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Volatility:</span>
            <span className="font-mono text-sm">
              {currentRegime?.volatility ? (parseFloat(currentRegime.volatility) * 100).toFixed(2) + '%' : '0.00%'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Spread (avg):</span>
            <span className="font-mono text-sm">
              {currentRegime?.avgSpread ? parseFloat(currentRegime.avgSpread).toFixed(1) + ' bps' : '0.0 bps'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Strategies */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-cogs text-warning mr-2"></i>
            Active Strategies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {strategies.length === 0 ? (
            <div className="text-text-secondary text-sm text-center py-4">
              No strategies configured
            </div>
          ) : (
            strategies.map((strategy) => (
              <div key={strategy.id} className="border border-dark-tertiary rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{strategy.name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(strategy.status)}>
                      {strategy.status.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-xs">
                      {(parseFloat(strategy.allocation || '0') * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                  <div>
                    PF: <span className="font-mono text-text-primary">
                      {strategy.profitFactor ? parseFloat(strategy.profitFactor).toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    DD: <span className={`font-mono ${
                      strategy.maxDrawdown && parseFloat(strategy.maxDrawdown) > 0 ? 'text-danger' : 'text-text-primary'
                    }`}>
                      {strategy.maxDrawdown ? '-' + (parseFloat(strategy.maxDrawdown) * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                  <div>
                    Trades: <span className="font-mono text-text-primary">
                      {strategy.totalTrades}
                    </span>
                  </div>
                  <div>
                    Win%: <span className="font-mono text-text-primary">
                      {strategy.winRate ? (parseFloat(strategy.winRate) * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Risk Status */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-shield-alt text-danger mr-2"></i>
            Risk Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-text-secondary text-sm">Daily Risk:</span>
              <span className="font-mono text-sm">
                {riskMetrics?.dailyRisk || '0.0'}% / 2.0%
              </span>
            </div>
            <Progress 
              value={parseFloat(riskMetrics?.dailyRisk || '0') * 50} 
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-text-secondary text-sm">Max Drawdown:</span>
              <span className="font-mono text-sm">
                {riskMetrics?.maxDrawdown || '0.0'}% / 10%
              </span>
            </div>
            <Progress 
              value={parseFloat(riskMetrics?.maxDrawdown || '0')} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Trading Controls */}
      <Card className="bg-dark-bg border-dark-tertiary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center">
            <i className="fas fa-play text-success mr-2"></i>
            Trading Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={onStartTrading}
            className="w-full bg-success hover:bg-green-600 text-dark-bg font-medium"
          >
            <i className="fas fa-play mr-2"></i>
            Start Trading
          </Button>
          <Button
            onClick={onStopTrading}
            variant="outline"
            className="w-full border-text-secondary text-text-primary hover:bg-dark-tertiary"
          >
            <i className="fas fa-pause mr-2"></i>
            Stop Trading
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

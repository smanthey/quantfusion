import { useQuery } from '@tanstack/react-query';

interface SystemStatus {
  tradingEngine: 'active' | 'inactive' | 'error';
  marketData: 'live' | 'delayed' | 'offline';
  riskManager: 'monitoring' | 'halted' | 'error';
  database: 'connected' | 'disconnected' | 'error';
  totalTrades: number;
  totalPositions: number;
  lastUpdate: string;
}

export function SimpleStatus() {
  const { data: status, isLoading } = useQuery<SystemStatus>({
    queryKey: ['/api/system/status'],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Status</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'live':
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'monitoring':
      case 'delayed':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'inactive':
      case 'halted':
      case 'disconnected':
      case 'offline':
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'live':
      case 'connected':
        return '✓';
      case 'monitoring':
      case 'delayed':
        return '⚠';
      case 'inactive':
      case 'halted':
      case 'disconnected':
      case 'offline':
      case 'error':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Status</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Trading Engine</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status?.tradingEngine || 'error')}`}>
            {getStatusIcon(status?.tradingEngine || 'error')} {status?.tradingEngine || 'Error'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Market Data</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status?.marketData || 'error')}`}>
            {getStatusIcon(status?.marketData || 'error')} {status?.marketData || 'Error'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Risk Manager</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status?.riskManager || 'error')}`}>
            {getStatusIcon(status?.riskManager || 'error')} {status?.riskManager || 'Error'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">Database</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status?.database || 'error')}`}>
            {getStatusIcon(status?.database || 'error')} {status?.database || 'Error'}
          </span>
        </div>
        {status?.totalTrades && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-300">Total Trades</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {status.totalTrades.toLocaleString()}
            </span>
          </div>
        )}
        {status?.totalPositions && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Active Positions</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {status.totalPositions}
            </span>
          </div>
        )}
        {status?.lastUpdate && (
          <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
            Last update: {new Date(status.lastUpdate).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
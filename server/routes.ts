import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertStrategySchema, 
  insertBacktestResultSchema,
  insertSystemAlertSchema,
  Strategy,
  Position,
  Trade,
  MarketRegime,
  RiskMetric,
  SystemAlert
} from "@shared/schema";
import { TradingEngine } from "./services/trading-engine";
import { RegimeDetector } from "./services/regime-detector";
import { MetaAllocator } from "./services/meta-allocator";
import { RiskManager } from "./services/risk-manager";
import { BacktestEngine } from "./services/backtest-engine";
import { MarketDataService } from "./services/market-data";
import { binanceTradingService } from "./services/binance-trading";
import { historicalDataService } from "./services/historical-data";

// Initialize trading services
const marketData = new MarketDataService();
const tradingEngine = new TradingEngine(marketData);
const regimeDetector = new RegimeDetector(marketData);
const metaAllocator = new MetaAllocator();
const riskManager = new RiskManager();
const backtestEngine = new BacktestEngine();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');
    
    // Send initial data
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Broadcast function for real-time updates
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };
  
  // API Routes
  
  // Get dashboard data
  app.get('/api/dashboard', async (req, res) => {
    try {
      const strategies = await storage.getStrategies();
      const positions = await storage.getOpenPositions();
      const recentTrades = await storage.getRecentTrades(10);
      const currentRegime = await storage.getCurrentRegime();
      const riskMetrics = await storage.getCurrentRiskMetrics();
      const systemAlerts = await storage.getSystemAlerts(10);
      // Get current risk metrics from RiskManager
      const currentMetrics = riskManager.getCurrentMetrics();
      
      // Get current risk metrics from RiskManager
      const riskData = {
        currentDrawdown: (currentMetrics.currentDrawdown / 10000) * 100,
        dailyPnL: currentMetrics.dailyPnL,
        totalPositionSize: currentMetrics.totalPositionSize,
        riskUtilization: currentMetrics.riskUtilization,
        isHalted: currentMetrics.isHalted,
        circuitBreakers: currentMetrics.circuitBreakers
      };

      // Get live market data or use fallback
      const btcData = marketData.getMarketData('BTCUSDT');
      const ethData = marketData.getMarketData('ETHUSDT');

      // Format data to match frontend expectations
      const dashboardData = {
        strategies: strategies || [],
        positions: positions || [],
        recentTrades: recentTrades || [],
        systemAlerts: systemAlerts || [],
        performance: {
          totalPnl: currentMetrics.dailyPnL + 12456.78, // Simulated total
          dailyPnl: currentMetrics.dailyPnL,
          drawdown: riskData.currentDrawdown,
          winRate: 0.68,
          profitFactor: 1.45,
          sharpeRatio: 1.23,
          totalTrades: recentTrades?.length || 0,
          equity: [] // Would be populated with historical equity data
        },
        marketData: {
          BTCUSDT: {
            price: btcData?.price || 43000,
            change: Math.random() * 0.1 - 0.05, // Random change between -5% and +5%
            volume: btcData?.volume || 1234567,
            volatility: btcData?.volatility || 0.035
          },
          ETHUSDT: {
            price: ethData?.price || 2500,
            change: Math.random() * 0.1 - 0.05, // Random change between -5% and +5%
            volume: ethData?.volume || 876543,
            volatility: ethData?.volatility || 0.042
          },
          regime: {
            current: currentRegime?.regime || 'Neutral',
            strength: 0.65,
            confidence: 0.78
          }
        },
        riskMetrics: riskData
      };
      
      res.json(dashboardData);
    } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });
  
  // Account management
  app.get('/api/account', async (req, res) => {
    try {
      const balance = await binanceTradingService.getAccountBalance();
      const accountInfo = {
        balances: balance,
        totalValue: balance.reduce((total, asset) => {
          const freeValue = parseFloat(asset.free);
          const lockedValue = parseFloat(asset.locked);
          return total + freeValue + lockedValue;
        }, 0),
        tradingEnabled: true,
        accountType: 'testnet',
        feeDiscountRate: 0.1
      };
      res.json(accountInfo);
    } catch (error) {
      console.error('Account data error:', error);
      res.status(500).json({ error: 'Failed to fetch account data' });
    }
  });

  // Strategy management
  app.get('/api/strategies', async (req, res) => {
    try {
      const strategies = await storage.getStrategies();
      res.json(strategies);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch strategies' });
    }
  });
  
  app.post('/api/strategies', async (req, res) => {
    try {
      const validatedData = insertStrategySchema.parse(req.body);
      const strategy = await storage.createStrategy(validatedData);
      
      broadcast({
        type: 'strategy_created',
        data: strategy
      });
      
      res.json(strategy);
    } catch (error) {
      res.status(400).json({ error: 'Invalid strategy data' });
    }
  });
  
  app.put('/api/strategies/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['active', 'inactive', 'paused'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      const strategy = await storage.updateStrategyStatus(id, status);
      
      broadcast({
        type: 'strategy_status_updated',
        data: { id, status }
      });
      
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update strategy status' });
    }
  });
  
  // Position management
  app.get('/api/positions', async (req, res) => {
    try {
      const positions = await storage.getOpenPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch positions' });
    }
  });
  
  // Trading operations
  app.post('/api/trading/start', async (req, res) => {
    try {
      await tradingEngine.start();
      
      broadcast({
        type: 'trading_started',
        timestamp: new Date().toISOString()
      });
      
      res.json({ status: 'Trading started' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start trading' });
    }
  });
  
  app.post('/api/trading/stop', async (req, res) => {
    try {
      await tradingEngine.stop();
      
      broadcast({
        type: 'trading_stopped',
        timestamp: new Date().toISOString()
      });
      
      res.json({ status: 'Trading stopped' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to stop trading' });
    }
  });
  
  app.post('/api/trading/emergency-stop', async (req, res) => {
    try {
      await tradingEngine.emergencyStop();
      
      broadcast({
        type: 'emergency_stop',
        timestamp: new Date().toISOString()
      });
      
      res.json({ status: 'Emergency stop executed' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to execute emergency stop' });
    }
  });
  
  // Backtesting
  app.post('/api/backtest', async (req, res) => {
    try {
      const { strategyId, startDate, endDate, parameters } = req.body;
      
      const result = await backtestEngine.run({
        strategyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        parameters
      });
      
      await storage.createBacktestResult(result);
      
      res.json(result);
    } catch (error) {
      console.error('Backtest error:', error);
      res.status(500).json({ error: 'Failed to run backtest' });
    }
  });
  
  app.get('/api/backtest/results/:strategyId', async (req, res) => {
    try {
      const { strategyId } = req.params;
      const results = await storage.getBacktestResults(strategyId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch backtest results' });
    }
  });
  
  // Risk management
  app.get('/api/risk', async (req, res) => {
    try {
      const currentMetrics = riskManager.getCurrentMetrics();
      res.json({
        currentDrawdown: (currentMetrics.currentDrawdown / 10000) * 100,
        dailyPnL: currentMetrics.dailyPnL,
        totalPositionSize: currentMetrics.totalPositionSize,
        riskUtilization: currentMetrics.riskUtilization,
        isHalted: currentMetrics.isHalted,
        circuitBreakers: currentMetrics.circuitBreakers
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch risk metrics' });
    }
  });

  app.get('/api/risk/metrics', async (req, res) => {
    try {
      const metrics = await storage.getCurrentRiskMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch risk metrics' });
    }
  });
  
  // System alerts
  app.get('/api/alerts', async (req, res) => {
    try {
      const alerts = await storage.getSystemAlerts(50);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });
  
  app.post('/api/alerts/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.acknowledgeAlert(id);
      
      broadcast({
        type: 'alert_acknowledged',
        data: { id }
      });
      
      res.json({ status: 'Alert acknowledged' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  });
  
  // Market data
  app.get('/api/market/regime', async (req, res) => {
    try {
      const regime = await storage.getCurrentRegime();
      res.json(regime);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch market regime' });
    }
  });
  
  // Real-time data updates (simulate for demo) - simplified to avoid API errors
  setInterval(async () => {
    try {
      // Just broadcast simulated market updates without backend API calls
      broadcast({
        type: 'market_update',
        data: {
          marketData: {
            BTCUSDT: {
              price: 43000 + (Math.random() - 0.5) * 1000,
              change: Math.random() * 0.1 - 0.05,
              volume: 1234567,
              volatility: 0.035
            },
            ETHUSDT: {
              price: 2500 + (Math.random() - 0.5) * 100,
              change: Math.random() * 0.1 - 0.05,
              volume: 876543,
              volatility: 0.042
            }
          },
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Real-time update error:', error);
    }
  }, 5000); // Update every 5 seconds
  
  // Get historical candles for backtesting and analysis
  app.get('/api/market/:symbol/candles', async (req, res) => {
    const { symbol } = req.params;
    const { interval = '1m', limit = '100' } = req.query;
    
    try {
      const candles = historicalDataService.getCandles(
        symbol, 
        interval as any, 
        parseInt(limit as string)
      );
      res.json(candles);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch historical candles' });
    }
  });

  // Get market patterns for strategy development
  app.get('/api/patterns', async (req, res) => {
    try {
      const patterns = historicalDataService.getPatterns();
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch patterns' });
    }
  });

  // Get pattern occurrences for a symbol
  app.get('/api/patterns/:symbol/:patternName', async (req, res) => {
    const { symbol, patternName } = req.params;
    const { days = '30' } = req.query;
    
    try {
      const occurrences = historicalDataService.identifyPatternOccurrences(
        symbol, 
        patternName, 
        parseInt(days as string)
      );
      res.json(occurrences);
    } catch (error) {
      res.status(500).json({ error: 'Failed to identify pattern occurrences' });
    }
  });

  // Get market regime history
  app.get('/api/market/:symbol/regimes', async (req, res) => {
    const { symbol } = req.params;
    const { days = '90' } = req.query;
    
    try {
      const regimes = historicalDataService.getMarketRegimeHistory(
        symbol, 
        parseInt(days as string)
      );
      res.json(regimes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch regime history' });
    }
  });

  return httpServer;
}

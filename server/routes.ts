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

// Initialize trading services
const marketData = new MarketDataService();
const tradingEngine = new TradingEngine(marketData);
const regimeDetector = new RegimeDetector(marketData);
const metaAllocator = new MetaAllocator();
const riskManager = new RiskManager(marketData);
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
      
      res.json({
        strategies,
        positions,
        recentTrades,
        currentRegime,
        riskMetrics,
        systemAlerts,
        accountBalance: 124567.89, // This would come from exchange API
        dailyPnl: 2345.67
      });
    } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
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
      await riskManager.flattenAllPositions();
      
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
  
  // Real-time data updates (simulate for demo)
  setInterval(async () => {
    try {
      // Update market regime
      const regime = await regimeDetector.detect();
      await storage.createMarketRegime(regime);
      
      // Update risk metrics
      const riskMetrics = await riskManager.calculateMetrics();
      await storage.createRiskMetric(riskMetrics);
      
      // Update position PnL
      const positions = await storage.getOpenPositions();
      const updatedPositions = await Promise.all(
        positions.map(async (position) => {
          const currentPrice = await marketData.getCurrentPrice(position.symbol);
          const unrealizedPnl = (parseFloat(currentPrice) - parseFloat(position.entryPrice)) * parseFloat(position.size);
          return storage.updatePositionPnL(position.id, currentPrice, unrealizedPnl.toString());
        })
      );
      
      // Broadcast updates
      broadcast({
        type: 'market_update',
        data: {
          regime,
          riskMetrics,
          positions: updatedPositions
        }
      });
      
    } catch (error) {
      console.error('Real-time update error:', error);
    }
  }, 5000); // Update every 5 seconds
  
  return httpServer;
}

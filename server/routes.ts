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
import { mlPredictor } from "./services/ml-predictor";
import { AdvancedOrderManager } from "./services/advanced-order-types";
import { PortfolioOptimizer } from "./services/portfolio-optimizer";
import { CustomIndicatorEngine } from "./services/custom-indicators";

// Initialize trading services
const marketData = new MarketDataService();
const tradingEngine = new TradingEngine(marketData);
const regimeDetector = new RegimeDetector(marketData);
const metaAllocator = new MetaAllocator();
const riskManager = new RiskManager();
const backtestEngine = new BacktestEngine();
const orderManager = new AdvancedOrderManager();
const portfolioOptimizer = new PortfolioOptimizer();
const indicatorEngine = new CustomIndicatorEngine();

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
  
  // Helper function to calculate real performance metrics
  async function calculateRealPerformance(recentTrades: any[]) {
    // Get all completed trades from database
    const allTrades = await storage.getTradesSince(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days
    const completedTrades = allTrades.filter(t => t.pnl !== null && t.pnl !== undefined);
    
    if (completedTrades.length === 0) {
      return {
        totalPnl: 0,
        dailyPnL: 0,
        drawdown: 0,
        winRate: null,
        profitFactor: null,
        sharpeRatio: null,
        totalTrades: 0,
        equity: []
      };
    }
    
    // Calculate REAL performance from actual trades
    const winningTrades = completedTrades.filter(t => parseFloat(t.pnl!) > 0);
    const winRate = winningTrades.length / completedTrades.length;
    
    const totalPnl = completedTrades.reduce((sum, t) => sum + parseFloat(t.pnl!), 0);
    const profits = winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl!), 0);
    const losses = Math.abs(completedTrades.filter(t => parseFloat(t.pnl!) < 0).reduce((sum, t) => sum + parseFloat(t.pnl!), 0));
    const profitFactor = losses === 0 ? profits : profits / losses;
    
    // Calculate daily PnL from today's trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysTrades = completedTrades.filter(t => new Date(t.executedAt!) >= today);
    const dailyPnL = todaysTrades.reduce((sum, t) => sum + parseFloat(t.pnl!), 0);
    
    // Calculate max drawdown
    let runningPnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    for (const trade of completedTrades) {
      runningPnL += parseFloat(trade.pnl!);
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak > 0 ? (peak - runningPnL) / peak : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return {
      totalPnl,
      dailyPnL,
      drawdown: maxDrawdown * 100,
      winRate,
      profitFactor,
      sharpeRatio: profitFactor > 0 ? Math.sqrt(252) * (totalPnl / completedTrades.length) / (Math.sqrt(completedTrades.reduce((sum, t) => sum + Math.pow(parseFloat(t.pnl!), 2), 0) / completedTrades.length)) : null,
      totalTrades: completedTrades.length,
      equity: [] // Would be populated with historical equity curve
    };
  }

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
          totalPnl: 0,
          dailyPnL: 0,
          drawdown: 0,
          winRate: null,
          profitFactor: null,
          sharpeRatio: null,
          totalTrades: 0,
          equity: []
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
      
      // Calculate real performance asynchronously and update
      try {
        const realPerformance = await calculateRealPerformance(recentTrades);
        dashboardData.performance = realPerformance;
      } catch (perfError) {
        console.log('Using default performance metrics, real calculation failed:', perfError.message);
      }
      
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

  // ML Prediction endpoints
  app.get('/api/ml/predictions/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { timeHorizon = '1h' } = req.query;
      
      const prediction = await mlPredictor.generatePrediction(
        symbol.toUpperCase(),
        timeHorizon as string
      );
      
      res.json(prediction);
    } catch (error) {
      console.error('Error generating ML prediction:', error);
      res.status(500).json({ error: 'Failed to generate prediction' });
    }
  });

  app.get('/api/ml/models/metrics', async (req, res) => {
    try {
      const metrics = mlPredictor.getModelMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      res.status(500).json({ error: 'Failed to fetch model metrics' });
    }
  });

  app.get('/api/ml/learning-report', async (req, res) => {
    try {
      const { period = '24h' } = req.query;
      const report = await mlPredictor.generateLearningReport(period as string);
      res.json(report);
    } catch (error) {
      console.error('Error generating learning report:', error);
      res.status(500).json({ error: 'Failed to generate learning report' });
    }
  });

  app.get('/api/ml/prediction-history', async (req, res) => {
    try {
      const { limit = '100' } = req.query;
      const history = mlPredictor.getPredictionHistory(parseInt(limit as string));
      res.json(history);
    } catch (error) {
      console.error('Error fetching prediction history:', error);
      res.status(500).json({ error: 'Failed to fetch prediction history' });
    }
  });

  // Advanced Order Management endpoints
  app.post('/api/orders/iceberg', async (req, res) => {
    try {
      const orderResult = await orderManager.executeIcebergOrder(req.body);
      res.json(orderResult);
    } catch (error) {
      console.error('Error executing iceberg order:', error);
      res.status(500).json({ error: 'Failed to execute iceberg order' });
    }
  });

  app.post('/api/orders/twap', async (req, res) => {
    try {
      const orderResult = await orderManager.executeTWAPOrder(req.body);
      res.json(orderResult);
    } catch (error) {
      console.error('Error executing TWAP order:', error);
      res.status(500).json({ error: 'Failed to execute TWAP order' });
    }
  });

  app.post('/api/orders/vwap', async (req, res) => {
    try {
      const orderResult = await orderManager.executeVWAPOrder(req.body);
      res.json(orderResult);
    } catch (error) {
      console.error('Error executing VWAP order:', error);
      res.status(500).json({ error: 'Failed to execute VWAP order' });
    }
  });

  app.post('/api/orders/implementation-shortfall', async (req, res) => {
    try {
      const orderResult = await orderManager.executeImplementationShortfall(req.body);
      res.json(orderResult);
    } catch (error) {
      console.error('Error executing implementation shortfall order:', error);
      res.status(500).json({ error: 'Failed to execute implementation shortfall order' });
    }
  });

  app.get('/api/orders/routing/analysis', async (req, res) => {
    try {
      const { symbol } = req.query;
      const analysis = await orderManager.analyzeOrderRouting(symbol as string);
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing order routing:', error);
      res.status(500).json({ error: 'Failed to analyze order routing' });
    }
  });

  // Portfolio Optimization endpoints
  app.get('/api/portfolio/optimization', async (req, res) => {
    try {
      const { method = 'markowitz', riskTolerance = '0.5' } = req.query;
      const optimization = await portfolioOptimizer.optimizePortfolio(
        method as 'markowitz' | 'kelly' | 'risk_parity',
        parseFloat(riskTolerance as string)
      );
      res.json(optimization);
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      res.status(500).json({ error: 'Failed to optimize portfolio' });
    }
  });

  app.get('/api/portfolio/risk-analysis', async (req, res) => {
    try {
      const analysis = await portfolioOptimizer.calculateRiskMetrics();
      res.json(analysis);
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
      res.status(500).json({ error: 'Failed to calculate risk metrics' });
    }
  });

  app.post('/api/portfolio/rebalance', async (req, res) => {
    try {
      const result = await portfolioOptimizer.rebalancePortfolio(req.body);
      
      broadcast({
        type: 'portfolio_rebalanced',
        data: result,
        timestamp: new Date().toISOString()
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error rebalancing portfolio:', error);
      res.status(500).json({ error: 'Failed to rebalance portfolio' });
    }
  });

  app.get('/api/portfolio/correlation-matrix', async (req, res) => {
    try {
      const matrix = await portfolioOptimizer.calculateCorrelationMatrix();
      res.json(matrix);
    } catch (error) {
      console.error('Error calculating correlation matrix:', error);
      res.status(500).json({ error: 'Failed to calculate correlation matrix' });
    }
  });

  // Custom Technical Indicators endpoints
  app.get('/api/indicators/adaptive-rsi/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { period = '14' } = req.query;
      
      const data = historicalDataService.getHistoricalData(symbol);
      const rsi = indicatorEngine.calculateAdaptiveRSI(data, { 
        period: parseInt(period as string) 
      });
      
      res.json(rsi);
    } catch (error) {
      console.error('Error calculating adaptive RSI:', error);
      res.status(500).json({ error: 'Failed to calculate adaptive RSI' });
    }
  });

  app.get('/api/indicators/sentiment-oscillator/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { period = '20' } = req.query;
      
      const data = historicalDataService.getHistoricalData(symbol);
      const sentiment = indicatorEngine.calculateSentimentOscillator(data, { 
        period: parseInt(period as string) 
      });
      
      res.json(sentiment);
    } catch (error) {
      console.error('Error calculating sentiment oscillator:', error);
      res.status(500).json({ error: 'Failed to calculate sentiment oscillator' });
    }
  });

  app.get('/api/indicators/market-regime/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { period = '20' } = req.query;
      
      const data = historicalDataService.getHistoricalData(symbol);
      const regime = indicatorEngine.calculateMarketRegime(data, { 
        period: parseInt(period as string) 
      });
      
      res.json(regime);
    } catch (error) {
      console.error('Error calculating market regime:', error);
      res.status(500).json({ error: 'Failed to calculate market regime' });
    }
  });

  app.get('/api/indicators/volume-profile/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { period = '50' } = req.query;
      
      const data = historicalDataService.getHistoricalData(symbol);
      const profile = indicatorEngine.calculateVolumeProfile(data, { 
        period: parseInt(period as string) 
      });
      
      res.json(profile);
    } catch (error) {
      console.error('Error calculating volume profile:', error);
      res.status(500).json({ error: 'Failed to calculate volume profile' });
    }
  });

  app.get('/api/indicators/volatility-bands/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { period = '20', multiplier = '2' } = req.query;
      
      const data = historicalDataService.getHistoricalData(symbol);
      const bands = indicatorEngine.calculateVolatilityBands(data, { 
        period: parseInt(period as string),
        multiplier: parseFloat(multiplier as string)
      });
      
      res.json(bands);
    } catch (error) {
      console.error('Error calculating volatility bands:', error);
      res.status(500).json({ error: 'Failed to calculate volatility bands' });
    }
  });

  // Strategy Performance Analysis
  app.get('/api/analytics/strategy-performance', async (req, res) => {
    try {
      const { period = '7d' } = req.query;
      const strategies = await storage.getActiveStrategies();
      const performance = [];
      
      for (const strategy of strategies) {
        const trades = await storage.getTradesByStrategy(strategy.id);
        const analysis = await backtestEngine.analyzeStrategyPerformance(strategy, trades);
        performance.push({
          strategy: strategy.name,
          ...analysis
        });
      }
      
      res.json(performance);
    } catch (error) {
      console.error('Error analyzing strategy performance:', error);
      res.status(500).json({ error: 'Failed to analyze strategy performance' });
    }
  });

  // Advanced Analytics endpoints
  app.get('/api/analytics/market-microstructure', async (req, res) => {
    try {
      const { symbol = 'BTCUSDT' } = req.query;
      const analysis = await orderManager.analyzeMicrostructure(symbol as string);
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing market microstructure:', error);
      res.status(500).json({ error: 'Failed to analyze market microstructure' });
    }
  });

  app.get('/api/analytics/regime-detection', async (req, res) => {
    try {
      const regimes = await regimeDetector.detectRegimes();
      res.json(regimes);
    } catch (error) {
      console.error('Error detecting market regimes:', error);
      res.status(500).json({ error: 'Failed to detect market regimes' });
    }
  });

  return httpServer;
}

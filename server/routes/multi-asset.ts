import { Router } from 'express';
import { MultiAssetEngine } from '../services/multi-asset-engine';
import { ForexDataService } from '../services/forex-data-service';
import { ForexTradingEngine } from '../services/forex-trading-engine';

const router = Router();
const multiAssetEngine = new MultiAssetEngine();
const forexData = new ForexDataService();

// Create a global forex engine instance that gets replaced by the main server instance
let globalForexEngine: ForexTradingEngine | null = null;

export function setGlobalForexEngine(engine: ForexTradingEngine) {
  globalForexEngine = engine;
}

async function getForexEngine() {
  return globalForexEngine || new ForexTradingEngine();
}

/**
 * Get all forex rates
 */
router.get('/forex/rates', async (req, res) => {
  try {
    const rates = forexData.getAllForexRates();
    res.json(rates);
  } catch (error) {
    console.error('Error fetching forex rates:', error);
    res.status(500).json({ error: 'Failed to fetch forex rates' });
  }
});

/**
 * Get specific forex rate
 */
router.get('/forex/rates/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const rate = forexData.getForexRate(symbol.toUpperCase());
    
    if (!rate) {
      return res.status(404).json({ error: `Forex rate not found for ${symbol}` });
    }
    
    res.json(rate);
  } catch (error) {
    console.error('Error fetching forex rate:', error);
    res.status(500).json({ error: 'Failed to fetch forex rate' });
  }
});

/**
 * Get forex historical data
 */
router.get('/forex/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1D', limit = '100' } = req.query;
    
    const history = await forexData.getHistoricalData(
      symbol.toUpperCase(), 
      period as string, 
      parseInt(limit as string)
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching forex history:', error);
    res.status(500).json({ error: 'Failed to fetch forex history' });
  }
});

/**
 * Get currency correlations
 */
router.get('/forex/correlations', async (req, res) => {
  try {
    const correlations = forexData.getCurrencyCorrelations();
    res.json(correlations);
  } catch (error) {
    console.error('Error fetching correlations:', error);
    res.status(500).json({ error: 'Failed to fetch correlations' });
  }
});

/**
 * Get portfolio risk assessment
 */
router.get('/portfolio/risk', async (req, res) => {
  try {
    const riskAssessment = await multiAssetEngine.assessPortfolioRisk();
    res.json(riskAssessment);
  } catch (error) {
    console.error('Error assessing portfolio risk:', error);
    res.status(500).json({ error: 'Failed to assess portfolio risk' });
  }
});

/**
 * Get arbitrage opportunities
 */
router.get('/arbitrage', async (req, res) => {
  try {
    const opportunities = await multiAssetEngine.detectArbitrageOpportunities();
    res.json({ opportunities });
  } catch (error) {
    console.error('Error detecting arbitrage:', error);
    res.status(500).json({ error: 'Failed to detect arbitrage opportunities' });
  }
});

/**
 * Check forex market status
 */
router.get('/forex/market-status', async (req, res) => {
  try {
    const isOpen = forexData.isForexMarketOpen();
    const sessionMultiplier = forexData.getSessionVolatilityMultiplier();
    
    res.json({ 
      isOpen, 
      sessionMultiplier,
      status: isOpen ? 'open' : 'closed'
    });
  } catch (error) {
    console.error('Error checking market status:', error);
    res.status(500).json({ error: 'Failed to check market status' });
  }
});

/**
 * FOREX CLONE COMPARISON ENDPOINTS
 */

/**
 * Get dedicated forex trading account status
 */
router.get('/forex-clone/account', async (req, res) => {
  try {
    const engine = await getForexEngine();
    const forexAccount = engine.getForexAccountStatus();
    res.json(forexAccount);
  } catch (error) {
    console.error('Error fetching forex account:', error);
    res.status(500).json({ error: 'Failed to fetch forex account' });
  }
});

/**
 * Get forex trades for comparison
 */
router.get('/forex-clone/trades', async (req, res) => {
  try {
    const engine = await getForexEngine();
    const trades = engine.getForexTrades();
    res.json(trades);
  } catch (error) {
    console.error('Error fetching forex trades:', error);
    res.status(500).json({ error: 'Failed to fetch forex trades' });
  }
});

/**
 * Get forex positions
 */
router.get('/forex-clone/positions', async (req, res) => {
  try {
    const engine = await getForexEngine();
    const positions = engine.getForexPositionsArray();
    res.json(positions);
  } catch (error) {
    console.error('Error fetching forex positions:', error);
    res.status(500).json({ error: 'Failed to fetch forex positions' });
  }
});

/**
 * COMPARISON DASHBOARD - Crypto vs Forex performance
 */
router.get('/comparison', async (req, res) => {
  try {
    console.log('📊 Fetching comparison data...');
    
    // Import storage to access real data directly
    const { storage } = await import('../storage');
    
    // Get ALL trades and separate crypto from forex
    const allTrades = await storage.getAllTrades();
    
    // Properly separate crypto and forex trades by symbol
    const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT'];
    const forexSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY'];
    
    const cryptoTrades = allTrades.filter(trade => cryptoSymbols.includes(trade.symbol));
    const forexTrades = allTrades.filter(trade => forexSymbols.includes(trade.symbol));
    
    console.log(`📊 TRADE SEPARATION: Crypto=${cryptoTrades.length}, Forex=${forexTrades.length}, Total=${allTrades.length}`);
    
    // Calculate CRYPTO metrics using only crypto trades
    let cryptoProfits = 0;
    let cryptoLosses = 0;
    let cryptoWinCount = 0;
    let cryptoLossCount = 0;
    
    for (const trade of cryptoTrades) {
      const profit = parseFloat(trade.profit || '0');
      const loss = parseFloat(trade.loss || '0');
      
      if (profit > 0) {
        cryptoProfits += profit;
        cryptoWinCount++;
      }
      if (loss > 0) {
        cryptoLosses += loss;
        cryptoLossCount++;
      }
    }
    
    // Calculate FOREX metrics using only forex trades
    let forexProfits = 0;
    let forexLosses = 0;
    let forexWinCount = 0;
    let forexLossCount = 0;
    
    for (const trade of forexTrades) {
      const profit = parseFloat(trade.profit || '0');
      const loss = parseFloat(trade.loss || '0');
      
      if (profit > 0) {
        forexProfits += profit;
        forexWinCount++;
      }
      if (loss > 0) {
        forexLosses += loss;
        forexLossCount++;
      }
    }
    
    const cryptoPnL = cryptoProfits - cryptoLosses; // Net crypto P&L
    const forexPnL = forexProfits - forexLosses; // Net forex P&L
    const cryptoWinRate = cryptoTrades.length > 0 ? (cryptoWinCount / cryptoTrades.length) * 100 : 0;
    const forexWinRate = forexTrades.length > 0 ? (forexWinCount / forexTrades.length) * 100 : 0;
    
    // Get current balance from account endpoint (which uses the unified calculation)
    let cryptoBalance = 10000 + cryptoPnL; // Starting balance + P&L (fallback)
    try {
      const accountResponse = await fetch('http://localhost:5000/api/account');
      const accountData = await accountResponse.json();
      cryptoBalance = parseFloat(accountData.balances[0].free);
    } catch {
      // Use calculated balance as fallback
    }
    
    console.log(`📊 Crypto: ${cryptoTrades.length} trades, $${cryptoPnL.toFixed(2)} P&L`);
    console.log(`📊 Forex: ${forexTrades.length} trades, $${forexPnL.toFixed(2)} P&L`);
    
    // Calculate real ROI values
    const forexBalance = 10000 + forexPnL; // Starting balance + forex P&L
    const cryptoROI = ((cryptoBalance - 10000) / 10000 * 100).toFixed(2) + '%';
    const forexROI = ((forexBalance - 10000) / 10000 * 100).toFixed(2) + '%';
    
    const comparison = {
      crypto: {
        account: 'Crypto System',
        totalTrades: cryptoTrades.length.toLocaleString(),
        winRate: cryptoWinRate.toFixed(1) + '%',
        totalProfits: '$' + cryptoProfits.toFixed(2),
        totalLosses: '$' + cryptoLosses.toFixed(2),
        totalPnL: '$' + cryptoPnL.toFixed(2),
        balance: '$' + cryptoBalance.toFixed(2)
      },
      forex: {
        account: 'Forex System', 
        totalTrades: forexTrades.length,
        winRate: forexWinRate.toFixed(1) + '%',
        totalProfits: '$' + forexProfits.toFixed(2),
        totalLosses: '$' + forexLosses.toFixed(2),
        totalPnL: '$' + forexPnL.toFixed(2),
        balance: '$' + forexBalance.toFixed(2)
      },
      performance: {
        cryptoROI,
        forexROI,
        winner: forexPnL >= cryptoPnL ? 'Forex' : 'Crypto'
      }
    };
    
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

export { router as multiAssetRoutes };
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
    
    // Get direct crypto data without HTTP calls
    const allTrades = await storage.getAllTrades();
    const cryptoTrades = allTrades.length;
    
    // Calculate crypto metrics using profit/loss fields - SAME AS ALL OTHER ENDPOINTS
    let totalProfits = 0;
    let totalLosses = 0;
    let winCount = 0;
    let lossCount = 0;
    
    for (const trade of allTrades) {
      const profit = parseFloat(trade.profit || '0');
      const loss = parseFloat(trade.loss || '0');
      
      if (profit > 0) {
        totalProfits += profit;
        winCount++;
      }
      if (loss > 0) {
        totalLosses += loss;
        lossCount++;
      }
    }
    
    const cryptoPnL = totalProfits - totalLosses; // Net P&L from database
    const cryptoWinRate = allTrades.length > 0 ? (winCount / allTrades.length) * 100 : 0;
    
    // Get current balance from account endpoint (which uses the unified calculation)
    let cryptoBalance = 10000 + cryptoPnL; // Starting balance + P&L (fallback)
    try {
      const accountResponse = await fetch('http://localhost:5000/api/account');
      const accountData = await accountResponse.json();
      cryptoBalance = parseFloat(accountData.balances[0].free);
    } catch {
      // Use calculated balance as fallback
    }
    
    // Get forex data
    const engine = await getForexEngine();
    const forexAccount = engine.getForexAccountStatus();
    
    console.log(`📊 Crypto: ${cryptoTrades} trades, $${cryptoPnL.toFixed(2)} P&L`);
    console.log(`📊 Forex: ${forexAccount.tradesCount} trades, $${forexAccount.totalPnL.toFixed(2)} P&L`);
    
    // Calculate real ROI values
    const cryptoROI = ((cryptoBalance - 10000) / 10000 * 100).toFixed(2) + '%';
    const forexROI = ((forexAccount.balance - 10000) / 10000 * 100).toFixed(2) + '%';
    
    const comparison = {
      crypto: {
        account: 'Crypto System',
        totalTrades: cryptoTrades.toLocaleString(),
        winRate: cryptoWinRate.toFixed(1) + '%',
        totalPnL: '$' + cryptoPnL.toFixed(2),
        balance: '$' + cryptoBalance.toFixed(2)
      },
      forex: {
        account: 'Forex System', 
        totalTrades: forexAccount.tradesCount,
        winRate: forexAccount.winRate.toFixed(1) + '%',
        totalPnL: '$' + forexAccount.totalPnL.toFixed(2),
        balance: '$' + forexAccount.balance.toFixed(2)
      },
      performance: {
        cryptoROI,
        forexROI,
        winner: forexAccount.totalPnL >= cryptoPnL ? 'Forex' : 'Crypto'
      }
    };
    
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

export { router as multiAssetRoutes };
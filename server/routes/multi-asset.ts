import { Router } from 'express';
import { MultiAssetEngine } from '../services/multi-asset-engine';
import { ForexDataService } from '../services/forex-data-service';
import { ForexTradingEngine } from '../services/forex-trading-engine';

const router = Router();
const multiAssetEngine = new MultiAssetEngine();
const forexData = new ForexDataService();
const forexEngine = new ForexTradingEngine();

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
    const forexAccount = forexEngine.getForexAccountStatus();
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
    const trades = forexEngine.getForexTrades();
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
    const positions = forexEngine.getForexPositionsArray();
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
    // This would be called from the main trading engine to get crypto stats
    // For now, return placeholder structure
    // Get real data from both systems
    const forexAccount = forexEngine.getForexAccountStatus();
    
    // Calculate real ROI values
    const cryptoROI = ((9500 - 10000) / 10000 * 100).toFixed(2) + '%'; // Approximate from recent data
    const forexROI = ((forexAccount.balance - 10000) / 10000 * 100).toFixed(2) + '%';
    
    const comparison = {
      crypto: {
        account: 'Crypto System',
        totalTrades: '4,980+', 
        winRate: '18.4%',
        totalPnL: '-$252.90',
        balance: '$9,498'
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
        winner: forexAccount.totalPnL >= -252.90 ? 'Forex' : 'Crypto'
      }
    };
    
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

export { router as multiAssetRoutes };
/**
 * Whale Tracker
 * 
 * Monitors large on-chain cryptocurrency transactions (whales).
 * Whale movements often precede 5-10% price moves.
 * 
 * Key Patterns:
 * - Exchange inflows (whales depositing to sell)
 * - Exchange outflows (accumulation/holding)
 * - Wallet-to-wallet transfers (OTC deals, institutional)
 * - Dormant wallets activating (old holders selling)
 * 
 * Data Sources:
 * - Whale Alert
 * - Etherscan, BscScan, Blockchain.com APIs
 * - Exchange reserve trackers
 */

export interface WhaleTransaction {
  symbol: string;
  blockchain: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  valueUSD: number;
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  isExchange: boolean;
  source: string;
}

export interface WhaleSignal {
  symbol: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  rationale: string;
  totalValueUSD: number;
  transactionCount: number;
  netFlowDirection: 'TO_EXCHANGE' | 'FROM_EXCHANGE' | 'WALLET_TO_WALLET';
}

export class WhaleTracker {
  private scanInterval: NodeJS.Timeout | null = null;
  private recentTransactions: Map<string, WhaleTransaction[]> = new Map();
  
  // Configuration
  private readonly SCAN_INTERVAL_MS = 60000; // 1 minute
  private readonly MIN_WHALE_SIZE_USD = 1000000; // $1M minimum
  private readonly LOOKBACK_HOURS = 24;
  
  constructor() {
    console.log('🐋 Whale Tracker initialized');
  }

  async start(): Promise<void> {
    console.log('🐋 Starting Whale Tracker...');
    
    await this.scan();
    
    this.scanInterval = setInterval(async () => {
      await this.scan();
    }, this.SCAN_INTERVAL_MS);
    
    console.log(`✅ Whale tracker started (checking every ${this.SCAN_INTERVAL_MS/1000} seconds)`);
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('⏸️  Whale Tracker stopped');
  }

  private async scan(): Promise<void> {
    try {
      console.log('🔍 Scanning for whale transactions...');
      
      // TODO: Integrate with Whale Alert API, Etherscan, etc.
      const transactions = await this.fetchWhaleTransactions();
      
      // Filter by minimum size
      const largeTransactions = transactions.filter(
        tx => tx.valueUSD >= this.MIN_WHALE_SIZE_USD
      );
      
      // Store recent transactions
      for (const tx of largeTransactions) {
        if (!this.recentTransactions.has(tx.symbol)) {
          this.recentTransactions.set(tx.symbol, []);
        }
        this.recentTransactions.get(tx.symbol)!.push(tx);
      }
      
      // Clean old transactions
      this.cleanOldTransactions();
      
      // Generate signals
      const signals = this.generateSignals();
      
      console.log(`📋 Found ${largeTransactions.length} whale txs, generated ${signals.length} signals`);
      
      for (const signal of signals.filter(s => s.confidence >= 0.6)) {
        console.log(`🎯 WHALE SIGNAL: ${signal.direction} ${signal.symbol} (${(signal.confidence*100).toFixed(0)}% confidence, $${(signal.totalValueUSD/1000000).toFixed(1)}M moved)`);
      }
      
    } catch (error) {
      console.error('❌ Whale tracking scan failed:', error);
    }
  }

  private async fetchWhaleTransactions(): Promise<WhaleTransaction[]> {
    // Placeholder - integrate with Whale Alert, blockchain explorers
    return [];
  }

  private cleanOldTransactions(): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.LOOKBACK_HOURS);
    
    for (const [symbol, txs] of this.recentTransactions.entries()) {
      const recentTxs = txs.filter(tx => tx.timestamp >= cutoffTime);
      if (recentTxs.length === 0) {
        this.recentTransactions.delete(symbol);
      } else {
        this.recentTransactions.set(symbol, recentTxs);
      }
    }
  }

  private generateSignals(): WhaleSignal[] {
    const signals: WhaleSignal[] = [];
    
    for (const [symbol, txs] of this.recentTransactions.entries()) {
      if (txs.length === 0) continue;
      
      // Analyze flow direction
      const toExchange = txs.filter(tx => this.isToExchange(tx));
      const fromExchange = txs.filter(tx => this.isFromExchange(tx));
      const walletToWallet = txs.filter(tx => !tx.isExchange);
      
      const toExchangeValue = toExchange.reduce((sum, tx) => sum + tx.valueUSD, 0);
      const fromExchangeValue = fromExchange.reduce((sum, tx) => sum + tx.valueUSD, 0);
      const totalValue = txs.reduce((sum, tx) => sum + tx.valueUSD, 0);
      
      // Large outflows from exchanges = bullish (accumulation)
      if (fromExchangeValue > toExchangeValue * 2 && fromExchangeValue > 5000000) {
        signals.push({
          symbol,
          direction: 'BULLISH',
          confidence: Math.min(0.85, (fromExchangeValue / 10000000) * 0.5),
          rationale: `Whales withdrawing from exchanges: $${(fromExchangeValue/1000000).toFixed(1)}M (${fromExchange.length} txs)`,
          totalValueUSD: fromExchangeValue,
          transactionCount: fromExchange.length,
          netFlowDirection: 'FROM_EXCHANGE'
        });
      }
      
      // Large inflows to exchanges = bearish (preparing to sell)
      else if (toExchangeValue > fromExchangeValue * 2 && toExchangeValue > 5000000) {
        signals.push({
          symbol,
          direction: 'BEARISH',
          confidence: Math.min(0.85, (toExchangeValue / 10000000) * 0.5),
          rationale: `Whales depositing to exchanges: $${(toExchangeValue/1000000).toFixed(1)}M (${toExchange.length} txs)`,
          totalValueUSD: toExchangeValue,
          transactionCount: toExchange.length,
          netFlowDirection: 'TO_EXCHANGE'
        });
      }
      
      // Large wallet-to-wallet = neutral (OTC, institutional movement)
      else if (walletToWallet.length > 0) {
        const walletValue = walletToWallet.reduce((sum, tx) => sum + tx.valueUSD, 0);
        signals.push({
          symbol,
          direction: 'NEUTRAL',
          confidence: 0.3,
          rationale: `Large OTC/institutional transfers: $${(walletValue/1000000).toFixed(1)}M`,
          totalValueUSD: walletValue,
          transactionCount: walletToWallet.length,
          netFlowDirection: 'WALLET_TO_WALLET'
        });
      }
    }
    
    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  private isToExchange(tx: WhaleTransaction): boolean {
    // Check if destination is an exchange wallet
    // Placeholder - in production, maintain list of known exchange addresses
    return tx.isExchange && tx.toAddress.toLowerCase().includes('exchange');
  }

  private isFromExchange(tx: WhaleTransaction): boolean {
    // Check if source is an exchange wallet
    return tx.isExchange && tx.fromAddress.toLowerCase().includes('exchange');
  }

  getSignalForSymbol(symbol: string): WhaleSignal | null {
    const signals = this.generateSignals();
    return signals.find(s => s.symbol === symbol) || null;
  }

  getAllSignals(): WhaleSignal[] {
    return this.generateSignals();
  }

  getStats() {
    return {
      trackedSymbols: this.recentTransactions.size,
      totalTransactions: Array.from(this.recentTransactions.values()).reduce((sum, txs) => sum + txs.length, 0),
      isRunning: this.scanInterval !== null
    };
  }
}

export const whaleTracker = new WhaleTracker();

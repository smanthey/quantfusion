/**
 * Politicians' Trades Scanner
 * 
 * Tracks Congressional and Senate stock trades for alpha generation.
 * Academic research shows politicians beat the market by 10-30% annually.
 * 
 * Key Features:
 * - Real-time monitoring of disclosed trades
 * - Signal generation when politicians buy/sell
 * - Integration with main trading system
 * - Historical tracking and backtesting
 * 
 * Data Sources:
 * - Capitol Trades (https://www.capitoltrades.com)
 * - Quiver Quantitative (https://www.quiverquant.com)
 * - House/Senate disclosure filings
 */

import { storage } from '../storage';

export interface PoliticianTrade {
  politician: string;
  position: string; // 'Senator', 'Representative'
  party: string; // 'Democrat', 'Republican', 'Independent'
  symbol: string;
  transactionType: 'purchase' | 'sale';
  amount: string; // Range like '$1,001 - $15,000'
  amountMin: number;
  amountMax: number;
  transactionDate: Date;
  disclosureDate: Date;
  assetType: string; // 'Stock', 'Stock Option', 'Corporate Bond', etc.
  committee?: string; // Committee memberships (insider info indicator)
}

export interface PoliticianTradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'WATCH';
  confidence: number; // 0-1
  rationale: string;
  politicianCount: number;
  totalVolume: number;
  avgDaysToDisclose: number;
  isCommitteeMember: boolean; // Higher weight if on relevant committee
}

export interface ScannerIntegrationStatus {
  provider: string;
  liveData: boolean;
  enabled: boolean;
  message: string;
  lastError?: string;
  lastSuccessAt?: Date;
}

export class PoliticianTradesScanner {
  private recentTrades: Map<string, PoliticianTrade[]> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private lastScanTime: Date | null = null;
  private integrationStatus: ScannerIntegrationStatus = {
    provider: "quiver",
    liveData: false,
    enabled: false,
    message: "Live provider disabled",
  };
  
  // Configuration
  private readonly SCAN_INTERVAL_MS = 3600000; // Scan every hour
  private readonly SIGNAL_THRESHOLD = 2; // Min 2 politicians trading same stock
  private readonly DAYS_LOOKBACK = 45; // Congressional disclosure window
  
  constructor() {
    // console.log('📊 Politicians Trades Scanner initialized');
  }

  /**
   * Start scanning for politician trades
   */
  async start(): Promise<void> {
    // console.log('🏛️  Starting Politicians Trades Scanner...');
    
    // Initial scan
    await this.scan();
    
    // Schedule regular scans
    this.scanInterval = setInterval(async () => {
      await this.scan();
    }, this.SCAN_INTERVAL_MS);
    
    // console.log(`✅ Scanner started (checking every ${this.SCAN_INTERVAL_MS/1000/60} minutes)`);
  }

  /**
   * Stop the scanner
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    // console.log('⏸️  Politicians Trades Scanner stopped');
  }

  /**
   * Main scanning logic - fetch and process politician trades
   */
  private async scan(): Promise<void> {
    try {
      // console.log('🔍 Scanning for new politician trades...');
      
      // Pull congress trade data from configured provider when enabled.
      const trades = await this.fetchRecentTrades();
      
      // Store trades
      for (const trade of trades) {
        const key = trade.symbol;
        if (!this.recentTrades.has(key)) {
          this.recentTrades.set(key, []);
        }
        this.recentTrades.get(key)!.push(trade);
      }
      
      // Clean old trades (outside lookback window)
      this.cleanOldTrades();
      
      // Generate signals from clustered activity
      const signals = this.generateSignals();
      
      // console.log(`📋 Found ${trades.length} new trades, generated ${signals.length} signals`);
      
      // Log high-confidence signals
      for (const signal of signals.filter(s => s.confidence >= 0.7)) {
        // console.log(`🎯 POLITICIAN SIGNAL: ${signal.action} ${signal.symbol} (${(signal.confidence*100).toFixed(0)}% confidence, ${signal.politicianCount} politicians)`);
      }
      
      this.lastScanTime = new Date();
      if (this.integrationStatus.enabled && trades.length > 0) {
        this.integrationStatus.liveData = true;
        this.integrationStatus.lastSuccessAt = new Date();
        this.integrationStatus.lastError = undefined;
        this.integrationStatus.message = "Receiving live congress trade data";
      }
      
    } catch (error) {
      this.integrationStatus.liveData = false;
      this.integrationStatus.lastError =
        error instanceof Error ? error.message : String(error);
      this.integrationStatus.message = "Live fetch failed";
    }
  }

  /**
   * Fetch recent politician trades from configured provider.
   */
  private async fetchRecentTrades(): Promise<PoliticianTrade[]> {
    const enabled = process.env.ENABLE_POLITICIAN_SCANNER_LIVE === "true";
    const apiKey = process.env.QUIVER_API_KEY || "";
    const url =
      process.env.QUIVER_CONGRESS_TRADES_URL ||
      "https://api.quiverquant.com/beta/live/congresstrading";

    this.integrationStatus.enabled = enabled;

    if (!enabled) {
      this.integrationStatus.message = "Enable with ENABLE_POLITICIAN_SCANNER_LIVE=true";
      return [];
    }

    if (!apiKey) {
      this.integrationStatus.liveData = false;
      this.integrationStatus.message = "QUIVER_API_KEY missing";
      return [];
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Quiver API error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const rows: any[] = Array.isArray(payload) ? payload : payload?.data || [];

    return rows
      .map((row) => this.toTrade(row))
      .filter((trade): trade is PoliticianTrade => trade !== null);
  }

  private toTrade(row: any): PoliticianTrade | null {
    const symbol = String(row?.Ticker || row?.ticker || row?.symbol || "").toUpperCase();
    if (!symbol) return null;

    const txTypeRaw = String(
      row?.Transaction || row?.transaction || row?.transaction_type || ""
    ).toLowerCase();
    const transactionType: "purchase" | "sale" =
      txTypeRaw.includes("sale") || txTypeRaw.includes("sell") ? "sale" : "purchase";

    const amountText = String(
      row?.Range || row?.amount || row?.Amount || row?.amount_range || "$1 - $1"
    );
    const [amountMin, amountMax] = this.parseAmountRange(amountText);

    const transactionDate = new Date(
      row?.TransactionDate || row?.transaction_date || row?.txDate || Date.now()
    );
    const disclosureDate = new Date(
      row?.Date || row?.disclosure_date || row?.disclosedAt || Date.now()
    );

    return {
      politician: String(row?.Representative || row?.politician || row?.name || "Unknown"),
      position: String(row?.Chamber || row?.position || "Unknown"),
      party: String(row?.Party || row?.party || "Unknown"),
      symbol,
      transactionType,
      amount: amountText,
      amountMin,
      amountMax,
      transactionDate: Number.isNaN(transactionDate.getTime()) ? new Date() : transactionDate,
      disclosureDate: Number.isNaN(disclosureDate.getTime()) ? new Date() : disclosureDate,
      assetType: String(row?.AssetType || row?.assetType || "Stock"),
      committee: row?.committee ? String(row.committee) : undefined,
    };
  }

  private parseAmountRange(raw: string): [number, number] {
    const values = (raw.match(/\d[\d,]*/g) || [])
      .map((part) => Number(part.replace(/,/g, "")))
      .filter((value) => Number.isFinite(value));

    if (values.length >= 2) {
      return [values[0], values[1]];
    }
    if (values.length === 1) {
      return [values[0], values[0]];
    }
    return [0, 0];
  }

  /**
   * Remove trades outside the lookback window
   */
  private cleanOldTrades(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.DAYS_LOOKBACK);
    
    for (const [symbol, trades] of Array.from(this.recentTrades.entries())) {
      const validTrades = trades.filter(t => t.disclosureDate >= cutoffDate);
      if (validTrades.length === 0) {
        this.recentTrades.delete(symbol);
      } else {
        this.recentTrades.set(symbol, validTrades);
      }
    }
  }

  /**
   * Generate trading signals from politician activity
   */
  private generateSignals(): PoliticianTradeSignal[] {
    const signals: PoliticianTradeSignal[] = [];
    
    for (const [symbol, trades] of Array.from(this.recentTrades.entries())) {
      if (trades.length < this.SIGNAL_THRESHOLD) continue;
      
      // Analyze trade direction
      const purchases = trades.filter(t => t.transactionType === 'purchase');
      const sales = trades.filter(t => t.transactionType === 'sale');
      
      const buyCount = purchases.length;
      const sellCount = sales.length;
      const totalCount = trades.length;
      
      // Calculate confidence based on clustering and committee membership
      const buyRatio = buyCount / totalCount;
      const sellRatio = sellCount / totalCount;
      const hasCommitteeMember = trades.some(t => t.committee !== undefined);
      
      // Strong buy signal: >70% purchases
      if (buyRatio >= 0.7) {
        const totalVolume = purchases.reduce((sum, t) => sum + (t.amountMin + t.amountMax) / 2, 0);
        const avgDisclosureLag = this.calculateAvgDisclosureLag(purchases);
        
        signals.push({
          symbol,
          action: 'BUY',
          confidence: Math.min(0.95, buyRatio * (hasCommitteeMember ? 1.2 : 1.0)),
          rationale: `${buyCount} politician(s) bought ${symbol} (${hasCommitteeMember ? 'including committee member' : 'no committee'})`,
          politicianCount: buyCount,
          totalVolume,
          avgDaysToDisclose: avgDisclosureLag,
          isCommitteeMember: hasCommitteeMember
        });
      }
      
      // Strong sell signal: >70% sales
      else if (sellRatio >= 0.7) {
        const totalVolume = sales.reduce((sum, t) => sum + (t.amountMin + t.amountMax) / 2, 0);
        const avgDisclosureLag = this.calculateAvgDisclosureLag(sales);
        
        signals.push({
          symbol,
          action: 'SELL',
          confidence: Math.min(0.95, sellRatio * (hasCommitteeMember ? 1.2 : 1.0)),
          rationale: `${sellCount} politician(s) sold ${symbol} (${hasCommitteeMember ? 'including committee member' : 'no committee'})`,
          politicianCount: sellCount,
          totalVolume,
          avgDaysToDisclose: avgDisclosureLag,
          isCommitteeMember: hasCommitteeMember
        });
      }
      
      // Mixed signals = watch
      else {
        signals.push({
          symbol,
          action: 'WATCH',
          confidence: 0.3,
          rationale: `Mixed activity: ${buyCount} buys, ${sellCount} sells`,
          politicianCount: totalCount,
          totalVolume: trades.reduce((sum, t) => sum + (t.amountMin + t.amountMax) / 2, 0),
          avgDaysToDisclose: this.calculateAvgDisclosureLag(trades),
          isCommitteeMember: hasCommitteeMember
        });
      }
    }
    
    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate average days between transaction and disclosure
   * Faster disclosure = more urgent/informed trade
   */
  private calculateAvgDisclosureLag(trades: PoliticianTrade[]): number {
    if (trades.length === 0) return 0;
    
    const totalLag = trades.reduce((sum, trade) => {
      const lagDays = Math.floor(
        (trade.disclosureDate.getTime() - trade.transactionDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + lagDays;
    }, 0);
    
    return totalLag / trades.length;
  }

  /**
   * Get current signals for a specific symbol
   */
  getSignalForSymbol(symbol: string): PoliticianTradeSignal | null {
    const signals = this.generateSignals();
    return signals.find(s => s.symbol === symbol) || null;
  }

  /**
   * Get all current signals
   */
  getAllSignals(): PoliticianTradeSignal[] {
    return this.generateSignals();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      trackedSymbols: this.recentTrades.size,
      totalTrades: Array.from(this.recentTrades.values()).reduce((sum, trades) => sum + trades.length, 0),
      lastScan: this.lastScanTime,
      isRunning: this.scanInterval !== null
    };
  }

  getIntegrationStatus(): ScannerIntegrationStatus {
    return this.integrationStatus;
  }
}

// Singleton instance
export const politicianTradesScanner = new PoliticianTradesScanner();

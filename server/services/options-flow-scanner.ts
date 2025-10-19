/**
 * Options Flow Scanner
 * 
 * Monitors unusual options activity to predict price movements 1-3 days ahead.
 * Large options bets often precede significant moves.
 * 
 * Key Signals:
 * - Unusual volume relative to open interest
 * - Large premium purchases (>$100k)
 * - Clustered activity at specific strikes
 * - Insider-indicative patterns (OTM calls before earnings)
 * 
 * Data Sources:
 * - Market Chameleon
 * - Unusual Whales
 * - CBOE Options Exchange
 */

export interface OptionsFlowData {
  symbol: string;
  optionType: 'CALL' | 'PUT';
  strike: number;
  expiration: Date;
  volume: number;
  openInterest: number;
  premium: number;
  spotPrice: number;
  isUnusual: boolean;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timestamp: Date;
  source: string;
}

export interface OptionsFlowSignal {
  symbol: string;
  direction: 'BULLISH' | 'BEARISH';
  confidence: number;
  timeframe: string; // '1-3 days', '1 week', etc.
  rationale: string;
  totalPremium: number;
  callPutRatio: number;
}

export class OptionsFlowScanner {
  private scanInterval: NodeJS.Timeout | null = null;
  private recentFlow: Map<string, OptionsFlowData[]> = new Map();
  
  // Configuration
  private readonly SCAN_INTERVAL_MS = 300000; // 5 minutes
  private readonly UNUSUAL_VOLUME_THRESHOLD = 5; // 5x normal volume
  private readonly LARGE_PREMIUM_THRESHOLD = 100000; // $100k+
  
  constructor() {
    console.log('📊 Options Flow Scanner initialized');
  }

  async start(): Promise<void> {
    console.log('📈 Starting Options Flow Scanner...');
    
    await this.scan();
    
    this.scanInterval = setInterval(async () => {
      await this.scan();
    }, this.SCAN_INTERVAL_MS);
    
    console.log(`✅ Options scanner started (checking every ${this.SCAN_INTERVAL_MS/1000/60} minutes)`);
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('⏸️  Options Flow Scanner stopped');
  }

  private async scan(): Promise<void> {
    try {
      console.log('🔍 Scanning for unusual options activity...');
      
      // TODO: Integrate with actual options data API
      // For now, placeholder for demonstration
      const flow = await this.fetchOptionsFlow();
      
      // Detect unusual activity
      const unusualFlow = flow.filter(f => this.isUnusual(f));
      
      // Store recent flow
      for (const option of unusualFlow) {
        if (!this.recentFlow.has(option.symbol)) {
          this.recentFlow.set(option.symbol, []);
        }
        this.recentFlow.get(option.symbol)!.push(option);
      }
      
      // Generate signals
      const signals = this.generateSignals();
      
      console.log(`📋 Found ${unusualFlow.length} unusual options, generated ${signals.length} signals`);
      
      for (const signal of signals.filter(s => s.confidence >= 0.7)) {
        console.log(`🎯 OPTIONS SIGNAL: ${signal.direction} ${signal.symbol} (${(signal.confidence*100).toFixed(0)}% confidence, $${(signal.totalPremium/1000).toFixed(0)}k premium)`);
      }
      
    } catch (error) {
      console.error('❌ Options flow scan failed:', error);
    }
  }

  private async fetchOptionsFlow(): Promise<OptionsFlowData[]> {
    // Placeholder - integrate with Market Chameleon, Unusual Whales, etc.
    return [];
  }

  private isUnusual(flow: OptionsFlowData): boolean {
    // Check if volume is unusual relative to open interest
    const volumeRatio = flow.volume / Math.max(flow.openInterest, 1);
    if (volumeRatio >= this.UNUSUAL_VOLUME_THRESHOLD) return true;
    
    // Check if premium is large
    if (flow.premium >= this.LARGE_PREMIUM_THRESHOLD) return true;
    
    return false;
  }

  private generateSignals(): OptionsFlowSignal[] {
    const signals: OptionsFlowSignal[] = [];
    
    for (const [symbol, flow] of this.recentFlow.entries()) {
      const calls = flow.filter(f => f.optionType === 'CALL');
      const puts = flow.filter(f => f.optionType === 'PUT');
      
      const callPremium = calls.reduce((sum, c) => sum + c.premium, 0);
      const putPremium = puts.reduce((sum, p) => sum + p.premium, 0);
      const totalPremium = callPremium + putPremium;
      
      if (totalPremium === 0) continue;
      
      const callPutRatio = callPremium / putPremium;
      
      // Strong call buying = bullish
      if (callPutRatio > 3 && callPremium > 500000) {
        signals.push({
          symbol,
          direction: 'BULLISH',
          confidence: Math.min(0.9, callPutRatio / 10),
          timeframe: '1-3 days',
          rationale: `Heavy call buying: ${calls.length} calls, $${(callPremium/1000).toFixed(0)}k premium`,
          totalPremium,
          callPutRatio
        });
      }
      
      // Strong put buying = bearish
      else if (callPutRatio < 0.33 && putPremium > 500000) {
        signals.push({
          symbol,
          direction: 'BEARISH',
          confidence: Math.min(0.9, 1 / (callPutRatio * 10)),
          timeframe: '1-3 days',
          rationale: `Heavy put buying: ${puts.length} puts, $${(putPremium/1000).toFixed(0)}k premium`,
          totalPremium,
          callPutRatio
        });
      }
    }
    
    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  getSignalForSymbol(symbol: string): OptionsFlowSignal | null {
    const signals = this.generateSignals();
    return signals.find(s => s.symbol === symbol) || null;
  }

  getAllSignals(): OptionsFlowSignal[] {
    return this.generateSignals();
  }

  getStats() {
    return {
      trackedSymbols: this.recentFlow.size,
      totalFlow: Array.from(this.recentFlow.values()).reduce((sum, flow) => sum + flow.length, 0),
      isRunning: this.scanInterval !== null
    };
  }
}

export const optionsFlowScanner = new OptionsFlowScanner();

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

export interface OptionsIntegrationStatus {
  provider: string;
  liveData: boolean;
  enabled: boolean;
  message: string;
  lastError?: string;
  lastSuccessAt?: Date;
}

export class OptionsFlowScanner {
  private scanInterval: NodeJS.Timeout | null = null;
  private recentFlow: Map<string, OptionsFlowData[]> = new Map();
  private integrationStatus: OptionsIntegrationStatus = {
    provider: "unusual_whales",
    liveData: false,
    enabled: false,
    message: "Live provider disabled",
  };
  
  // Configuration
  private readonly SCAN_INTERVAL_MS = 300000; // 5 minutes
  private readonly UNUSUAL_VOLUME_THRESHOLD = 5; // 5x normal volume
  private readonly LARGE_PREMIUM_THRESHOLD = 100000; // $100k+
  
  constructor() {
    // console.log('📊 Options Flow Scanner initialized');
  }

  async start(): Promise<void> {
    // console.log('📈 Starting Options Flow Scanner...');
    
    await this.scan();
    
    this.scanInterval = setInterval(async () => {
      await this.scan();
    }, this.SCAN_INTERVAL_MS);
    
    // console.log(`✅ Options scanner started (checking every ${this.SCAN_INTERVAL_MS/1000/60} minutes)`);
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    // console.log('⏸️  Options Flow Scanner stopped');
  }

  private async scan(): Promise<void> {
    try {
      // console.log('🔍 Scanning for unusual options activity...');
      
      // Pull live options flow from configured provider when enabled.
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
      
      // console.log(`📋 Found ${unusualFlow.length} unusual options, generated ${signals.length} signals`);
      
      for (const signal of signals.filter(s => s.confidence >= 0.7)) {
        // console.log(`🎯 OPTIONS SIGNAL: ${signal.direction} ${signal.symbol} (${(signal.confidence*100).toFixed(0)}% confidence, $${(signal.totalPremium/1000).toFixed(0)}k premium)`);
      }
      if (this.integrationStatus.enabled && flow.length > 0) {
        this.integrationStatus.liveData = true;
        this.integrationStatus.lastSuccessAt = new Date();
        this.integrationStatus.lastError = undefined;
        this.integrationStatus.message = "Receiving live options flow data";
      }
      
    } catch (error) {
      this.integrationStatus.liveData = false;
      this.integrationStatus.lastError =
        error instanceof Error ? error.message : String(error);
      this.integrationStatus.message = "Live fetch failed";
    }
  }

  private async fetchOptionsFlow(): Promise<OptionsFlowData[]> {
    const enabled = process.env.ENABLE_OPTIONS_SCANNER_LIVE === "true";
    const apiKey = process.env.UNUSUAL_WHALES_API_KEY || "";
    const url =
      process.env.UNUSUAL_WHALES_OPTIONS_URL ||
      "https://api.unusualwhales.com/api/options/flow/recent";

    this.integrationStatus.enabled = enabled;

    if (!enabled) {
      this.integrationStatus.message = "Enable with ENABLE_OPTIONS_SCANNER_LIVE=true";
      return [];
    }
    if (!apiKey) {
      this.integrationStatus.liveData = false;
      this.integrationStatus.message = "UNUSUAL_WHALES_API_KEY missing";
      return [];
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Unusual Whales API error: ${response.status} ${response.statusText}`
      );
    }

    const payload = await response.json();
    const rows: any[] = Array.isArray(payload) ? payload : payload?.data || [];

    return rows
      .map((row) => this.toFlow(row))
      .filter((entry): entry is OptionsFlowData => entry !== null);
  }

  private toFlow(row: any): OptionsFlowData | null {
    const symbol = String(row?.symbol || row?.ticker || "").toUpperCase();
    if (!symbol) return null;

    const strike = Number(row?.strike || row?.strike_price || 0);
    const volume = Number(row?.volume || row?.total_volume || 0);
    const openInterest = Number(row?.open_interest || row?.openInterest || 0);
    const premium = Number(row?.premium || row?.notional || row?.premium_total || 0);
    const spotPrice = Number(row?.spot_price || row?.underlying_price || row?.price || 0);

    const typeRaw = String(row?.option_type || row?.type || "call").toUpperCase();
    const optionType: "CALL" | "PUT" = typeRaw.includes("P") ? "PUT" : "CALL";

    const sentimentRaw = String(row?.sentiment || row?.side || "neutral").toUpperCase();
    const sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" =
      sentimentRaw.includes("BULL")
        ? "BULLISH"
        : sentimentRaw.includes("BEAR")
        ? "BEARISH"
        : "NEUTRAL";

    const expiration = new Date(
      row?.expiration || row?.expiry || row?.expiration_date || Date.now()
    );
    const timestamp = new Date(row?.timestamp || row?.created_at || Date.now());

    return {
      symbol,
      optionType,
      strike: Number.isFinite(strike) ? strike : 0,
      expiration: Number.isNaN(expiration.getTime()) ? new Date() : expiration,
      volume: Number.isFinite(volume) ? volume : 0,
      openInterest: Number.isFinite(openInterest) ? openInterest : 0,
      premium: Number.isFinite(premium) ? premium : 0,
      spotPrice: Number.isFinite(spotPrice) ? spotPrice : 0,
      isUnusual: false,
      sentiment,
      timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      source: "unusual_whales",
    };
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
    
    for (const [symbol, flow] of Array.from(this.recentFlow.entries())) {
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

  getIntegrationStatus(): OptionsIntegrationStatus {
    return this.integrationStatus;
  }
}

export const optionsFlowScanner = new OptionsFlowScanner();

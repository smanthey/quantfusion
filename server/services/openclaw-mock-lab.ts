import crypto from "node:crypto";
import { storage } from "../storage";

interface ProbabilityInput {
  forwardPrice: number;
  strike: number;
  volatility: number;
  timeToExpiryYears: number;
  marketProbability?: number;
  feeBps?: number;
}

interface VenueQuote {
  venue: string;
  marketId: string;
  probabilityYes: number;
  feeBps?: number;
  liquidityUsd?: number;
}

interface ScanInput {
  symbol: string;
  fairProbability?: number;
  quotes: VenueQuote[];
  minEdgeBps?: number;
}

interface PaperTradeInput {
  symbol: string;
  marketId: string;
  venue: string;
  side?: "BUY" | "SELL";
  marketProbability: number;
  fairProbability: number;
  bankrollUsd: number;
  maxRiskPct?: number;
  feeBps?: number;
  notes?: string;
}

interface LatencyDislocationInput {
  symbol: string;
  marketId: string;
  venue: string;
  marketProbability: number;
  referencePriceNow: number;
  referencePricePrev: number;
  referenceTimestampMs: number;
  marketTimestampMs: number;
  fairProbability?: number;
  feeBps?: number;
  liquidityUsd?: number;
  minEdgeBps?: number;
  blindWindowMs?: number;
}

interface OpportunityRecord {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  evidenceCount: number;
  symbol: string;
  marketId: string;
  venue: string;
  marketProbability: number;
  fairProbability: number;
  edgeBps: number;
  expectedRoiPct: number;
  score: number;
  source: "fair_value" | "latency_dislocation";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalCdf(x: number): number {
  // Abramowitz-Stegun approximation, sufficient for trading signals.
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * z);
  const erf =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t *
      Math.exp(-z * z));

  return 0.5 * (1 + sign * erf);
}

export class OpenClawMockLabService {
  private readonly strategyName = "quantfusion-mock-lab";
  private readonly strategyType = "prediction_market";
  private readonly maxRecentOpportunities = 200;
  private readonly recentOpportunities: OpportunityRecord[] = [];
  private readonly opportunityIndex = new Map<string, OpportunityRecord>();

  async evaluateProbability(input: ProbabilityInput) {
    const F = Math.max(1e-9, Number(input.forwardPrice || 0));
    const K = Math.max(1e-9, Number(input.strike || 0));
    const sigma = Math.max(1e-9, Number(input.volatility || 0));
    const T = Math.max(1e-9, Number(input.timeToExpiryYears || 0));
    const marketProb = clamp01(Number(input.marketProbability ?? 0));
    const feeBps = Math.max(0, Number(input.feeBps ?? 0));

    const d2 = (Math.log(F / K) - 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
    const fairProbability = clamp01(normalCdf(d2));
    const edge = fairProbability - marketProb;
    const edgeBps = edge * 10_000;
    const feePct = feeBps / 10_000;
    const expectedRoiPct = (edge - feePct) * 100;

    return {
      fairProbability,
      d2,
      edge,
      edgeBps,
      expectedRoiPct,
      recommendation:
        expectedRoiPct > 0
          ? "positive_ev"
          : "skip",
    };
  }

  async scanArbitrage(input: ScanInput) {
    const symbol = String(input.symbol || "UNKNOWN").toUpperCase();
    const quotes = Array.isArray(input.quotes) ? input.quotes : [];
    const fairProbability = input.fairProbability ?? null;
    const minEdgeBps = Number(input.minEdgeBps ?? 50);

    if (quotes.length < 2) {
      return {
        symbol,
        opportunities: [],
        reason: "at_least_two_quotes_required",
      };
    }

    const normalized = quotes
      .map((q) => ({
        ...q,
        probabilityYes: clamp01(Number(q.probabilityYes || 0)),
        feeBps: Math.max(0, Number(q.feeBps || 0)),
        liquidityUsd: Math.max(0, Number(q.liquidityUsd || 0)),
      }))
      .sort((a, b) => a.probabilityYes - b.probabilityYes);

    const bestBuy = normalized[0];
    const bestSell = normalized[normalized.length - 1];

    const crossVenueSpread = bestSell.probabilityYes - bestBuy.probabilityYes;
    const crossVenueSpreadBps = crossVenueSpread * 10_000;

    const fairOpportunities = normalized
      .map((q) => {
        if (fairProbability === null) return null;
        const edge = fairProbability - q.probabilityYes;
        const edgeBps = edge * 10_000;
        const expectedRoiPct = (edge - q.feeBps / 10_000) * 100;

        if (edgeBps < minEdgeBps) return null;

        const score = this.scoreOpportunity(edgeBps, expectedRoiPct, q.liquidityUsd);
        return this.upsertOpportunity({
          symbol,
          marketId: q.marketId,
          venue: q.venue,
          marketProbability: q.probabilityYes,
          fairProbability,
          edgeBps,
          expectedRoiPct,
          score,
          source: "fair_value",
        });
      })
      .filter(Boolean);

    const crossVenueArb =
      crossVenueSpreadBps >= minEdgeBps
        ? {
            symbol,
            buyVenue: bestBuy.venue,
            sellVenue: bestSell.venue,
            buyProbability: bestBuy.probabilityYes,
            sellProbability: bestSell.probabilityYes,
            spreadBps: crossVenueSpreadBps,
            recommendation: "cross_venue_arb_candidate",
          }
        : null;

    return {
      symbol,
      crossVenueArb,
      fairOpportunities: this.rankOpportunities(fairOpportunities as OpportunityRecord[]),
      totalQuotes: normalized.length,
    };
  }

  async scanLatencyDislocation(input: LatencyDislocationInput) {
    const symbol = String(input.symbol || "UNKNOWN").toUpperCase();
    const marketProbability = clamp01(Number(input.marketProbability || 0));
    const referenceNow = Math.max(1e-9, Number(input.referencePriceNow || 0));
    const referencePrev = Math.max(1e-9, Number(input.referencePricePrev || 0));
    const fairProbabilityInput = input.fairProbability !== undefined ? clamp01(Number(input.fairProbability)) : null;
    const feeBps = Math.max(0, Number(input.feeBps ?? 30));
    const liquidityUsd = Math.max(0, Number(input.liquidityUsd ?? 0));
    const blindWindowMs = Math.max(1, Number(input.blindWindowMs ?? 500));
    const minEdgeBps = Number(input.minEdgeBps ?? 50);

    const lagMs = Math.max(0, Number(input.referenceTimestampMs) - Number(input.marketTimestampMs));
    const referenceReturn = (referenceNow - referencePrev) / referencePrev;
    const projectedShift = Math.max(-0.49, Math.min(0.49, referenceReturn * 0.45));
    const projectedFair = clamp01(marketProbability + projectedShift);
    const fairProbability = fairProbabilityInput ?? projectedFair;

    const edge = fairProbability - marketProbability;
    const edgeBps = edge * 10_000;
    const expectedRoiPct = (edge - feeBps / 10_000) * 100;
    const withinBlindWindow = lagMs <= blindWindowMs;
    const score = this.scoreOpportunity(edgeBps, expectedRoiPct, liquidityUsd) + (withinBlindWindow ? 8 : -3);

    if (edgeBps >= minEdgeBps) {
      this.upsertOpportunity({
        symbol,
        marketId: String(input.marketId || "unknown"),
        venue: String(input.venue || "unknown"),
        marketProbability,
        fairProbability,
        edgeBps,
        expectedRoiPct,
        score,
        source: "latency_dislocation",
      });
    }

    return {
      symbol,
      marketId: String(input.marketId || "unknown"),
      venue: String(input.venue || "unknown"),
      lagMs,
      blindWindowMs,
      withinBlindWindow,
      referenceReturn,
      projectedShift,
      marketProbability,
      fairProbability,
      edgeBps,
      expectedRoiPct,
      score,
      recommendation:
        edgeBps >= minEdgeBps && expectedRoiPct > 0 && withinBlindWindow
          ? "enter_candidate"
          : "skip",
    };
  }

  async executePaperTrade(input: PaperTradeInput) {
    const strategyId = await this.ensureStrategy();

    const marketProbability = clamp01(Number(input.marketProbability || 0));
    const fairProbability = clamp01(Number(input.fairProbability || 0));
    const bankrollUsd = Math.max(1, Number(input.bankrollUsd || 0));
    const maxRiskPct = Math.min(25, Math.max(0.2, Number(input.maxRiskPct ?? 5)));
    const feeBps = Math.max(0, Number(input.feeBps ?? 30));

    const edge = fairProbability - marketProbability;
    const b = (1 - marketProbability) / Math.max(1e-9, marketProbability);
    const p = fairProbability;
    const q = 1 - p;

    // Kelly fraction for binary payoff, reduced for safety.
    const rawKelly = (b * p - q) / Math.max(1e-9, b);
    const kellyFraction = Math.max(0, Math.min(maxRiskPct / 100, rawKelly * 0.5));
    const stakeUsd = Math.max(1, bankrollUsd * kellyFraction);
    const quantity = stakeUsd / Math.max(0.0001, marketProbability);

    const entryFee = stakeUsd * (feeBps / 10_000);

    const trade = await storage.createTrade({
      strategyId,
      symbol: String(input.symbol || "UNKNOWN").toUpperCase(),
      side: input.side === "SELL" ? "SELL" : "BUY",
      size: quantity.toFixed(8),
      entryPrice: marketProbability.toFixed(8),
      stopLoss: null,
      takeProfit: fairProbability.toFixed(8),
      pnl: null,
      profit: "0",
      loss: "0",
      fees: entryFee.toFixed(8),
      status: "open",
      strategy: this.strategyName,
    });

    const created = {
      id: trade.id,
      marketId: String(input.marketId),
      venue: String(input.venue || "unknown"),
      edgeBps: edge * 10_000,
      fairProbability,
      marketProbability,
      kellyFraction,
      stakeUsd,
      quantity,
      feeBps,
    };

    await storage.createSystemAlert({
      type: "info",
      title: "Mock trade opened",
      message: `${created.id} ${input.symbol} edge=${created.edgeBps.toFixed(1)}bps stake=$${stakeUsd.toFixed(2)}`,
      acknowledged: false,
    });

    return created;
  }

  async closePaperTrade(tradeId: string, exitProbability: number) {
    const all = await storage.getAllTrades();
    const trade = all.find((t) => t.id === tradeId);

    if (!trade) return { ok: false, error: "trade_not_found" };
    if (trade.status !== "open") return { ok: false, error: "trade_not_open" };

    const entry = Number(trade.entryPrice || 0);
    const size = Number(trade.size || 0);
    const fees = Number(trade.fees || 0);
    const exit = clamp01(Number(exitProbability || 0));

    const gross = size * (exit - entry);
    const exitFees = size * exit * 0.001; // conservative paper fee
    const pnl = gross - fees - exitFees;

    await storage.updateTrade(tradeId, {
      exitPrice: exit.toFixed(8),
      pnl: pnl.toFixed(8),
      profit: pnl > 0 ? pnl.toFixed(2) : "0",
      loss: pnl < 0 ? Math.abs(pnl).toFixed(2) : "0",
      fees: (fees + exitFees).toFixed(8),
      status: "closed",
      closedAt: new Date(),
    });

    return {
      ok: true,
      tradeId,
      entryProbability: entry,
      exitProbability: exit,
      pnl,
      totalFees: fees + exitFees,
    };
  }

  async getDashboard() {
    const allTrades = await storage.getAllTrades();
    const mockTrades = allTrades.filter((t) => t.strategy === this.strategyName || t.strategy === "openclaw-paper");

    const closed = mockTrades.filter((t) => t.status === "closed");
    const open = mockTrades.filter((t) => t.status === "open");

    const pnlSeries = new Map<string, number>();
    let netPnl = 0;
    let wins = 0;
    let losses = 0;

    for (const t of closed) {
      const pnl = Number(t.pnl || 0);
      netPnl += pnl;
      if (pnl >= 0) wins += 1;
      else losses += 1;

      const key = (t.closedAt || t.executedAt || new Date()).toISOString().slice(0, 10);
      pnlSeries.set(key, (pnlSeries.get(key) || 0) + pnl);
    }

    const sortedDates = Array.from(pnlSeries.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => ({ date, pnl }));

    let cumulative = 100;
    const equityCurve = sortedDates.map((d) => {
      cumulative += d.pnl;
      return { date: d.date, equity: cumulative };
    });

    const recentTrades = mockTrades.slice(0, 12).map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      status: t.status,
      strategy: t.strategy,
      entryPrice: Number(t.entryPrice || 0),
      exitPrice: t.exitPrice ? Number(t.exitPrice) : null,
      size: Number(t.size || 0),
      pnl: t.pnl ? Number(t.pnl) : null,
      executedAt: t.executedAt,
      closedAt: t.closedAt,
    }));

    const winRate = closed.length ? wins / closed.length : 0;

    const baseCapital = 100;

    return {
      summary: {
        totalTrades: mockTrades.length,
        closedTrades: closed.length,
        openTrades: open.length,
        wins,
        losses,
        winRate,
        netPnl,
        roiPct: (netPnl / baseCapital) * 100,
      },
      equityCurve,
      recentTrades,
      opportunities: this.rankOpportunities(this.recentOpportunities.slice(0, 20)),
    };
  }

  private async ensureStrategy(): Promise<string> {
    const strategies = await storage.getStrategies();
    const existing = strategies.find((s) => s.name === this.strategyName);
    if (existing) return existing.id;

    const created = await storage.createStrategy({
      name: this.strategyName,
      type: this.strategyType,
      status: "active",
      allocation: "0.0500",
      parameters: {
        model: "n_d2_binary",
        sizing: "kelly_half",
        mode: "paper",
      },
    });

    return created.id;
  }

  private trimRecentOpportunities() {
    this.recentOpportunities.sort((a, b) => {
      if (a.lastSeenAt !== b.lastSeenAt) return b.lastSeenAt.localeCompare(a.lastSeenAt);
      return a.id.localeCompare(b.id);
    });

    if (this.recentOpportunities.length <= this.maxRecentOpportunities) return;
    const removed = this.recentOpportunities.splice(this.maxRecentOpportunities);
    for (const item of removed) {
      this.opportunityIndex.delete(this.opportunityKey(item.symbol, item.marketId, item.venue, item.source));
    }
  }

  private scoreOpportunity(edgeBps: number, expectedRoiPct: number, liquidityUsd = 0): number {
    const liquidityBoost = Math.log10(Math.max(1, liquidityUsd + 1));
    return Number((edgeBps * 0.04 + expectedRoiPct * 3 + liquidityBoost).toFixed(4));
  }

  private opportunityKey(symbol: string, marketId: string, venue: string, source: OpportunityRecord["source"]): string {
    return `${symbol}|${marketId}|${venue}|${source}`;
  }

  private upsertOpportunity(input: Omit<OpportunityRecord, "id" | "createdAt" | "lastSeenAt" | "evidenceCount">): OpportunityRecord {
    const now = new Date().toISOString();
    const key = this.opportunityKey(input.symbol, input.marketId, input.venue, input.source);
    const existing = this.opportunityIndex.get(key);

    if (existing) {
      existing.lastSeenAt = now;
      existing.evidenceCount += 1;
      existing.marketProbability = input.marketProbability;
      existing.fairProbability = input.fairProbability;
      existing.edgeBps = input.edgeBps;
      existing.expectedRoiPct = input.expectedRoiPct;
      existing.score = input.score;
      return existing;
    }

    const created: OpportunityRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      lastSeenAt: now,
      evidenceCount: 1,
      ...input,
    };

    this.recentOpportunities.unshift(created);
    this.opportunityIndex.set(key, created);
    this.trimRecentOpportunities();
    return created;
  }

  // Deterministic ranking for stable UI ordering.
  private rankOpportunities(items: OpportunityRecord[]): OpportunityRecord[] {
    return [...items].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.lastSeenAt !== b.lastSeenAt) return b.lastSeenAt.localeCompare(a.lastSeenAt);
      return a.id.localeCompare(b.id);
    });
  }
}

export const openClawMockLabService = new OpenClawMockLabService();

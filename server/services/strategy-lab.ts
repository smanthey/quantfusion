import type { Candle, MarketDataService } from "./market-data";
import { log } from "../utils/logger";

export type Direction = "long" | "short";

export interface StrategyCandidate {
  id: string;
  name: string;
  params: StrategyParams;
}

export interface StrategyParams {
  shortPeriod: number;
  longPeriod: number;
  rsiPeriod: number;
  rsiMin: number;
  rsiMax: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldBars: number;
}

export interface StrategyScore {
  id: string;
  name: string;
  params: StrategyParams;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  maxDrawdown: number;
  netPnl: number;
  avgPnl: number;
  keepWatching: boolean;
  noise: boolean;
}

export interface StrategyLabResult {
  generatedAt: string;
  symbols: string[];
  minCandles: number;
  candidates: StrategyScore[];
  top: StrategyScore[];
  watchlist: StrategyScore[];
  noise: StrategyScore[];
}

export class StrategyLab {
  private readonly marketData: MarketDataService;
  private lastRunAt = 0;
  private cached: StrategyLabResult | null = null;
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(marketData: MarketDataService) {
    this.marketData = marketData;
  }

  getLabResult(): StrategyLabResult {
    const now = Date.now();
    if (this.cached && now - this.lastRunAt < this.cacheTtlMs) {
      return this.cached;
    }
    const result = this.runLab();
    this.cached = result;
    this.lastRunAt = now;
    return result;
  }

  private runLab(): StrategyLabResult {
    const symbols = this.marketData.getTradableSymbols();
    const minCandles = 200;
    const candidates = this.generateCandidates();
    const scored: StrategyScore[] = [];

    for (const candidate of candidates) {
      const aggregate = this.scoreCandidate(symbols, minCandles, candidate);
      if (aggregate) {
        scored.push(aggregate);
      }
    }

    scored.sort((a, b) => b.netPnl - a.netPnl);

    const top = scored.slice(0, 8);
    const watchlist = scored.filter((s) => s.keepWatching);
    const noise = scored.filter((s) => s.noise);

    return {
      generatedAt: new Date().toISOString(),
      symbols,
      minCandles,
      candidates: scored,
      top,
      watchlist,
      noise,
    };
  }

  private generateCandidates(): StrategyCandidate[] {
    const shorts = [8, 10, 12, 15];
    const longs = [26, 30, 34, 40, 50];
    const rsiPeriods = [10, 14];
    const stopLosses = [0.015, 0.02, 0.025];
    const takeProfits = [0.02, 0.03, 0.04];
    const maxHoldBars = [48, 72, 96];

    const candidates: StrategyCandidate[] = [];
    for (const shortPeriod of shorts) {
      for (const longPeriod of longs) {
        if (shortPeriod >= longPeriod) continue;
        for (const rsiPeriod of rsiPeriods) {
          for (const stopLossPct of stopLosses) {
            for (const takeProfitPct of takeProfits) {
              for (const maxHold of maxHoldBars) {
                const params: StrategyParams = {
                  shortPeriod,
                  longPeriod,
                  rsiPeriod,
                  rsiMin: 35,
                  rsiMax: 65,
                  stopLossPct,
                  takeProfitPct,
                  maxHoldBars: maxHold,
                };
                const id = `ema${shortPeriod}_${longPeriod}_rsi${rsiPeriod}_sl${Math.round(
                  stopLossPct * 1000
                )}_tp${Math.round(takeProfitPct * 1000)}_h${maxHold}`;
                candidates.push({
                  id,
                  name: `EMA ${shortPeriod}/${longPeriod} RSI ${rsiPeriod}`,
                  params,
                });
              }
            }
          }
        }
      }
    }
    return candidates;
  }

  private scoreCandidate(symbols: string[], minCandles: number, candidate: StrategyCandidate): StrategyScore | null {
    const allPnL: number[] = [];
    const allTrades: { pnl: number }[] = [];
    let totalPnL = 0;

    for (const symbol of symbols) {
      const candles = this.marketData.getCandles(symbol, 400);
      if (candles.length < minCandles) continue;
      const trades = this.simulate(candles, candidate.params);
      for (const trade of trades) {
        allTrades.push(trade);
        allPnL.push(trade.pnl);
        totalPnL += trade.pnl;
      }
    }

    if (allTrades.length === 0) return null;

    const wins = allTrades.filter((t) => t.pnl > 0).length;
    const losses = allTrades.filter((t) => t.pnl < 0);
    const grossProfit = allTrades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 1;
    const winRate = wins / allTrades.length;
    const avgPnl = totalPnL / allTrades.length;

    const sharpe = this.calculateSharpe(allPnL);
    const maxDrawdown = this.calculateMaxDrawdown(allPnL);

    const keepWatching =
      allTrades.length >= 20 &&
      profitFactor >= 1.2 &&
      sharpe >= 0.3 &&
      maxDrawdown <= 0.25;

    const noise = allTrades.length < 8 || profitFactor < 0.9 || sharpe < 0;

    return {
      id: candidate.id,
      name: candidate.name,
      params: candidate.params,
      totalTrades: allTrades.length,
      winRate: Number(winRate.toFixed(4)),
      profitFactor: Number(profitFactor.toFixed(2)),
      sharpe: Number(sharpe.toFixed(3)),
      maxDrawdown: Number(maxDrawdown.toFixed(3)),
      netPnl: Number(totalPnL.toFixed(2)),
      avgPnl: Number(avgPnl.toFixed(4)),
      keepWatching,
      noise,
    };
  }

  private simulate(candles: Candle[], params: StrategyParams): { pnl: number }[] {
    const trades: { pnl: number }[] = [];
    let position: { side: Direction; entry: number; entryIndex: number } | null = null;

    for (let i = params.longPeriod; i < candles.length; i++) {
      const price = candles[i].close;
      if (!Number.isFinite(price)) continue;

      if (position) {
        const holdingBars = i - position.entryIndex;
        const pnl = position.side === "long" ? price - position.entry : position.entry - price;
        const pnlPct = pnl / position.entry;
        const hitStop = pnlPct <= -params.stopLossPct;
        const hitTarget = pnlPct >= params.takeProfitPct;
        const timeExit = holdingBars >= params.maxHoldBars;
        if (hitStop || hitTarget || timeExit) {
          const fees = (position.entry + price) * 0.001;
          trades.push({ pnl: pnl - fees });
          position = null;
        }
      }

      if (!position) {
        const signal = this.generateSignal(candles, i, params);
        if (signal) {
          position = { side: signal, entry: price, entryIndex: i };
        }
      }
    }

    return trades;
  }

  private generateSignal(candles: Candle[], index: number, params: StrategyParams): Direction | null {
    const slice = candles.slice(0, index + 1);
    if (slice.length < params.longPeriod + 2) return null;

    const shortMA = this.calculateMA(slice, params.shortPeriod);
    const longMA = this.calculateMA(slice, params.longPeriod);
    const prevShortMA = this.calculateMA(slice.slice(0, -1), params.shortPeriod);
    const prevLongMA = this.calculateMA(slice.slice(0, -1), params.longPeriod);
    const rsi = this.calculateRSI(slice, params.rsiPeriod);

    const bullishCross = shortMA > longMA && prevShortMA <= prevLongMA && rsi >= params.rsiMin;
    const bearishCross = shortMA < longMA && prevShortMA >= prevLongMA && rsi <= params.rsiMax;

    if (bullishCross) return "long";
    if (bearishCross) return "short";
    return null;
  }

  private calculateMA(candles: Candle[], period: number): number {
    if (candles.length < period) return 0;
    const recent = candles.slice(-period);
    const sum = recent.reduce((total, c) => total + c.close, 0);
    return sum / period;
  }

  private calculateRSI(candles: Candle[], period: number): number {
    if (candles.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const delta = candles[i].close - candles[i - 1].close;
      if (delta >= 0) gains += delta;
      else losses -= delta;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  private calculateSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;
    const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? avg / stdDev : 0;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    let peak = 0;
    let equity = 0;
    let maxDd = 0;
    for (const r of returns) {
      equity += r;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  }
}

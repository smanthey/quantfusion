import type { StrategyLabResult } from "./strategy-lab";

export type StrategyPerformance = {
  strategy: string;
  trades: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
  profitFactor: number;
};

function netPnl(trade: any): number {
  const profit = Number(trade.profit || 0);
  const loss = Number(trade.loss || 0);
  const fees = Number(trade.fees || 0);
  if (profit === 0 && loss === 0 && trade.pnl) {
    const raw = Number(trade.pnl);
    return Number.isFinite(raw) ? raw : 0;
  }
  return profit - loss - fees;
}

export function buildStrategyInsights(trades: any[], labResult?: StrategyLabResult | null) {
  const closed = trades.filter((t) => t.status === "closed");
  const grouped = new Map<string, any[]>();

  for (const trade of closed) {
    const key = String(trade.strategy || trade.strategyId || "unknown");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(trade);
  }

  const performance: StrategyPerformance[] = [];
  for (const [strategy, items] of grouped.entries()) {
    const pnls = items.map(netPnl);
    const total = pnls.reduce((s, p) => s + p, 0);
    const wins = pnls.filter((p) => p > 0).length;
    const losses = pnls.filter((p) => p < 0);
    const grossProfit = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 1;

    performance.push({
      strategy,
      trades: items.length,
      winRate: items.length ? wins / items.length : 0,
      pnl: Number(total.toFixed(2)),
      avgPnl: Number((items.length ? total / items.length : 0).toFixed(4)),
      profitFactor: Number(profitFactor.toFixed(2)),
    });
  }

  performance.sort((a, b) => b.pnl - a.pnl);

  const recommendedFocus = performance
    .filter((p) => p.trades >= 5 && p.pnl > 0)
    .slice(0, 5);

  return {
    performance,
    recommendedFocus,
    lab: labResult || null,
  };
}

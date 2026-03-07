import type { Trade } from "@shared/schema";

type Rollup = {
  pnl: number;
  trades: number;
  winRate: number;
};

type Performance = {
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  maxDrawdown: number;
  expectancy: number;
};

const netPnl = (trade: any): number => {
  const profit = parseFloat(trade.profit || "0");
  const loss = parseFloat(trade.loss || "0");
  const fees = parseFloat(trade.fees || "0");
  if (profit === 0 && loss === 0 && trade.pnl) {
    const pnl = parseFloat(trade.pnl || "0");
    return Number.isFinite(pnl) ? pnl : 0;
  }
  const pnl = profit - loss - fees;
  return Number.isFinite(pnl) ? pnl : 0;
};

export function calculateRollups(trades: any[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const summarizeSince = (sinceMs: number): Rollup => {
    const windowTrades = trades.filter((t) => {
      if (t.status !== "closed") return false;
      const ts = t.executedAt ? new Date(t.executedAt).getTime() : 0;
      return ts >= sinceMs;
    });
    const total = windowTrades.reduce((sum, t) => sum + netPnl(t), 0);
    const wins = windowTrades.filter((t) => netPnl(t) > 0).length;
    const count = windowTrades.length;
    return {
      pnl: Number(total.toFixed(2)),
      trades: count,
      winRate: count > 0 ? Number((wins / count).toFixed(4)) : 0,
    };
  };

  return {
    lastHour: summarizeSince(hourAgo),
    today: summarizeSince(startOfToday),
    lastWeek: summarizeSince(weekAgo),
    lastMonth: summarizeSince(monthAgo),
    allTime: summarizeSince(0),
    updatedAt: now.toISOString(),
  };
}

export function calculatePerformance(trades: any[]): Performance {
  const closed = trades.filter((t) => t.status === "closed");
  const pnls = closed.map((t) => netPnl(t));
  const totalPnl = pnls.reduce((s, p) => s + p, 0);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const winRate = closed.length ? wins.length / closed.length : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 1;
  const expectancy = closed.length ? totalPnl / closed.length : 0;
  const sharpe = computeSharpe(pnls);
  const maxDrawdown = computeMaxDrawdown(pnls);

  return {
    totalPnl: Number(totalPnl.toFixed(2)),
    totalTrades: closed.length,
    winRate: Number(winRate.toFixed(4)),
    profitFactor: Number(profitFactor.toFixed(2)),
    sharpe: Number(sharpe.toFixed(3)),
    maxDrawdown: Number(maxDrawdown.toFixed(3)),
    expectancy: Number(expectancy.toFixed(4)),
  };
}

function computeSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? avg / stdDev : 0;
}

function computeMaxDrawdown(returns: number[]): number {
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

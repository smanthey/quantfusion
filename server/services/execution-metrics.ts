import { readJournalEntries } from "./trade-journal";

export type ExecutionMetrics = {
  entrySlippageBpsAvg: number;
  exitSlippageBpsAvg: number;
  roundTripSlippageBpsAvg: number;
  spreadBpsAvg: number;
  volatilityAvg: number;
  avgFees: number;
  totalFees: number;
  totalTrades: number;
  tradesWithExecutionMeta: number;
  updatedAt: string;
};

type ExecutionMeta = {
  entryRequested?: number;
  entryFill?: number;
  entrySlippageBps?: number;
  exitMark?: number;
  exitFill?: number;
  exitSlippageBps?: number;
  spreadBps?: number;
  volatility?: number;
};

function safeNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function computeExecutionMetrics(): Promise<ExecutionMetrics> {
  const entries = await readJournalEntries();
  let entrySlippageTotal = 0;
  let entrySlippageCount = 0;
  let exitSlippageTotal = 0;
  let exitSlippageCount = 0;
  let spreadTotal = 0;
  let spreadCount = 0;
  let volatilityTotal = 0;
  let volatilityCount = 0;
  let totalFees = 0;
  let tradeCount = 0;
  let tradesWithExecutionMeta = 0;

  for (const entry of entries) {
    const trade = entry.trade || {};
    if (entry.event === "close" || entry.event === "partial") {
      tradeCount += 1;
      totalFees += safeNumber(trade.fees);
    }

    const execution: ExecutionMeta | undefined = trade.execution;
    if (!execution) continue;
    tradesWithExecutionMeta += 1;

    if (Number.isFinite(execution.entrySlippageBps)) {
      entrySlippageTotal += safeNumber(execution.entrySlippageBps);
      entrySlippageCount += 1;
    }
    if (Number.isFinite(execution.exitSlippageBps)) {
      exitSlippageTotal += safeNumber(execution.exitSlippageBps);
      exitSlippageCount += 1;
    }
    if (Number.isFinite(execution.spreadBps)) {
      spreadTotal += safeNumber(execution.spreadBps);
      spreadCount += 1;
    }
    if (Number.isFinite(execution.volatility)) {
      volatilityTotal += safeNumber(execution.volatility);
      volatilityCount += 1;
    }
  }

  const entrySlippageBpsAvg = entrySlippageCount ? entrySlippageTotal / entrySlippageCount : 0;
  const exitSlippageBpsAvg = exitSlippageCount ? exitSlippageTotal / exitSlippageCount : 0;
  const roundTripSlippageBpsAvg = entrySlippageCount && exitSlippageCount
    ? (entrySlippageBpsAvg + exitSlippageBpsAvg)
    : entrySlippageBpsAvg + exitSlippageBpsAvg;
  const spreadBpsAvg = spreadCount ? spreadTotal / spreadCount : 0;
  const volatilityAvg = volatilityCount ? volatilityTotal / volatilityCount : 0;
  const avgFees = tradeCount ? totalFees / tradeCount : 0;

  return {
    entrySlippageBpsAvg: Number(entrySlippageBpsAvg.toFixed(2)),
    exitSlippageBpsAvg: Number(exitSlippageBpsAvg.toFixed(2)),
    roundTripSlippageBpsAvg: Number(roundTripSlippageBpsAvg.toFixed(2)),
    spreadBpsAvg: Number(spreadBpsAvg.toFixed(2)),
    volatilityAvg: Number(volatilityAvg.toFixed(6)),
    avgFees: Number(avgFees.toFixed(4)),
    totalFees: Number(totalFees.toFixed(4)),
    totalTrades: tradeCount,
    tradesWithExecutionMeta,
    updatedAt: new Date().toISOString(),
  };
}

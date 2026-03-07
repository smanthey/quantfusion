import { promises as fs } from "fs";
import path from "path";

export type TradeSnapshot = {
  event: "open" | "update" | "close" | "partial";
  trade: any;
  ts: string;
};

const journalPath = process.env.QUANT_TRADE_JOURNAL_PATH
  ? path.resolve(process.env.QUANT_TRADE_JOURNAL_PATH)
  : path.resolve(process.cwd(), "data", "trade-journal.jsonl");

export function getTradeJournalPath(): string {
  return journalPath;
}

async function ensureDir() {
  await fs.mkdir(path.dirname(journalPath), { recursive: true });
}

export async function appendTradeSnapshot(event: TradeSnapshot["event"], trade: any): Promise<void> {
  try {
    await ensureDir();
    const line: TradeSnapshot = {
      event,
      trade,
      ts: new Date().toISOString(),
    };
    await fs.appendFile(journalPath, JSON.stringify(line) + "\n", "utf8");
  } catch {
    // Best-effort only; do not block trading path
  }
}

export async function readLatestTradesFromJournal(): Promise<any[]> {
  try {
    const raw = await fs.readFile(journalPath, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const latest = new Map<string, any>();
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as TradeSnapshot;
        if (!entry.trade?.id) continue;
        latest.set(String(entry.trade.id), entry.trade);
      } catch {
        // skip bad lines
      }
    }
    return Array.from(latest.values());
  } catch {
    return [];
  }
}

export async function readJournalEntries(): Promise<TradeSnapshot[]> {
  try {
    const raw = await fs.readFile(journalPath, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const entries: TradeSnapshot[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as TradeSnapshot);
      } catch {
        // skip bad lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

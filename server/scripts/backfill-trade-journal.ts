import { promises as fs } from "fs";
import { storage } from "../storage";
import { appendTradeSnapshot, getTradeJournalPath } from "../services/trade-journal";

async function main() {
  const args = new Set(process.argv.slice(2));
  const reset = args.has("--reset");

  if (reset) {
    try {
      await fs.unlink(getTradeJournalPath());
    } catch {
      // ignore
    }
  }

  const trades = await storage.getAllTrades();
  let appended = 0;

  for (const trade of trades) {
    const event = trade.status === "closed" ? "close" : "open";
    await appendTradeSnapshot(event, trade);
    appended += 1;
  }

  console.log(`Backfill complete. Appended ${appended} trade snapshots.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});

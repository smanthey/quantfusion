interface LiveVenueQuote {
  venue: "Polymarket" | "Kalshi";
  marketId: string;
  probabilityYes: number;
  feeBps: number;
  liquidityUsd: number;
  timestampMs: number;
  raw?: any;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseTimestampMs(value: any): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 2_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim()) {
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct > 2_000_000_000 ? direct : direct * 1000;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export class PredictionMarketQuoteService {
  private readonly polymarketBase = process.env.POLYMARKET_GAMMA_URL || "https://gamma-api.polymarket.com";
  private readonly kalshiBase = process.env.KALSHI_API_URL || "https://api.elections.kalshi.com/trade-api/v2";
  private readonly requestTimeoutMs = 6_000;

  async getLiveQuotes(params: { symbol?: string; marketId?: string }) {
    const symbolHint = String(params.symbol || "BTC").toUpperCase();
    const marketIdHint = params.marketId ? String(params.marketId).toLowerCase() : "";

    const [polymarket, kalshi] = await Promise.allSettled([
      this.fetchPolymarketQuote(symbolHint, marketIdHint),
      this.fetchKalshiQuote(symbolHint, marketIdHint),
    ]);

    const quotes: LiveVenueQuote[] = [];
    const errors: string[] = [];

    if (polymarket.status === "fulfilled" && polymarket.value) quotes.push(polymarket.value);
    if (kalshi.status === "fulfilled" && kalshi.value) quotes.push(kalshi.value);
    if (polymarket.status === "rejected") errors.push(`polymarket:${String(polymarket.reason?.message || polymarket.reason)}`);
    if (kalshi.status === "rejected") errors.push(`kalshi:${String(kalshi.reason?.message || kalshi.reason)}`);

    quotes.sort((a, b) => b.timestampMs - a.timestampMs);

    return {
      symbolHint,
      marketIdHint: marketIdHint || undefined,
      fetchedAtMs: Date.now(),
      quotes,
      errors,
    };
  }

  private async fetchPolymarketQuote(symbolHint: string, marketIdHint: string): Promise<LiveVenueQuote | null> {
    const token = symbolHint.replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const url = `${this.polymarketBase}/markets?active=true&closed=false&limit=200&search=${encodeURIComponent(token)}`;
    const json = await this.fetchJson(url);
    const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

    const scored = list
      .map((m: any) => {
        const marketId = String(m?.id || m?.conditionId || m?.slug || m?.ticker || "").trim();
        const title = String(m?.question || m?.title || m?.slug || "").toUpperCase();
        const prob = this.extractPolymarketYesProbability(m);
        if (!marketId || !Number.isFinite(prob)) return null;

        let score = 0;
        if (marketIdHint && marketId.toLowerCase().includes(marketIdHint)) score += 5;
        if (title.includes(token)) score += 3;
        score += Math.min(2, Math.log10(Math.max(1, parseNumber(m?.liquidityNum || m?.liquidity || 0))));

        return {
          quote: {
            venue: "Polymarket" as const,
            marketId,
            probabilityYes: clamp01(prob),
            feeBps: 35,
            liquidityUsd: Math.max(0, parseNumber(m?.liquidityNum || m?.liquidity || 0)),
            timestampMs: parseTimestampMs(m?.updatedAt || m?.endDate || m?.createdAt),
            raw: m,
          },
          score,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    return scored.length > 0 ? scored[0].quote : null;
  }

  private extractPolymarketYesProbability(market: any): number {
    const direct =
      parseNumber(market?.probability) ||
      parseNumber(market?.probabilityYes) ||
      parseNumber(market?.yesPrice) ||
      parseNumber(market?.lastTradePrice);
    if (direct > 0) return direct > 1 ? direct / 100 : direct;

    const rawPrices = market?.outcomePrices || market?.outcome_prices;
    if (Array.isArray(rawPrices) && rawPrices.length >= 2) {
      const p = parseNumber(rawPrices[0]);
      return p > 1 ? p / 100 : p;
    }

    if (typeof rawPrices === "string" && rawPrices.trim()) {
      try {
        const parsed = JSON.parse(rawPrices);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const p = parseNumber(parsed[0]);
          return p > 1 ? p / 100 : p;
        }
      } catch {
        // ignore parse failures
      }
    }

    return NaN;
  }

  private async fetchKalshiQuote(symbolHint: string, marketIdHint: string): Promise<LiveVenueQuote | null> {
    const token = symbolHint.replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const url = `${this.kalshiBase}/markets?status=open&limit=200`;
    const json = await this.fetchJson(url);
    const list = Array.isArray(json?.markets) ? json.markets : Array.isArray(json) ? json : [];

    const scored = list
      .map((m: any) => {
        const marketId = String(m?.ticker || m?.market_ticker || m?.id || "").trim();
        const title = String(m?.title || m?.subtitle || m?.event_ticker || "").toUpperCase();
        const prob = this.extractKalshiYesProbability(m);
        if (!marketId || !Number.isFinite(prob)) return null;

        let score = 0;
        if (marketIdHint && marketId.toLowerCase().includes(marketIdHint)) score += 5;
        if (title.includes(token) || marketId.includes(token)) score += 3;
        score += Math.min(2, Math.log10(Math.max(1, parseNumber(m?.volume || m?.open_interest || 0))));

        return {
          quote: {
            venue: "Kalshi" as const,
            marketId,
            probabilityYes: clamp01(prob),
            feeBps: 35,
            liquidityUsd: Math.max(0, parseNumber(m?.volume || m?.open_interest || 0)),
            timestampMs: parseTimestampMs(m?.last_updated_ts || m?.updated_at || m?.close_time),
            raw: m,
          },
          score,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    return scored.length > 0 ? scored[0].quote : null;
  }

  private extractKalshiYesProbability(market: any): number {
    const candidates = [
      market?.yes_bid,
      market?.yes_ask,
      market?.yes_price,
      market?.last_price,
      market?.last_traded_price,
    ];

    for (const c of candidates) {
      const n = parseNumber(c);
      if (!Number.isFinite(n) || n <= 0) continue;
      return n > 1 ? n / 100 : n;
    }

    return NaN;
  }

  private async fetchJson(url: string): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`http_${res.status}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const predictionMarketQuoteService = new PredictionMarketQuoteService();

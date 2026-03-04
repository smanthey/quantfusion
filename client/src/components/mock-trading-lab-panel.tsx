import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";

interface MockDashboardResponse {
  ok: boolean;
  summary: {
    totalTrades: number;
    closedTrades: number;
    openTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    netPnl: number;
    roiPct: number;
  };
  equityCurve: Array<{ date: string; equity: number }>;
  opportunities: Array<{
    id: string;
    createdAt?: string;
    lastSeenAt?: string;
    evidenceCount?: number;
    symbol: string;
    venue: string;
    marketId: string;
    marketProbability: number;
    fairProbability: number;
    edgeBps: number;
    expectedRoiPct: number;
    score?: number;
    source?: "fair_value" | "latency_dislocation";
  }>;
  recentTrades: Array<{
    id: string;
    symbol: string;
    side: string;
    status: string;
    strategy: string | null;
    entryPrice: number;
    exitPrice: number | null;
    size: number;
    pnl: number | null;
    executedAt?: string;
    closedAt?: string;
  }>;
}

interface DashboardMarketSnapshot {
  marketData?: {
    BTCUSDT?: {
      price?: number;
    };
  };
}

interface LiveVenueQuote {
  venue: "Polymarket" | "Kalshi";
  marketId: string;
  probabilityYes: number;
  feeBps: number;
  liquidityUsd: number;
  timestampMs: number;
}

interface LiveQuotesResponse {
  ok: boolean;
  result: {
    symbolHint?: string;
    quotes: LiveVenueQuote[];
    fetchedAtMs: number;
    errors?: string[];
  };
}

async function jsonRequest(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

export function MockTradingLabPanel() {
  const MAX_QUOTE_AGE_MS = 2_000;
  const { toast } = useToast();
  const previousTickRef = useRef<{ price: number; timestampMs: number } | null>(null);
  const lastScanAtRef = useRef(0);
  const { data: wsMessage } = useWebSocket("/ws");

  const { data, isLoading, isError, error } = useQuery<MockDashboardResponse>({
    queryKey: ["/api/openclaw/mock/dashboard"],
    refetchInterval: 10_000,
    staleTime: 3_000,
  });

  const { data: dashboardSnapshot } = useQuery<DashboardMarketSnapshot>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 5_000,
    staleTime: 2_000,
  });

  const { data: liveQuotes } = useQuery<LiveQuotesResponse>({
    queryKey: ["/api/openclaw/mock/live-quotes?symbol=BTC-5M"],
    refetchInterval: 3_000,
    staleTime: 1_500,
  });

  const nowMs = Date.now();
  const allLiveQuotes = liveQuotes?.result?.quotes || [];
  const freshLiveQuotes = allLiveQuotes.filter(
    (q) => nowMs - Number(q.timestampMs || 0) <= MAX_QUOTE_AGE_MS
  );

  const scanMutation = useMutation({
    mutationFn: async () =>
      jsonRequest("/api/openclaw/mock/scan-arb", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTC-5M",
          fairProbability: 0.62,
          minEdgeBps: 80,
          quotes: [
            { venue: "Polymarket", marketId: "btc-5m-up", probabilityYes: 0.54, feeBps: 40 },
            { venue: "Kalshi", marketId: "k-btc-5m", probabilityYes: 0.57, feeBps: 35 },
            { venue: "InternalFair", marketId: "deribit-model", probabilityYes: 0.62, feeBps: 0 },
          ],
        }),
      }),
    onSuccess: () => {
      toast({ title: "Arbitrage scan complete", description: "Latest opportunities refreshed." });
      queryClient.invalidateQueries({ queryKey: ["/api/openclaw/mock/dashboard"] });
    },
    onError: (err: any) => {
      toast({
        title: "Scan failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const latencyScanMutation = useMutation({
    mutationFn: async (payload: {
      symbol: string;
      marketId: string;
      venue: string;
      marketProbability: number;
      referencePriceNow: number;
      referencePricePrev: number;
      referenceTimestampMs: number;
      marketTimestampMs: number;
      feeBps?: number;
      liquidityUsd?: number;
      blindWindowMs?: number;
      minEdgeBps?: number;
    }) =>
      jsonRequest("/api/openclaw/mock/scan-latency", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/openclaw/mock/dashboard"] });
    },
    onError: (err: any) => {
      toast({
        title: "Latency scan failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const topOpportunity = data?.opportunities?.[0];
    const venueTarget = String(topOpportunity?.venue || "").toLowerCase();
    const quotes = freshLiveQuotes;
    const selectedQuote =
      quotes.find((q) => q.venue.toLowerCase() === venueTarget) ||
      quotes[0];

    const wsPrice = Number(wsMessage?.data?.marketData?.BTCUSDT?.price ?? NaN);
    const snapshotPrice = Number(dashboardSnapshot?.marketData?.BTCUSDT?.price ?? NaN);
    const currentPrice = Number.isFinite(wsPrice) ? wsPrice : snapshotPrice;
    const currentTimestampMs = Number.isFinite(Number(wsMessage?.timestamp))
      ? Number(wsMessage?.timestamp)
      : Date.now();

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return;
    }
    if (!selectedQuote || !Number.isFinite(Number(selectedQuote.probabilityYes))) {
      previousTickRef.current = { price: currentPrice, timestampMs: currentTimestampMs };
      return;
    }

    const previous = previousTickRef.current;
    if (!previous) {
      previousTickRef.current = { price: currentPrice, timestampMs: currentTimestampMs };
      return;
    }

    const priceMoved = Math.abs(currentPrice - previous.price) / previous.price > 0.0001;
    const elapsedSinceLastScan = Date.now() - lastScanAtRef.current;
    const throttleMs = 4_000;

    if (!priceMoved || elapsedSinceLastScan < throttleMs) {
      previousTickRef.current = { price: currentPrice, timestampMs: currentTimestampMs };
      return;
    }

    latencyScanMutation.mutate({
      symbol: topOpportunity?.symbol || "BTC-5M",
      marketId: selectedQuote.marketId,
      venue: selectedQuote.venue,
      marketProbability: Number(selectedQuote.probabilityYes),
      referencePriceNow: currentPrice,
      referencePricePrev: previous.price,
      referenceTimestampMs: currentTimestampMs,
      marketTimestampMs: Number(selectedQuote.timestampMs || currentTimestampMs),
      feeBps: Number(selectedQuote.feeBps || 35),
      liquidityUsd: Number(selectedQuote.liquidityUsd || 0),
      blindWindowMs: 500,
      minEdgeBps: 50,
    });

    previousTickRef.current = { price: currentPrice, timestampMs: currentTimestampMs };
    lastScanAtRef.current = Date.now();
  }, [
    wsMessage,
    dashboardSnapshot?.marketData?.BTCUSDT?.price,
    data?.opportunities,
    latencyScanMutation,
    freshLiveQuotes,
  ]);

  const seedDeribitMutation = useMutation({
    mutationFn: async () =>
      jsonRequest("/api/openclaw/mock/trades", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTC-5M",
          marketId: "btc-5m-up",
          venue: "Polymarket",
          side: "BUY",
          marketProbability: 0.54,
          fairProbability: 0.62,
          bankrollUsd: 100,
          maxRiskPct: 8,
          feeBps: 35,
          notes: "Seeded from Deribit N(d2) post concept",
        }),
      }),
    onSuccess: () => {
      toast({ title: "Mock trade opened", description: "Deribit-edge paper trade seeded." });
      queryClient.invalidateQueries({ queryKey: ["/api/openclaw/mock/dashboard"] });
    },
    onError: (err: any) => {
      toast({
        title: "Trade open failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const seedCopyMutation = useMutation({
    mutationFn: async () =>
      jsonRequest("/api/openclaw/mock/trades", {
        method: "POST",
        body: JSON.stringify({
          symbol: "NBA-LOWCAP",
          marketId: "alpha-copy-wallet",
          venue: "AlphaWhaleStyle",
          side: "BUY",
          marketProbability: 0.11,
          fairProbability: 0.16,
          bankrollUsd: 100,
          maxRiskPct: 6,
          feeBps: 45,
          notes: "Seeded from copy-wallet low-price range concept",
        }),
      }),
    onSuccess: () => {
      toast({ title: "Copy-style paper trade opened", description: "$100 test trade added." });
      queryClient.invalidateQueries({ queryKey: ["/api/openclaw/mock/dashboard"] });
    },
    onError: (err: any) => {
      toast({
        title: "Trade open failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async ({ tradeId, exitProbability }: { tradeId: string; exitProbability: number }) =>
      jsonRequest(`/api/openclaw/mock/trades/${tradeId}/close`, {
        method: "POST",
        body: JSON.stringify({ exitProbability }),
      }),
    onSuccess: () => {
      toast({ title: "Mock trade closed", description: "PnL snapshot updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/openclaw/mock/dashboard"] });
    },
    onError: (err: any) => {
      toast({
        title: "Close failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  if (isError) {
    const message = error instanceof Error ? error.message : "Mock lab unavailable";
    return (
      <Card className="backdrop-blur-xl bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle>OpenClaw Mock Lab</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {message.includes("mock_lab_disabled")
            ? "Mock lab is disabled. Set ENABLE_OPENCLAW_MOCK_LAB=true to enable."
            : message}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card className="backdrop-blur-xl bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle>OpenClaw Mock Lab</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading mock performance...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-white/5 border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>OpenClaw Mock Lab</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              Run Arb Scan
            </Button>
            <Button size="sm" onClick={() => seedDeribitMutation.mutate()} disabled={seedDeribitMutation.isPending}>
              Seed Deribit Edge
            </Button>
            <Button size="sm" onClick={() => seedCopyMutation.mutate()} disabled={seedCopyMutation.isPending}>
              Seed Copy Wallet
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded bg-blue-500/10">
            <p className="text-xs text-muted-foreground">Net PnL</p>
            <p className={`text-lg font-semibold ${data.summary.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${data.summary.netPnl.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded bg-purple-500/10">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-lg font-semibold text-purple-300">{(data.summary.winRate * 100).toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded bg-cyan-500/10">
            <p className="text-xs text-muted-foreground">Trades</p>
            <p className="text-lg font-semibold text-cyan-300">{data.summary.totalTrades}</p>
          </div>
          <div className="p-3 rounded bg-amber-500/10">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="text-lg font-semibold text-amber-300">{data.summary.openTrades}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 rounded border border-white/10">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Ranked Opportunities (Live)</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                onClick={() => {
                  const topOpportunity = data.opportunities?.[0];
                  const currentPrice = Number(
                    wsMessage?.data?.marketData?.BTCUSDT?.price ??
                    dashboardSnapshot?.marketData?.BTCUSDT?.price ??
                    0
                  );
                  const previous = previousTickRef.current;
                  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !previous) return;
                  const quotes = freshLiveQuotes;
                  const venueTarget = String(topOpportunity?.venue || "").toLowerCase();
                  const selectedQuote =
                    quotes.find((q) => q.venue.toLowerCase() === venueTarget) ||
                    quotes[0];
                  if (!selectedQuote) return;

                  latencyScanMutation.mutate({
                    symbol: topOpportunity?.symbol || "BTC-5M",
                    marketId: selectedQuote.marketId,
                    venue: selectedQuote.venue,
                    marketProbability: Number(selectedQuote.probabilityYes),
                    referencePriceNow: currentPrice,
                    referencePricePrev: previous.price,
                    referenceTimestampMs: Date.now(),
                    marketTimestampMs: Number(selectedQuote.timestampMs || Date.now()),
                    feeBps: Number(selectedQuote.feeBps || 35),
                    liquidityUsd: Number(selectedQuote.liquidityUsd || 0),
                    blindWindowMs: 500,
                    minEdgeBps: 50,
                  });
                }}
                disabled={latencyScanMutation.isPending || freshLiveQuotes.length === 0}
              >
                Scan Latency
              </Button>
            </div>
            <div className="mb-3 rounded border border-white/10 overflow-hidden">
              <div className="grid grid-cols-4 gap-2 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Venue</span>
                <span>YES</span>
                <span>Age</span>
                <span>Market</span>
              </div>
              {allLiveQuotes.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-muted-foreground">No venue quotes available.</div>
              ) : (
                allLiveQuotes.slice(0, 4).map((q) => {
                  const ageMs = Math.max(0, nowMs - Number(q.timestampMs || nowMs));
                  const isFresh = ageMs <= MAX_QUOTE_AGE_MS;
                  return (
                    <div key={`${q.venue}-${q.marketId}`} className="grid grid-cols-4 gap-2 px-2 py-1 text-[11px] border-t border-white/10">
                      <span className="font-medium">{q.venue}</span>
                      <span>{(q.probabilityYes * 100).toFixed(2)}%</span>
                      <span className={isFresh ? "text-green-300" : "text-amber-300"}>{ageMs}ms</span>
                      <span className="truncate text-muted-foreground" title={q.marketId}>{q.marketId}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {data.opportunities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No opportunities yet. Run arb scan.</p>
              ) : (
                data.opportunities.slice(0, 8).map((op) => (
                  <div key={op.id} className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium">{op.symbol} - {op.venue}</p>
                      <p className="text-muted-foreground">
                        {op.marketId}
                        {op.source ? ` • ${op.source}` : ""}
                        {typeof op.evidenceCount === "number" ? ` • ev:${op.evidenceCount}` : ""}
                        {typeof op.score === "number" ? ` • score:${op.score.toFixed(2)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-green-300 border-green-500/40">
                        {op.edgeBps.toFixed(0)} bps
                      </Badge>
                      <p className="mt-1 text-[10px] text-muted-foreground">{op.expectedRoiPct.toFixed(2)}%</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Live quotes: {allLiveQuotes.length} venues • fresh (&lt;={MAX_QUOTE_AGE_MS}ms): {freshLiveQuotes.length}
              {liveQuotes?.result?.errors?.length ? ` • ${liveQuotes.result.errors.length} source errors` : ""}
            </p>
          </div>

          <div className="p-3 rounded border border-white/10">
            <p className="text-sm font-medium mb-2">Recent Mock Trades</p>
            <div className="space-y-2 max-h-48 overflow-auto">
              {data.recentTrades.length === 0 ? (
                <p className="text-xs text-muted-foreground">No mock trades yet.</p>
              ) : (
                data.recentTrades.slice(0, 8).map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-medium">{trade.symbol} ({trade.side})</p>
                      <p className="text-muted-foreground">
                        entry {trade.entryPrice.toFixed(3)} {trade.exitPrice !== null ? `-> exit ${trade.exitPrice.toFixed(3)}` : ""}
                      </p>
                    </div>
                    {trade.status === "open" ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => closeMutation.mutate({ tradeId: trade.id, exitProbability: 1 })}
                        >
                          Close @1.0
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => closeMutation.mutate({ tradeId: trade.id, exitProbability: 0 })}
                        >
                          Close @0.0
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className={trade.pnl !== null && trade.pnl >= 0 ? "text-green-300 border-green-500/40" : "text-red-300 border-red-500/40"}
                      >
                        {trade.pnl !== null ? `$${trade.pnl.toFixed(2)}` : "closed"}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

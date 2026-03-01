import crypto from "crypto";
import { storage } from "../storage";
import { log } from "../utils/logger";

type OrderMode = "paper" | "live";
type Side = "BUY" | "SELL";

export interface TradingViewAlertPayload {
  symbol: string;
  side?: "buy" | "sell" | "BUY" | "SELL";
  timeframe?: string;
  condition?: string;
  message?: string;
  price?: number;
  strategy?: string;
  confidence?: number;
}

export interface PositionSizingInput {
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  maxNotionalPercent?: number;
}

export interface PositionSizingResult {
  riskAmount: number;
  stopDistance: number;
  quantity: number;
  notional: number;
  cappedByMaxNotional: boolean;
}

export interface TradeRequest {
  symbol: string;
  side: Side;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent?: number;
  accountBalance?: number;
  mode?: OrderMode;
  notes?: string;
}

interface PendingLiveOrder {
  id: string;
  token: string;
  request: TradeRequest;
  createdAt: number;
  expiresAt: number;
  status: "pending_confirmation" | "cancelled" | "confirmed" | "failed";
  reason?: string;
}

export class OpenClawTradingService {
  private pendingLiveOrders = new Map<string, PendingLiveOrder>();
  private readonly defaultMode: OrderMode =
    process.env.OPENCLAW_TRADING_MODE === "live" ? "live" : "paper";
  private readonly defaultRiskPercent = Number(process.env.OPENCLAW_DEFAULT_RISK_PCT || "1");
  private readonly defaultMaxNotionalPct = Number(process.env.OPENCLAW_MAX_NOTIONAL_PCT || "5");
  private readonly liveConfirmTtlMs = Number(process.env.OPENCLAW_LIVE_CONFIRM_TTL_MS || `${10 * 60 * 1000}`);
  private readonly tradingViewSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || "";
  private readonly openAlgoApiUrl = process.env.OPENALGO_API_URL || "";
  private readonly openAlgoApiKey = process.env.OPENALGO_API_KEY || "";

  constructor() {
    this.startPendingOrderReaper();
    this.startDailySummaryJob();
  }

  getMode(): OrderMode {
    return this.defaultMode;
  }

  verifyTradingViewSecret(candidate: string): boolean {
    if (!this.tradingViewSecret) return true;
    return candidate === this.tradingViewSecret;
  }

  async ingestTradingViewAlert(payload: TradingViewAlertPayload): Promise<{ ok: boolean; id: string }> {
    const id = crypto.randomUUID();
    const side = payload.side ? String(payload.side).toUpperCase() : "N/A";
    const title = `TradingView Alert: ${payload.symbol} ${side}`;
    const message = payload.message || payload.condition || "Condition met";

    await storage.createSystemAlert({
      type: "info",
      title,
      message: `${message} [tf=${payload.timeframe || "unknown"} strategy=${payload.strategy || "unknown"}]`,
      acknowledged: false,
    });

    log.info("TradingView alert ingested", { id, payload });

    return { ok: true, id };
  }

  calculatePositionSize(input: PositionSizingInput): PositionSizingResult {
    const accountBalance = Math.max(0, Number(input.accountBalance || 0));
    const riskPercent = Math.max(0.01, Number(input.riskPercent || this.defaultRiskPercent));
    const entryPrice = Math.max(0.00000001, Number(input.entryPrice || 0));
    const stopLossPrice = Math.max(0.00000001, Number(input.stopLossPrice || 0));
    const maxNotionalPercent = Math.max(
      0.1,
      Number(input.maxNotionalPercent || this.defaultMaxNotionalPct)
    );

    const riskAmount = accountBalance * (riskPercent / 100);
    const stopDistance = Math.max(0.00000001, Math.abs(entryPrice - stopLossPrice));
    let quantity = riskAmount / stopDistance;
    let notional = quantity * entryPrice;

    const maxNotional = accountBalance * (maxNotionalPercent / 100);
    let cappedByMaxNotional = false;
    if (notional > maxNotional) {
      quantity = maxNotional / entryPrice;
      notional = quantity * entryPrice;
      cappedByMaxNotional = true;
    }

    return {
      riskAmount,
      stopDistance,
      quantity,
      notional,
      cappedByMaxNotional,
    };
  }

  async submitTrade(req: TradeRequest): Promise<any> {
    const mode: OrderMode = req.mode === "live" ? "live" : this.defaultMode;
    const normalized: TradeRequest = {
      ...req,
      mode,
      side: req.side === "SELL" ? "SELL" : "BUY",
      riskPercent: Number(req.riskPercent || this.defaultRiskPercent),
    };

    if (mode === "paper") {
      const executed = await this.executePaperTrade(normalized);
      return {
        ok: true,
        mode,
        execution: "paper",
        trade: executed,
      };
    }

    const pending = this.createPendingLiveOrder(normalized);
    await storage.createSystemAlert({
      type: "warning",
      title: `Live Trade Awaiting Confirmation`,
      message: `Order ${pending.id} for ${normalized.symbol} ${normalized.side} requires explicit confirm.`,
      acknowledged: false,
    });

    return {
      ok: true,
      mode,
      requiresConfirmation: true,
      pendingOrderId: pending.id,
      confirmationToken: pending.token,
      expiresAt: new Date(pending.expiresAt).toISOString(),
    };
  }

  async confirmLiveOrder(orderId: string, token: string, confirm: boolean): Promise<any> {
    const pending = this.pendingLiveOrders.get(orderId);
    if (!pending) {
      return { ok: false, error: "pending_order_not_found" };
    }
    if (pending.expiresAt < Date.now()) {
      this.pendingLiveOrders.delete(orderId);
      return { ok: false, error: "pending_order_expired" };
    }
    if (pending.token !== token) {
      return { ok: false, error: "invalid_confirmation_token" };
    }
    if (!confirm) {
      pending.status = "cancelled";
      pending.reason = "user_rejected";
      this.pendingLiveOrders.set(orderId, pending);
      return { ok: true, cancelled: true };
    }

    pending.status = "confirmed";
    this.pendingLiveOrders.set(orderId, pending);

    try {
      const result = await this.executeLiveTrade(pending.request);
      this.pendingLiveOrders.delete(orderId);
      return { ok: true, mode: "live", execution: "live", brokerResult: result };
    } catch (err: any) {
      pending.status = "failed";
      pending.reason = String(err?.message || err || "live_execution_failed");
      this.pendingLiveOrders.set(orderId, pending);
      return { ok: false, error: pending.reason };
    }
  }

  listPendingOrders() {
    return Array.from(this.pendingLiveOrders.values()).map((o) => ({
      id: o.id,
      symbol: o.request.symbol,
      side: o.request.side,
      createdAt: new Date(o.createdAt).toISOString(),
      expiresAt: new Date(o.expiresAt).toISOString(),
      status: o.status,
      reason: o.reason || null,
    }));
  }

  async getDailyPnLSummary(date?: string) {
    const start = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (!date) start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const trades = await storage.getAllTrades();
    const dayTrades = trades.filter((t) => {
      if (!t.executedAt) return false;
      const ts = new Date(t.executedAt).getTime();
      return ts >= start.getTime() && ts < end.getTime();
    });

    let grossProfit = 0;
    let grossLoss = 0;
    let fees = 0;
    let netPnl = 0;
    let wins = 0;
    let losses = 0;

    for (const t of dayTrades) {
      const p = Number(t.profit || 0);
      const l = Number(t.loss || 0);
      const f = Number(t.fees || 0);
      const n = p - l - f;
      grossProfit += p;
      grossLoss += l;
      fees += f;
      netPnl += n;
      if (n >= 0) wins += 1;
      else losses += 1;
    }

    return {
      date: start.toISOString().slice(0, 10),
      totalTrades: dayTrades.length,
      wins,
      losses,
      winRate: dayTrades.length ? wins / dayTrades.length : 0,
      grossProfit,
      grossLoss,
      fees,
      netPnl,
    };
  }

  private createPendingLiveOrder(request: TradeRequest): PendingLiveOrder {
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(16).toString("hex");
    const now = Date.now();
    const pending: PendingLiveOrder = {
      id,
      token,
      request,
      createdAt: now,
      expiresAt: now + this.liveConfirmTtlMs,
      status: "pending_confirmation",
    };
    this.pendingLiveOrders.set(id, pending);
    return pending;
  }

  private async executePaperTrade(req: TradeRequest) {
    const strategyId = await this.ensureOpenClawStrategy();
    const sizing = this.calculatePositionSize({
      accountBalance: Number(req.accountBalance || 10000),
      riskPercent: Number(req.riskPercent || this.defaultRiskPercent),
      entryPrice: req.entryPrice,
      stopLossPrice: req.stopLoss,
      maxNotionalPercent: this.defaultMaxNotionalPct,
    });

    const created = await storage.createTrade({
      strategyId,
      symbol: req.symbol,
      side: req.side,
      size: sizing.quantity.toString(),
      entryPrice: req.entryPrice.toString(),
      stopLoss: req.stopLoss.toString(),
      takeProfit: req.takeProfit.toString(),
      status: "open",
      strategy: "openclaw-paper",
    });

    await storage.createSystemAlert({
      type: "success",
      title: `Paper trade placed`,
      message: `${req.symbol} ${req.side} qty=${sizing.quantity.toFixed(6)} notional=$${sizing.notional.toFixed(2)}`,
      acknowledged: false,
    });

    return {
      tradeId: created.id,
      symbol: req.symbol,
      side: req.side,
      quantity: sizing.quantity,
      notional: sizing.notional,
      riskAmount: sizing.riskAmount,
      entryPrice: req.entryPrice,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit,
    };
  }

  private async executeLiveTrade(req: TradeRequest) {
    if (!this.openAlgoApiUrl) {
      throw new Error("openalgo_not_configured");
    }

    const sizing = this.calculatePositionSize({
      accountBalance: Number(req.accountBalance || 10000),
      riskPercent: Number(req.riskPercent || this.defaultRiskPercent),
      entryPrice: req.entryPrice,
      stopLossPrice: req.stopLoss,
      maxNotionalPercent: this.defaultMaxNotionalPct,
    });

    const payload = {
      symbol: req.symbol,
      side: req.side,
      quantity: Number(sizing.quantity.toFixed(8)),
      orderType: "MARKET",
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit,
      source: "openclaw-quantfusion",
      notes: req.notes || "",
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.openAlgoApiKey) headers["Authorization"] = `Bearer ${this.openAlgoApiKey}`;

    const response = await fetch(this.openAlgoApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`openalgo_error_${response.status}: ${bodyText.slice(0, 200)}`);
    }

    const strategyId = await this.ensureOpenClawStrategy();
    await storage.createTrade({
      strategyId,
      symbol: req.symbol,
      side: req.side,
      size: sizing.quantity.toString(),
      entryPrice: req.entryPrice.toString(),
      stopLoss: req.stopLoss.toString(),
      takeProfit: req.takeProfit.toString(),
      status: "open",
      strategy: "openclaw-live",
    });

    await storage.createSystemAlert({
      type: "warning",
      title: `Live order sent`,
      message: `${req.symbol} ${req.side} qty=${sizing.quantity.toFixed(6)} routed to OpenAlgo`,
      acknowledged: false,
    });

    return {
      request: payload,
      response: bodyText,
    };
  }

  private async ensureOpenClawStrategy(): Promise<string> {
    const existing = await storage.getStrategies();
    const found = existing.find((s) => s.name === "OpenClaw Automation");
    if (found) return found.id;

    const created = await storage.createStrategy({
      name: "OpenClaw Automation",
      type: "automation",
      status: "active",
      parameters: {
        source: "tradingview/openalgo",
        mode: this.defaultMode,
      },
      allocation: "0",
    });
    return created.id;
  }

  private startPendingOrderReaper() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, item] of Array.from(this.pendingLiveOrders.entries())) {
        if (item.expiresAt < now) {
          item.status = "cancelled";
          item.reason = "expired";
          this.pendingLiveOrders.set(id, item);
        }
      }
    }, 30_000);
  }

  private startDailySummaryJob() {
    setInterval(async () => {
      const now = new Date();
      if (now.getUTCHours() !== 0 || now.getUTCMinutes() !== 5) return;
      try {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const summary = await this.getDailyPnLSummary(yesterday.toISOString().slice(0, 10));
        await storage.createSystemAlert({
          type: "info",
          title: `Daily P&L ${summary.date}`,
          message: `Trades=${summary.totalTrades} Net=$${summary.netPnl.toFixed(2)} WinRate=${(
            summary.winRate * 100
          ).toFixed(1)}%`,
          acknowledged: false,
        });
      } catch (err: any) {
        log.error("daily pnl summary generation failed", { error: String(err?.message || err) });
      }
    }, 60_000);
  }
}

export const openClawTradingService = new OpenClawTradingService();

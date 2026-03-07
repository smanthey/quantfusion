type RejectionEvent = {
  ts: string;
  symbol: string;
  side: string;
  reason: string;
  stage: "circuit_breaker" | "validation" | "risk_manager" | "other";
};

const MAX_EVENTS = 200;

class RejectionTracker {
  private events: RejectionEvent[] = [];

  record(event: Omit<RejectionEvent, "ts">) {
    const entry: RejectionEvent = { ...event, ts: new Date().toISOString() };
    this.events.unshift(entry);
    if (this.events.length > MAX_EVENTS) this.events = this.events.slice(0, MAX_EVENTS);
  }

  getSummary() {
    const counts: Record<string, number> = {};
    const stageCounts: Record<string, number> = {};
    for (const e of this.events) {
      counts[e.reason] = (counts[e.reason] || 0) + 1;
      stageCounts[e.stage] = (stageCounts[e.stage] || 0) + 1;
    }

    return {
      total: this.events.length,
      byReason: counts,
      byStage: stageCounts,
      recent: this.events.slice(0, 50),
    };
  }
}

export const rejectionTracker = new RejectionTracker();

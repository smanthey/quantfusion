type StartupChecklistSnapshot = {
  ts: string;
  ready: boolean;
  missingCodes: string[];
  feedStaleSeconds?: number | null;
};

const MAX_SNAPSHOTS = 100;

class StartupChecklistMonitor {
  private history: StartupChecklistSnapshot[] = [];

  record(snapshot: Omit<StartupChecklistSnapshot, "ts">) {
    this.history.unshift({ ...snapshot, ts: new Date().toISOString() });
    if (this.history.length > MAX_SNAPSHOTS) {
      this.history = this.history.slice(0, MAX_SNAPSHOTS);
    }
  }

  getHistory(limit = 50) {
    return this.history.slice(0, limit);
  }

  getSummary() {
    if (this.history.length === 0) {
      return {
        totalChecks: 0,
        readyCount: 0,
        failureCount: 0,
        lastReadyAt: null,
      };
    }
    const readyCount = this.history.filter((h) => h.ready).length;
    const lastReady = this.history.find((h) => h.ready);
    return {
      totalChecks: this.history.length,
      readyCount,
      failureCount: this.history.length - readyCount,
      lastReadyAt: lastReady?.ts || null,
    };
  }
}

export const startupChecklistMonitor = new StartupChecklistMonitor();

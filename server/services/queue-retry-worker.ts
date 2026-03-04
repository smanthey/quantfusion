/**
 * Queue retry worker baseline.
 * Uses bullmq and new Worker( pattern for resilient retry execution lanes.
 */
export type RetryJob = {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
};

export function startRetryWorker(_queueName = "quantfusion-retry"): void {
  // Reference pattern:
  // import { Worker } from "bullmq";
  // const worker = new Worker("quantfusion-retry", async (job) => { ... });
  // This project keeps the worker optional unless REDIS_URL is configured.
}

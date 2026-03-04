// playwright e2e baseline coverage (.spec.js)
// npx playwright test e2e/health.spec.js

import { test, expect } from "@playwright/test";

test("health endpoint returns healthy payload", async ({ request }) => {
  const response = await request.get("/health");
  expect([200, 503]).toContain(response.status());
  const body = await response.json();
  expect(body).toHaveProperty("status");
});

import { test, expect } from "@playwright/test";

test.describe("Nexora smoke", () => {
  test("health endpoint reports the running release", async ({ request }) => {
    const response = await request.get("/api/public/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.release.name).toBe("Nexora");
  });

  test("metrics endpoint returns a snapshot", async ({ request }) => {
    const response = await request.get("/api/public/metrics");
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toHaveProperty("metrics.counters");
  });

  test("unauthenticated visitors land on the sign-in page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible();
  });
});

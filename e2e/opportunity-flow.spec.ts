import { test, expect } from "@playwright/test";

test("search, save, reload, and update an opportunity", async ({ page }) => {
  const opportunity = { id: "e2e-opportunity", title: "Composer for an indie game", description: "Paid music project", source: "E2E", url: "https://example.com/e2e", score: 90, freshness: "New", budget: "$1,000", disciplines: ["Composition"], paymentStatus: "paid" };
  let saved: Array<Record<string, unknown>> = [];
  await page.route("**/api/opportunities**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ opportunities: [opportunity], failedRequests: [] }) }));
  await page.route("**/api/saved-opportunities**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ opportunities: saved }) });
    const body = request.postDataJSON();
    if (request.method() === "POST") saved = [...saved, body.opportunity ?? body];
    if (request.method() === "PATCH") saved = saved.map((item) => item.id === body.id ? { ...item, status: body.status } : item);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ opportunity: saved.at(-1) }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /scout opportunities/i }).click();
  await expect(page.getByText(opportunity.title)).toBeVisible();
  await page.getByRole("button", { name: /save/i }).first().click();
  await page.reload();
  await expect(page.getByText(opportunity.title)).toBeVisible();
  const status = page.getByRole("combobox").first();
  await status.selectOption("applied");
  await page.reload();
  await expect(status).toHaveValue("applied");
});

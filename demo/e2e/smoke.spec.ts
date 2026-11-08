import { test, expect } from "@playwright/test";

const BASE = "/demos/shahnameh/";

test.beforeEach(async ({ page }) => {
  const external: string[] = [];
  (page as any)._ext = external;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["data:", "blob:"].includes(u.protocol) && u.origin !== "http://localhost:4173") external.push(r.url());
  });
});
test.afterEach(async ({ page }) => expect((page as any)._ext, "off-origin requests").toEqual([]));

test("read story, choose a branch", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByTestId("banner")).toContainText("Demo · sample data · ← rezaghamar.ir");
  await expect(page.getByTestId("story-text")).toContainText("Simurgh");
  await page.getByRole("button", { name: /Take the feather/ }).click();
  await expect(page.getByTestId("story-text")).toContainText("Rostam");
  await expect(page.getByTestId("chain")).toContainText("Situation #1");
  await page.getByRole("button", { name: /does not buckle/ }).click();
  await expect(page.getByTestId("story-text")).toContainText("White Demon");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByTestId("banner")).toHaveCount(0);
});

test("Persian story with RTL and banner", async ({ page }) => {
  await page.goto(BASE + "?lang=fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("banner")).toContainText("نسخه نمایشی · داده‌های نمونه");
  await expect(page.getByTestId("story-text")).toContainText("سیمرغ");
});

test("allowance spend then guardian recovery", async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole("tab", { name: "Wallet" }).click();
  await page.getByTestId("as").selectOption("alice");
  await page.getByTestId("spend").click();
  await expect(page.getByTestId("balance")).toHaveText("8 ETH");
  await page.getByTestId("spend").click(); // 2 more > remaining allowance 1
  await expect(page.getByTestId("log")).toContainText("more than you are allowed");
  for (const g of ["g1", "g2", "g3"]) {
    await page.getByTestId("as").selectOption(g);
    await page.getByTestId("propose").click();
  }
  await expect(page.getByTestId("owner")).toHaveText("New owner (Zal)");
  await page.getByTestId("as").selectOption("owner");
  await page.getByTestId("allow").click();
  await expect(page.getByTestId("log")).toContainText("you are not the owner");
});

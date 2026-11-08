import { test, expect, type Page } from "@playwright/test";

const BASE = "/demos/shahnameh/";
const ORIGIN = "http://localhost:4173";
const U = BASE + "?latency=60";

test.beforeEach(async ({ page }) => {
  const external: string[] = [];
  (page as any)._ext = external;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["data:", "blob:"].includes(u.protocol) && u.origin !== ORIGIN) external.push(r.url());
  });
});
test.afterEach(async ({ page }) => expect((page as any)._ext, "off-origin requests").toEqual([]));

async function connect(page: Page, url = U) {
  await page.goto(url + "#/connect");
  await page.getByTestId("connect-option-simulated").click();
  await expect(page.getByTestId("connected-card")).toBeVisible();
}
async function actAs(page: Page, name: string) {
  const panel = page.getByTestId("demo-controls");
  if (!(await panel.evaluate((el) => (el as HTMLDetailsElement).open))) await panel.locator("summary").click();
  const value = await page.getByTestId("demo-actor").locator("option", { hasText: name }).first().getAttribute("value");
  await page.getByTestId("demo-actor").selectOption(value!);
}

test("landing shows the demo banner and links to the reader", async ({ page }) => {
  await page.goto(U);
  await expect(page.getByTestId("banner")).toContainText("Demo · sample data · ← rezaghamar.ir");
  await expect(page.getByTestId("landing-title")).toContainText("Every road");
  await page.getByTestId("start-reading").click();
  await expect(page.getByTestId("chapter-title")).toContainText("Zal and the Simurgh");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByTestId("banner")).toHaveCount(0);
});

test("reader: pick branches, DRAFT notice, open branch links to the writer", async ({ page }) => {
  await page.goto(U + "#/read");
  await expect(page.getByTestId("draft-notice")).toBeVisible();
  await page.getByTestId("choice-0").click();
  await expect(page.getByTestId("chapter-title")).toContainText("Rakhsh");
  await page.goto(U + "#/read/7");
  await expect(page.getByTestId("choice-open-1")).toBeVisible();
  await page.getByTestId("write-branch-1").click();
  await expect(page).toHaveURL(/#\/write\?parent=7&branch=1/);
});

test("reader in Persian is RTL and keeps the draft notice", async ({ page }) => {
  await page.goto(BASE + "?lang=fa&latency=60#/read");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("chapter-text")).toContainText("سیمرغ");
  await expect(page.getByTestId("draft-notice")).toContainText("پیش‌نویس");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("writing needs a wallet, then a chapter goes pending to confirmed", async ({ page }) => {
  await page.goto(U + "#/write?parent=7&branch=1");
  await expect(page.getByTestId("needs-wallet")).toBeVisible();
  await connect(page);
  await page.goto(U + "#/write?parent=7&branch=1");
  await page.getByTestId("title-en").fill("Rustam waits");
  await page.getByTestId("title-fa").fill("رستم منتظر می‌ماند");
  await page.getByTestId("text-en").fill("He lowers the bow and waits.");
  await page.getByTestId("text-fa").fill("کمان را پایین می‌آورد و منتظر می‌ماند.");
  await page.getByTestId("is-ending").check();
  await page.getByTestId("submit-chapter").click();
  await expect(page.getByTestId("tx-confirmed")).toBeVisible();
  await page.getByRole("link", { name: /Read it in the story/ }).click();
  await expect(page.getByTestId("chapter-title")).toContainText("Rustam waits");
});

test("writing: over-long label blocks submit; declined signature and revert are shown", async ({ page }) => {
  await connect(page);
  await page.goto(U + "#/write?parent=9&branch=1");
  await page.getByTestId("title-en").fill("T");
  await page.getByTestId("title-fa").fill("ت");
  await page.getByTestId("text-en").fill("text");
  await page.getByTestId("text-fa").fill("متن");
  await page.getByTestId("label-en-0").fill("x".repeat(32));
  await page.getByTestId("label-fa-0").fill("الف");
  await page.getByTestId("label-en-1").fill("b");
  await page.getByTestId("label-fa-1").fill("ب");
  await expect(page.getByTestId("submit-chapter")).toBeDisabled();
  await expect(page.getByTestId("write-error")).toBeVisible();
  await page.getByTestId("label-en-0").fill("a");
  await expect(page.getByTestId("submit-chapter")).toBeEnabled();
  await actAs(page, "You");
  await page.getByTestId("demo-rejectNextSignature").check();
  await page.getByTestId("submit-chapter").click();
  await expect(page.getByTestId("tx-rejected")).toBeVisible();
  await page.getByTestId("demo-failNextTransaction").check();
  await page.getByTestId("submit-chapter").click();
  await expect(page.getByTestId("tx-failed")).toBeVisible();
});

test("wallet: send ETH within balance, revoke an allowance", async ({ page }) => {
  await connect(page);
  await page.goto(U + "#/wallet");
  await expect(page.getByTestId("wallet-balance")).toContainText("1.2400");
  await page.getByTestId("send-to").fill("0x9d443d0941964aa3ebdcb00ccef58b1bb399aa10");
  await page.getByTestId("send-amount").fill("0.04");
  await page.getByTestId("send-review").click();
  await page.getByTestId("send-confirm").click();
  await expect(page.getByTestId("tx-confirmed").first()).toBeVisible();
  await expect(page.getByTestId("wallet-balance")).toContainText("1.2000");
  await page.getByTestId("revoke-btn").first().click();
  await expect(page.getByTestId("allowance-row")).toHaveCount(1);
});

test("recovery: guardians hand over ownership, cancel clears approvals", async ({ page }) => {
  await connect(page);
  await page.goto(U + "#/recovery");
  await expect(page.getByTestId("recovery-empty")).toBeVisible();
  await actAs(page, "Farzaneh");
  await page.getByTestId("propose-addr").fill("0x0000000000000000000000000000000000000000");
  await expect(page.getByTestId("propose-error")).toBeVisible();
  await page.getByTestId("propose-addr").fill("0xC4d847273da4472cbddf62462a129a9499a67e02");
  await page.getByTestId("propose-submit").click();
  await expect(page.getByTestId("approvals-count")).toContainText("1");
  await actAs(page, "You");
  await page.getByTestId("cancel-recovery").click();
  await expect(page.getByTestId("recovery-empty")).toBeVisible();
  await actAs(page, "Farzaneh");
  await page.getByTestId("propose-addr").fill("0xC4d847273da4472cbddf62462a129a9499a67e02");
  await page.getByTestId("propose-submit").click();
  await expect(page.getByTestId("approvals-count")).toContainText("1");
  await actAs(page, "Kaveh");
  await page.getByTestId("approve-btn").click();
  await expect(page.getByTestId("recovery-empty")).toBeVisible();
  await page.goto(U + "#/wallet");
  await expect(page.getByTestId("wallet-owner")).toContainText("0xC4d8");
});

test("history filters and detail; state survives a reload", async ({ page }) => {
  await connect(page);
  await page.goto(U + "#/history");
  await expect(page.getByTestId("history-row").first()).toBeVisible();
  const all = await page.getByTestId("history-row").count();
  expect(all).toBeGreaterThan(5);
  await page.getByTestId("filter-recovery").click();
  expect(await page.getByTestId("history-row").count()).toBeLessThan(all);
  await page.getByTestId("history-row").first().click();
  await expect(page.getByTestId("history-detail")).toContainText("0x");
  await page.reload();
  await expect(page.getByTestId("session-pill")).toBeVisible();
});

test("unknown route shows the 404", async ({ page }) => {
  await page.goto(U + "#/nope");
  await expect(page.getByTestId("not-found")).toBeVisible();
});

import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { locales } from "../lib/messages";
import { localeNames } from "../lib/messages";

async function openRail(page: Page) {
  if (await page.locator("#rail-items").isVisible()) await page.locator(".reveal-button").press("Enter");
  await page.locator(".reveal-button").press("Enter");
  await expect(page.locator("#rail-items")).toBeVisible();
}

const qa = path.resolve(process.cwd(), "../../artifacts/qa");
for (const locale of locales) {
  test(`${locale}: localized desktop and mobile without horizontal overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${locale}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".capture-card")).toHaveCount(3);
    await expect(page.locator(".language-trigger")).toContainText(localeNames[locale]);
    await expect(page.locator("#rail-items")).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".capture-actions")).toBeVisible();
    expect(errors).toEqual([]);
    if (locale === "zh-Hans") {
      await mkdir(qa, { recursive: true });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.screenshot({ path: path.join(qa, "website-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.screenshot({ path: path.join(qa, "website-desktop.png"), fullPage: false });
      await page.screenshot({ path: path.join(qa, "website-full.png"), fullPage: true });
      await openRail(page);
      await page.locator(".desktop").screenshot({ path: path.join(qa, "rail-expanded-v4.png") });
      await page.locator(".language-trigger").click();
      await page.screenshot({ path: path.join(qa, "language-picker-v2.png"), clip: { x: 1000, y: 0, width: 280, height: 410 } });
    }
  });
}

test("overflow preserves items, reset cancels deletion, empty state can recover", async ({ page }) => {
  await page.goto("/en/");
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Add a snippet", exact: true }).click();
  await expect(page.locator("#rail-items")).toBeVisible();
  await openRail(page);
  await expect(page.locator(".capture-card")).toHaveCount(1);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(page.locator(".capture-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await openRail(page);
  await page.getByRole("button", { name: "Remove: Weekend mountains", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  // A reset must cancel the queued deletion, not remove the same seed ID later.
  await page.waitForTimeout(650);
  await expect(page.locator(".capture-card")).toHaveCount(3);
  await openRail(page);
  for (let count = 3; count > 0; count--) {
    await page.locator(".card-remove").first().click();
    await expect(page.locator(".capture-card")).toHaveCount(count - 1);
  }
  await expect(page.locator(".empty-slot")).toBeVisible();
  await page.locator(".empty-slot").click();
  await expect(page.locator(".capture-card")).toHaveCount(1);
});

test("keyboard, reduced motion and focus after removal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  await openRail(page);
  const first = page.getByRole("button", { name: "Copy: Weekend mountains", exact: true });
  await first.focus();
  await first.press("ArrowRight");
  const text = page.getByRole("button", { name: "Copy: A little idea", exact: true });
  await expect(text).toBeFocused();
  await text.press("Delete");
  await expect(page.locator(".capture-card")).toHaveCount(2);
  await expect(first).toBeFocused();
  await first.press("Escape");
  await expect(page.locator("#rail-items")).toBeHidden();
  await expect(page.locator(".reveal-button")).toBeFocused();
  await page.locator(".reveal-button").press("Enter");
  await expect(page.locator("#rail-items")).toBeVisible();
});

test("text and PNG copy use native clipboard payloads", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/");
  await openRail(page);
  await page.getByRole("button", { name: "Copy: A little idea", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Copied to clipboard");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Keep the useful things within reach.");
  await page.getByRole("button", { name: "Copy: Weekend mountains", exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.read()).flatMap((item) => item.types))).toContain("image/png");
});

test("clipboard denial provides truthful feedback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: {
      writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
      write: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    } });
  });
  await page.goto("/en/");
  await openRail(page);
  await page.getByRole("button", { name: "Copy: A little idea", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("denied");
});

test("edge dwell reveals a full-width shallow row, leaving hides it without focus theft", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  const edge = await page.locator(".desktop").boundingBox();
  expect(edge).not.toBeNull();
  await page.mouse.move(edge!.x + edge!.width / 2, edge!.y + 70);
  // Brief contact must not reveal the rail.
  await page.mouse.move(edge!.x + edge!.width / 2, edge!.y + 26);
  await page.mouse.move(edge!.x + edge!.width / 2, edge!.y + 70);
  await page.waitForTimeout(250);
  await expect(page.locator("#rail-items")).toBeHidden();
  const before = await page.evaluate(() => document.activeElement?.tagName);
  await page.mouse.move(edge!.x + edge!.width / 2, edge!.y + 26);
  await expect(page.locator("#rail-items")).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(before);
  const rail = await page.locator(".rail-drawer").boundingBox();
  expect(rail!.width).toBeCloseTo(edge!.width - 12, 0);
  expect(rail!.height).toBeLessThan(130);
  expect(await page.locator(".rail-drawer").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await page.mouse.move(edge!.x + 30, edge!.y + 230);
  await expect(page.locator("#rail-items")).toBeHidden();
});

test("additions reveal the new card without receipt text, reset stays quiet", async ({ page }) => {
  await page.goto("/zh-Hans/");
  await page.getByRole("button", { name: "截一张图", exact: true }).click();
  await expect(page.locator("#rail-items")).toBeVisible();
  await expect(page.locator('[data-card="4"]')).toHaveClass(/just-added/);
  await expect(page.getByRole("button", { name: "截一张图", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "放段文字", exact: true }).click();
  await expect(page.locator("#rail-items")).toBeVisible();
  await expect(page.locator('[data-card="5"]')).toHaveClass(/just-added/);
  await expect(page.getByRole("status")).not.toContainText("已加入");
  await page.locator("#playground").screenshot({ path: path.join(qa, "capture-peek-v4.png"), animations: "disabled" });
  await page.getByRole("button", { name: "重置演示", exact: true }).click();
  await expect(page.getByRole("status")).not.toContainText("已重置");
  await expect(page.locator(".capture-card")).toHaveCount(3);
  await expect(page.locator(".receipt-view")).toHaveCount(0);
  await expect(page.locator("#rail-items")).toBeHidden();
});

test("back-to-top appears only beyond one viewport and returns focus to the top", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/zh-Hans/");
  const top = page.locator(".back-to-top");
  await expect(top).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, innerHeight - 10));
  await expect(top).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, innerHeight + 20));
  await expect(top).toBeVisible();
  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(top).toBeHidden();
  await expect(page.locator("#top")).toBeFocused();
});

test("mobile capture automatically reveals and scrolls the newest card into the rail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es/");
  for (let i = 0; i < 4; i++) await page.locator(".text-button").click();
  await expect(page.locator("#rail-items")).toBeVisible();
  const latest = page.locator('[data-card="7"]');
  const row = await page.locator(".slot-row").boundingBox();
  const card = await latest.boundingBox();
  expect(card!.x).toBeGreaterThanOrEqual(row!.x);
  expect(card!.x + card!.width).toBeLessThanOrEqual(row!.x + row!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#playground").screenshot({ path: path.join(qa, "rail-mobile-v4.png"), animations: "disabled" });
});

test("language menu supports arrows, escape, outside click and real navigation", async ({ page }) => {
  await page.goto("/en/");
  const trigger = page.getByRole("button", { name: "Language", exact: true });
  await trigger.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "English", exact: true })).toBeFocused();
  await page.getByRole("menuitemradio", { name: "English", exact: true }).press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "简体中文", exact: true })).toBeFocused();
  await page.getByRole("menuitemradio", { name: "简体中文", exact: true }).press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator("h1").click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.click();
  await page.getByRole("menuitemradio", { name: "日本語", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});

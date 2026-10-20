import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { locales } from "../lib/messages";
import { localeNames } from "../lib/messages";

async function openRail(page: Page) {
  if (await page.locator(".reveal-button").getAttribute("aria-expanded") === "true") await page.locator(".reveal-button").press("Enter");
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
    await expect(page.locator("#rail-items")).toBeVisible();
    const before = await page.locator(".demo-controls").boundingBox();
    await page.locator(".reveal-button").press("Enter");
    const after = await page.locator(".demo-controls").boundingBox();
    expect(after!.width).toBeCloseTo(before!.width, 0);
    expect(after!.x).toBeCloseTo(before!.x, 0);
    await page.locator(".reveal-button").press("Enter");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".capture-actions")).toBeVisible();
    const hint = (await page.locator(".desktop-instruction").boundingBox())!;
    const pin = (await page.locator(".capture-card .card-pin").first().boundingBox())!;
    expect(pin.y).toBeGreaterThanOrEqual(hint.y + hint.height);
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

test("a continuous row keeps more than 16 items, reset cancels deletion, empty state can recover", async ({ page }) => {
  await page.goto("/en/");
  for (let i = 0; i < 18; i++) await page.getByRole("button", { name: "Add a snippet", exact: true }).click();
  await expect(page.locator("#rail-items")).toBeVisible();
  await openRail(page);
  await expect(page.locator(".capture-card")).toHaveCount(21);
  await expect(page.locator(".overflow-slot")).toHaveCount(0);
  expect(await page.locator(".slot-row").evaluate((row) => row.scrollWidth > row.clientWidth)).toBe(true);
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
  const next = page.getByRole("button", { name: "Copy: Color inspiration", exact: true });
  await expect(next).toBeFocused();
  await next.press("Escape");
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
  await expect(page.locator(".demo-feedback [role=status]")).toHaveText("Copied to clipboard");
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
  await expect(page.locator(".demo-feedback [role=status]")).toContainText("denied");
});

test("edge dwell reveals a full-width shallow row, leaving hides it without focus theft", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  await page.locator(".reveal-button").click();
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
  expect(rail!.width).toBeCloseTo(edge!.width, 0);
  expect(rail!.height).toBeLessThan(210);
  expect(await page.locator(".rail-drawer").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await page.mouse.move(edge!.x + 30, edge!.y + 280);
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
  await expect(page.locator(".demo-feedback [role=status]")).not.toContainText("已加入");
  await page.locator("#playground").screenshot({ path: path.join(qa, "capture-peek-v4.png"), animations: "disabled" });
  await page.getByRole("button", { name: "重置演示", exact: true }).click();
  await expect(page.locator(".demo-feedback [role=status]")).not.toContainText("已重置");
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

test("wheel scrolls the continuous row, then releases the page at the end", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  for (let index = 0; index < 18; index++) await page.locator(".text-button").click();
  await openRail(page);
  const row = page.locator(".slot-row");
  await row.evaluate((element) => { element.scrollLeft = 0; });
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  const initialY = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 360);
  await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
  expect(await page.evaluate(() => scrollY)).toBe(initialY);
  await expect(page.locator(".capture-card")).toHaveCount(21);
  await row.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await page.mouse.wheel(0, 360);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(initialY);
});

test("SnapSlot in the desktop dock opens the notes", async ({ page }) => {
  await page.goto("/zh-Hans/");
  await page.locator(".reveal-button").press("Enter");
  await expect(page.locator("#rail-items")).toBeHidden();
  await page.locator(".dock-snapslot").click();
  await expect(page.locator("#rail-items")).toBeVisible();
  await expect(page.locator(".dock-snapslot .app-symbol")).toBeVisible();
});

test("deletion removes its layout slot immediately and supports rapid keyboard removal", async ({ page }) => {
  await page.goto("/en/");
  await page.locator('.card-copy').first().focus();
  await page.keyboard.press("Delete");
  // The decorative effect must never keep an empty flex item for half a second.
  expect(await page.locator('.capture-card').count()).toBe(2);
  await expect(page.getByRole('button', {name:'Copy: A little idea',exact:true})).toBeFocused();
  await page.keyboard.press("Delete");
  expect(await page.locator('.capture-card').count()).toBe(1);
  await expect(page.getByRole('button', {name:'Copy: Color inspiration',exact:true})).toBeFocused();
  await page.waitForTimeout(220);
  const row = (await page.locator('.slot-row').boundingBox())!;
  const card = (await page.locator('.capture-card').boundingBox())!;
  expect(card.x + card.width / 2).toBeCloseTo(row.x + row.width / 2, 0);
});

for (const [width,height] of [[1280,600],[1280,720],[1440,900],[390,667],[390,844],[320,568]]) {
  test(`first screen and refreshed playground show all dock apps at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await page.goto('/es/');
    for (const hash of ['', '#playground']) {
      if (hash) { await page.goto(`/es/${hash}`); await page.reload(); }
      for (const app of await page.locator('.desktop-dock .dock-app').all()) {
        const bounds=(await app.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y+bounds.height).toBeLessThanOrEqual(height);
      }
      expect(await page.locator('.hero-action').count()).toBe(0);
    }
  });
}

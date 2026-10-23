import { test, expect, type Page } from "@playwright/test";
import { locales, localeNames } from "../lib/messages";
import { homeCopy } from "../lib/home-copy";

const stage = (page: Page) => page.locator("#stage > div").first();
const fanOpacity = (page: Page) => page.getByRole("list").first().evaluate((el) => Number(getComputedStyle(el).opacity));
const skipCoach = (page: Page) => page.getByRole("button", { name: homeCopy.en.coach.skip }).click();

async function edge(page: Page, dy: number) {
  const box = (await stage(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + dy);
}

for (const locale of locales) {
  test(`${locale}: localized, the whole demo desktop fits the first screen, no horizontal overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/${locale}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("h1")).toHaveText(homeCopy[locale].headline);
    await expect(page.getByRole("button", { name: homeCopy[locale].nav.language })).toContainText(localeNames[locale]);
    const box = (await stage(page).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(768);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("notes stay hidden until the pointer rests on the top edge for 500 ms, and leave when it moves down", async ({ page }) => {
  await page.goto("/en/");
  expect(await fanOpacity(page)).toBe(0);
  await edge(page, 300);
  await page.waitForTimeout(600);
  expect(await fanOpacity(page)).toBe(0);
  await edge(page, 5);
  await page.waitForTimeout(250);
  await edge(page, 300);
  await page.waitForTimeout(700);
  expect(await fanOpacity(page)).toBe(0);
  await edge(page, 5);
  await page.waitForTimeout(900);
  expect(await fanOpacity(page)).toBe(1);
  await edge(page, 120);
  await page.waitForTimeout(700);
  expect(await fanOpacity(page)).toBe(1);
  await edge(page, 420);
  await page.waitForTimeout(900);
  expect(await fanOpacity(page)).toBe(0);
});

test("the guide walks through the edge, an image, a note and the tray menu in order", async ({ page }) => {
  await page.goto("/en/");
  const coach = page.locator("[role=status]").filter({ hasText: "/4" });
  await expect(coach).toContainText(homeCopy.en.coach.edge);
  await edge(page, 5);
  await expect(coach).toContainText(homeCopy.en.coach.file);
  await page.getByRole("button", { name: homeCopy.en.stage.copyFile + homeCopy.en.stage.files[0] }).click();
  await expect(coach).toContainText(homeCopy.en.coach.drag);
  await page.evaluate(() => {
    const source = document.querySelector("[data-focus='true']")!;
    const target = document.querySelector("[data-coach='drag']")!;
    const data = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  await expect(coach).toContainText(homeCopy.en.coach.trayWin);
  await page.getByRole("button", { name: homeCopy.en.menu.trayWin }).click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(coach).toHaveCount(0);
});

test("the tray menu toggles collect and pin, and both stay in step with settings", async ({ page }) => {
  await page.goto("/en/");
  await skipCoach(page);
  const tray = page.getByRole("button", { name: homeCopy.en.menu.trayWin });
  const notes = page.locator("[data-note]");
  await tray.click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: homeCopy.en.menu.pin }).click();
  await expect.poll(() => fanOpacity(page)).toBe(1);
  await edge(page, 500);
  await page.waitForTimeout(900);
  expect(await fanOpacity(page)).toBe(1);

  await tray.click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: homeCopy.en.menu.intake }).click();
  const before = await notes.count();
  await page.getByRole("button", { name: homeCopy.en.stage.copyFile + homeCopy.en.stage.files[0] }).click();
  await expect(page.getByText(homeCopy.en.notice.notPinned)).toBeVisible();
  expect(await notes.count()).toBe(before);

  await tray.click({ button: "right" });
  await page.getByRole("menuitem", { name: homeCopy.en.menu.settings }).click();
  await expect(page.getByRole("switch", { name: homeCopy.en.menu.intake })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: homeCopy.en.menu.pin })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: homeCopy.en.menu.pin }).click();
  await page.getByRole("button", { name: homeCopy.en.settings.close }).click();
  await edge(page, 500);
  await page.waitForTimeout(900);
  expect(await fanOpacity(page)).toBe(0);
});

test("selected page text becomes a note and its full text is copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/");
  const line = page.getByText(homeCopy.en.bento.selectLine);
  await line.scrollIntoViewIfNeeded();
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: new RegExp(homeCopy.en.chip) })).toBeVisible();
  await page.keyboard.press("Control+Alt+KeyT");
  await expect(page.locator("[data-note]")).toHaveCount(4);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(homeCopy.en.bento.selectLine);
});

test("Mac visitors get a menu bar and Dock, and the menu opens from the menu bar", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
  const page = await context.newPage();
  await page.goto("/en/");
  await expect(page.getByRole("link", { name: homeCopy.en.get.mac })).toBeVisible();
  await skipCoach(page);
  await page.getByRole("button", { name: homeCopy.en.menu.trayMac }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("button", { name: homeCopy.en.get.alsoWin }).click();
  await expect(page.getByRole("button", { name: homeCopy.en.menu.trayWin })).toBeVisible();
  await context.close();
});

test("refresh tolerates extensions that annotate images", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    new MutationObserver(() => document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (image.dataset.vtonPinned) return;
      image.dataset.vtonPinned = "pre";
      const button = document.createElement("div");
      button.className = "vton-btn"; button.textContent = "Try-On";
      image.after(button);
    })).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/zh-Hans/");
  await page.reload();
  await expect(page.locator("h1")).toBeVisible();
  expect(errors.filter((error) => /hydrat|didn't match|server rendered/i.test(error))).toEqual([]);
});

test("footer links to the repository and the contact address", async ({ page }) => {
  await page.goto("/zh-Hans/");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/LING-0001/SnapSlot");
  await expect(footer.getByRole("link", { name: "e1347605313@gmail.com" })).toHaveAttribute("href", "mailto:e1347605313@gmail.com");
});

test("the app's language setting changes its own menu, not the page", async ({ page }) => {
  await page.goto("/zh-Hans/");
  await page.getByRole("button", { name: homeCopy["zh-Hans"].coach.skip }).click();
  await page.getByRole("button", { name: homeCopy["zh-Hans"].menu.trayWin }).click({ button: "right" });
  await page.getByRole("menuitem", { name: homeCopy["zh-Hans"].menu.settings }).click();
  await page.getByRole("combobox").selectOption("en");
  await expect(page.getByRole("dialog", { name: homeCopy.en.settings.title })).toBeVisible();
  await page.getByRole("button", { name: homeCopy.en.settings.close }).click();
  await page.getByRole("button", { name: homeCopy.en.menu.trayWin }).click({ button: "right" });
  await expect(page.getByRole("menuitemcheckbox", { name: homeCopy.en.menu.pin })).toBeVisible();
  await expect(page.locator("h1")).toHaveText(homeCopy["zh-Hans"].headline);
});

test("every guide bubble stays inside the desktop, on Mac and Windows", async ({ browser }) => {
  for (const mac of [false, true]) for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    if (mac) await context.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
    const page = await context.newPage();
    await page.goto("/ja/");
    const inside = () => page.evaluate(() => {
      const bubble = document.querySelector("[data-side]")!.getBoundingClientRect();
      const desk = document.querySelector("#stage > div")!.getBoundingClientRect();
      return bubble.left >= desk.left && bubble.right <= desk.right;
    });
    const box = (await stage(page).boundingBox())!;
    expect(await inside()).toBe(true);
    await page.mouse.move(box.x + 200, box.y + 8);
    await page.waitForTimeout(800);
    expect(await inside()).toBe(true);
    await page.locator("[data-coach=file]").click();
    await page.waitForTimeout(500);
    expect(await inside()).toBe(true);
    await page.evaluate(() => {
      const source = document.querySelector("[data-focus='true']")!, target = document.querySelector("[data-coach='drag']")!, data = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    await page.waitForTimeout(500);
    expect(await inside()).toBe(true);
    await context.close();
  }
});

import { test, expect } from "@playwright/test";

test("notes ease out before hiding, become inert immediately and keep the page layout stable", async ({ page }) => {
  await page.goto("/en/");
  const drawer = page.locator("#rail-items");
  await expect(drawer).toHaveCSS("opacity", "1");
  const before = await page.locator(".hero-copy").evaluate((element) => (element as HTMLElement).offsetTop);
  const samples = await page.evaluate(async () => {
    const drawer = document.querySelector<HTMLElement>("#rail-items")!;
    document.querySelector<HTMLButtonElement>(".reveal-button")!.click();
    const frames: { opacity: number; inert: boolean; hiddenFromAT: boolean }[] = [];
    const start = performance.now();
    while (performance.now() - start < 400) {
      await new Promise(requestAnimationFrame);
      frames.push({ opacity: Number(getComputedStyle(drawer).opacity), inert: drawer.inert, hiddenFromAT: drawer.getAttribute("aria-hidden") === "true" });
    }
    return frames;
  });
  expect(samples.filter((frame) => frame.opacity > 0 && frame.opacity < 1).length).toBeGreaterThan(1);
  expect(samples.every((frame) => frame.inert && frame.hiddenFromAT)).toBe(true);
  await expect(drawer).toBeHidden();
  expect(await page.locator(".hero-copy").evaluate((element) => (element as HTMLElement).offsetTop)).toBe(before);
  await page.locator(".reveal-button").press("Enter");
  await expect(drawer).toHaveCSS("opacity", "1");
  await expect(drawer).not.toHaveAttribute("inert");
});

test("reopening during dismissal reverses smoothly and reduced motion hides immediately", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.locator("#rail-items")).toHaveCSS("opacity", "1");
  const reversal = await page.evaluate(async () => {
    const drawer = document.querySelector<HTMLElement>("#rail-items")!;
    const toggle = document.querySelector<HTMLButtonElement>(".reveal-button")!;
    toggle.click();
    // Wait for a real intermediate animation frame, not a fixed wall-clock delay.
    const start = performance.now();
    let opacity = 1;
    while (opacity > .85 && performance.now() - start < 500) {
      await new Promise(requestAnimationFrame);
      opacity = Number(getComputedStyle(drawer).opacity);
    }
    toggle.click();
    const atToggle = Number(getComputedStyle(drawer).opacity);
    await new Promise(requestAnimationFrame);
    return { before: opacity, atToggle, after: Number(getComputedStyle(drawer).opacity) };
  });
  expect(reversal.before).toBeGreaterThan(0);
  expect(reversal.before).toBeLessThan(1);
  expect(Math.abs(reversal.atToggle - reversal.before)).toBeLessThan(.03);
  expect(reversal.after).toBeGreaterThan(0);
  await expect(page.locator("#rail-items")).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".reveal-button").press("Enter");
  await expect(page.locator("#rail-items")).toBeHidden();
  await expect(page.locator("#rail-items")).toHaveCSS("transition-duration", "0s");
});

test("initial and refreshed cards hide when the pointer moves below, then reveal again at the top", async ({ page }) => {
  await page.goto("/en/");
  for (const refresh of [false, true]) {
    if (refresh) await page.reload();
    await expect(page.locator("#rail-items")).toBeVisible();
    const card = (await page.locator(".card-copy").first().boundingBox())!;
    // Move the pointer without Playwright scrolling an entering card into view.
    await page.mouse.move(card.x + card.width / 2, Math.max(1, card.y + card.height / 2));
    await page.waitForTimeout(600);
    await expect(page.locator("#rail-items")).toBeVisible();
    const desktop = (await page.locator(".desktop").boundingBox())!;
    await page.mouse.move(desktop.x + 200, desktop.y + desktop.height - 80);
    await expect(page.locator("#rail-items")).toBeHidden({ timeout: 1200 });
    await page.mouse.move(desktop.x + 200, Math.max(1, desktop.y + 24));
    await expect(page.locator("#rail-items")).toBeVisible({ timeout: 800 });
    await page.mouse.move(desktop.x + 200, desktop.y + desktop.height - 80);
    await expect(page.locator("#rail-items")).toBeHidden({ timeout: 1200 });
  }
});

test("approaching the upper area reveals without pixel-perfect targeting", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".reveal-button").click();
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  const box = (await page.locator(".desktop").boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 160);
  await page.mouse.move(box.x + 200, box.y + 26);
  await page.waitForTimeout(350);
  await expect(page.locator(".reveal-button")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#rail-items")).toBeVisible({ timeout: 800 });
});

test("an upward sweep past the demo edge still reveals", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".reveal-button").click();
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  const box = (await page.locator(".desktop").boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 100);
  await page.mouse.move(box.x + 200, box.y - 22);
  await expect(page.locator("#rail-items")).toBeVisible({ timeout: 800 });
  await page.mouse.move(box.x + 200, 2);
  await page.waitForTimeout(650);
  await expect(page.locator("#rail-items")).toBeVisible();
  await page.mouse.move(box.x + 200, box.y + 240);
  await expect(page.locator("#rail-items")).toBeHidden();
});

test("repeated approach and leave works across the width, dragging does not reveal", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".reveal-button").click();
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  const box = (await page.locator(".desktop").boundingBox())!;
  for (const offset of [30, box.width / 2, box.width - 30]) {
    await page.mouse.move(box.x + offset, box.y + 280);
    await page.mouse.move(box.x + offset, box.y + 30);
    await expect(page.locator("#rail-items")).toBeVisible({ timeout: 800 });
    await page.mouse.move(box.x + offset, box.y + 280);
    await expect(page.locator("#rail-items")).toBeHidden();
  }
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 25);
  await page.waitForTimeout(250);
  await expect(page.locator("#rail-items")).toBeHidden();
  await page.mouse.up();
});

test("capture peeks restart on each arrival, then hide without stealing focus", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".capture-button").click();
  await expect(page.locator("#rail-items")).toBeVisible();
  await page.waitForTimeout(1700);
  await page.locator(".text-button").click();
  await page.waitForTimeout(1400);
  await expect(page.locator("#rail-items")).toBeVisible();
  await expect(page.locator(".text-button")).toBeFocused();
  await expect(page.locator("#rail-items")).toBeHidden({ timeout: 2500 });
});

test("hover holds an automatic peek, and reset cancels old timers", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".capture-button").click();
  await page.locator('[data-card="4"] .card-copy').hover();
  await page.waitForTimeout(2800);
  await expect(page.locator("#rail-items")).toBeVisible();
  await page.locator(".reset-button").click();
  await expect(page.locator("#rail-items")).toBeHidden();
  await page.locator(".reveal-button").press("Enter");
  await page.waitForTimeout(600);
  await expect(page.locator("#rail-items")).toBeVisible();
  await expect(page.locator(".capture-card")).toHaveCount(3);
});

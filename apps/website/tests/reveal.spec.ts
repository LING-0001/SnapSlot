import { test, expect } from "@playwright/test";

test("approaching the upper area reveals without pixel-perfect targeting", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  const box = (await page.locator(".desktop").boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 160);
  await page.mouse.move(box.x + 200, box.y + 26);
  await expect(page.locator("#rail-items")).toBeVisible({ timeout: 800 });
});

test("an upward sweep past the demo edge still reveals", async ({ page }) => {
  await page.goto("/en/");
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
  await page.locator(".desktop").scrollIntoViewIfNeeded();
  const box = (await page.locator(".desktop").boundingBox())!;
  for (const offset of [30, box.width / 2, box.width - 30]) {
    await page.mouse.move(box.x + offset, box.y + 220);
    await page.mouse.move(box.x + offset, box.y + 30);
    await expect(page.locator("#rail-items")).toBeVisible({ timeout: 800 });
    await page.mouse.move(box.x + offset, box.y + 220);
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

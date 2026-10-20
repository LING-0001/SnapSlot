import { test, expect } from "@playwright/test";

test("refresh tolerates try-on extensions that annotate and insert buttons beside images", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const inject = () => {
      document.querySelectorAll<HTMLImageElement>('img[src="/mountains.svg"],img[src="/studio.svg"],img.scene-wallpaper').forEach((image) => {
        if (image.dataset.vtonPinned) return;
        image.dataset.vtonPinned = "pre";
        const button = document.createElement("div");
        button.className = "vton-btn"; button.textContent = "Try-On";
        image.after(button);
      });
    };
    new MutationObserver(inject).observe(document, { childList: true, subtree: true });
  });
  await page.route(/\.js(?:\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.continue();
  });
  await page.goto('/zh-Hans/#playground');
  await page.locator('.text-button').click();
  await expect(page.locator('.capture-card')).toHaveCount(4);
  await page.reload();
  await page.locator('.text-button').click();
  await expect(page.locator('.capture-card')).toHaveCount(4);
  expect(errors.filter((error) => /hydrat|didn't match|server rendered/i.test(error))).toEqual([]);
});

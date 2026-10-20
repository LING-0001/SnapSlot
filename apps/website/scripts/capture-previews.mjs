import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Run against a local preview; captures the actual web UI, not a native-client claim.
const browser = await chromium.launch(process.platform === "darwin" ? { channel: "chrome" } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await page.goto(`${process.env.PREVIEW_URL || "http://127.0.0.1:3000"}/en/`);
  await page.locator(".card-copy").first().waitFor();
  await mkdir("public/previews", { recursive: true });
  await page.locator(".desktop").screenshot({ path: "public/previews/collect.png" });
  await page.locator(".card-copy").first().hover();
  await page.locator(".desktop").screenshot({ path: "public/previews/copy.png" });
  await page.locator(".card-remove").first().click();
  await page.waitForTimeout(150);
  await page.mouse.move(0, 0);
  await page.locator(".desktop").screenshot({ path: "public/previews/clear.png" });
} finally { await browser.close(); }

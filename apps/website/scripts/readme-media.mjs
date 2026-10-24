// Captures the README screenshots and the demo animation from the running website.
//   npm run dev -- --port 3000   (in another terminal)
//   node scripts/readme-media.mjs [locale ...]
// Writes PNG stills and GIF frames to docs/media/<locale>/; scripts/readme-gif.py assembles the GIF.
import { chromium } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.SNAPSLOT_URL ?? "http://127.0.0.1:3000";
const all = ["zh-Hans", "en", "zh-Hant", "ja", "ko", "es"];
const menusOnly = process.argv.includes("--menus-only");
const localeArgs = process.argv.slice(2).filter(value => value !== "--menus-only");
const wanted = localeArgs.length ? localeArgs : all;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/media");
// Edge ships with Windows; elsewhere use Chrome, or Playwright's Chromium if neither is installed.
const channel = process.platform === "win32" ? { channel: "msedge" } : process.platform === "darwin" ? { channel: "chrome" } : {};
const browser = await chromium.launch(channel);

async function open(locale, { mac = false, width = 1280, height = 800, scale = 2, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await context.addInitScript(({mac}) => {
    Object.defineProperty(navigator, "platform", { get: () => mac ? "MacIntel" : "Win32" });
    let text = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { text=value; }, readText: async () => text, write: async () => {} } });
  }, {mac});
  const page = await context.newPage();
  await page.goto(`${base}/${locale}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const desk = (page) => page.locator("#stage > div").first();
const skip = (page) => page.locator("[data-side] button").click();
const dropFocused = (page) => page.evaluate(() => {
  const source = document.querySelector("[data-focus='true']"), target = document.querySelector("[data-coach='drag']"), data = new DataTransfer();
  source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
  target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
});
async function reveal(page) {
  const box = await desk(page).boundingBox();
  await page.mouse.move(box.x + box.width * .4, box.y + 6);
  await page.waitForTimeout(1100);
  return box;
}
async function holdOpen(page) {
  const box = await reveal(page);
  await page.mouse.move(box.x + box.width * .5, box.y + 120, { steps: 4 });
  await page.waitForTimeout(500);
}

for (const locale of wanted) {
  const dir = path.join(root, locale);
  await mkdir(dir, { recursive: true });

  // 1. Hero: notes fanned open on the Windows desktop.
  if (!menusOnly) {
    const page = await open(locale);
    await skip(page);
    await reveal(page);
    await page.locator("[data-coach=file]").click();
    await page.waitForTimeout(1200);
    await holdOpen(page);
    const deskBox = await desk(page).boundingBox();
    await page.screenshot({ path: path.join(dir, "hero.png"), clip: { x: deskBox.x, y: deskBox.y, width: deskBox.width, height: Math.min(deskBox.height, 330) } });
    await page.context().close();
  }

  // 2. Tray menu and settings window (Windows).
  {
    const page = await open(locale);
    await skip(page);
    await page.locator("[data-coach=tray]").click({ button: "right" });
    await page.waitForTimeout(350);
    const box = await desk(page).boundingBox();
    const menu = await page.locator("[role=menu]").boundingBox();
    const right = box.x + box.width, bottom = box.y + box.height;
    const clip = { x: menu.x - 40, y: menu.y - 40, width: right - (menu.x - 40), height: bottom - (menu.y - 40) };
    await page.screenshot({ path: path.join(dir, "tray-menu.png"), clip });
    if (!menusOnly) {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.locator("[role=menu] [role=menuitem]").first().click();
      await page.waitForTimeout(500);
      const win = await page.locator("[role=dialog]").boundingBox();
      await page.screenshot({ path: path.join(dir, "settings.png"), clip: { x: win.x - 24, y: win.y - 24, width: win.width + 48, height: win.height + 48 } });
    }
    await page.context().close();
  }

  // 3. Drag a note into a document.
  if (!menusOnly) {
    const page = await open(locale);
    await skip(page);
    await reveal(page);
    await dropFocused(page);
    await page.locator("[data-coach=file]").nth(0).click();
    await page.waitForTimeout(900);
    await dropFocused(page);
    await holdOpen(page);
    const box = await desk(page).boundingBox();
    await page.screenshot({ path: path.join(dir, "drag.png"), clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    await page.context().close();
  }

  // 4. Select text, press the shortcut.
  if (!menusOnly) {
    const page = await open(locale);
    await skip(page);
    const line = page.locator("[class*=selectable]");
    await line.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const box = await line.boundingBox();
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const tile = await page.locator("[class*=tileDark]").boundingBox();
    await page.screenshot({ path: path.join(dir, "select.png"), clip: { x: tile.x, y: tile.y, width: tile.width, height: tile.height } });
    await page.context().close();
  }

  // 5. macOS desktop.
  {
    const page = await open(locale, { mac: true });
    await skip(page);
    await reveal(page);
    await page.locator("[data-coach=tray]").click();
    await page.waitForTimeout(400);
    const box = await desk(page).boundingBox();
    await page.screenshot({ path: path.join(dir, "macos.png"), clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    await page.context().close();
  }

  // 6. Phone.
  if (!menusOnly) {
    const page = await open(locale, { width: 390, height: 844, scale: 2, mobile: true });
    await skip(page);
    const box = await desk(page).boundingBox();
    await page.touchscreen.tap(box.x + 200, box.y + 10);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dir, "phone.png") });
    await page.context().close();
  }

  // 7. Animation: one continuous take, recorded with Chrome's screencast so timing is real.
  if (!menusOnly) {
    const frames = path.join(dir, "frames");
    await rm(frames, { recursive: true, force: true });
    await mkdir(frames);
    const page = await open(locale, { scale: 1 });
    await skip(page);
    await page.addStyleTag({ content: "#demo-cursor{position:fixed;z-index:9999;left:0;top:0;width:22px;height:22px;pointer-events:none;transition:none}#demo-cursor.press{scale:.85}" });
    await page.evaluate(() => {
      const cursor = document.createElement("div");
      cursor.id = "demo-cursor";
      cursor.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2l14 9-6.2 1.3L14 19l-2.6 1.2-3.2-6.6L3 17z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      document.body.append(cursor);
      addEventListener("mousemove", (e) => { cursor.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`; }, true);
      addEventListener("mousedown", () => cursor.classList.add("press"), true);
      addEventListener("mouseup", () => cursor.classList.remove("press"), true);
    });
    await desk(page).scrollIntoViewIfNeeded();
    const box = await desk(page).boundingBox();
    const at = (fx, fy) => [box.x + box.width * fx, box.y + fy];
    const glide = async (x, y, ms = 600) => { await page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 22)) }); };
    const pause = (ms) => page.waitForTimeout(ms);

    const cdp = await page.context().newCDPSession(page);
    const shots = [];
    cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
      shots.push({ data, t: metadata.timestamp });
      await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await page.mouse.move(...at(.45, 5));
    await pause(1100);
    await page.mouse.move(...at(.5, 120));
    await pause(400);
    await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
    await pause(900);
    await glide(...at(.42, box.height * .62), 500);
    await pause(900);

    // Rest on the top edge: the glow charges, then the notes drop.
    await glide(...at(.45, 5), 700);
    await pause(1500);
    // Copy an image on the desktop: it flies up and joins the fan.
    const file = await page.locator("[data-coach=file]").boundingBox();
    await glide(file.x + file.width / 2, file.y + file.height / 3, 700);
    await page.mouse.down(); await pause(90); await page.mouse.up();
    await page.locator("[data-coach=file]").evaluate((el) => el.click());
    await pause(1500);
    // Pin the notes from the tray menu so they stay put.
    const tray = await page.locator("[data-coach=tray]").boundingBox();
    await glide(tray.x + tray.width / 2, tray.y + tray.height / 2, 800);
    await pause(200);
    await page.locator("[data-coach=tray]").click({ button: "right" });
    await pause(700);
    const pin = await page.locator("[role=menuitemcheckbox]").nth(1).boundingBox();
    await glide(pin.x + pin.width * .4, pin.y + pin.height / 2, 450);
    await pause(250);
    await page.locator("[role=menuitemcheckbox]").nth(1).click();
    await pause(800);
    // Turn the fan with the wheel.
    await glide(...at(.5, 120), 700);
    for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -120); await pause(650); }
    // Drag the front note into the document.
    const card = await page.locator("[data-focus='true']").boundingBox();
    const target = await page.locator("[data-coach=drag]").boundingBox();
    await glide(card.x + card.width / 2, card.y + card.height / 2, 400);
    await page.mouse.down();
    await page.evaluate(() => {
      const card = document.querySelector("[data-focus='true']"), r = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      Object.assign(ghost.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: 9998, opacity: .85, pointerEvents: "none", rotate: "-4deg", transformOrigin: "50% 50%" });
      ghost.id = "demo-ghost";
      document.body.append(ghost);
      const dx = r.left - (r.left + r.width / 2), dy = r.top - (r.top + r.height / 2);
      addEventListener("mousemove", (e) => { ghost.style.left = `${e.clientX + dx}px`; ghost.style.top = `${e.clientY + dy}px`; }, true);
    });
    await glide(target.x + target.width * .45, target.y + target.height * .55, 1000);
    await page.mouse.up();
    // Chromium usually completes the native drag; drop by hand only if it did not.
    await pause(150);
    await page.evaluate(() => {
      document.getElementById("demo-ghost")?.remove();
      const target = document.querySelector("[data-coach='drag']");
      if (target.querySelector("[style*='background-image']")) return;
      const source = document.querySelector("[data-focus='true']"), data = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    await pause(1800);
    await cdp.send("Page.stopScreencast");

    const { writeFile } = await import("node:fs/promises");
    const index = [];
    for (const [i, shot] of shots.entries()) {
      const name = `${String(i).padStart(4, "0")}.png`;
      await writeFile(path.join(frames, name), Buffer.from(shot.data, "base64"));
      index.push({ name, t: shot.t });
    }
    const vp = page.viewportSize();
    await writeFile(path.join(frames, "index.json"), JSON.stringify({ crop: { x: box.x / vp.width, y: box.y / vp.height, w: box.width / vp.width, h: box.height / vp.height }, frames: index }));
    await page.context().close();
  }
  console.log(`${locale}: done`);
}
await browser.close();

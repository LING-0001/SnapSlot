import { test, expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(__dirname, "../../..");
const entry = pathToFileURL(process.env.SNAPSLOT_UI_ENTRY || path.join(root, "artifacts/native-ui/index.html")).href;
const output = process.env.SNAPSLOT_QA_OUTPUT || path.join(root, "artifacts/qa/native-ui");
test.beforeAll(() => { if (!process.env.SNAPSLOT_UI_ENTRY) execFileSync(process.execPath, [path.join(root, "apps/native-ui/build.mjs")], { stdio: "pipe" }); });
async function host(page: Page, mode = "rail", count = 8, platform: "macos" | "windows" = "macos") {
  await page.addInitScript(({ count, platform }) => {
    const w = window as any;
    w.commands = [];
    w.state = { type: "state", items: Array.from({ length: count }, (_, i) => ({ id: `note-${i}`, kind: "text", title: `Note ${i}`, text: `周五前：\n· 定下图标\n· 更新截图\n· 发给设计组看\n${i}` })), expanded: true, arming: false, pinned: false, appearance: "glass", count, locale: "zh-Hans", reducedMotion: false, platform };
    w.preferences = { collectImages: true, textShortcut: { key: "KeyT", control: true, alt: true, shift: false, meta: false }, openShortcut: { key: "Space", control: true, alt: true, shift: false, meta: false } };
    w.shortcutChanges = [];
    w.emit = (message: any) => platform === "windows" ? w.hostListener({ data: message }) : w.snapslotReceive(message);
    const postMessage = (command: any) => {
      w.commands.push(command);
      if (command.type === "surfaces" || command.type === "moveWindow" || command.type === "drag" || command.type === "close") return;
      if (["beginShortcutRecording", "endShortcutRecording", "resizePreferences", "minimizePreferences"].includes(command.type)) return;
      if (command.type === "setAppearance") w.state.appearance = command.value;
      if (command.type === "setLocale") w.state.locale = command.value;
      if (command.type === "pin") { w.state.pinned = true; w.state.expanded = true; }
      if (command.type === "unpin" || command.type === "collapse") { w.state.pinned = false; w.state.expanded = false; }
      if (command.type === "clearNotes") { w.state.items = []; w.state.count = 0; }
      if (command.type === "remove") { w.state.items = w.state.items.filter((item: any) => item.id !== command.id); w.state.count = w.state.items.length; }
      if (command.type === "savePreferences") { w.preferences = command.value; if (command.editingShortcut) w.shortcutChanges = w.shortcutChanges.filter((change: any) => change.target !== command.editingShortcut); }
      w.emit(w.state); w.emit({ type: "preferences", value: w.preferences, platform, shortcutChanges: w.shortcutChanges });
      if (command.type === "copy") w.emit({ type: "copied", id: command.id });
    };
    if (platform === "windows") w.chrome = { ...w.chrome, webview: { postMessage, addEventListener: (_: string, listener: any) => { w.hostListener = listener; }, removeEventListener: () => {} } };
    else w.webkit = { messageHandlers: { snapslot: { postMessage } } };
  }, { count, platform });
  await page.goto(entry + (mode === "rail" ? "" : `?mode=${mode}`));
  await expect(page.locator("main")).toHaveAttribute("data-skin", "glass");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"));
}
const focused = (page: Page) => page.locator("[data-focus=true]");

test("fan uses the exact website geometry, colors, shadows and animation timings", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 360 });
  await host(page);
  const reference = await context.newPage();
  await reference.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
  await reference.goto("http://127.0.0.1:3000/zh-Hans/");
  await reference.getByRole("button", { name: "跳过", exact: true }).click();
  await reference.getByRole("button", { name: "SnapSlot 菜单" }).click();
  await reference.getByRole("menuitemcheckbox", { name: "固定便签", exact: true }).click();
  await reference.evaluate(() => document.fonts.ready);
  const properties = (node: Element) => {
    const style = getComputedStyle(node), arm = getComputedStyle(node.closest("[role=listitem]")!), card = getComputedStyle(node.parentElement!);
    return { width: style.width, height: style.height, radius: style.borderRadius, padding: style.padding, background: style.backgroundColor, color: style.color, shadow: style.boxShadow, blur: style.backdropFilter, faceTransition: style.transitionDuration, armTransition: arm.transitionDuration, origin: arm.transformOrigin, cardAnimation: card.animationDuration, dialTransition: getComputedStyle(node.closest("[role=list]")!).transitionDuration };
  };
  expect(await focused(page).evaluate(properties)).toEqual(await reference.locator("[data-focus=true]").evaluate(properties));
  await expect(page.locator("[data-arm][aria-hidden=false]")).toHaveCount(4);
  expect(await page.locator("[data-arm][aria-hidden=false] [data-note]").evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().bottom < innerHeight - 20))).toBe(true);
  await page.screenshot({ path: path.join(output, "fan.png"), omitBackground: true });
});

test("wheel navigation and incremental native updates preserve the selected card", async ({ page }) => {
  await host(page, "rail", 30);
  await expect(focused(page)).toHaveAttribute("data-index", "29");
  await page.mouse.move(640, 100); await page.mouse.wheel(0, -40);
  await expect(focused(page)).toHaveAttribute("data-index", "28");
  await focused(page).press("ArrowLeft"); await expect(focused(page)).toHaveAttribute("data-index", "27");
  await page.evaluate(() => { const w = window as any; w.snapslotReceive({ ...w.state, items: w.state.items.map(({ id, kind, title }: any) => ({ id, kind, title })) }); });
  await expect(focused(page)).toHaveAttribute("data-index", "27");
  await expect(focused(page)).toContainText("定下图标");
  await focused(page).press("Delete"); await expect(page.locator("[data-arm]")).toHaveCount(29);
  await expect(focused(page)).toHaveAttribute("data-index", "26");
  await expect(focused(page)).toBeFocused();
});

test("click copies, shows the website feedback and native drag does not copy", async ({ page }) => {
  await host(page);
  await focused(page).click();
  await expect(page.locator("[data-arm]").last().getByText("已复制", { exact: true })).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => (window as any).commands.filter((c: any) => c.type === "copy"))).toEqual([{ type: "copy", id: "note-7" }]);
  const box = (await focused(page).boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 60); await page.mouse.down(); await page.waitForTimeout(180); await page.mouse.move(box.x + 80, box.y + 65); await page.mouse.up();
  expect(await page.evaluate(() => (window as any).commands.filter((c: any) => c.type === "drag"))).toEqual([{ type: "drag", id: "note-7" }]);
  expect(await page.evaluate(() => (window as any).commands.filter((c: any) => c.type === "copy"))).toHaveLength(1);
});

test("native pointer feedback reveals the same hover controls without activation", async ({ page }) => {
  await host(page);
  const box = (await focused(page).boundingBox())!;
  await page.mouse.move(0, 650);
  await page.evaluate(({ x, y }) => (window as any).snapslotReceive({ type: "pointer", x, y }), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect(page.locator(".host-hover")).toHaveCount(1);
  await expect(page.locator(".host-hover button").last()).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => (window as any).commands.some((c: any) => c.type === "copy"))).toBe(false);
});

test("settings match the website and persist changes through native commands", async ({ page, context }) => {
  await page.setViewportSize({ width: 420, height: 442 }); await host(page, "preferences", 30);
  await expect(page.getByRole("dialog")).toHaveCSS("width", "420px");
  await expect(page.getByRole("switch")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "清空全部", exact: true })).toBeInViewport({ ratio: 1 });
  const reference = await context.newPage(); await reference.setViewportSize({ width: 1280, height: 1000 });
  await reference.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
  await reference.goto("http://127.0.0.1:3000/zh-Hans/"); await reference.getByRole("button", { name: "跳过", exact: true }).click();
  await reference.getByRole("button", { name: "SnapSlot 菜单" }).click(); await reference.getByRole("menuitem", { name: "设置…", exact: true }).click();
  await reference.evaluate(() => document.fonts.ready);
  const rowStyle = (node: Element) => { const s = getComputedStyle(node); return [s.minHeight, s.padding, s.backgroundColor, s.borderRadius, s.fontSize, s.gap]; };
  expect(await page.getByRole("switch").first().locator("..").evaluate(rowStyle)).toEqual(await reference.getByRole("switch").first().locator("..").evaluate(rowStyle));
  await page.getByRole("button", { name: "纸白", exact: true }).click(); await expect(page.locator("main")).toHaveAttribute("data-skin", "paper");
  await page.getByRole("button", { name: "石墨", exact: true }).click(); await expect(page.locator("main")).toHaveAttribute("data-skin", "graphite");
  await page.getByRole("switch", { name: "自动收取剪贴板图片", exact: true }).click(); await expect(page.getByRole("switch").first()).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "固定便签", exact: true }).click(); await expect(page.getByRole("switch").last()).toHaveAttribute("aria-checked", "true");
  await page.screenshot({ path: path.join(output, "settings.png"), omitBackground: true });
  await page.getByRole("button", { name: "清空全部", exact: true }).click(); await expect(page.getByRole("button", { name: "清空全部", exact: true })).toBeDisabled();
  await page.getByRole("combobox").selectOption("en"); await expect(page.getByRole("dialog")).toHaveAttribute("aria-label", "SnapSlot Settings");
});

test("tray matches the four website menu actions", async ({ page }) => {
  await page.setViewportSize({ width: 244, height: 140 }); await host(page, "tray");
  await expect(page.getByRole("menuitem")).toHaveCount(2); await expect(page.getByRole("menuitemcheckbox")).toHaveCount(2);
  await expect(page.getByRole("menu")).toHaveCSS("border-radius", "10px");
  await expect(page.getByRole("menuitemcheckbox").last()).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: path.join(output, "menu.png"), omitBackground: true });
  await page.getByRole("menuitemcheckbox", { name: "固定便签", exact: true }).click();
  expect(await page.evaluate(() => (window as any).commands.some((c: any) => c.type === "pin"))).toBe(true);
});

test("tray hover highlights each row, including native pointer updates from an inactive window", async ({ page }) => {
  await page.setViewportSize({ width: 244, height: 140 }); await host(page, "tray");
  const rows = page.locator(".native-menu button");
  for (let index = 0; index < 4; index++) {
    const row = rows.nth(index);
    await row.hover();
    await expect(row).toHaveCSS("background-color", "rgb(10, 132, 255)");
    await expect(row).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(row.locator("span")).toHaveCSS("color", "rgb(255, 255, 255)");
    await page.mouse.move(0, 0);
    const box = (await row.boundingBox())!;
    await page.evaluate(({ x, y }) => (window as any).snapslotReceive({ type: "pointer", x, y }), { x: box.x + 30, y: box.y + box.height / 2 });
    await expect(page.locator(".native-menu .host-hover")).toHaveCount(1);
    await expect(row).toHaveCSS("background-color", "rgb(10, 132, 255)");
    await expect(row.locator("span")).toHaveCSS("color", "rgb(255, 255, 255)");
  }
  await page.screenshot({ path: path.join(output, "menu-hover.png"), omitBackground: true });
  await page.evaluate(() => (window as any).snapslotReceive({ type: "pointer", x: null, y: null }));
  await expect(page.locator(".native-menu .host-hover")).toHaveCount(0);
  await expect(rows.last()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("arrivals animate, reduced motion disables animation, collapsed cards cannot receive input", async ({ page }) => {
  await host(page, "rail", 1);
  await page.evaluate(() => { const w = window as any; w.state.items.push({ id: "new", kind: "text", title: "New", text: "New note" }); w.state.count = 2; w.snapslotReceive(w.state); });
  await expect(focused(page)).toHaveAttribute("data-note", "new");
  await expect(focused(page).locator("..")).toHaveCSS("animation-duration", "0.52s");
  await page.evaluate(() => { const w = window as any; w.state.reducedMotion = true; w.snapslotReceive(w.state); });
  await expect(focused(page).locator("..")).toHaveCSS("animation-name", "none");
  await focused(page).press("Escape");
  await expect(page.locator("[role=list]")).toHaveAttribute("inert", "");
});

for (const platform of ["macos", "windows"] as const) {
test(`${platform}: a new image never replays its entrance or flashes when its fresh marker expires`, async ({ page }) => {
  await host(page, "rail", 1, platform);
  await page.evaluate(() => {
    const w = window as any; w.arrivalStarts = []; w.arrivalOpacity = [];
    document.addEventListener("animationstart", event => { const e = event as AnimationEvent; if ((e.target as HTMLElement).matches('[data-arm="new-image"] > div')) w.arrivalStarts.push(e.animationName); });
    w.state.items.push({ id: "new-image", kind: "image", title: "New image", preview: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="skyblue"/></svg>' });
    w.state.count = 2; w.emit(w.state);
    const start = performance.now();
    const sample = () => { const elapsed = performance.now() - start; const card = document.querySelector('[data-arm="new-image"] > div'); if (elapsed > 700 && card) w.arrivalOpacity.push(Number(getComputedStyle(card).opacity)); if (elapsed < 2050) requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  });
  await expect(focused(page)).toHaveAttribute("data-note", "new-image");
  await page.waitForTimeout(2150);
  expect(await page.evaluate(() => (window as any).arrivalStarts)).toHaveLength(1);
  expect(await page.evaluate(() => Math.min(...(window as any).arrivalOpacity))).toBeGreaterThan(.99);
});

test(`${platform}: occupied shortcuts show persistent replacements and both actions can be rebound`, async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 560 }); await host(page, "preferences", 8, platform);
  await page.evaluate(platform => {
    const w = window as any, oldText = w.preferences.textShortcut, oldOpen = w.preferences.openShortcut;
    w.preferences = { ...w.preferences, textShortcut: { ...oldText, shift: true }, openShortcut: { ...oldOpen, shift: true } };
    w.shortcutChanges = [{ target: "text", requested: oldText, replacement: w.preferences.textShortcut }, { target: "open", requested: oldOpen, replacement: w.preferences.openShortcut }];
    w.emit({ type: "preferences", value: w.preferences, platform, shortcutChanges: w.shortcutChanges });
  }, platform);
  const text = page.locator('[data-shortcut-row="text"]'), open = page.locator('[data-shortcut-row="open"]');
  await expect(text.getByRole("status")).toContainText("被占用，已修改为");
  await expect(open.getByRole("status")).toContainText("被占用，已修改为");
  await expect(open.locator("kbd")).toContainText(platform === "macos" ? ["⌃", "⌥", "⇧", "Space"] : ["Ctrl", "Alt", "Shift", "Space"]);
  await text.getByRole("button").click(); await page.keyboard.press("Control+Alt+y");
  await expect(text.locator("kbd")).toContainText(platform === "macos" ? ["⌃", "⌥", "Y"] : ["Ctrl", "Alt", "Y"]);
  await expect(text.getByRole("status")).toHaveCount(0);
  await expect(open.getByRole("status")).toContainText("被占用，已修改为");
  await open.getByRole("button").click(); await page.keyboard.press("Control+Alt+Shift+o");
  await expect(open.locator("kbd")).toContainText(platform === "macos" ? ["⌃", "⌥", "⇧", "O"] : ["Ctrl", "Alt", "Shift", "O"]);
  expect(await page.evaluate(() => (window as any).commands.filter((c: any) => c.type === "savePreferences").map((c: any) => c.editingShortcut))).toEqual(["text", "open"]);
  await page.screenshot({ path: path.join(output, `${platform}-editable-shortcuts.png`), omitBackground: true });
});

test(`${platform}: shortcut recording rejects invalid Copy, Escape cancels without closing, and minimizing uses its own command`, async ({ page }) => {
  await host(page, "preferences", 8, platform);
  const row = page.locator('[data-shortcut-row="text"]');
  await row.getByRole("button").click(); await page.keyboard.press("Meta+c");
  await expect(row.getByRole("status")).toContainText("复制");
  await page.keyboard.press("Escape"); await expect(row.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => (window as any).commands.some((c: any) => c.type === "close" || c.type === "savePreferences"))).toBe(false);
  await row.getByRole("button").click();
  await page.evaluate(() => dispatchEvent(new Event("blur")));
  await expect(row.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => (window as any).commands.some((c: any) => c.type === "endShortcutRecording"))).toBe(true);
  await page.getByRole("button", { name: "最小化设置", exact: true }).click();
  expect(await page.evaluate(() => (window as any).commands.filter((c: any) => c.type === "minimizePreferences").length)).toBe(1);
});

}

test("the entire native interface loads offline without network requests or missing fonts", async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await host(page); await page.evaluate(() => Promise.all([document.fonts.load('500 13px "Noto Sans SC"', "便签"), document.fonts.load('500 13px "Inter Tight"', "SnapSlot")]));
  expect(await page.evaluate(() => document.fonts.check('500 13px "Noto Sans SC"', "便签") && document.fonts.check('500 13px "Inter Tight"', "SnapSlot"))).toBe(true);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});


test("Windows uses the same fan, native WebView2 bridge and website settings", async ({ page }) => {
  await host(page, "rail", 30, "windows");
  await expect(page.locator("[data-os=win]")).toHaveCount(1);
  await expect(focused(page)).toHaveCSS("width", "200px");
  await focused(page).click();
  expect(await page.evaluate(() => (window as any).commands.filter((c: any) => c.type === "copy"))).toEqual([{ type: "copy", id: "note-29" }]);
  await focused(page).press("Delete");await expect(page.locator("[data-arm]")).toHaveCount(29);
});

test("Windows settings and tray match the website's platform chrome", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 442 });await host(page, "preferences", 3, "windows");
  await expect(page.getByRole("dialog")).toHaveCSS("border-radius", "10px");
  await expect(page.getByRole("button", { name: "关闭设置" })).toHaveText("×");
  await expect(page.locator("kbd")).toContainText(["Ctrl", "Alt", "T", "Ctrl", "Alt", "Space"]);
  await page.getByRole("button", { name: "石墨", exact: true }).click();await expect(page.locator("main")).toHaveAttribute("data-skin", "graphite");
  await page.getByRole("switch", { name: "固定便签", exact: true }).click();await expect(page.getByRole("switch").last()).toHaveAttribute("aria-checked", "true");
  await page.setViewportSize({ width: 244, height: 170 });await page.goto(entry+"?mode=tray");
  const row=page.getByRole("menuitemcheckbox").last();await row.hover();await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0.05)");
  await expect(row).toHaveCSS("color", "rgb(27, 27, 27)");
});

test("native menu supports arrow, Home and End navigation", async ({ page }) => {
  await host(page,"tray");const rows=page.locator(".native-menu button");
  await rows.first().focus();await page.keyboard.press("End");await expect(rows.last()).toBeFocused();
  await page.keyboard.press("ArrowDown");await expect(rows.first()).toBeFocused();
  await page.keyboard.press("ArrowUp");await expect(rows.last()).toBeFocused();
  await page.keyboard.press("Home");await expect(rows.first()).toBeFocused();
});

test("Quit is separated, fully visible and sends only the native quit command", async ({ page }) => {
  for(const platform of ["macos","windows"] as const){
    await page.setViewportSize({width:244,height:platform==="macos"?140:170});await host(page,"tray",8,platform);
    const quit=page.getByRole("menuitem",{name:"退出快照贴",exact:true});
    await expect(quit).toBeInViewport({ratio:1});await expect(quit.locator("xpath=preceding-sibling::*[1]")).toHaveJSProperty("tagName","HR");
    await quit.click();expect(await page.evaluate(()=>(window as any).commands.filter((command:any)=>command.type==="quit").length)).toBe(1);
    expect(await page.evaluate(()=>(window as any).commands.some((command:any)=>command.type==="clearNotes"))).toBe(false);
  }
});

import { test, expect, type Page } from "@playwright/test";
import { locales, localeNames } from "../lib/locales";
import { homeCopy } from "../lib/home-copy";
import { demoCopy } from "../lib/demo-copy";
import { downloads, githubReleases } from "../lib/releases";

const stage = (page: Page) => page.locator("#stage > div").first();
const fanOpacity = (page: Page) => page.locator("#stage [role=list]").evaluate((el) => Number(getComputedStyle(el).opacity));
const skipCoach = (page: Page) => page.getByRole("button", { name: homeCopy.en.coach.skip }).click();
// Most cases exercise the Windows demo; explicit Mac contexts below cover Mac.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "Win32" }));
  // Keep browser QA from changing the user's system clipboard or feeding the live client.
  await page.addInitScript(() => {
    let text = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => { text = value; }, readText: async () => text, write: async () => {},
    } });
  });
});

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
  await page.getByRole("button", { name: "Windows", exact: true }).click();
  await expect(page.getByRole("button", { name: homeCopy.en.menu.trayWin })).toBeVisible();
  await page.locator("[data-coach=tray]").click({button:"right"});await page.getByRole("menuitem").first().click();
  await page.getByRole("combobox").selectOption("ja");await expect(stage(page)).toHaveAttribute("data-os","win");
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
  await expect(footer.getByRole("link", { name: "GitHub Releases" })).toHaveAttribute("href", githubReleases);
  await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/LING-0001/SnapSlot");
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
      return bubble.left >= desk.left && bubble.right <= desk.right && bubble.top >= desk.top && bubble.bottom <= desk.bottom;
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

test("downloads are links, platform controls switch the demo, and replay restores the experience", async ({ page }) => {
  await page.goto("/en/");
  for (const platform of ["win", "mac"] as const) {
    const link = page.getByRole("link", { name: homeCopy.en.get[platform], exact: true });
    await expect(link).toHaveAttribute("href", downloads[platform].href);
    await expect(link).toHaveAttribute("download", downloads[platform].filename);
    await expect(link).not.toHaveAttribute("target", "_blank");
  }
  await page.getByRole("button", { name: "macOS", exact: true }).click();
  await expect(stage(page)).toHaveAttribute("data-os", "mac");
  await expect(page.getByRole("button", { name: "macOS", exact: true })).toHaveAttribute("aria-pressed", "true");
  await skipCoach(page);
  await page.locator("[data-coach=file]").click();
  await page.getByRole("button", { name: demoCopy.en.paste, exact: true }).click();
  await expect(page.locator("[data-note]")).toHaveCount(4);
  await page.getByRole("button", { name: demoCopy.en.replay, exact: true }).click();
  await expect(page.locator("[data-note]")).toHaveCount(3);
  await expect(page.getByRole("button", { name: demoCopy.en.paste, exact: true })).toBeDisabled();
  await expect(page.locator("[data-side]")).toContainText(homeCopy.en.coach.edge);
  await expect(page.locator("#stage [role=list]")).toHaveAttribute("inert", "");
});

test("blocked clipboard access gives honest feedback and still allows pasting inside the demo", async ({ page }) => {
  await page.goto("/en/"); await skipCoach(page);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new DOMException("Blocked", "NotAllowedError"); }; });
  await page.getByRole("button", { name: demoCopy.en.reveal, exact: true }).click();
  await page.locator("[data-focus=true]").click();
  await expect(page.locator("[role=status]").filter({ hasText: demoCopy.en.clipboardHint })).toBeVisible();
  await expect(page.getByText(demoCopy.en.copiedHere).first()).toBeVisible();
  await page.getByRole("button", { name: demoCopy.en.paste, exact: true }).click();
  await expect(page.locator("[data-coach=drag]")).toContainText(homeCopy.en.stage.sampleText);
});

test("keyboard users can navigate the menu, close settings and unpin with Escape", async ({ page }) => {
  await page.goto("/en/"); await skipCoach(page);
  const tray=page.locator("[data-coach=tray]");
  await tray.focus(); await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await expect(page.getByRole("menuitemcheckbox", {name:homeCopy.en.menu.pin})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#stage [role=list]")).not.toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator("#stage [role=list]")).toHaveAttribute("inert", "");
  await tray.focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:homeCopy.en.settings.close})).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(tray).toBeFocused();
});

test("small touch screens keep settings inside the desktop without horizontal focus scrolling", async ({ browser }) => {
  for(const os of ["Win32","MacIntel"]) {
    const context=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
    await context.addInitScript(value=>Object.defineProperty(navigator,"platform",{get:()=>value}),os);
    const page=await context.newPage();await page.goto("http://127.0.0.1:3000/en/");await skipCoach(page);
    expect(await page.locator("[class*=placeholder]").evaluate(el=>el.getBoundingClientRect().bottom<=el.parentElement!.getBoundingClientRect().bottom)).toBe(true);
    await page.locator("[data-coach=tray]").tap();await page.getByRole("menuitem").first().tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    const bounds=await page.getByRole("dialog").boundingBox(),desk=await stage(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(desk!.x);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(desk!.x+desk!.width);
    expect(await stage(page).evaluate(el=>el.scrollLeft)).toBe(0);
    await page.getByRole("combobox").focus();expect(await stage(page).evaluate(el=>el.scrollLeft)).toBe(0);
    await page.getByRole("button",{name:homeCopy.en.settings.clear,exact:true}).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button",{name:homeCopy.en.settings.clear,exact:true})).toBeInViewport();
    await context.close();
  }
});

test("feature content remains readable without JavaScript or an intersection observer", async ({ browser, page }) => {
  const context=await browser.newContext({javaScriptEnabled:false});const plain=await context.newPage();await plain.goto("http://127.0.0.1:3000/en/");
  expect(await plain.locator("#features article").evaluateAll(items=>items.every(el=>getComputedStyle(el).opacity==="1"))).toBe(true);await context.close();
  await page.addInitScript(()=>Object.defineProperty(window,"IntersectionObserver",{value:undefined}));
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/en/");await page.locator("#features").scrollIntoViewIfNeeded();
  expect(await page.locator("#features article").evaluateAll(items=>items.every(el=>getComputedStyle(el).opacity==="1"))).toBe(true);
  expect(errors).toEqual([]);
});

test("removing an earlier note preserves the selected note", async ({ page }) => {
  await page.goto("/en/");await skipCoach(page);await page.getByRole("button",{name:demoCopy.en.reveal,exact:true}).click();
  const selected=await page.locator("[data-focus=true]").getAttribute("data-note");
  await page.getByRole("button",{name:homeCopy.en.stage.remove}).first().click({force:true});
  await expect(page.locator("[data-focus=true]")).toHaveAttribute("data-note",selected!);
});

test("touch visitors can copy a note and paste it into the document without clipboard permission", async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{configurable:true,value:{write:async()=>{throw new DOMException("Blocked","NotAllowedError");},writeText:async()=>{throw new DOMException("Blocked","NotAllowedError");}}}));
  const page=await context.newPage();await page.goto("http://127.0.0.1:3000/zh-Hans/");
  await expect(page.locator("[data-side]")).toContainText(homeCopy["zh-Hans"].coach.edgeTouch);
  await page.getByRole("button",{name:demoCopy["zh-Hans"].reveal,exact:true}).tap();
  await page.locator("[data-coach=file]").tap();
  await page.locator("[data-focus=true]").tap();
  await expect(page.locator("[data-side]")).toContainText(demoCopy["zh-Hans"].touchCopy);
  await page.getByRole("button",{name:demoCopy["zh-Hans"].paste,exact:true}).tap();
  await expect(page.locator("[data-coach=drag] [class*=docImage]")).toHaveCount(1);
  await expect(page.locator("[data-side]")).toContainText(homeCopy["zh-Hans"].coach.trayTouch);
  await context.close();
});

test("vertical touch scrolling preserves selection and horizontal swiping does not accidentally copy", async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{const w=window as any;w.copies=0;Object.defineProperty(navigator,"clipboard",{configurable:true,value:{write:async()=>{w.copies++;},writeText:async()=>{w.copies++;}}});});
  const page=await context.newPage();await page.goto("http://127.0.0.1:3000/en/");await skipCoach(page);await page.getByRole("button",{name:demoCopy.en.reveal,exact:true}).tap();
  const before=await page.locator("[data-focus=true]").getAttribute("data-note");
  const gesture=async(dx:number,dy:number)=>page.locator("[data-focus=true]").evaluate((el,{dx,dy})=>{
    const at=(x:number,y:number)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
    el.dispatchEvent(new TouchEvent("touchstart",{bubbles:true,touches:[at(180,100)]}));
    el.dispatchEvent(new TouchEvent("touchend",{bubbles:true,changedTouches:[at(180+dx,100+dy)]}));
  },{dx,dy});
  await gesture(35,110);await expect(page.locator("[data-focus=true]")).toHaveAttribute("data-note",before!);
  await gesture(-75,5);await expect(page.locator("[data-focus=true]")).not.toHaveAttribute("data-note",before!);
  await page.locator("[data-focus=true]").dispatchEvent("click");expect(await page.evaluate(()=>(window as any).copies)).toBe(0);
  await page.locator("[data-focus=true]").tap();await expect.poll(()=>page.evaluate(()=>(window as any).copies)).toBe(1);
  await context.close();
});

test("Quit stops the demo app and replay relaunches it", async ({ page }) => {
  await page.goto("/en/");await skipCoach(page);const tray=page.locator("[data-coach=tray]");
  await tray.click({button:"right"});await page.getByRole("menuitem",{name:homeCopy.en.menu.quit,exact:true}).click();
  await expect(tray).toHaveCount(0);await expect(page.locator("[data-note]")).toHaveCount(0);
  await expect(page.getByRole("button",{name:demoCopy.en.reveal,exact:true})).toBeDisabled();
  await page.keyboard.press("Control+Alt+Space");await expect(page.locator("#stage [role=list]")).toHaveAttribute("inert", "");
  await page.locator("[data-coach=file]").click();await expect(page.locator("[data-note]")).toHaveCount(0);
  await page.getByRole("button",{name:demoCopy.en.replay,exact:true}).click();
  await expect(tray).toHaveCount(1);await expect(page.locator("[data-note]")).toHaveCount(3);
});

for (const platform of ["mac", "win"] as const) test(`${platform}: fan leaves the document and desktop files clear, including many notes and short windows`, async ({ browser }) => {
  for(const viewport of [{width:1280,height:720},{width:768,height:1024},{width:390,height:844}]) {
    const mobile=viewport.width<600;const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
    await context.addInitScript(value=>Object.defineProperty(navigator,"platform",{get:()=>value}),platform==="mac"?"MacIntel":"Win32");
    const page=await context.newPage();await page.goto("http://127.0.0.1:3000/en/");await skipCoach(page);
    await page.locator("[data-coach=tray]").click({button:platform==="mac"?"left":"right"});await page.getByRole("menuitemcheckbox",{name:homeCopy.en.menu.pin,exact:true}).click();
    for(let i=0;i<8;i++)await page.locator("[data-coach=file]").click();
    await page.waitForTimeout(700);
    const layout=await page.evaluate(()=>{
      const bottom=Math.max(...Array.from(document.querySelectorAll<HTMLElement>('[role=listitem][aria-hidden=false] [data-note]')).map(el=>el.getBoundingClientRect().bottom));
      const doc=document.querySelector('[data-coach=drag]')!.getBoundingClientRect(),files=document.querySelector('[class*=files]')!.getBoundingClientRect();
      return {bottom,docTop:doc.top,filesTop:files.top,docRight:doc.right,docLeft:doc.left,filesRight:files.right,filesLeft:files.left,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(layout.docTop-layout.bottom).toBeGreaterThanOrEqual(16);expect(layout.filesTop-layout.bottom).toBeGreaterThanOrEqual(8);
    if(!mobile)expect(platform==="mac"?layout.filesLeft-layout.docRight:layout.docLeft-layout.filesRight).toBeGreaterThanOrEqual(16);
    expect(layout.overflow).toBe(0);await context.close();
  }
});

test("contact details follow the last feature without an empty band", async ({ page }) => {
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport);await page.goto("/zh-Hans/");
    const gap=await page.evaluate(()=>{
      const bottom=Math.max(...Array.from(document.querySelectorAll('#features article')).map(el=>el.getBoundingClientRect().bottom));
      return document.querySelector('footer [class*=mark]')!.getBoundingClientRect().top-bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(32);expect(gap).toBeLessThanOrEqual(64);
  }
});

for (const platform of ["mac", "win"] as const) test(`${platform}: demo stays complete in the first desktop screen in all six languages`, async ({ browser }) => {
  const context=await browser.newContext();await context.addInitScript(value=>Object.defineProperty(navigator,"platform",{get:()=>value}),platform==="mac"?"MacIntel":"Win32");
  const page=await context.newPage();
  for(const viewport of [{width:1280,height:720},{width:1366,height:768},{width:1440,height:900},{width:1280,height:600}]) {
    await page.setViewportSize(viewport);
    for(const locale of locales) {
      await page.goto(`http://127.0.0.1:3000/${locale}/`);await expect(stage(page)).toHaveAttribute("data-os",platform);await page.evaluate(()=>document.fonts.ready);
      const box=(await stage(page).boundingBox())!;expect(box.y+box.height,`${locale} ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(viewport.height);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  await context.close();
});

for (const os of ["mac", "win"] as const) {
  test(`${os}: unpinned notes still dismiss while Settings remains open`, async ({ page }) => {
    await page.goto("/en/"); await skipCoach(page);
    await page.getByRole("button", { name: os === "mac" ? "macOS" : "Windows", exact: true }).click();
    await edge(page, 5); await expect.poll(() => fanOpacity(page)).toBe(1);
    await page.getByRole("button", { name: os === "mac" ? homeCopy.en.menu.trayMac : homeCopy.en.menu.trayWin }).click({ button: "right" });
    await page.getByRole("menuitem", { name: homeCopy.en.menu.settings }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await edge(page, 420);
    await expect.poll(() => fanOpacity(page)).toBe(0);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}

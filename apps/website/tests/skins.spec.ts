import { test, expect, type Page } from "@playwright/test";
import { builtInSkins, MAX_SKIN_BYTES, parseSkin } from "../lib/skin";

async function openEditor(page: Page) {
  await page.locator(".appearance-trigger").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("image controls are immediately visible on short desktop and phone screens in every locale", async ({ page }) => {
  test.setTimeout(60000);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 667 }]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es"]) {
      await page.goto(`/${locale}/`);
      await openEditor(page);
      await expect(page.locator(".artwork-choose")).toBeInViewport({ ratio: 1 });
      expect(await page.locator(".skin-dialog").evaluate((dialog) => dialog.scrollTop)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator("#skin-image-upload").setInputFiles("public/images/ice-desktop.png");
      await expect(page.locator(".artwork-thumbnail")).toHaveClass(/has-image/);
      await expect(page.locator(".artwork-choose")).toBeInViewport({ ratio: 1 });
      for (const button of await page.locator(".artwork-options button").all()) {
        await expect(button).toBeInViewport({ ratio: 1 });
      }
      await page.keyboard.press("Escape");
    }
  }
});

test("skin validation rejects incompatible versions, unsafe values and unusable geometry", () => {
  const base = builtInSkins[0];
  for (const invalid of [
    { ...base, schemaVersion: 2 },
    { ...base, pin: { ...base.pin, enabled: "yes" } },
    { ...base, card: { ...base.card, width: -1 } },
    { ...base, card: { ...base.card, frame: "url(https://example.com)" } },
    { ...base, card: { ...base.card, height: 80, padding: 24, borderWidth: 8 } },
    { ...base, card: { ...base.card, imageFit: "stretch" } },
    { ...base, script: "alert(1)" },
    { ...base, background: { image: "https://example.com/image.png", fit: "cover" } },
    { ...base, background: { image: "data:image/svg+xml;base64,PHN2Zy8+", fit: "cover" } },
    { ...base, background: { image: "data:image/png;base64,bm90LWFuLWltYWdl", fit: "cover" } },
  ]) expect(() => parseSkin(JSON.stringify(invalid))).toThrow();
  expect(() => parseSkin(" ".repeat(MAX_SKIN_BYTES + 1))).toThrow("2 MB");
});

test("switching and resizing skins preserves the mixed inbox and removes the rail", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".text-button").click();
  const ids = await page.locator(".capture-card").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.card));
  await openEditor(page);
  await page.locator(".skin-tabs button").nth(1).click();
  await expect(page.locator(".preview-card").first()).toHaveCSS("height", "208px");
  await page.keyboard.press("Escape");
  await page.locator(".reveal-button").click();
  if (!(await page.locator("#rail-items").isVisible())) await page.locator(".reveal-button").click();
  await expect(page.locator(".card-copy").first()).toHaveCSS("height", "208px");
  expect(await page.locator(".capture-card").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.card))).toEqual(ids);
  expect(await page.locator(".rail").evaluate((el) => getComputedStyle(el, "::before").content)).toBe("none");
  await openEditor(page);
  await page.locator(".skin-tabs button").first().click();
  await page.getByRole("slider").first().focus();
  await page.keyboard.press("End");
  await expect(page.locator(".preview-card").first()).toHaveCSS("width", "320px");
});

test("JSON edits apply live, invalid edits retain last good skin, presets cancel pending edits", async ({ page }) => {
  await page.goto("/en/");
  await openEditor(page);
  await page.locator(".json-editor summary").click();
  const editor = page.locator("#skin-json");
  const custom = { ...builtInSkins[0], name: "My blue notes", card: { ...builtInSkins[0].card, width: 240, height: 144 }, pin: { ...builtInSkins[0].pin, x: 25, y: -8 } };
  await editor.fill(JSON.stringify(custom));
  await expect(page.locator(".preview-card").first()).toHaveCSS("width", "240px");
  await expect(page.locator(".preview-card").first()).toHaveCSS("height", "144px");
  await expect(page.locator(".preview-card .card-pin").first()).toHaveCSS("left", "60px");
  await editor.fill('{"schemaVersion":2}');
  await expect(editor).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".skin-feedback")).toContainText("Skin unchanged");
  await expect(page.locator(".preview-card").first()).toHaveCSS("width", "240px");
  await editor.fill(JSON.stringify(custom));
  await page.locator(".skin-tabs button").nth(1).click();
  await page.waitForTimeout(350);
  await expect(page.locator(".preview-card").first()).toHaveCSS("width", "168px");
});

test("JSON import and export round-trip without uploading the skin", async ({ page }) => {
  await page.goto("/en/");
  await openEditor(page);
  const posts: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  const custom = { ...builtInSkins[0], name: "Custom", card: { ...builtInSkins[0].card, radius: 4 } };
  await page.locator('#skin-json-upload').setInputFiles({ name: "skin.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(custom)) });
  await expect(page.locator(".preview-surface").first()).toHaveCSS("border-radius", "4px");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download skin", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("skin.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  expect(parseSkin(Buffer.concat(chunks).toString())).toEqual(custom);
  expect(posts).toEqual([]);
  await page.locator('#skin-json-upload').setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"schemaVersion":2}') });
  await expect(page.locator(".skin-feedback")).toContainText("Skin unchanged");
  await expect(page.locator(".preview-surface").first()).toHaveCSS("border-radius", "4px");
});

test("custom large skins stay inside a mobile page and expose horizontally scrollable cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es/");
  await openEditor(page);
  const custom = { ...builtInSkins[0], card: { ...builtInSkins[0].card, width: 480, textWidth: 480, height: 280 } };
  await page.locator('#skin-json-upload').setInputFiles({ name: "skin.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(custom)) });
  await expect(page.locator(".preview-card").first()).toHaveCSS("width", "480px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".slot-row").evaluate((row) => row.scrollWidth > row.clientWidth)).toBe(true);
});

for (const width of [390, 1280]) {
  test(`appearance dialog traps focus and Escape returns to its opener at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/");
    await openEditor(page);
    for (let index = 0; index < 14; index++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".skin-dialog"))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator(".appearance-trigger")).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
}

test("gallery presets update the actual inbox and reopening the editor synchronizes JSON", async ({ page }) => {
  await page.goto("/en/");
  await page.locator(".theme-option").nth(1).click();
  await expect(page.locator(".theme-option").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".card-copy").first()).toHaveCSS("height", "208px");
  await openEditor(page);
  await page.locator(".json-editor summary").click();
  expect(JSON.parse(await page.locator("#skin-json").inputValue()).name).toBe("Card");
  await page.keyboard.press("Escape");
  await page.locator(".theme-option").first().click();
  await openEditor(page);
  expect(JSON.parse(await page.locator("#skin-json").inputValue()).name).toBe("Paper");
});

test("custom edits clear preset selection and both previews fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/");
  for (const preview of await page.locator(".theme-option .skin-preview").all()) {
    const bounds = (await preview.boundingBox())!;
    for (const card of await preview.locator(".preview-card").all()) {
      const item = (await card.boundingBox())!;
      expect(item.x).toBeGreaterThanOrEqual(bounds.x);
      expect(item.x + item.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    }
  }
  await openEditor(page);
  await page.getByRole("button", { name: "Note color: #EBF3FF", exact: true }).click();
  await expect(page.locator('.skin-tabs [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.theme-options [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator(".preview-status")).toContainText("Custom");
  await expect(page.locator('.color-swatch[aria-pressed="true"]')).toHaveAttribute("aria-label", "Note color: #EBF3FF");
});

test("uploaded artwork applies locally and round-trips inside skin JSON", async ({ page }) => {
  await page.goto('/en/');
  await openEditor(page);
  await page.locator('.skin-tabs button').nth(1).click();
  const posts: string[] = [];
  page.on('request', request => { if(request.method()==='POST')posts.push(request.url()); });
  await page.locator('#skin-image-upload').setInputFiles('public/images/ice-desktop.png');
  await expect(page.locator('.artwork-thumbnail')).toHaveClass(/has-image/);
  const background = await page.locator('.preview-surface').first().evaluate(e=>getComputedStyle(e).backgroundImage);
  expect(background).toContain('data:image/');
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await expect(page.locator('.preview-surface').first()).toHaveCSS('background-size', 'contain, auto');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download skin',exact:true}).click();
  const stream=await (await pending).createReadStream();
  const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);
  const source=Buffer.concat(chunks).toString();const parsed=parseSkin(source);
  expect(parsed.background?.image).toMatch(/^data:image\/(webp|png);base64,/);
  expect(parsed.background?.fit).toBe('contain');
  await page.keyboard.press('Escape');
  expect(await page.locator('.card-copy').first().evaluate(e=>getComputedStyle(e).backgroundImage)).toBe(background);
  await expect(page.locator('.capture-card')).toHaveCount(3);
  await openEditor(page);
  await page.getByRole('button',{name:'Use defaults',exact:true}).click();
  await expect(page.locator('.artwork-thumbnail')).not.toHaveClass(/has-image/);
  await page.locator('#skin-json-upload').setInputFiles({name:'skin.json',mimeType:'application/json',buffer:Buffer.from(source)});
  await expect(page.locator('.artwork-thumbnail')).toHaveClass(/has-image/);
  expect(await page.locator('.preview-surface').first().evaluate(e=>getComputedStyle(e).backgroundImage)).toBe(background);
  await page.locator('#skin-image-upload').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await expect(page.locator('.skin-feedback')).toContainText('Choose a PNG');
  expect(await page.locator('.preview-surface').first().evaluate(e=>getComputedStyle(e).backgroundImage)).toBe(background);
  await page.getByRole('button',{name:'Remove image',exact:true}).click();
  await expect(page.locator('.artwork-thumbnail')).not.toHaveClass(/has-image/);
  expect(posts).toEqual([]);
});

test("invalid or oversized images preserve the skin and a pending upload cannot override a preset", async ({ page }) => {
  await page.addInitScript(() => {
    const decode=window.createImageBitmap.bind(window);
    window.createImageBitmap=(async (...args:Parameters<typeof createImageBitmap>)=>{
      await new Promise(resolve=>setTimeout(resolve,300));
      return decode(...args);
    }) as typeof createImageBitmap;
  });
  await page.goto('/en/');await openEditor(page);
  const input=page.locator('#skin-image-upload');
  await input.setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
  await expect(page.locator('.skin-feedback')).toContainText('smaller than 5 MB');
  await input.setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(page.locator('.skin-feedback')).toContainText('could not be read');
  await input.setInputFiles('public/images/ice-desktop.png');
  await page.locator('.skin-tabs button').nth(1).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.skin-tabs button').nth(1)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.artwork-thumbnail')).not.toHaveClass(/has-image/);
  await expect(page.getByRole('button',{name:'Upload image',exact:true})).toBeEnabled();
});

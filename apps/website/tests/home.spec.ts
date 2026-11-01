import {test,expect,type Page} from '@playwright/test';
import {locales} from '../lib/locales';
import {snapshotCopy,snapshotDeviceCopy} from '../lib/snapshot-copy';
import {homeCopy} from '../lib/home-copy';
import {demoCopy} from '../lib/demo-copy';
import {landingDemoCopy} from '../lib/landing-demo-copy';
import {downloads} from '../lib/releases';

const baseURL=process.env.SNAPSLOT_TEST_URL||'http://127.0.0.1:3000';
const stage=(page:Page)=>page.locator('#stage > div').first();
const focused=(page:Page)=>page.locator('[data-focus=true]');
async function help(page:Page){const toggle=page.getByRole('button',{name:landingDemoCopy[(await page.locator('html').getAttribute('lang')) as keyof typeof landingDemoCopy].instructions,exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click()}
async function reveal(page:Page){await page.keyboard.press('Control+Alt+Space');await expect(page.locator('#stage [role=list]')).not.toHaveAttribute('inert','');await expect(page.locator('#stage [role=list]')).toHaveCSS('transform','none')}
async function menu(page:Page){await page.locator('[data-coach=tray]').click()}
test.beforeEach(async({page})=>{
 // Keep tests isolated from the user's clipboard and running desktop client.
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{},write:async()=>{}}}));
});
for(const locale of locales){
 test(`${locale}: translated content and readable desktop, tablet and phone layouts`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/${locale}/`);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(page.locator('#snapshot-title')).toHaveText(snapshotCopy[locale].headline.join(''));
  await expect(page.getByRole('button',{name:new RegExp('^'+snapshotCopy[locale].language+':')})).toBeVisible();
  for(const [width,height]of [[1440,900],[768,1024],[390,844],[320,740]]){
   await page.setViewportSize({width,height});
   await expect.poll(async()=>Math.abs((await stage(page).boundingBox())!.y+(await stage(page).boundingBox())!.height-(height-5))).toBeLessThan(2);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const desktop=(await stage(page).boundingBox())!;
   if(width>=768){const intro=(await page.locator('.ss-intro').boundingBox())!;expect(intro.height).toBeLessThan(450);expect(intro.y+intro.height).toBeLessThan(desktop.y);await expect(focused(page)).toBeVisible();}
   await expect(page.getByRole('button',{name:landingDemoCopy[locale].pin,exact:true})).toBeVisible();
   const trial=(await page.locator('section[data-demo-selection]').boundingBox())!;expect(trial.y).toBeGreaterThanOrEqual(desktop.y);expect(trial.y+trial.height).toBeLessThanOrEqual(desktop.y+desktop.height);
   await expect(page.locator('#downloads [data-platform=mac] a[download]')).toHaveAttribute('href',downloads.mac.href);
   await expect(page.locator('#downloads [data-platform=win] a[download]')).toHaveAttribute('href',downloads.win.href);
  }
  await page.setViewportSize({width:1024,height:900});
  await page.getByRole('button',{name:landingDemoCopy[locale].pin,exact:true}).click();
  const stepBounds=(await page.locator('section[data-demo-selection]').boundingBox())!,stageBounds=(await stage(page).boundingBox())!;
  expect(stepBounds.y).toBeGreaterThanOrEqual(stageBounds.y);expect(stepBounds.y+stepBounds.height).toBeLessThanOrEqual(stageBounds.y+stageBounds.height);
  expect(stepBounds.x).toBeGreaterThanOrEqual(0);expect(stepBounds.x+stepBounds.width).toBeLessThanOrEqual(1024);
  const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));expect(new Set(ids).size).toBe(ids.length);
  expect(errors).toEqual([]);
 });
}
test('download navigation reaches both real versioned installers without a sticky-header obstruction',async({page})=>{
 await page.goto('/zh-Hans/');
 await page.locator('header.ll-nav a[href="#downloads"]').click();
 await expect(page.locator('#download-title')).toBeInViewport();
 await expect(page).toHaveURL(/\/zh-Hans\/$/);
 await expect.poll(async()=>(await page.locator('#download-title').boundingBox())!.y).toBeGreaterThanOrEqual(80);
 for(const platform of ['mac','win'] as const){
  const link=page.locator(`#downloads [data-platform=${platform}] a[download]`);
  await expect(link).toHaveAttribute('href',downloads[platform].href);
  await expect(link).toHaveAttribute('download',downloads[platform].filename);
 }
});
test('notes open on demand; copying and pasting works when system clipboard access is blocked',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Blocked','NotAllowedError')},write:async()=>{throw new DOMException('Blocked','NotAllowedError')}}}));
 await page.goto('/en/');
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');
 await reveal(page);await focused(page).click();
 await expect(page.locator('[class*=copiedOn]')).toContainText(demoCopy.en.copiedHere);
 await page.getByRole('button',{name:demoCopy.en.paste,exact:true}).click();
 await expect(page.locator('[data-coach=drag]')).toContainText(homeCopy.en.stage.sampleText);
});
test('image collection, drag into the document, and platform switching retain the session',async({page})=>{
 await page.goto('/en/');
 await help(page);await page.locator('[data-coach=file]').click();
 await expect(page.locator('[data-note]')).toHaveCount(4);
 await page.evaluate(()=>{
  const data=new DataTransfer();document.querySelector('[data-focus=true]')!.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));
  document.querySelector('[data-coach=drag]')!.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
 });
 await expect(page.locator('[data-coach=drag] [class*=docImage]')).toHaveCount(1);
 await page.getByRole('button',{name:'Windows',exact:true}).click();
 await expect(stage(page)).toHaveAttribute('data-os','win');
 await menu(page);await expect(page.getByRole('menuitem').first()).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('[data-note]')).toHaveCount(4);
 await page.getByRole('button',{name:'macOS',exact:true}).click();
 await expect(stage(page)).toHaveAttribute('data-os','mac');
});
test('selected website text can be pinned explicitly with its shortcut',async({page})=>{
 await page.goto('/en/');
 const text=await page.locator('.ss-intro>p').textContent();
 await page.locator('.ss-intro>p').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range)});
 await page.keyboard.press('Control+Alt+KeyT');
 await expect(page.locator('[data-note]')).toHaveCount(4);
 await expect(focused(page)).toContainText(text!);
});
for(const [platform,os] of [['MacIntel','mac'],['Win32','win']] as const){
test(`${os}: keyboard menu navigation, settings dismissal and Escape preserve expected focus`,async({page})=>{
 await page.addInitScript(platform=>Object.defineProperty(navigator,'platform',{get:()=>platform}),platform);
 await page.goto('/en/');
 // Hydration replaces the default Mac tray with the detected platform's tray.
 // Focus the final control, rather than a server-rendered node about to unmount.
 await expect(stage(page)).toHaveAttribute('data-os',os);
 const tray=page.locator('[data-coach=tray]');await tray.focus();await page.keyboard.press('ArrowDown');
 await expect(page.getByRole('menuitem').first()).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(tray).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');
 await help(page);await page.getByRole('button',{name:demoCopy.en.reveal,exact:true}).click();
 await expect(focused(page)).toBeFocused();
});
}
test('settings control collection, skins and the app locale without changing the website language',async({page})=>{
 await page.goto('/en/');await menu(page);await page.getByRole('menuitem',{name:homeCopy.en.menu.settings,exact:true}).click();
 await page.getByRole('button',{name:homeCopy.en.skins[2],exact:true}).click();
 await expect(page.locator('[data-skin]')).toHaveAttribute('data-skin','graphite');
 await page.getByRole('switch',{name:homeCopy.en.menu.intake,exact:true}).click();
 await expect(page.getByRole('switch',{name:homeCopy.en.menu.intake,exact:true})).toHaveAttribute('aria-checked','false');
 await page.getByRole('dialog').getByRole('combobox').selectOption('ja');
 await expect(page.getByRole('dialog')).toHaveAttribute('aria-label',homeCopy.ja.settings.title);
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.getByRole('button',{name:homeCopy.ja.settings.close}).click();
 await help(page);await page.locator('[data-coach=file]').click();await expect(page.locator('[data-note]')).toHaveCount(3);
});
test('removing an earlier note keeps the selected note and keyboard deletion remains available',async({page})=>{
 await page.goto('/en/');await reveal(page);const selected=await focused(page).getAttribute('data-note');
 await page.getByRole('button',{name:homeCopy.en.stage.remove,exact:true}).first().click({force:true});
 await expect(focused(page)).toHaveAttribute('data-note',selected!);
 await focused(page).focus();await page.keyboard.press('Delete');
 await expect(page.locator('[data-note]')).toHaveCount(1);
});
test('quit stops collection; replay restores the first step and three demo notes',async({page})=>{
 await page.goto('/en/');await reveal(page);await focused(page).click();await page.getByRole('button',{name:demoCopy.en.paste,exact:true}).click();
 await expect(page.locator('[data-coach=drag]')).toContainText(homeCopy.en.stage.sampleText);
 await menu(page);await page.getByRole('menuitem',{name:homeCopy.en.menu.quit,exact:true}).click();
 await expect(page.locator('[data-coach=drag]')).not.toContainText(homeCopy.en.stage.sampleText);
 await expect(page.getByRole('button',{name:demoCopy.en.paste,exact:true})).toBeDisabled();
 await help(page);await expect(page.getByRole('button',{name:demoCopy.en.reveal,exact:true})).toBeDisabled();
 await help(page);await page.locator('[data-coach=file]').click();await expect(page.locator('[data-note]')).toHaveCount(0);
 await page.getByRole('button',{name:demoCopy.en.replay,exact:true}).click();
 await expect(page.getByRole('button',{name:demoCopy.en.reveal,exact:true})).toBeEnabled();
 await expect(page.locator('[data-note-count]')).toHaveText('Notes 3/30');
 await expect(page.getByRole('button',{name:landingDemoCopy.en.pin,exact:true})).toBeEnabled();
 await expect(page.getByRole('button',{name:homeCopy.en.coach.skip,exact:true})).toBeVisible();
});
test('short touch screens keep image files, document, settings and focus within their surfaces',async({browser})=>{
 const context=await browser.newContext({baseURL,viewport:{width:375,height:667},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto('/zh-Hans/');
 const trial=(await page.locator('section[data-demo-selection]').boundingBox())!,desktopBounds=(await stage(page).boundingBox())!;expect(trial.y).toBeGreaterThanOrEqual(desktopBounds.y);expect(trial.y+trial.height).toBeLessThanOrEqual(desktopBounds.y+desktopBounds.height);
 await page.locator('[data-coach=tray]').tap();await page.getByRole('menuitem').first().tap();
 const bounds=(await page.getByRole('dialog').boundingBox())!,desktop=(await stage(page).boundingBox())!;
 expect(bounds.x).toBeGreaterThanOrEqual(desktop.x);expect(bounds.x+bounds.width).toBeLessThanOrEqual(desktop.x+desktop.width);
 await page.getByRole('dialog').getByRole('combobox').focus();expect(await stage(page).evaluate(el=>el.scrollLeft)).toBe(0);
 await page.getByRole('button',{name:homeCopy['zh-Hans'].settings.clear,exact:true}).scrollIntoViewIfNeeded();
 await expect(page.getByRole('button',{name:homeCopy['zh-Hans'].settings.clear,exact:true})).toBeInViewport();
 await context.close();
});
test('language switch stays on the product page and closes the menu',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:new RegExp('^'+snapshotCopy['zh-Hans'].language+':')}).click();
 await page.getByRole('menuitem',{name:'Español'}).click();
 await expect(page).toHaveURL(/\/es\/$/);await expect(page.locator('html')).toHaveAttribute('lang','es');
 await expect(page.getByRole('menu')).toHaveCount(0);
});
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 test(`pointer language selection does not flash a keyboard focus ring (${viewport.width}px)`,async({page})=>{
  await page.setViewportSize(viewport);await page.goto('/zh-Hant/');
  const trigger=page.locator('.ll-nav .brand-language-trigger');
  await trigger.click();await expect(page.getByRole('menu')).toBeVisible();
  // Sample the transition, not just its final state: the regression lasted a few frames.
  const flashes=page.evaluate(()=>new Promise<number>(resolve=>{
   let count=0;const until=performance.now()+900;
   const sample=()=>{
    const trigger=document.querySelector('.ll-nav .brand-language-trigger');
    if(trigger?.matches(':focus-visible')&&getComputedStyle(trigger).outlineStyle!=='none')count++;
    if(performance.now()<until)requestAnimationFrame(sample);else resolve(count);
   };requestAnimationFrame(sample);
  }));
  await page.getByRole('menuitem',{name:'English',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/$/);await expect(page.locator('html')).toHaveAttribute('lang','en');
  expect(await flashes).toBe(0);await expect(page.getByRole('menu')).toHaveCount(0);
 });
}
test('language menu preserves keyboard focus on Escape and supports keyboard selection',async({page})=>{
 await page.goto('/zh-Hans/');const trigger=page.locator('.ll-nav .brand-language-trigger');
 await trigger.focus();await page.keyboard.press('ArrowDown');await expect(page.getByRole('menu')).toBeVisible();
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
 await expect(trigger).toHaveCSS('outline-style','solid');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/\/en\/$/);await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByRole('menu')).toHaveCount(0);
});
test('back-to-top appears after scrolling and returns keyboard focus to the brand',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en/');
 const back=page.getByRole('button',{name:snapshotCopy.en.top,exact:true});await expect(back).toHaveCount(0);
 await page.evaluate(()=>scrollTo(0,120));await expect(back).toBeVisible();await back.click();
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);await expect(page.locator('#snapshot-brand')).toBeFocused();
});
test('content and download links remain available without JavaScript; reduced motion disables transitions',async({browser,page})=>{
 const context=await browser.newContext({baseURL,javaScriptEnabled:false});const plain=await context.newPage();await plain.goto('/en/');
 await expect(plain.locator('#snapshot-title')).toBeVisible();await expect(plain.locator('.ss-use-grid article')).toHaveCount(3);await expect(plain.locator('#downloads [data-platform=mac] a[download]')).toBeVisible();await expect(plain.locator('#downloads noscript a[download]')).toBeVisible();await context.close();
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en/');
 expect(await focused(page).evaluate(node=>getComputedStyle(node).transitionDuration)).toBe('0s');
});


test('visible text demo collects the selected sentence and keyboard controls the same notes',async({page})=>{
 await page.goto('/zh-Hans/');
 const sample=page.locator('[data-selectable]');
 await expect(sample).toBeVisible();
 await page.getByRole('button',{name:landingDemoCopy['zh-Hans'].instructions,exact:true}).click();
 await expect(page.locator('[class*=shortcutList]')).toBeVisible();await expect(page.locator('[class*=shortcutList]')).toContainText('展开便签');
 await sample.scrollIntoViewIfNeeded();
 await sample.evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range)});
 await page.keyboard.press('Control+Alt+KeyT');await expect(page.locator('[data-note]')).toHaveCount(4);
 await expect(focused(page)).toContainText(homeCopy['zh-Hans'].bento.selectLine);
 await page.keyboard.press('Escape');await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');
 await page.keyboard.press('Control+Alt+Space');await expect(focused(page)).toBeFocused();
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('Delete');await expect(page.locator('[data-note]')).toHaveCount(3);
});

test('replay keeps the explicit first step and avoids a menu bar guide overlay',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:'macOS',exact:true}).click();
 await page.getByRole('button',{name:demoCopy['zh-Hans'].replay,exact:true}).click();
 await expect(page.locator('[data-target=edge]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:homeCopy['zh-Hans'].coach.skip,exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:landingDemoCopy['zh-Hans'].pin,exact:true})).toBeEnabled();
});


test('first step shows a new visible text note and offers click-based switching and reuse',async({page})=>{
 await page.goto('/zh-Hans/');const copy=landingDemoCopy['zh-Hans'];
 await expect(page.locator('[data-note-count]')).toHaveText('便签 3/30');
 await expect(page.getByText('网页交互演示',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:copy.pin,exact:true}).click();
 await expect(page.locator('[data-note-count]')).toHaveText('便签 4/30');
 await expect(focused(page)).toContainText(homeCopy['zh-Hans'].bento.selectLine);
 await expect(focused(page)).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:copy.pinned})).toBeVisible();
 await expect(page.getByRole('button',{name:copy.pin,exact:true})).toBeEnabled();
 await page.getByRole('button',{name:copy.prev,exact:true}).click();
 await expect(focused(page)).toHaveAttribute('data-index','2');
 await page.getByRole('button',{name:copy.nextNote,exact:true}).click();
 await expect(focused(page)).toHaveAttribute('data-index','3');
 await focused(page).click();
 await expect(page.locator('[data-coach=drag]')).toHaveAttribute('data-reuse-active','true');
 await page.getByRole('button',{name:demoCopy['zh-Hans'].paste,exact:true}).click();
 await expect(page.locator('[data-coach=drag]')).toContainText(homeCopy['zh-Hans'].bento.selectLine);
 await page.locator('select[aria-label]').first().selectOption('graphite');
 await expect(page.locator('[data-skin]')).toHaveAttribute('data-skin','graphite');
});
test('demo capacity evicts the oldest note and reload resets the temporary session',async({page})=>{
 await page.goto('/en/');
 await page.locator('[data-coach=file]').evaluate(node=>{for(let i=0;i<31;i++)(node as HTMLButtonElement).click()});
 await expect(page.locator('[data-note-count]')).toHaveText('Notes 30/30');
 await expect(page.locator('[data-note=s1]')).toHaveCount(0);
 await page.reload();await expect(page.locator('[data-note-count]')).toHaveText('Notes 3/30');
 await page.getByRole('button',{name:landingDemoCopy.en.instructions,exact:true}).click();
 await expect(page.getByText(landingDemoCopy.en.demoRules,{exact:true})).toBeVisible();
 await page.getByText(landingDemoCopy.en.rules,{exact:true}).click();
 await expect(page.getByText(landingDemoCopy.en.appRules,{exact:true})).toBeVisible();
 await page.getByText(landingDemoCopy.en.privacy,{exact:true}).click();
 await expect(page.getByText(landingDemoCopy.en.privacyText,{exact:true})).toBeVisible();
});
test('header download reaches a working platform chooser and intro leads to the demo',async({page})=>{
 await page.goto('/zh-Hans/');
 await expect(page.locator('header a[href="#downloads"]')).toHaveCount(1);
 await expect(page.locator('.ss-intro a[href="#desktop"]')).toHaveCount(1);
 await page.getByRole('tab',{name:'Windows',exact:true}).click();
 await expect(page.locator('#downloads [data-platform=win]')).toBeVisible();
 await expect(page.locator('#downloads [data-platform=win] a[download]')).toHaveAttribute('href',downloads.win.href);
 await page.getByRole('tab',{name:'Windows',exact:true}).press('ArrowLeft');
 await expect(page.getByRole('tab',{name:'macOS',exact:true})).toBeFocused();
 await expect(page.locator('#downloads [data-platform=mac]')).toBeVisible();
 const order=await page.locator('main > section').evaluateAll(nodes=>nodes.map(node=>node.id||node.className));
 expect(order).toEqual(['ll-shell ss-intro','desktop','features','downloads']);
 await expect(page.locator('#downloads')).toContainText('macOS 13+');
 await expect(page.locator('#downloads')).toContainText(landingDemoCopy['zh-Hans'].windowsSystem);
 await expect(page.locator('#downloads a[href*="webview2"]')).toHaveAttribute('href','https://developer.microsoft.com/microsoft-edge/webview2/#download');
});


test('desktop guide walks through pinning, reuse and the menu; short rules stay visible',async({page})=>{
 await page.goto('/zh-Hans/');
 await expect(page.locator('[class*=coachStep]')).toHaveText('1/4');
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');
 const desktop=(await stage(page).boundingBox())!;await page.mouse.move(desktop.x+desktop.width/2,desktop.y+3);
 await expect(page.locator('#stage [role=list]')).not.toHaveAttribute('inert','');
 await expect(page.locator('[class*=coachStep]')).toHaveText('2/4');
 await expect(page.locator('#stage section[data-demo-selection]')).toHaveCount(1);
 await page.getByRole('button',{name:landingDemoCopy['zh-Hans'].pin,exact:true}).click();
 await expect(page.locator('[class*=coachStep]')).toHaveText('3/4');
 await focused(page).click();await page.getByRole('button',{name:demoCopy['zh-Hans'].paste,exact:true}).click();
 await expect(page.locator('[class*=coachStep]')).toHaveText('4/4');
 await menu(page);await expect(page.locator('[class*=coachStep]')).toHaveCount(0);
 await expect(page.locator('.ss-product-information details')).toHaveCount(0);
 await expect(page.getByText(landingDemoCopy['zh-Hans'].appRules,{exact:true})).toBeVisible();
 await expect(page.getByText(landingDemoCopy['zh-Hans'].privacyText,{exact:true})).toBeVisible();
});
test('Windows right-click menu opens above its tray and stays inside the demo',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:'Windows',exact:true}).click();
 const tray=page.locator('[data-coach=tray]');await tray.click({button:'right'});
 await expect(page.getByRole('menu')).toBeVisible();
 await expect.poll(async()=>{const a=(await page.getByRole('menu').boundingBox())!,b=(await tray.boundingBox())!;return a.y+a.height<=b.y}).toBe(true);
 const m=(await page.getByRole('menu').boundingBox())!,d=(await stage(page).boundingBox())!;
 expect(m.x).toBeGreaterThanOrEqual(d.x);expect(m.x+m.width).toBeLessThanOrEqual(d.x+d.width);expect(m.y).toBeGreaterThanOrEqual(d.y);
});

test('wheel gestures over notes never scroll the page, including the last note',async({page})=>{
 await page.goto('/zh-Hans/');await page.evaluate(()=>scrollTo(0,0));await reveal(page);
 const box=(await focused(page).boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 const initialY=await page.evaluate(()=>scrollY);
 await page.mouse.wheel(0,120);await expect(focused(page)).toHaveAttribute('data-index','2');
 for(let i=0;i<4;i++)await page.mouse.wheel(0,160);
 expect(await page.evaluate(()=>scrollY)).toBe(initialY);
 await page.mouse.wheel(-100,0);await expect(focused(page)).toHaveAttribute('data-index','1');
 expect(await page.evaluate(()=>scrollY)).toBe(initialY);
 await page.mouse.move(8,850);await page.mouse.wheel(0,400);
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(initialY);
});
test('touch swipes turn notes while vertical touch movement stays inside the note area',async({browser})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{const page=await context.newPage();await page.goto('/zh-Hans/');await reveal(page);const cdp=await context.newCDPSession(page);
 const swipe=async(dx:number,dy:number)=>{const r=(await focused(page).boundingBox())!,x=r.x+r.width/2,y=r.y+r.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const initialY=await page.evaluate(()=>scrollY);await swipe(-70,5);await expect(focused(page)).toHaveAttribute('data-index','2');
 expect(await page.evaluate(()=>scrollY)).toBe(initialY);await swipe(0,65);expect(await page.evaluate(()=>scrollY)).toBe(initialY);
 expect(await focused(page).evaluate(e=>getComputedStyle(e).touchAction)).toBe('none');
 }finally{await context.close()}
});


test('common theme reaches the portal menu and footer metadata shares one column',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:/^选择语言:/}).click();
 const current=page.getByRole('menuitem',{name:'简体中文',exact:true}),hover=page.getByRole('menuitem',{name:'繁體中文',exact:true});
 await expect(current).toHaveCSS('color','rgb(108, 77, 255)');await hover.hover();await expect(hover).toHaveCSS('background-color','rgb(242, 238, 255)');
 await page.keyboard.press('Escape');await expect(page.locator('[class*=coachStep]')).toHaveText('1/4');
 const brand=(await page.locator('.ss-footer .ll-brand').boundingBox())!,copyright=(await page.locator('.ss-footer .ss-copyright').boundingBox())!;expect(copyright.x).toBe(brand.x);expect(copyright.y).toBeGreaterThan(brand.y+brand.height);
});
test('notes start unpinned; dwelling at the desktop edge is the first guide step',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:'macOS',exact:true}).click();
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');await expect(page.locator('[class*=coachStep]')).toHaveText('1/4');
 await menu(page);await expect(page.getByRole('menuitemcheckbox',{name:/固定便签/})).toHaveAttribute('aria-checked','false');await page.keyboard.press('Escape');
 const r=(await stage(page).boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+3);
 await expect(page.locator('#stage [role=list]')).not.toHaveAttribute('inert','');await expect(page.locator('[class*=coachStep]')).toHaveText('2/4');
 await menu(page);await expect(page.getByRole('menuitemcheckbox',{name:/固定便签/})).toHaveAttribute('aria-checked','false');
});


test('collecting is temporary; only explicit pinning shows a status dot and keeps notes open',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:'macOS',exact:true}).click();
 await page.locator('[data-coach=pin]').click();await expect(page.locator('[data-note]')).toHaveCount(4);
 const desktop=(await stage(page).boundingBox())!;await page.mouse.move(desktop.x+2,desktop.y+desktop.height-3);
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');
 await reveal(page);await menu(page);await page.getByRole('menuitemcheckbox',{name:/固定便签/}).click();
 const tray=page.locator('[data-coach=tray]');await expect(tray).toHaveAttribute('data-pinned','true');
 await expect(tray.locator('[class*=trayPinned]')).toBeVisible();
 await page.mouse.move(8,880);await page.waitForTimeout(700);
 await expect(page.locator('#stage [role=list]')).not.toHaveAttribute('inert','');
 await menu(page);await page.getByRole('menuitemcheckbox',{name:/固定便签/}).click();
 await expect(tray).toHaveAttribute('data-pinned','false');await expect(tray.locator('[class*=trayPinned]')).toHaveCount(0);
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');
});


test('pinning can be repeated and help or document text can also be collected',async({page})=>{
 await page.goto('/zh-Hans/');const pin=page.locator('[data-coach=pin]');
 await pin.click();await pin.click();await pin.click();await expect(page.locator('[data-note]')).toHaveCount(6);await expect(pin).toBeEnabled();
 await help(page);const paragraph=page.locator('#demo-instructions p').first(),text=(await paragraph.textContent())!;
 await paragraph.evaluate(node=>{const r=document.createRange();r.selectNodeContents(node);const s=getSelection()!;s.removeAllRanges();s.addRange(r)});
 await page.keyboard.press('Control+Alt+KeyT');await expect(page.locator('[data-note]')).toHaveCount(7);await expect(focused(page)).toContainText(text);
 await expect(page.locator('#demo-instructions')).toBeHidden();await focused(page).click();await page.getByRole('button',{name:demoCopy['zh-Hans'].paste,exact:true}).click();
 const documentText=page.locator('[data-coach=drag] [class*=docText]').first();
 await documentText.evaluate(node=>{const r=document.createRange();r.selectNodeContents(node);const s=getSelection()!;s.removeAllRanges();s.addRange(r)});
 await page.keyboard.press('Control+Alt+KeyT');await expect(page.locator('[data-note]')).toHaveCount(8);await expect(focused(page)).toContainText(text);
});
test('double-clicked words can be collected without disabling whole-note dragging',async({page})=>{
 await page.goto('/zh-Hans/');await reveal(page);await focused(page).locator('[class*=noteText]').dblclick({position:{x:22,y:18}});await expect(focused(page)).toHaveAttribute('draggable','true');
 const selected=await page.evaluate(()=>getSelection()?.toString()||'');expect(selected.trim().length).toBeGreaterThan(0);
 await page.keyboard.press('Control+Alt+KeyT');await expect(page.locator('[data-note]')).toHaveCount(4);await expect(focused(page)).toContainText(selected.trim());
});
test('text notes retain native drag-and-drop through their top-edge handle',async({page})=>{
 await page.goto('/zh-Hans/');await reveal(page);await page.locator('[data-note-drag=s2]').dragTo(page.locator('[data-coach=drag]'));
 await expect(page.locator('[data-coach=drag]')).toContainText(homeCopy['zh-Hans'].stage.sampleText);
});


test('the entire text card remains draggable by default',async({page})=>{
 await page.goto('/zh-Hans/');await reveal(page);await expect(focused(page)).toHaveAttribute('draggable','true');
 await focused(page).dragTo(page.locator('[data-coach=drag]'));
 await expect(page.locator('[data-coach=drag]')).toContainText(homeCopy['zh-Hans'].stage.sampleText);
});


test('completed edge guidance is not repeated when the reuse step collapses',async({page})=>{
 await page.goto('/zh-Hans/');await reveal(page);await expect(page.locator('[class*=coachStep]')).toHaveText('2/4');
 await page.locator('[data-coach=pin]').click();await expect(page.locator('[class*=coachStep]')).toHaveText('3/4');
 const desktop=(await stage(page).boundingBox())!;await page.mouse.move(desktop.x+2,desktop.y+desktop.height-3);
 await expect(page.locator('#stage [role=list]')).toHaveAttribute('inert','');await expect(page.locator('[class*=coachStep]')).toHaveCount(0);
 await reveal(page);await expect(page.locator('[class*=coachStep]')).toHaveText('3/4');
 await expect(page.locator('[class*=coach]').filter({hasText:homeCopy['zh-Hans'].coach.edge})).toHaveCount(0);
});
test('copied feedback occupies only a small bottom-right corner of the note',async({page})=>{
 await page.goto('/zh-Hans/');await reveal(page);await focused(page).click();
 const tag=focused(page).locator('[class*=copiedOn]');await expect(tag).toBeVisible();
 const card=(await focused(page).boundingBox())!,label=(await tag.boundingBox())!;
 expect(label.height).toBeLessThanOrEqual(22);expect(label.width).toBeLessThan(card.width*.8);
 expect(card.x+card.width-label.x-label.width).toBeLessThanOrEqual(9);expect(card.y+card.height-label.y-label.height).toBeLessThanOrEqual(9);
});


test('notes enlarge with a click or Space, and Escape returns focus without collapsing the rail',async({page})=>{
 await page.goto('/zh-Hans/');await page.getByRole('button',{name:'macOS',exact:true}).click();await reveal(page);
 await focused(page).press('Space');await expect(page.locator('[data-note-preview]')).toContainText(homeCopy['zh-Hans'].stage.sampleText);
 await page.keyboard.press('Escape');await expect(page.locator('[data-note-preview]')).toHaveCount(0);await expect(focused(page)).toBeFocused();
 await focused(page).press('ArrowRight');await page.locator('[role=listitem]').filter({has:page.locator('[data-focus=true]')}).getByRole('button',{name:'放大便签'}).click();
 await expect(page.locator('[data-note-preview] img')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#stage [role=list]')).not.toHaveAttribute('inert','');
});

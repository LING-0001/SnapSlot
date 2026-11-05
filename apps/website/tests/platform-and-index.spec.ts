import {test,expect} from '@playwright/test';
import path from 'node:path';

for(const [platform,os] of [['MacIntel','mac'],['Win32','win']] as const){
 test(`${os}: delayed hydration never paints the other platform`,async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({platform,os})=>{
   Object.defineProperty(navigator,'platform',{get:()=>platform});
   const wrongFrames:string[]=[];
   Object.assign(window,{wrongPlatformFrames:wrongFrames});
   const sample=()=>{
    const stage=document.querySelector<HTMLElement>('#stage > div');
    if(stage?.checkVisibility({visibilityProperty:true})&&stage.dataset.os!==os)wrongFrames.push('desktop');
    for(const panel of document.querySelectorAll<HTMLElement>('.ss-download-panel')){
     if(panel.checkVisibility({visibilityProperty:true})&&panel.dataset.platform!==os)wrongFrames.push('download');
    }
    requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  },{platform,os});
  let releaseScripts!:()=>void;
  const scriptsHeld=new Promise<void>(resolve=>{releaseScripts=resolve;});
  await page.route(/\/_next\/.*\.js(?:\?.*)?$/,async route=>{await scriptsHeld;await route.continue();});
  try{
   await page.goto('/zh-Hans/',{waitUntil:'commit'});
   await expect(page.locator('#snapshot-title')).toBeVisible();
   const other=os==='mac'?'win':'mac';
   await expect(page.locator(`#stage > [data-os="${other}"]`)).not.toBeVisible();
   await expect(page.locator(`#download-panel-${other}`)).not.toBeVisible();
   // Allow several actual browser paints while the application scripts remain blocked.
   await page.evaluate(()=>new Promise<void>(resolve=>{
    let frames=0;const tick=()=>++frames===5?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);
   }));
  }finally{releaseScripts();}
  await expect(page.locator('#stage > div').first()).toBeVisible();
  await expect(page.locator('#stage > div').first()).toHaveAttribute('data-os',os);
  await expect(page.locator(`#download-tab-${os}`)).toHaveAttribute('aria-selected','true');
  await expect(page.locator(`#download-panel-${os}`)).toBeVisible();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  expect(await page.evaluate(()=>(window as Window&{wrongPlatformFrames?:string[]}).wrongPlatformFrames)).toEqual([]);
  expect(errors).toEqual([]);
  if(process.env.SNAPSLOT_QA_OUTPUT)await page.screenshot({path:path.join(process.env.SNAPSLOT_QA_OUTPUT,`first-platform-${os}.png`)});
 });

 test(`${os}: first download choice matches the detected desktop and manual changes persist`,async({page})=>{
  await page.addInitScript(platform=>Object.defineProperty(navigator,'platform',{get:()=>platform}),platform);
  await page.goto('/zh-Hans/');
  await expect(page.locator('#stage > div').first()).toHaveAttribute('data-os',os);
  await expect(page.locator(`#download-tab-${os}`)).toHaveAttribute('aria-selected','true');
  await expect(page.locator(`#download-panel-${os}`)).toBeVisible();
  const other=os==='mac'?'win':'mac';
  await page.locator(`#download-tab-${other}`).click();
  await expect(page.locator(`#download-panel-${other}`)).toBeVisible();
  await page.getByRole('button',{name:os==='mac'?'Windows':'macOS',exact:true}).click();
  await expect(page.locator(`#download-tab-${other}`)).toHaveAttribute('aria-selected','true');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator(`#download-tab-${other}`)).toHaveAttribute('aria-selected','true');
  await page.locator(`#download-tab-${other}`).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(`#download-tab-${os}`)).toBeFocused();
  await expect(page.locator(`#download-panel-${os}`)).toBeVisible();
 });
}

test('website note position stays below the focused card and follows keyboard navigation',async({page})=>{
 await page.goto('/zh-Hans/');
 await page.keyboard.press('Control+Alt+Space');
 const index=page.locator('[data-note-index]');
 await expect(index).toBeVisible();
 await expect(index).toHaveText('2 / 3');
 const card=page.locator('[data-focus=true]');
 await card.focus();
 await page.keyboard.press('ArrowRight');
 await expect(index).toHaveText('3 / 3');
 await expect(card).toBeFocused();
 await page.keyboard.press('ArrowRight');
 await expect(index).toHaveText('3 / 3');
 await page.keyboard.press('ArrowLeft');
 await expect(index).toHaveText('2 / 3');
 await expect(card).toBeFocused();
 await expect(index).toHaveCSS('pointer-events','none');
 for(const [width,height]of [[1280,900],[390,844],[320,740]]){
  await page.setViewportSize({width,height});
  await expect.poll(async()=>{
   const a=await card.boundingBox(),b=await index.boundingBox();
   return !!a&&!!b&&b.y>=a.y+a.height+3&&b.y<a.y+a.height+16;
  }).toBe(true);
  expect((await index.boundingBox())!.height).toBeLessThanOrEqual(17);
  const coach=page.locator('[data-side]');
  if(await coach.isVisible())await expect.poll(async()=>{
   const a=await index.boundingBox(),b=await coach.boundingBox();
   return !a||!b||a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y;
  }).toBe(true);
  if(process.env.SNAPSLOT_QA_OUTPUT)await page.locator('#desktop').screenshot({path:path.join(process.env.SNAPSLOT_QA_OUTPUT,`website-note-index-${width}.png`)});
 }
});

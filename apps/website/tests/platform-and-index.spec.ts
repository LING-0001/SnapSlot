import {test,expect} from '@playwright/test';
import path from 'node:path';

for(const [platform,os] of [['MacIntel','mac'],['Win32','win']] as const){
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
 await page.keyboard.press('ArrowRight');
 await expect(index).toHaveText('3 / 3');
 await page.keyboard.press('ArrowLeft');
 await expect(index).toHaveText('2 / 3');
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

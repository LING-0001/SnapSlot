import {test,expect} from '@playwright/test';

test('usage guide explains copy and drag, supports pause/replay and restores focus', async ({page})=>{
  await page.goto('/en/');
  await page.locator('.usage-trigger').click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.guide-scene')).toHaveAttribute('data-mode','copy');
  await expect(page.locator('.guide-scene')).toHaveAttribute('data-playing','true');
  await expect(page.locator('.usage-steps')).toContainText('Ctrl / ⌘ + V');
  await page.getByRole('button',{name:'Pause animation',exact:true}).click();
  await expect(page.locator('.guide-cursor')).toHaveCSS('animation-play-state','paused');
  await page.getByRole('button',{name:'Hold and drag',exact:true}).click();
  await expect(page.locator('.guide-scene')).toHaveAttribute('data-mode','drag');
  await expect(page.locator('.usage-note')).toContainText('does not drag files');
  await page.getByRole('button',{name:'Replay',exact:true}).click();
  await expect(page.locator('.guide-scene')).toHaveAttribute('data-playing','true');
  for(let index=0;index<8;index++){
    await page.keyboard.press('Tab');
    expect(await page.evaluate(()=>!!document.activeElement?.closest('.usage-dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.usage-trigger')).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});

test('short mobile screens can open the guide and reduced motion stays static',async({page})=>{
  await page.setViewportSize({width:390,height:667});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/zh-Hans/');
  await page.locator('.usage-nav').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.guide-cursor')).toHaveCSS('animation-name','none');
  await expect(page.locator('.guide-result')).toHaveCSS('opacity','1');
  await page.getByRole('button',{name:'长按拖拽',exact:true}).click();
  await expect(page.locator('.usage-note')).toContainText('网页暂不支持');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.usage-nav')).toBeFocused();
});

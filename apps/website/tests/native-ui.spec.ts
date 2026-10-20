import {test,expect,type Page} from '@playwright/test';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {builtInSkins} from '../lib/skin';
test.beforeAll(()=>{execFileSync(process.execPath,['scripts/build-native.mjs'],{stdio:'pipe'});});
const entry=pathToFileURL(path.resolve('../..','artifacts/native-ui/index.html')).href;
async function host(page:Page,mode='rail'){
  await page.addInitScript(({skin})=>{
    const bridge=window as typeof window & {nativeCommands:Record<string,unknown>[];nativeState:Record<string,unknown>;nativePreferences:Record<string,unknown>;preferenceError?:string;snapslotReceive?:(value:unknown)=>void;chrome?:{webview:unknown}};
    bridge.nativeCommands=[];
    bridge.nativeState={type:'state',items:Array.from({length:21},(_,i)=>({id:'item-'+i,kind:'text',title:'Note '+i,text:'Full payload '+i+'\nKeep useful things close.'})),skin:JSON.stringify(skin),locale:'zh-Hans',expanded:true,reducedMotion:false};
    bridge.nativePreferences={collectScreenshots:true,captureShortcut:{key:'KeyS',control:true,alt:true,shift:false,meta:false},textShortcut:{key:'KeyT',control:true,alt:true,shift:false,meta:false}};
    const chrome=(window as unknown as {chrome:Record<string,unknown>}).chrome||{};
    chrome.webview={addEventListener:()=>{},postMessage:(command:Record<string,unknown>)=>{
      bridge.nativeCommands.push(command);
      if(command.type==='ready'){bridge.snapslotReceive?.(bridge.nativeState);if(location.search.includes('preferences'))bridge.snapslotReceive?.({type:'preferences',value:bridge.nativePreferences,platform:'macos'});}
      if(command.type==='savePreferences'){
        if(bridge.preferenceError)bridge.snapslotReceive?.({type:'error',message:bridge.preferenceError});
        else{bridge.nativePreferences=command.value as Record<string,unknown>;bridge.snapslotReceive?.({type:'preferences',value:bridge.nativePreferences,platform:'macos'});}
      }
      if(command.type==='remove'){
        bridge.nativeState.items=(bridge.nativeState.items as {id:string}[]).filter(item=>item.id!==command.id);
        bridge.snapslotReceive?.(bridge.nativeState);
      }
      if(command.type==='applySkin'){bridge.nativeState.skin=command.source;bridge.snapslotReceive?.(bridge.nativeState);}
    }};
    (window as unknown as {chrome:unknown}).chrome=chrome;
  },{skin:builtInSkins[0]});
  await page.goto(entry+(mode==='rail'?'':'?mode='+mode));
}
test('offline native row keeps 21 notes and sends copy, remove and drag to the host',async({page})=>{
  const network:string[]=[];page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
  await host(page);
  await expect(page.locator('.capture-card')).toHaveCount(21);
  const last=page.locator('.card-copy').last();await last.click();
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:unknown[]}).nativeCommands)).toContainEqual({type:'copy',id:'item-20'});
  const box=(await last.boundingBox())!;
  await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.waitForTimeout(180);await page.mouse.move(box.x+60,box.y+45);await page.mouse.up();
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:unknown[]}).nativeCommands)).toContainEqual({type:'drag',id:'item-20'});
  await last.press('Delete');await expect(page.locator('.capture-card')).toHaveCount(20);
  expect(network).toEqual([]);
  await expect(page.locator('.native-tool')).toHaveCount(6);
});
test('native appearance uses the shared editor, keeps image controls visible and exports through the OS',async({page})=>{
  await page.setViewportSize({width:1080,height:790});await host(page,'settings');
  await expect(page.locator('.skin-dialog')).toBeVisible();await expect(page.locator('.artwork-choose')).toBeInViewport({ratio:1});
  await page.locator('#skin-image-upload').setInputFiles('public/images/ice-desktop.png');
  await expect(page.locator('.artwork-thumbnail')).toHaveClass(/has-image/);
  await page.getByRole('button',{name:'下载皮肤',exact:true}).click();
  const exports=await page.evaluate(()=>(window as unknown as {nativeCommands:{type:string;source?:string}[]}).nativeCommands.filter(command=>command.type==='exportSkin'));
  expect(JSON.parse(exports.at(-1)!.source!).background.image).toMatch(/^data:image\//);
  await page.getByRole('button',{name:'打开皮肤文件夹',exact:true}).click();
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:unknown[]}).nativeCommands)).toContainEqual({type:'openSkinFolder'});
  await page.evaluate(()=>{(window as unknown as {snapslotReceive:(value:unknown)=>void}).snapslotReceive({type:'skin',source:'{}'});});
  await expect(page.locator('.native-notice')).toBeVisible();await expect(page.locator('.artwork-thumbnail')).toHaveClass(/has-image/);
});
test('native text composer sends full text only on explicit save',async({page})=>{
  await page.setViewportSize({width:520,height:360});await host(page,'text');
  await page.getByRole('textbox').fill('完整文字\nSecond line');
  await page.getByRole('button',{name:'贴上文字',exact:true}).click();
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:unknown[]}).nativeCommands)).toContainEqual({type:'saveText',text:'完整文字\nSecond line'});
});

test('native hover selects before clicking, including an inactive host window',async({page})=>{
  await host(page);
  const card=page.locator('[data-card="item-20"]'), button=card.locator('.card-copy');
  await button.scrollIntoViewIfNeeded();
  await expect(card).toBeInViewport();
  const box=(await button.boundingBox())!;
  await page.mouse.move(0,0);
  await page.evaluate(({x,y})=>(window as unknown as {snapslotReceive:(value:unknown)=>void}).snapslotReceive({type:'pointer',x,y}),{x:box.x+30,y:box.y+30});
  await expect(card).toHaveClass(/host-hover/);
  await expect(card.locator('.copy-overlay')).toHaveCSS('opacity','1');
  await expect(button).toHaveCSS('outline-width','2px');
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:{type:string}[]}).nativeCommands.filter(command=>command.type==='copy'))).toHaveLength(0);
  await button.click();
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:{type:string}[]}).nativeCommands.filter(command=>command.type==='copy'))).toHaveLength(1);
  await page.mouse.move(0,0);
  await page.evaluate(()=>(window as unknown as {snapslotReceive:(value:unknown)=>void}).snapslotReceive({type:'pointer',x:null,y:null}));
  await expect(card).not.toHaveClass(/host-hover/);
});

test('incremental native states retain existing image previews and text payloads',async({page})=>{
  await host(page);
  await page.evaluate(()=>{
    const bridge=window as unknown as {nativeState:{items:Record<string,unknown>[]};snapslotReceive:(value:unknown)=>void};
    bridge.nativeState.items[0]={id:'item-0',kind:'image',title:'Photo',preview:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLf8AAAAASUVORK5CYII='};
    bridge.snapslotReceive({...bridge.nativeState,type:'state'});
  });
  const before=await page.locator('[data-card="item-0"] .sample-artwork').evaluate(node=>getComputedStyle(node).backgroundImage);
  await page.evaluate(()=>{
    const bridge=window as unknown as {nativeState:{items:{id:string;kind:string;title:string}[]};snapslotReceive:(value:unknown)=>void};
    bridge.snapslotReceive({type:'state',items:bridge.nativeState.items.map(({id,kind,title})=>({id,kind,title})),expanded:true,locale:'zh-Hans',reducedMotion:false});
  });
  await expect(page.locator('[data-card="item-0"] .sample-artwork')).toHaveCSS('background-image',before);
  await expect(page.locator('[data-card="item-1"] .text-preview')).toContainText('Keep useful things close.');
  await page.evaluate(()=>{const bridge=window as unknown as {nativeState:unknown;snapslotReceive:(value:unknown)=>void};bridge.snapslotReceive({...bridge.nativeState as object,type:'state',focus:true});});
  await expect(page.locator('.card-copy').first()).toBeFocused();
});

test('native settings record two shortcuts, toggle screenshot intake and save through the host',async({page})=>{
  await page.setViewportSize({width:600,height:580});await host(page,'preferences');
  await expect(page.getByRole('heading',{name:'设置',exact:true})).toBeVisible();
  const intake=page.getByRole('switch');await expect(intake).toBeChecked();
  const capture=page.getByRole('button',{name:'截一张图',exact:true}),text=page.getByRole('button',{name:'收取选中文字',exact:true}),save=page.getByRole('button',{name:'保存更改',exact:true});
  await expect(save).toBeInViewport({ratio:1});await expect(save).toBeDisabled();
  await intake.uncheck();await capture.click();await capture.press('Control+Alt+Shift+P');
  await text.click();await text.press('Control+Alt+Shift+P');await save.click();
  await expect(page.getByRole('alert')).toContainText('两个快捷键不能相同');
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:{type:string}[]}).nativeCommands.filter(value=>value.type==='savePreferences'))).toHaveLength(0);
  await text.click();await text.press('Control+Alt+Y');await save.click();
  await expect(page.getByRole('status')).toHaveText('已保存');await expect(save).toBeDisabled();
  const value=await page.evaluate(()=>(window as unknown as {nativePreferences:Record<string,unknown>}).nativePreferences);
  expect(value).toEqual({collectScreenshots:false,captureShortcut:{key:'KeyP',control:true,alt:true,shift:true,meta:false},textShortcut:{key:'KeyY',control:true,alt:true,shift:false,meta:false}});
  await page.getByRole('button',{name:'恢复默认'}).click();await expect(intake).toBeChecked();await save.click();await expect(capture).toHaveText('⌃⌥S');await expect(text).toHaveText('⌃⌥T');
  await capture.click();await capture.press('Escape');
  expect(await page.evaluate(()=>(window as unknown as {nativeCommands:{type:string}[]}).nativeCommands.filter(value=>value.type==='close'))).toHaveLength(0);
});

test('a rejected native shortcut save retains the draft and allows another attempt',async({page})=>{
  await page.setViewportSize({width:600,height:580});await host(page,'preferences');
  await page.evaluate(()=>{(window as unknown as {preferenceError:string}).preferenceError='快捷键已被占用，请换一个组合。';});
  await page.getByRole('switch').uncheck();await page.getByRole('button',{name:'保存更改'}).click();
  await expect(page.getByRole('alert')).toContainText('快捷键已被占用');
  await expect(page.getByRole('button',{name:'保存更改'})).toBeEnabled();
  expect(await page.evaluate(()=>(window as unknown as {nativePreferences:{collectScreenshots:boolean}}).nativePreferences.collectScreenshots)).toBe(true);
});

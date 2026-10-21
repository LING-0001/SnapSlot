"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { builtInSkins, skinStyle } from "@/lib/skin";
import { SampleArtwork } from "./sample-artwork";
import styles from "./prototype-rail.module.css";
import hotkeys from "./prototype-rail-hotkeys.module.css";
import appearance from "./prototype-rail-appearance.module.css";

// PROTOTYPE — three Windows control placements on the real website desktop shell.
type DesktopState = "idle" | "hover" | "pinned" | "menu" | "settings";
type Card = { id: number; kind: "image" | "text"; art: string; name: string };
const states: DesktopState[] = ["idle", "hover", "pinned", "menu", "settings"];
const stateNames: Record<DesktopState, string> = { idle: "收起", hover: "展开", pinned: "固定", menu: "托盘菜单", settings: "设置" };
const stateDescriptions: Record<DesktopState, string> = {
  idle: "状态 01：便签栏收起，桌面只保留底部工具条。",
  hover: "状态 02：鼠标移入后，便签栏展开；离开后等待 450 ms。",
  pinned: "状态 03：别针变蓝，便签栏固定显示。",
  menu: "状态 04：从 Dock 的 SnapSlot 图标打开托盘菜单。",
  settings: "状态 05：设置独立出现，集中编辑偏好。",
};
const initialCards: Card[] = [
  { id: 1, kind: "image", art: "/mountains.svg", name: "参考图片" },
  { id: 2, kind: "text", art: "", name: "灵感便签" },
  { id: 3, kind: "image", art: "/studio.svg", name: "工作室照片" },
];

function Icon({ kind, size = 18 }: { kind: "camera" | "text" | "copy" | "close" | "chevron" | "pin" | "gear" | "palette" | "arrow" | "reset"; size?: number }) {
  const paths = {
    camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></>,
    text: <><path d="M5 5h14M12 5v15M8 20h8M5 5v3m14-3v3"/></>,
    copy: <path d="M8 8h12v12H8zM4 16V4h12"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    pin: <><path d="M8 4h8l-1.2 6.1L18 13H6l3.2-2.9L8 4Z"/><path d="M12 13v7"/></>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.9-1.1L14.2 3h-4.1l-.4 2.8a7 7 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.9 1.1l.4 2.8h4.1l.4-2.8a7 7 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1.1Z"/></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-.6a1.4 1.4 0 0 1 0-2.8H15a6 6 0 0 0 6-6c0-3.3-4-5.2-9-5.2Z"/><circle cx="7" cy="10" r=".8"/><circle cx="10" cy="7" r=".8"/><circle cx="15" cy="7" r=".8"/></>,
    arrow: <path d="m14 5-7 7 7 7"/>,
    reset: <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return <button type="button" className={styles.switch} aria-label={label} aria-pressed={checked} onClick={() => onChange(!checked)}><i/></button>;
}

function Pin({ pinned, onClick }: { pinned: boolean; onClick: () => void }) {
  return <button type="button" className={`${styles.pin} ${pinned ? styles.pinOn : ""}`} aria-label={pinned ? "取消固定" : "固定便签栏"} aria-pressed={pinned} onClick={onClick}><Icon kind="pin"/></button>;
}

function PrototypeCard({ card, onRemove, onCopy }: { card: Card; onRemove: () => void; onCopy: () => void }) {
  return <div data-card={card.id} className={`capture-card ${card.kind}`}>
    <span className="card-pin" aria-hidden="true"><i/><b/></span>
    <button type="button" className="card-copy" onClick={onCopy} aria-label={`复制：${card.name}`}>
      {card.kind === "image" ? <SampleArtwork src={card.art} label={card.name}/> : <div className="text-preview"><strong>新建功能的想法</strong><p>固定状态与右键菜单保持同步。</p><p>快捷键冲突写在输入框旁。</p></div>}
      <span className="copy-overlay"><Icon kind="copy" size={16}/>复制</span>
    </button>
    <div className="card-caption"><span>{card.name}</span><span className="card-type">{card.kind === "text" ? "TXT" : "PNG"}</span></div>
    <button type="button" className="card-remove" onClick={onRemove} aria-label={`移除：${card.name}`}><Icon kind="close" size={12}/></button>
  </div>;
}

function ContextMenu({ pinned, collect, onPin, onCollect, onSettings, onScreenshot }: { pinned: boolean; collect: boolean; onPin: () => void; onCollect: () => void; onSettings: () => void; onScreenshot: () => void }) {
  return <div className={styles.contextMenu} role="menu" aria-label="SnapSlot 托盘菜单">
    <header><span className="app-symbol"/>SnapSlot <small>快照贴</small></header>
    <button type="button" role="menuitem" onClick={onScreenshot}><span><Icon kind="camera" size={16}/> 截取屏幕</span><kbd>Ctrl Shift S</kbd></button>
    <button type="button" role="menuitem">展开便签 <kbd>Ctrl Alt Space</kbd></button>
    <button type="button" role="menuitem" onClick={onPin}>{pinned ? "取消固定" : "固定便签"}<Icon kind="pin" size={16}/></button>
    <button type="button" role="menuitemcheckbox" aria-checked={collect} onClick={onCollect}>自动收取剪贴板图片 <i className={collect ? styles.checked : ""}/></button>
    <hr/>
    <button type="button" role="menuitem" onClick={onSettings}><span><Icon kind="gear" size={16}/> 设置</span><Icon kind="chevron" size={16}/></button>
    <hr/><button type="button" role="menuitem" className={styles.quit}>退出 SnapSlot</button>
  </div>;
}

function Settings({ pinned, collect, screenshotKey, shortcutNotice, onPin, onCollect, onClose, onScreenshot, onShortcutConflict }: { pinned: boolean; collect: boolean; screenshotKey: string; shortcutNotice: string; onPin: () => void; onCollect: () => void; onClose: () => void; onScreenshot: () => void; onShortcutConflict: () => void }) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [surface, setSurface] = useState<"paper" | "blue" | "green">("paper");
  const [radius, setRadius] = useState(12);
  return <section className={`${styles.settings} ${appearance.frame}`} aria-label="设置预览">
    <header><span>设置</span><button type="button" aria-label="关闭设置" onClick={onClose}>×</button></header>
    <div className={styles.settingsBody}><h2>便签栏</h2><label><span><b>固定便签栏</b><small>固定后，鼠标移开不会收起。</small></span><Switch checked={pinned} label="固定便签栏" onChange={onPin}/></label><h2>截图与快捷键</h2><label className={styles.key}><span><b>截取屏幕</b><small>截取后会作为新便签加入。</small></span><button type="button" className={hotkeys.keyButton} onClick={onScreenshot}><kbd>{screenshotKey}</kbd></button></label><label className={styles.key}><span><b>展开便签栏</b><small>显示或收起便签栏。</small></span><kbd>Ctrl Alt Space</kbd></label><button type="button" className={hotkeys.conflictButton} onClick={onShortcutConflict}>模拟快捷键冲突</button>{shortcutNotice && <p className={hotkeys.shortcutNotice} role="status">{shortcutNotice}</p>}<h2>剪贴板</h2><label><span><b>自动收取剪贴板图片</b><small>开启后，复制图片或截图会自动加入；不会读取普通文字。</small></span><Switch checked={collect} label="自动收取剪贴板图片" onChange={onCollect}/></label><h2>外观</h2><button type="button" className={`${styles.settingsRow} ${appearance.toggle}`} aria-expanded={appearanceOpen} onClick={() => setAppearanceOpen((open) => !open)}><span><Icon kind="palette"/> 外观</span><Icon kind="chevron"/></button>{appearanceOpen && <div className={appearance.editor}><div className={appearance.preview}><span>实时预览</span><div className={`${appearance.note} ${appearance[surface]}`} style={{ borderRadius: radius }}><i/><b>灵感便签</b><p>这里展示外观调整效果。</p></div></div><div className={appearance.controls}><span>便签底色</span><div className={appearance.swatches} role="group" aria-label="便签底色"><button type="button" aria-label="纸张" aria-pressed={surface === "paper"} className={appearance.paper} onClick={() => setSurface("paper")}/><button type="button" aria-label="冰蓝" aria-pressed={surface === "blue"} className={appearance.blue} onClick={() => setSurface("blue")}/><button type="button" aria-label="浅绿" aria-pressed={surface === "green"} className={appearance.green} onClick={() => setSurface("green")}/></div><label className={appearance.range}><span>圆角</span><input type="range" min="0" max="24" value={radius} onChange={(event) => setRadius(Number(event.target.value))}/><output>{radius} px</output></label></div></div>}</div>
  </section>;
}

export function RailPrototype({ locale }: { locale: string }) {
  const router = useRouter(), params = useSearchParams();
  const raw = params.get("state");
  const state: DesktopState = raw === "hover" || raw === "pinned" || raw === "menu" || raw === "settings" ? raw : "idle";
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [collect, setCollect] = useState(true);
  const [screenshotKey, setScreenshotKey] = useState("Ctrl Shift S");
  const [shortcutNotice, setShortcutNotice] = useState("");
  const [status, setStatus] = useState("");
  const railOpen = state === "hover" || state === "pinned";
  const pinned = state === "pinned";
  const choose = useCallback((next: DesktopState) => { const search = new URLSearchParams(params.toString()); search.delete("variant"); search.set("state", next); router.replace(`?${search.toString()}`); setStatus(stateDescriptions[next]); }, [params, router]);
  useEffect(() => {
    const move = (event: KeyboardEvent) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") choose(states[(states.indexOf(state) + (event.key === "ArrowRight" ? 1 : states.length - 1)) % states.length]); };
    addEventListener("keydown", move); return () => removeEventListener("keydown", move);
  }, [choose, state]);
  function togglePin(next?: boolean) { choose((next ?? !pinned) ? "pinned" : "hover"); }
  function toggleCollect(next?: boolean) { setCollect((value) => { const result = next ?? !value; setStatus(result ? "自动收取剪贴板图片已开启。" : "自动收取剪贴板图片已关闭。"); return result; }); }
  function add(kind: Card["kind"]) { const id = Date.now(); setCards((old) => [...old, { id, kind, art: kind === "image" ? "/studio.svg" : "", name: kind === "image" ? "新截图" : "新文字" }]); choose("hover"); setStatus(kind === "image" ? "已截取一张屏幕图片。" : "已收取一条文字。"); }
  function reset() { setCards(initialCards); setCollect(true); choose("idle"); setStatus("已恢复原型初始状态。"); }
  const openSettings = () => choose("settings");
  const resolveShortcutConflict = () => { const replacement = "Ctrl Shift Alt S"; setScreenshotKey(replacement); setShortcutNotice(`与“展开便签栏”的 Ctrl Alt Space 冲突，已自动改为 ${replacement}。`); setStatus("截图快捷键已自动避开冲突。"); };
  return <>
    <header className="site-header page-width" id="top"><a className="home-link" href={`/${locale}/`} aria-label="SnapSlot"><span className="brand"><span className="brand-logo" aria-hidden="true"/><span>SnapSlot</span></span><span className="chinese-name">快照贴</span></a><nav aria-label="原型导航"><a href={`/${locale}/`}>使用说明</a><a href={`/${locale}/#skins`}>外观</a><a href={`/${locale}/#about`}>关于</a></nav><span className={styles.prototypeTag}>交互原型</span></header>
    <main><section className="hero"><div className="scene-wallpaper" aria-hidden="true"/><div className="playground"><div className="desktop" style={skinStyle(builtInSkins[0])}>
      <p className="desktop-instruction">这是官网桌面的可交互原型：便签、工具条、Dock 与新增的 Windows 控制方案均可点击。</p>
      <div data-ui="prototype-rail" className={`rail ${railOpen ? "expanded" : "collapsed"}`}><div className="rail-drawer" aria-hidden={!railOpen}>
        <button type="button" className="rail-dismiss" onClick={() => choose("idle")} aria-label="收起便签"><Icon kind="chevron" size={16}/></button>
        <div className="slot-row" role="group" aria-label="便签栏">{cards.map((card) => <PrototypeCard key={card.id} card={card} onCopy={() => setStatus(`已复制「${card.name}」。`)} onRemove={() => { setCards((old) => old.filter((item) => item.id !== card.id)); setStatus(`已移除「${card.name}」。`); }}/>)}</div>
        <div className={styles.railPin}><Pin pinned={pinned} onClick={() => togglePin()}/><span>{pinned ? "已固定" : "450 ms 后收起"}</span></div>
      </div></div>
      <div className={styles.centerStage}>
        {state === "settings" && (
          <Settings pinned={pinned} collect={collect} screenshotKey={screenshotKey} shortcutNotice={shortcutNotice} onPin={() => togglePin()} onCollect={() => toggleCollect()} onClose={() => choose("hover")} onScreenshot={() => add("image")} onShortcutConflict={resolveShortcutConflict}/>
        )}
      </div>
      <div className="desktop-footer"><div className="demo-controls" data-ui="demo-toolbar"><div className="capture-actions"><button type="button" className="button capture-button" onClick={() => add("image")}><Icon kind="camera"/><span className="control-label">截取屏幕</span></button><button type="button" className="button text-button" onClick={() => add("text")}><Icon kind="text"/><span className="control-label">收取文字</span></button></div><div className="demo-utilities"><button type="button" className={`reveal-button ${styles.revealButton}`} aria-expanded={railOpen} onClick={() => choose(railOpen ? "idle" : "hover")}><span className="control-label">{railOpen ? "收起" : "展开"}</span><span className={styles.revealGlyph}><Icon kind="chevron" size={16}/></span></button><button type="button" className="reset-button" onClick={reset}><Icon kind="reset" size={18}/><span className="control-label">重置</span></button></div></div><div className="demo-feedback"><p role="status" aria-live="polite">{status || stateDescriptions[state]}</p></div>
        <div className="desktop-dock" data-ui="desktop-dock"><span className="dock-app dock-files" aria-hidden="true"/><span className="dock-app dock-browser" aria-hidden="true"/>{state === "menu" && <ContextMenu pinned={pinned} collect={collect} onPin={() => togglePin()} onCollect={() => toggleCollect()} onSettings={openSettings} onScreenshot={() => add("image")}/>}<button type="button" className="dock-app dock-snapslot" aria-label="SnapSlot 托盘菜单" onClick={() => choose(state === "menu" ? "hover" : "menu")}><span className="app-symbol" aria-hidden="true"/><i aria-hidden="true"/></button><span className="dock-app dock-notes" aria-hidden="true"/></div>
      </div>
    </div></div></section></main>
    {process.env.NODE_ENV !== "production" && <nav className={styles.stateStrip} aria-label="桌面状态帧">{states.map((item, index) => <button type="button" key={item} aria-pressed={state === item} onClick={() => choose(item)}><small>{String(index + 1).padStart(2, "0")}</small>{stateNames[item]}</button>)}</nav>}
  </>;
}

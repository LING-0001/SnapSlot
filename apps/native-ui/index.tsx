import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { homeCopy, fill } from "../website/lib/home-copy";
import { locales, localeNames, type Locale } from "../website/lib/locales";
import { navigateMenu } from "../website/lib/menu-navigation";
import s from "../website/components/home.module.css";
import {interactionCopy} from "../website/lib/interaction-copy";
import "../website/assets/fonts/fonts.css";
import { send, type Appearance, type AppPreferences, type Message, type NativeItem, type Surface, type Shortcut, type ShortcutTarget, type ShortcutChange } from "./protocol";
import { shortcutCopy } from "./shortcut-copy";
import "./native.css";

const appearances: Appearance[] = ["glass", "paper", "graphite"];
const openShortcut: Shortcut = { key: "Space", control: true, alt: true, shift: false, meta: false };
const defaults: AppPreferences = { collectImages: true, textShortcut: { ...openShortcut, key: "KeyT" }, openShortcut };
function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return <button className={`${s.toggle} ${on ? s.toggleOn : ""}`} role="switch" aria-checked={on} aria-label={label} onClick={onChange}><span/></button>;
}
function Keys({ keys }: { keys: string[] }) { return <span className={s.keys}>{keys.map(key => <kbd key={key}>{key}</kbd>)}</span>; }

function App() {
  const mode = new URLSearchParams(location.search).get("mode") || "rail";
  const [preview,setPreview]=useState<NativeItem|null>(null);
  const [selectionChip,setSelectionChip]=useState<{x:number;y:number}|null>(null);
  const previewRef=useRef<NativeItem|null>(null),previewClose=useRef<HTMLButtonElement>(null),previewTrigger=useRef<HTMLElement|null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [platform, setPlatform] = useState<"macos" | "windows">("macos");
  const [items, setItems] = useState<NativeItem[]>([]);
  const [expanded, setExpanded] = useState(false), [arming, setArming] = useState(false), [pinned, setPinned] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>("glass"), [preferences, setPreferences] = useState(defaults);
  const [count, setCount] = useState(0), [focus, setFocus] = useState(0), [focusRequest, setFocusRequest] = useState(0);
  const [narrow, setNarrow] = useState(() => matchMedia("(max-width: 760px)").matches);
  const [fresh, setFresh] = useState<string[]>([]), [copied, setCopied] = useState(""), [notice, setNotice] = useState("");
  const [shortcutChanges, setShortcutChanges] = useState<ShortcutChange[]>([]);
  const currentPreferences = useRef(defaults);
  const recordingReady = useRef(false);
  const [recording, setRecording] = useState<ShortcutTarget | null>(null), [recordError, setRecordError] = useState("");
  const settingsPanel = useRef<HTMLElement>(null), settingsHeight = useRef(0);
  const dial = useRef<HTMLDivElement>(null), known = useRef(new Map<string, NativeItem>()), initialized = useRef(false);
  const focusId = useRef(""), timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const focusAfterRemoval = useRef(false);
  const wheel = useRef(0), pointer = useRef<{ id: string; x: number; y: number; time: number } | null>(null), dragged = useRef(false);
  const hostPointer = useRef<{ x: number; y: number } | null>(null), wakeSurfaces = useRef<() => void>(() => {});
  const a = homeCopy[locale],interaction=interactionCopy[locale];
  function closePreview(){previewRef.current=null;setPreview(null);setSelectionChip(null);send({type:"closePreview"});previewTrigger.current?.focus({preventScroll:true});}
  function enlarge(item:NativeItem,trigger:HTMLElement){previewRef.current=item;previewTrigger.current=trigger;setPreview(item);send({type:"preview",id:item.id});}
  function collectSelection(){const text=getSelection()?.toString().trim();if(text){if(previewRef.current)closePreview();send({type:"collectText",text});getSelection()?.removeAllRanges();setSelectionChip(null);}}
  useLayoutEffect(()=>{if(preview)previewClose.current?.focus({preventScroll:true});wakeSurfaces.current();},[preview,selectionChip]);
  useEffect(()=>{
    if(mode!=="rail")return;
    const changed=()=>{const selection=getSelection();if(!selection||selection.isCollapsed||!selection.toString().trim()){setSelectionChip(null);return;}const r=selection.getRangeAt(0).getBoundingClientRect();setSelectionChip({x:Math.max(90,Math.min(innerWidth-90,r.x+r.width/2)),y:Math.min(innerHeight-42,r.bottom+8)});};
    document.addEventListener("selectionchange",changed);return()=>document.removeEventListener("selectionchange",changed);
  },[mode]);
  function later(key: string, fn: () => void, ms: number) { clearTimeout(timers.current.get(key)); timers.current.set(key, setTimeout(fn, ms)); }
  function updateHover() {
    const point = hostPointer.current;
    const arm = point ? document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-arm]") : null;
    dial.current?.querySelectorAll<HTMLElement>("[data-arm]").forEach(node => node.classList.toggle("host-hover", node === arm));
    if (mode === "tray") {
      const item = point ? document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>(".native-menu button") : null;
      document.querySelectorAll<HTMLElement>(".native-menu button").forEach(node => node.classList.toggle("host-hover", node === item));
    }
  }
  useEffect(() => {
    function receive(message: Message) {
      if (message.type === "state") {
        const previous = known.current;
        const next = message.items.map(item => ({ ...item, text: item.text ?? previous.get(item.id)?.text, preview: item.preview ?? previous.get(item.id)?.preview }));
        const arrivals = next.filter(item => !previous.has(item.id));
        setItems(next); setCount(message.count);
        if(previewRef.current && !next.some(item=>item.id===previewRef.current?.id)){previewRef.current=null;setPreview(null);send({type:"closePreview"});} setExpanded(message.expanded); setArming(message.arming); setPinned(message.pinned);
        if (message.platform) setPlatform(message.platform);
        if (locales.includes(message.locale as Locale)) setLocale(message.locale as Locale);
        if (appearances.includes(message.appearance)) setAppearance(message.appearance);
        document.documentElement.classList.toggle("reduce-motion", message.reducedMotion);
        // Keep the selected card stable through incremental state updates and removals.
        const selected = next.findIndex(item => item.id === focusId.current);
        const nextFocus = arrivals.length ? next.length - 1 : selected >= 0 ? selected : Math.max(0, next.length - 1);
        setFocus(nextFocus); focusId.current = next[nextFocus]?.id || "";
        if (initialized.current && arrivals.length) {
          setFresh(arrivals.map(item => item.id)); later("fresh", () => setFresh([]), 1400);
        }
        initialized.current = true; known.current = new Map(next.map(item => [item.id, item]));
        if (message.focus) setFocusRequest(value => value + 1);
      } else if (message.type === "preferences") { currentPreferences.current = message.value; setPreferences(message.value); setPlatform(message.platform); setShortcutChanges(message.shortcutChanges || []); }
      else if (message.type === "recordingCancelled") { recordingReady.current = false; setRecording(null); }
      else if (message.type === "recordingReady") { recordingReady.current = true; }
      else if (message.type === "shortcutKey") { window.dispatchEvent(new KeyboardEvent(message.down ? "keydown" : "keyup", { code: message.code, key: message.key, ctrlKey: message.control, altKey: message.alt, shiftKey: message.shift, metaKey: message.meta, repeat: message.repeat, bubbles: true })); }
      else if (message.type === "copied") { setCopied(message.id); later("copied", () => setCopied(""), 1400); }
      else if (message.type === "pointer") {
        hostPointer.current = message.x !== null && message.y !== null ? { x: message.x, y: message.y } : null;
        updateHover(); wakeSurfaces.current();
      } else if (message.type === "error") { setNotice(message.message); later("notice", () => setNotice(""), 7000); }
    }
    const receiveWebView = (event: { data: Message }) => receive(event.data);
    window.snapslotReceive = receive; window.chrome?.webview?.addEventListener("message", receiveWebView); send({ type: "ready" });
    return () => { delete window.snapslotReceive; window.chrome?.webview?.removeEventListener("message", receiveWebView); timers.current.forEach(clearTimeout); };
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  useLayoutEffect(() => {
    focusId.current = items[focus]?.id || ""; updateHover(); wakeSurfaces.current();
    if (focusAfterRemoval.current) { focusAfterRemoval.current = false; dial.current?.querySelector<HTMLButtonElement>("[data-focus='true']")?.focus({ preventScroll: true }); }
  }, [items, focus, expanded, arming, appearance, narrow]);
  useEffect(() => { if (focusRequest && !previewRef.current) dial.current?.querySelector<HTMLButtonElement>("[data-focus='true']")?.focus({ preventScroll: true }); }, [focusRequest]);

  // A WKWebView cannot blur the desktop outside its own document. Supply the
  // animated card geometry to AppKit's behind-window material, below the web view.
  useEffect(() => {
    if (mode !== "rail") return;
    let frame = 0, until = 0, last = "", disposed = false;
    const measure = () => {
      frame = 0;
      const node = dial.current;
      const surfaces: Surface[] = [];
      if (node) {
        const dialOpacity = Number(getComputedStyle(node).opacity);
        node.querySelectorAll<HTMLElement>("[data-arm]").forEach(arm => {
          const face = arm.querySelector<HTMLElement>("[data-note]")!, card = face.parentElement!;
          const style = getComputedStyle(arm), rect = face.getBoundingClientRect();
          const rotation = new DOMMatrix(style.transform), scale = new DOMMatrix(getComputedStyle(card).transform);
          const opacity = dialOpacity * Number(style.opacity) * Number(getComputedStyle(card).opacity);
          if (opacity < .01 || rect.bottom < 0 || rect.top > innerHeight || arm.getAttribute("aria-hidden") === "true") return;
          const size = Math.hypot(scale.a, scale.b) * (parseFloat(getComputedStyle(card).scale) || 1);
          surfaces.push({ id: arm.dataset.arm!, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: face.offsetWidth * size, height: face.offsetHeight * size, angle: Math.atan2(rotation.b, rotation.a) * 180 / Math.PI, opacity });
        });
      }
      document.querySelectorAll<HTMLElement>("[data-native-region]").forEach(node=>{
        const r=node.getBoundingClientRect();surfaces.push({id:node.dataset.nativeRegion!,x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,angle:0,opacity:1});
      });
      const value = JSON.stringify(surfaces);
      if (value !== last) { last = value; send({ type: "surfaces", surfaces }); }
      if (!disposed && performance.now() < until) frame = requestAnimationFrame(measure);
    };
    const wake = () => { until = performance.now() + 850; if (!frame) frame = requestAnimationFrame(measure); };
    wakeSurfaces.current = wake; wake(); addEventListener("resize", wake);
    return () => { disposed = true; cancelAnimationFrame(frame); removeEventListener("resize", wake); wakeSurfaces.current = () => {}; };
  }, [mode, appearance]);
  useEffect(() => {
    const node = dial.current; if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation(); wheel.current += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(wheel.current) < 40) return;
      const by = Math.sign(wheel.current); wheel.current = 0;
      setFocus(value => Math.min(Math.max(value + by, 0), known.current.size - 1));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if(event.key==="Escape"&&!recording){event.preventDefault();if(previewRef.current)closePreview();else send({type:mode==="rail"?"collapse":"close"});}
      if(mode==="rail"&&event.ctrlKey&&event.altKey&&event.code==="KeyT"&&getSelection()?.toString().trim()){event.preventDefault();collectSelection();}
    };
    addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey);
  }, [mode, recording]);
  useEffect(() => {
    if (!recording) return;
    recordingReady.current = false;
    let candidate: Shortcut | null = null;
    const copy = shortcutCopy[locale];
    const down = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!recordingReady.current) return;
      if (event.key === "Escape") { setRecording(null); return; }
      if (event.repeat || /^(Control|Alt|Shift|Meta)(Left|Right)$/.test(event.code)) return;
      candidate = null;
      if (!/^(Key[A-Z]|Digit[0-9]|Space|F([1-9]|10|11))$/.test(event.code) || !(event.ctrlKey || event.altKey || event.metaKey)) { setRecordError(copy.invalid.replaceAll("Control", platform === "windows" ? "Ctrl" : "Control").replaceAll("Option", platform === "windows" ? "Alt" : "Option").replaceAll("Command", platform === "windows" ? "Win" : "Command")); return; }
      const value = { key: event.code, control: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey };
      if (value.key === "KeyC" && !value.alt && !value.shift && value.control !== value.meta) { setRecordError(copy.copyReserved); return; }
      setRecordError(""); candidate = value;
    };
    const up = (event: KeyboardEvent) => {
      if (!candidate || event.code !== candidate.key) return;
      event.preventDefault(); event.stopImmediatePropagation();
      // Register after the key is released, so recording does not trigger its action.
      send({ type: "savePreferences", value: { ...currentPreferences.current, [recording === "text" ? "textShortcut" : "openShortcut"]: candidate }, editingShortcut: recording });
      candidate = null; setRecording(null);
    };
    const cancel = () => setRecording(null);
    const outside = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest(`[data-shortcut-row="${recording}"]`)) cancel(); };
    send({ type: "beginShortcutRecording" });
    addEventListener("keydown", down, true); addEventListener("keyup", up, true); addEventListener("blur", cancel); addEventListener("pointerdown", outside, true);
    return () => { recordingReady.current = false; removeEventListener("keydown", down, true); removeEventListener("keyup", up, true); removeEventListener("blur", cancel); removeEventListener("pointerdown", outside, true); send({ type: "endShortcutRecording" }); };
  }, [recording, platform]);
  useLayoutEffect(() => {
    if (!settingsPanel.current) return;
    const body = settingsPanel.current.querySelector<HTMLElement>(`.${s.windowBody}`)!;
    const header = settingsPanel.current.querySelector<HTMLElement>("header")!;
    const height = Math.ceil(header.offsetHeight + body.scrollHeight);
    if (height !== settingsHeight.current) { settingsHeight.current = height; send({ type: "resizePreferences", height }); }
  }, [platform, shortcutChanges, recording, recordError, locale]);
  const savePreferences = (next: AppPreferences) => send({ type: "savePreferences", value: next });
  const togglePin = () => send({ type: pinned ? "unpin" : "pin" });
  const closeMenu = () => send({ type: "close" });
  const mac = platform === "macos";
  const keys = (value: AppPreferences["textShortcut"]) => [value.control ? (mac ? "⌃" : "Ctrl") : "", value.alt ? (mac ? "⌥" : "Alt") : "", value.shift ? (mac ? "⇧" : "Shift") : "", value.meta ? (mac ? "⌘" : "Win") : "", value.key.replace(/^Key|^Digit/, "")].filter(Boolean);
  const shortcutRow = (target: ShortcutTarget, title: string, value: Shortcut) => {
    const copy = shortcutCopy[locale], change = shortcutChanges.find(change => change.target === target);
    const conflict = change ? copy.conflict.replace("{old}", keys(change.requested).join(" + ")).replace("{new}", keys(change.replacement).join(" + ")) : "";
    const hint = [conflict, recording === target ? recordError || copy.hint : ""].filter(Boolean).join(" ");
    return <div className="native-shortcut-row" data-shortcut-row={target}><div className={s.row} data-settings-row><span>{title}</span>
      {<button className="native-shortcut" aria-label={`${title} · ${copy.change}`} aria-pressed={recording === target} title={copy.change} onClick={() => { setRecordError(""); setRecording(recording === target ? null : target); }}>
        {change && <svg className="native-shortcut-warning" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.5v4M8 11v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        {recording === target ? <span>{copy.record}</span> : <><Keys keys={keys(value)}/><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m10.5 2.5 3 3M3 10l7-7a2.12 2.12 0 0 1 3 3l-7 7-4 1 1-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></>}
      </button>}
    </div>{hint && <p className="native-shortcut-hint" role="status" aria-live="polite">{hint}</p>}</div>;
  };
  const remove = (item: NativeItem, index: number) => {
    const next = items[index - 1] || items[index + 1]; focusId.current = next?.id || "";
    focusAfterRemoval.current = !!document.activeElement?.closest("[data-arm]");
    send({ type: "remove", id: item.id });
  };
  const select = (index: number, keyboard = false) => {
    setFocus(index); focusId.current = items[index]?.id || "";
    if (keyboard) later("focus", () => dial.current?.querySelector<HTMLButtonElement>(`[data-index='${index}']`)?.focus({ preventScroll: true }), 0);
  };
  return <main className={`${s.page} ${s.embedded} native-page`} data-skin={appearance}>
    <div className={`${s.stage} native-surface`} data-os={mac ? "mac" : "win"} data-mode={mode} data-density="regular">
      {mode === "tray" ? <div className={`${s.trayMenu} native-menu`} role="menu" aria-label="SnapSlot" onKeyDown={navigateMenu}>
        <button role="menuitem" onClick={() => send({ type: "openPreferences" })}><span className={s.check}/>{a.menu.settings}</button><hr/>
        <button role="menuitemcheckbox" aria-checked={preferences.collectImages} onClick={() => { savePreferences({ ...preferences, collectImages: !preferences.collectImages }); closeMenu(); }}><span className={s.check}>{preferences.collectImages ? "✓" : ""}</span>{a.menu.intake}</button>
        <button role="menuitemcheckbox" aria-checked={pinned} onClick={() => { togglePin(); closeMenu(); }}><span className={s.check}>{pinned ? "✓" : ""}</span>{a.menu.pin}</button>
        <hr/>
        <button role="menuitem" onClick={() => send({ type: "quit" })}><span className={s.check}/>{a.menu.quit}</button>
      </div> : mode !== "rail" ? <section ref={settingsPanel} className={`${s.window} native-window`} onPointerDown={event => { if (event.button === 0 && !(event.target as HTMLElement).closest("button, select, input, a, [role=switch], [data-swatch], [data-shortcut-row]")) send({ type: "moveWindow" }); }} role="dialog" aria-label={a.settings.title}>
        <header className={s.windowBar} data-drag-region>
          {mac ? <span className={s.lights}><button onClick={() => send({ type: "close" })} aria-label={a.settings.close}/><button onClick={() => send({ type: "minimizePreferences" })} aria-label={shortcutCopy[locale].minimize}/><i/></span> : <span className={s.mark} style={{width:20,height:20}} aria-hidden="true"/>}
          <span>{a.settings.title}</span>
          {!mac && <span className="native-window-controls"><button className="native-minimize" onClick={() => send({ type: "minimizePreferences" })} aria-label={shortcutCopy[locale].minimize}>−</button><button className={s.windowClose} onClick={() => send({ type: "close" })} aria-label={a.settings.close}>×</button></span>}
        </header>
        <div className={s.windowBody}>
          <div className={s.row} data-settings-row><span>{a.menu.intake}<small>{a.settings.intakeHint}</small></span><Toggle on={preferences.collectImages} label={a.menu.intake} onChange={() => savePreferences({ ...preferences, collectImages: !preferences.collectImages })}/></div>
          <div className={s.row} data-settings-row><span>{a.menu.pin}<small>{a.settings.pinHint}</small></span><Toggle on={pinned} label={a.menu.pin} onChange={togglePin}/></div>
          <div className={s.row} data-settings-row><span>{a.settings.look}</span><span className={s.miniSkins}>{appearances.map((option, index) => <button key={option} className={`${s.miniSkin} ${appearance === option ? s.miniSkinOn : ""}`} data-swatch={option} onClick={() => send({ type: "setAppearance", value: option })} aria-label={a.skins[index]} aria-pressed={appearance === option}/>)}</span></div>
          <label className={s.row} data-settings-row><span>{a.settings.language}</span><select className={s.select} value={locale} onChange={event => send({ type: "setLocale", value: event.target.value })}>{locales.map(value => <option key={value} value={value} lang={value}>{localeNames[value]}</option>)}</select></label>
          {shortcutRow("text", a.settings.pinText, preferences.textShortcut)}
          {shortcutRow("open", a.settings.openNotes, preferences.openShortcut || openShortcut)}
          <div className={s.row} data-settings-row><span>{fill(a.settings.count, count)}</span><button className={s.danger} disabled={!count} onClick={() => send({ type: "clearNotes" })}>{a.settings.clear}</button></div>
        </div>
      </section> : <>
        <div className={`${s.edgeGlow} ${arming ? s.edgeArming : ""}`} aria-hidden="true"><i/></div>
        <div ref={dial} className={`${s.dial} ${expanded ? s.dialOpen : ""} ${arming ? s.dialArming : ""}`} role="list" aria-label={a.stage.list} inert={!expanded} aria-hidden={!expanded}>
          {items.map((item, index) => {
            const d = index - focus, reach = 1.25, hidden = Math.abs(d) > reach;
            const Face=item.kind==="text"?"div":"button";
            return <div key={item.id} role="listitem" data-arm={item.id} data-kind={item.kind} className={`${s.arm} ${item.kind === "text" ? s.textNote : ""} ${fresh.includes(item.id) ? s.fresh : ""} ${d === 0 ? s.current : ""}`} aria-hidden={hidden} style={{ "--d": d, "--ad": Math.abs(d), zIndex: 50 - Math.round(Math.abs(d) * 2), opacity: hidden ? 0 : 1 - Math.max(Math.abs(d) - reach + 1, 0) * .7, pointerEvents: hidden ? "none" : undefined } as React.CSSProperties}>
              <div className={s.card}><span className={s.pin} aria-hidden="true"/>
                <Face role={item.kind==="text"?"button":undefined} draggable className={s.face} data-note={item.id} data-index={index} data-focus={d === 0} tabIndex={d === 0 ? 0 : -1}
                  aria-label={item.kind === "text" ? a.stage.copyText + (item.text || "").slice(0, 20) : a.stage.copyImage + item.title}
                  onPointerDown={event => { dragged.current = false; pointer.current = { id: item.id, x: event.clientX, y: event.clientY, time: performance.now() }; }}
                  onPointerMove={event => { const start = pointer.current; if (!getSelection()?.toString().trim() && start?.id === item.id && event.buttons === 1 && !dragged.current && performance.now() - start.time >= 160 && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) { dragged.current = true; pointer.current = null; send({ type: "drag", id: item.id }); } }}
                  onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} onDragStart={event => {event.preventDefault();if(dragged.current)return;dragged.current=true;pointer.current=null;const text=getSelection()?.toString().trim();if(text)send({type:"dragText",text});else send({type:"drag",id:item.id});}}
                  onClick={() => { if (!dragged.current && !getSelection()?.toString().trim()) { select(index); send({ type: "copy", id: item.id }); } dragged.current = false; }}
                  onKeyDown={event => {
                    if(event.ctrlKey||event.altKey||event.metaKey)return;
                    if(event.key===" "){event.preventDefault();enlarge(item,event.currentTarget);return;}
                    if(event.key==="Enter"){event.preventDefault();send({type:"copy",id:item.id});return;}
                    if (event.key === "ArrowRight" && index < items.length - 1) select(index + 1, true);
                    else if (event.key === "ArrowLeft" && index > 0) select(index - 1, true);
                    else if (event.key === "Delete" || event.key === "Backspace") remove(item, index);
                    else return; event.preventDefault();
                  }}>
                  {item.kind === "image" ? <><span className={s.photo} style={{ backgroundImage: `url("${item.preview}")` }}/><span className={s.photoCaption}><i/>{item.title}</span></> : <span className={s.noteText} data-note-text>{item.text}</span>}
                  <span className={`${s.copied} ${copied === item.id ? s.copiedOn : ""}`} role={copied===item.id?"status":undefined} aria-hidden={copied!==item.id}>{a.stage.copied}</span>
                </Face><button className={s.enlarge} aria-label={interaction.zoom} title={interaction.zoom} onClick={event=>enlarge(item,event.currentTarget)} tabIndex={d===0?0:-1}><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="m13 13 4 4M6 8.5h5M8.5 6v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button><button className={s.remove} aria-label={a.stage.remove} tabIndex={-1} onClick={() => remove(item, index)}>×</button>
              </div>
            </div>;
          })}
          {!items.length && <p className={s.emptyFan}>{a.stage.empty}</p>}
          {items.length > 1 && <p className={s.counter} data-native-counter aria-hidden="true">{pinned && <span className={s.pinnedDot}/ >}{focus + 1} / {items.length}</p>}
        </div>
      </>}
      {mode==="rail" && preview && <section className={`${s.notePreview} native-preview`} role="dialog" aria-label={interaction.zoom} data-native-region="__preview"><header><b>{interaction.zoom}</b><button ref={previewClose} aria-label={a.settings.close} onClick={closePreview}>×</button></header><div className={s.previewContent} data-preview-content>{preview.kind==="image"?<img src={preview.preview} alt={preview.title}/>:<p>{preview.text}</p>}</div></section>}
      {mode==="rail" && selectionChip && <button className="native-selection" data-native-region="__selection" style={{left:selectionChip.x,top:selectionChip.y}} onMouseDown={event=>event.preventDefault()} onClick={collectSelection}>{a.chip}</button>}
      <p className={`${s.notice} ${notice ? s.noticeOn : ""} native-notice`} role="status" aria-live="polite">{notice}</p>
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);

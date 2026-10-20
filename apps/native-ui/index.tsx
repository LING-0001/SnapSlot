import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { messages, locales, type Locale } from "../website/lib/messages";
import { siteCopy } from "../website/lib/site-copy";
import { builtInSkins, parseSkin, skinStyle, type Skin } from "../website/lib/skin";
import { SkinEditor } from "../website/components/skin-editor";
import { nativeCopy } from "./copy";
import { send, type AppPreferences, type HostMessage, type NativeItem } from "./protocol";
import { PreferencesPanel } from "./preferences";
import "../website/app/globals.css";
import "./native.css";

function Icon({ kind }: { kind: string }) {
  const paths: Record<string, React.ReactNode> = {
    copy: <><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 4H4v12"/></>,
    capture: <><rect x="3" y="6" width="18" height="15" rx="3"/><circle cx="12" cy="13" r="4"/><path d="m8 6 1-3h6l1 3"/></>,
    text: <path d="M4 5h16M12 5v15M8 20h8M4 5v3m16-3v3"/>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 17 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="1"/></>,
    skin: <><path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3-4-6-9-6Z"/><path d="M7 9h.01M10 6h.01M15 6h.01M5 13h.01"/></>,
    paste: <><path d="M8 5H5v16h14V5h-3"/><rect x="8" y="2" width="8" height="5" rx="1"/><path d="M9 12h6m-6 4h6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    collapse: <path d="m6 15 6-6 6 6"/>,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] || paths.copy}</svg>;
}
function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [items, setItems] = useState<NativeItem[]>([]);
  const [skin, setSkin] = useState<Skin>(builtInSkins[0]);
  const [expanded, setExpanded] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [text, setText] = useState("");
  const [removals, setRemovals] = useState<{id:string;x:number;y:number}[]>([]);
  const [preferences,setPreferences]=useState<AppPreferences|null>(null),[platform,setPlatform]=useState<"macos"|"windows">("macos"),[preferencesRevision,setPreferencesRevision]=useState(0);
  const mode = new URLSearchParams(location.search).get("mode") || "rail";
  const row = useRef<HTMLDivElement>(null);
  const focusNext = useRef(false);
  const positions = useRef<Map<string,number>>(new Map());
  const animations = useRef<Animation[]>([]);
  const dragging = useRef(false);
  const pointer = useRef<{id:string;x:number;y:number;time:number} | null>(null);
  const hostPointer = useRef<{x:number;y:number}|null>(null);
  function updateHover() {
    const point=hostPointer.current;
    const card=point?document.elementFromPoint(point.x,point.y)?.closest<HTMLElement>("[data-card]"):null;
    row.current?.querySelectorAll<HTMLElement>("[data-card]").forEach(node=>node.classList.toggle("host-hover",node===card));
  }
  const m = messages[locale], copy = siteCopy[locale], labels = nativeCopy(locale);
  const currentSkin = useRef(skin); currentSkin.current = skin;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn:()=>void, ms:number) => { timers.current.push(setTimeout(fn,ms)); };
  useEffect(() => {
    function receive(message:HostMessage) {
      if (message.type === "state") {
        setItems(old=>{
          const known=new Map(old.map(item=>[item.id,item]));
          const next=message.items.map(item=>({...item,text:item.text??known.get(item.id)?.text,preview:item.preview??known.get(item.id)?.preview}));
          return old.length===next.length && old.every((item,index)=>item.id===next[index].id&&item.text===next[index].text&&item.preview===next[index].preview&&item.title===next[index].title) ? old : next;
        }); setExpanded(message.expanded);
        if (locales.includes(message.locale as Locale)) setLocale(message.locale as Locale);
        document.documentElement.classList.toggle("reduce-motion",message.reducedMotion);
        focusNext.current = !!message.focus;
        if(message.focus)setFocusRequest(value=>value+1);
        try { if(typeof message.skin === "string")setSkin(parseSkin(message.skin)); setNotice(""); } catch (error) { setNotice(String(error)); }
      } else if(message.type === "preferences") {
        setPreferences(old=>JSON.stringify(old)===JSON.stringify(message.value)?old:message.value);setPlatform(message.platform);setPreferencesRevision(value=>value+1);setNotice("");
      } else if (message.type === "pointer") {
        hostPointer.current=message.x!==null&&message.y!==null?{x:message.x,y:message.y}:null;updateHover();
      } else if (message.type === "skin") {
        try { const next=parseSkin(message.source);setSkin(next);setNotice("");send({type:"applySkin",source:JSON.stringify(next)}); }
        catch(error) { setNotice(String(error)); }
      } else if(message.type === "error") {setNotice(message.message);setPreferencesRevision(value=>value+1);}
      else if(message.type === "copied") { setCopied(message.id);later(()=>setCopied(""),1400); }
    }
    window.snapslotReceive=receive;
    window.chrome?.webview?.addEventListener("message",event=>receive(event.data));
    send({type:"ready"});
    return ()=>{ delete window.snapslotReceive;timers.current.forEach(clearTimeout);animations.current.forEach(animation=>animation.cancel()); };
  },[]);
  useLayoutEffect(()=>{
    const cards=[...row.current?.querySelectorAll<HTMLElement>("[data-card]") || []];
    animations.current.forEach(animation=>animation.cancel());animations.current=[];
    const next=new Map<string,number>();
    for(const card of cards) {
      const x=card.offsetLeft;next.set(card.dataset.card!,x);
      const before=positions.current.get(card.dataset.card!);
      if(before!==undefined && Math.abs(before-x)>.5 && !document.documentElement.classList.contains("reduce-motion") && !matchMedia("(prefers-reduced-motion:reduce)").matches)
        animations.current.push(card.animate([{transform:`translateX(${before-x}px)`},{transform:"none"}],{duration:180,easing:"cubic-bezier(.22,1,.36,1)"}));
    }
    const arrived=cards.find(card=>!positions.current.has(card.dataset.card!));
    if(arrived && row.current)row.current.scrollLeft=Math.max(0,arrived.offsetLeft-row.current.clientWidth+arrived.offsetWidth+12);
    positions.current=next;
    updateHover();
    if(focusNext.current) { focusNext.current=false;row.current?.querySelector<HTMLButtonElement>(".card-copy")?.focus({preventScroll:true}); }
  },[items,expanded,focusRequest]);
  useEffect(()=>{ if(notice) { const timer=setTimeout(()=>setNotice(""),7000);return()=>clearTimeout(timer); } },[notice]);
  useEffect(()=>{ document.documentElement.lang=locale; },[locale]);
  function applySkin(next:Skin) { setSkin(next);send({type:"applySkin",source:JSON.stringify(next)}); }
  function remove(item:NativeItem) {
    const card=row.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(item.id)}"]`);
    if(card) {
      const removal={id:item.id,x:card.offsetLeft,y:card.offsetTop};
      setRemovals(old=>[...old,removal]);later(()=>setRemovals(old=>old.filter(value=>value.id!==item.id)),190);
    }
    const index=items.findIndex(value=>value.id===item.id);
    const next=items[index+1] || items[index-1];
    setItems(old=>old.filter(value=>value.id!==item.id));send({type:"remove",id:item.id});
    if(card?.contains(document.activeElement)) later(()=>{
      if(next)row.current?.querySelector<HTMLButtonElement>(`[data-card="${CSS.escape(next.id)}"] .card-copy`)?.focus();
      else document.querySelector<HTMLButtonElement>(".native-tool")?.focus();
    },0);
  }
  if(mode === "preferences")return <PreferencesPanel value={preferences} platform={platform} locale={locale} revision={preferencesRevision} notice={notice} onSave={value=>{setNotice("");send({type:"savePreferences",value});}} onClose={()=>send({type:"close"})}/>;
  if(mode === "settings") return <main className="native-settings">
    <SkinEditor locale={locale} m={m} skin={skin} onChange={applySkin} open onClose={()=>send({type:"close"})} onExport={()=>send({type:"exportSkin",source:JSON.stringify(skin)})} footer={<div className="native-folder"><button onClick={()=>send({type:"openSkinFolder"})}>{labels.folder}</button><span>{labels.skinHint}</span></div>}/>
    {notice && <p className="native-notice" role="status">{labels.skinError}{notice}</p>}
  </main>;
  if(mode === "text") return <main className="native-text"><h1>{m.addText}</h1><textarea autoFocus value={text} onChange={event=>setText(event.target.value)} aria-label={m.addText} onKeyDown={event=>{
    if(event.key==="Escape")send({type:"close"});
    if(event.key==="Enter"&&(event.metaKey||event.ctrlKey)) {event.preventDefault();if(text.trim()&&new TextEncoder().encode(text).length<=65536)send({type:"saveText",text});}
  }}/><div className="native-text-actions"><button onClick={()=>send({type:"close"})}>{labels.cancel}</button><button className="primary button" disabled={!text.trim()||new TextEncoder().encode(text).length>65536} onClick={()=>send({type:"saveText",text})}>{labels.save}</button></div>{new TextEncoder().encode(text).length>65536 && <p role="alert">{labels.tooLarge}</p>}</main>;
  return <main className="native-root" style={skinStyle(skin)} onKeyDown={event=>{
    if(event.key==="Escape"){event.preventDefault();send({type:"collapse"});}else send({type:"pin"});
  }}>
    <div className={`rail ${expanded?"expanded":"collapsed"}`} data-ui="native-notes">
      <div className="rail-drawer" inert={!expanded} aria-hidden={!expanded}>
        <div ref={row} className="slot-row" role="group" aria-label={m.demoLabel} onScroll={updateHover} onWheel={event=>{if(row.current&&!event.ctrlKey&&!event.shiftKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX))row.current.scrollLeft+=event.deltaY*(event.deltaMode===1?20:1);}}>
          {items.map((item,index)=><div className={`capture-card ${item.kind}`} data-card={item.id} key={item.id}>
            <span className="card-pin" aria-hidden="true"><i/><b/></span>
            <button className="card-copy" aria-label={`${m.copy}: ${item.title}`} onClick={()=>{if(!dragging.current)send({type:"copy",id:item.id});dragging.current=false;}}
              onPointerDown={event=>{dragging.current=false;pointer.current={id:item.id,x:event.clientX,y:event.clientY,time:performance.now()};}}
              onPointerMove={event=>{const start=pointer.current;if(!start||start.id!==item.id||event.buttons!==1||dragging.current)return;if(performance.now()-start.time>=160&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>=6){dragging.current=true;pointer.current=null;send({type:"drag",id:item.id});}}}
              onPointerUp={()=>{pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}} onDragStart={event=>event.preventDefault()}
              onKeyDown={event=>{if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();remove(item);}if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();const next=(index+(event.key==="ArrowLeft"?-1:1)+items.length)%items.length;row.current?.querySelector<HTMLButtonElement>(`[data-card="${CSS.escape(items[next].id)}"] .card-copy`)?.focus();}}}>
              {item.kind==="image"?<span className="sample-artwork" role="img" aria-label={item.title} style={{backgroundImage:`url("${item.preview}")`}}/>:<div className="text-preview"><strong>{item.title}</strong>{(item.text || "").slice(0,180).split("\n").slice(1,4).map((line,i)=><p key={i}>{line || "\u00a0"}</p>)}</div>}
              <span className="copy-overlay"><Icon kind="copy"/>{copied===item.id?m.copied:m.copy}</span>
            </button>
            <button className="card-remove" aria-label={`${m.remove}: ${item.title}`} onClick={()=>remove(item)}><Icon kind="close"/></button>
          </div>)}
          {removals.map(item=><div key={item.id} className="fragments" aria-hidden="true" style={{left:item.x,top:item.y}}>{Array.from({length:12},(_,i)=><i key={i} style={{"--x":`${i%4*28}px`,"--y":`${Math.floor(i/4)*24}px`,"--fragment":["#eabd42","#a7c8ae","#f6f4ed","#6e96ad"][i%4]} as React.CSSProperties}/>)}</div>)}
          {!items.length&&<button className="empty-slot" onClick={()=>send({type:"capture"})}><Icon kind="capture"/><span>{m.empty}</span></button>}
        </div>
        <div className="native-tools" data-ui="native-toolbar">
          {([["capture",m.addImage],["newText",m.addText],["paste",labels.paste],["addImages",labels.importImages],["appearance",copy.customize],["collapse",m.collapse]] as const).map(([type,label])=><button className="native-tool" key={type} title={label} aria-label={label} onClick={()=>send({type})}><Icon kind={{capture:"capture",newText:"text",paste:"paste",addImages:"image",appearance:"skin",collapse:"collapse"}[type]}/></button>)}
        </div>
      </div>
    </div>
    {notice&&<p className="native-notice" role="status">{notice}</p>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);

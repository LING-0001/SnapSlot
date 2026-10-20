"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { edgeHints, localeNames, locales, type Locale, type Messages } from "@/lib/messages";
import { useRailReveal } from "./use-rail-reveal";
import { builtInSkins, isSameSkin, skinStyle, type Skin } from "@/lib/skin";
import { siteCopy } from "@/lib/site-copy";
import { SkinEditor, SkinPreview } from "./skin-editor";
import { SampleArtwork } from "./sample-artwork";
import { UsageGuide } from "./usage-guide";

type Card = { id: number; kind: "image" | "text"; art: string; name: string };
function Symbol({ kind, size = 20 }: { kind: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    up: <path d="M12 19V5m-6 6 6-6 6 6" />,
    camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></>,
    text: <><path d="M5 5h14M12 5v15M8 20h8M5 5v3m14-3v3"/></>,
    copy: <><path d="M8 8h12v12H8zM4 16V4h12"/></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    windows: <><path d="M3 4h8v8H3zm10 0h8v8h-8zM3 14h8v8H3zm10 0h8v8h-8z" fill="currentColor" stroke="none"/></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-.6a1.4 1.4 0 0 1 0-2.8H15a6 6 0 0 0 6-6c0-3.3-4-5.2-9-5.2Z"/><circle cx="7" cy="10" r=".8"/><circle cx="10" cy="7" r=".8"/><circle cx="15" cy="7" r=".8"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "small" : ""}`}><span className="brand-logo" aria-hidden="true"/><span>SnapSlot</span></span>;
}

function LanguagePicker({ locale, label }: { locale: Locale; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function move(index: number) {
    root.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitemradio"]')[index]?.focus();
  }
  useEffect(() => { if (open) move(locales.indexOf(locale)); }, [open, locale]);
  return <div className="language-picker" ref={root}
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    onKeyDown={(e) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
    <button ref={trigger} className="language-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls="language-menu"
      onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}>
      <Symbol kind="globe" size={16}/><span>{localeNames[locale]}</span><Symbol kind="chevron" size={12}/>
    </button>
    {open && <div className="language-menu" id="language-menu" role="menu" aria-label={label}>
      {locales.map((l, index) => <a key={l} href={`/${l}/`} lang={l} role="menuitemradio" aria-checked={l === locale}
        onClick={(e) => { if (l === locale) { e.preventDefault(); setOpen(false); trigger.current?.focus(); } }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move((index + (e.key === "ArrowDown" ? 1 : -1) + locales.length) % locales.length); }
          if (e.key === "Home") { e.preventDefault(); move(0); }
          if (e.key === "End") { e.preventDefault(); move(locales.length - 1); }
          if (e.key === " ") { e.preventDefault(); e.currentTarget.click(); }
        }}><span>{localeNames[l]}</span><span aria-hidden="true">{l === locale ? <span className="selected-mark" aria-hidden="true"/> : null}</span></a>)}
    </div>}
  </div>;
}

function RailDemo({ m, locale, skin, onCustomize, children }: { m: Messages; locale: Locale; skin: Skin; onCustomize: () => void; children: ReactNode }) {
  const labels = siteCopy[locale];
  const seed = (): Card[] => [
    { id: 1, kind: "image", art: "/mountains.svg", name: m.sampleImage },
    { id: 2, kind: "text", art: "", name: m.sampleText },
    { id: 3, kind: "image", art: "/studio.svg", name: m.samplePhoto },
  ];
  const [cards, setCards] = useState<Card[]>(seed);
  const { expanded, desktop, rail, handle, reveal, collapse, peek, pin, unpin } = useRailReveal(true);
  const [removals, setRemovals] = useState<{ id: number; x: number; y: number; width: number; height: number }[]>([]);
  const [status, setStatus] = useState("");
  const [arrival, setArrival] = useState<number | null>(null);
  const nextId = useRef(4);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const copyButtons = useRef<Map<number, HTMLButtonElement>>(new Map());
  const rowRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Map<string, number> | null>(null);
  const motion = useRef<Animation[]>([]);
  const focusAfterRemoval = useRef<{ id?: number } | null>(null);

  useLayoutEffect(() => {
    const previous = positions.current;
    positions.current = null;
    motion.current.forEach((animation) => animation.cancel());
    motion.current = [];
    if (previous && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rowRef.current?.querySelectorAll<HTMLElement>("[data-card]").forEach((element) => {
        const before = previous.get(element.dataset.card!);
        const delta = before === undefined ? 0 : before - element.getBoundingClientRect().left;
        if (Math.abs(delta) > .5) motion.current.push(element.animate([
          { transform: `translateX(${delta}px)` }, { transform: "translateX(0)" },
        ], { duration: 180, easing: "cubic-bezier(.22,1,.36,1)" }));
      });
    }
    if (focusAfterRemoval.current) {
      const next = focusAfterRemoval.current.id;
      (next === undefined ? handle.current : copyButtons.current.get(next) || handle.current)?.focus({ preventScroll: true });
      focusAfterRemoval.current = null;
    }
  }, [cards, handle]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); motion.current.forEach((animation) => animation.cancel()); }, []);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    // Keep trackpad/touch scrolling native. A plain mouse wheel moves the row
    // only while it has room in that direction; at either end the page scrolls.
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? row.clientWidth : 1);
      const maximum = row.scrollWidth - row.clientWidth;
      if ((delta > 0 && row.scrollLeft < maximum - 1) || (delta < 0 && row.scrollLeft > 1)) {
        event.preventDefault();
        row.scrollLeft += delta;
      }
    };
    row.addEventListener("wheel", wheel, { passive: false });
    return () => row.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    if (!expanded || !arrival) return;
    const row = rail.current?.querySelector<HTMLDivElement>(".slot-row");
    const card = row?.querySelector<HTMLElement>(`[data-card="${arrival}"]`);
    if (row && card) row.scrollLeft = Math.max(0, card.offsetLeft - row.clientWidth + card.offsetWidth + 24);
  }, [expanded, arrival, rail]);
  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { timers.current.delete(timer); fn(); }, ms);
    timers.current.add(timer);
  }
  function add(kind: "image" | "text") {
    const id = nextId.current++;
    const card: Card = { id, kind, art: id % 2 ? "/studio.svg" : "/mountains.svg", name: kind === "text" ? m.sampleText : m.sampleImage };
    setCards((old) => [...old, card]);
    setArrival(id);
    setStatus("");
    peek();
    later(() => setArrival((current) => current === id ? null : current), 2500);
  }
  function reset() {
    timers.current.forEach(clearTimeout); timers.current.clear();
    collapse();
    positions.current = null; focusAfterRemoval.current = null;
    setCards(seed()); nextId.current = 4; setRemovals([]); setArrival(null); setStatus("");
    if (rowRef.current) rowRef.current.scrollLeft = 0;
  }
  async function copy(card: Card) {
    try {
      if (card.kind === "text") await navigator.clipboard.writeText(m.textContent);
      else {
        // Start the clipboard operation during the user gesture. PNG is interoperable
        // with native apps; copying a URL would violate the image-card contract.
        const png = new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Canvas unavailable")); return; }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG unavailable")), "image/png");
          };
          img.onerror = reject; img.src = card.art;
        });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      }
      setStatus(m.copied);
    } catch { setStatus(m.copyFailed); }
  }
  function remove(card: Card) {
    if (!cards.some((item) => item.id === card.id)) return;
    const active = document.activeElement;
    const focusWasInCard = active?.closest(`[data-card="${card.id}"]`) != null;
    const position = cards.findIndex((item) => item.id === card.id);
    const neighbor = cards[position + 1] || cards[position - 1];
    positions.current = new Map(Array.from(rowRef.current?.querySelectorAll<HTMLElement>("[data-card]") || [])
      .map((element) => [element.dataset.card!, element.getBoundingClientRect().left]));
    if (focusWasInCard) focusAfterRemoval.current = { id: neighbor?.id };
    const element = rowRef.current?.querySelector<HTMLElement>(`[data-card="${card.id}"]`);
    if (element && rowRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const bounds = element.getBoundingClientRect(), rowBounds = rowRef.current.getBoundingClientRect();
      setRemovals((old) => [...old, { id: card.id, x: bounds.left - rowBounds.left + rowRef.current!.scrollLeft, y: bounds.top - rowBounds.top, width: bounds.width, height: bounds.height }]);
      later(() => setRemovals((old) => old.filter((item) => item.id !== card.id)), 180);
    }
    setCards((old) => old.filter((c) => c.id !== card.id));
    setStatus(m.removed);
  }
  function key(event: KeyboardEvent, card: Card, index: number) {
    if (event.key === "Delete") { event.preventDefault(); remove(card); }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = cards[(index + delta + cards.length) % cards.length];
      copyButtons.current.get(next.id)?.focus();
    }
  }
  return <>
    <div className="demo-meta"><span>{labels.demo}</span><span>{labels.hint}</span></div>
    <div ref={desktop} style={skinStyle(skin)} className="desktop" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); collapse(true); } }}>
      <p className="desktop-instruction">{edgeHints[locale]}</p>
      <div ref={rail} data-ui="notes-demo" className={`rail ${expanded ? "expanded" : "collapsed"}`}
        onKeyDown={pin}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) unpin(); }}>
        <div id="rail-items" className="rail-drawer" inert={!expanded} aria-hidden={!expanded}>
          <button className="rail-dismiss" onClick={() => collapse(true)} aria-label={m.collapse}><Symbol kind="chevron" size={16}/></button>
          <div ref={rowRef} className="slot-row" role="group" aria-label={m.demoLabel}>
            {cards.map((card, index) => <div key={card.id} data-card={card.id} className={`capture-card ${card.kind} ${arrival === card.id ? "just-added" : ""}`}>
              <span className="card-pin" aria-hidden="true"><i/><b/></span>
              <button className="card-copy" ref={(el) => { if (el) copyButtons.current.set(card.id, el); else copyButtons.current.delete(card.id); }}
                onKeyDown={(e) => key(e, card, index)} onClick={() => copy(card)} aria-label={`${m.copy}: ${card.name}`}>
                {card.kind === "image" ? <SampleArtwork src={card.art} label={card.name}/> :
                  <div className="text-preview"><strong>{m.noteTitle}</strong>{m.noteLines.map((line) => <p key={line}>{line}</p>)}</div>}
                <span className="copy-overlay"><Symbol kind="copy" size={16}/>{m.copy}</span>
              </button>
              <div className="card-caption"><span>{card.name}</span><span className="card-type">{card.kind === "text" ? "TXT" : "PNG"}</span></div>
              <button className="card-remove" onClick={() => remove(card)} aria-label={`${m.remove}: ${card.name}`}><Symbol kind="close" size={12}/></button>
            </div>)}
            {removals.map((item) => <div key={item.id} className="fragments" aria-hidden="true" style={{ left: item.x, top: item.y, width: item.width, height: item.height }}>{Array.from({ length: 12 }, (_, i) =>
              <i key={i} style={{ "--x": `${(i % 4) * 28}%`, "--y": `${Math.floor(i / 4) * 34}%`, "--fragment": ["#eabd42", "#a7c8ae", "#f6f4ed", "#6e96ad"][i % 4] } as CSSProperties}/>)}</div>)}
            {cards.length === 0 && <button className="empty-slot" onClick={() => add("image")}><Symbol kind="camera" size={28}/><span>{m.empty}</span></button>}
          </div>
        </div>
      </div>
      {children}
      <div className="desktop-footer">
    <div className="demo-controls" data-ui="demo-toolbar">
      <div className="capture-actions"><button className="button capture-button" aria-label={m.addImage} title={m.addImage} onClick={() => add("image")}><Symbol kind="camera"/><span className="control-label">{m.addImage}</span></button><button className="button text-button" aria-label={m.addText} title={m.addText} onClick={() => add("text")}><Symbol kind="text"/><span className="control-label">{m.addText}</span></button></div>
      <div className="demo-utilities">
        <button ref={handle} className="reveal-button" aria-expanded={expanded} aria-controls="rail-items" aria-label={expanded ? m.collapse : m.expand} title={expanded ? m.collapse : m.expand}
          onClick={() => expanded ? collapse() : reveal(true)}><span className="control-label toggle-labels" aria-hidden="true"><span className={expanded ? "inactive" : ""}>{m.expand}</span><span className={expanded ? "" : "inactive"}>{m.collapse}</span></span><Symbol kind="chevron" size={16}/></button>
        <button className="reset-button" aria-label={m.reset} title={m.reset} onClick={reset}><Symbol kind="reset" size={18}/><span className="control-label">{m.reset}</span></button>
        <button className="appearance-trigger" aria-haspopup="dialog" aria-label={labels.customize} title={labels.customize} onClick={onCustomize}><Symbol kind="palette" size={18}/><span className="control-label">{labels.nav[1]}</span></button>
      </div>
    </div>
    <div className="demo-feedback">
      <p role="status" aria-live="polite" aria-atomic="true">{status || m.demoNote}</p>
      <p className="sr-only">{m.keyboard}</p>
    </div>
    <div className="desktop-dock" data-ui="desktop-dock">
      <span className="dock-app dock-files" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M7 12h13l4 5h17v23H7z" fill="#fff" opacity=".45"/><path d="M6 21h36l-4 20H10z" fill="#fff"/></svg></span>
      <span className="dock-app dock-browser" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="#fff"/><circle cx="24" cy="24" r="12" fill="#8ed3fa"/><path d="m30 14-3 14-10 7 4-14z" fill="#1764c0"/><path d="m30 14-9 7 6 7z" fill="#ed6a5b"/></svg></span>
      <button className="dock-app dock-snapslot" aria-label="SnapSlot" title="SnapSlot" onClick={() => reveal(true)}><span className="app-symbol" aria-hidden="true"/><span className="dock-tooltip">SnapSlot</span><i aria-hidden="true"/></button>
      <span className="dock-app dock-notes" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="8" y="7" width="32" height="35" rx="5" fill="#fff"/><path d="M8 12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v6H8z" fill="#ffd56b"/><path d="M15 25h18M15 31h18M15 37h12" stroke="#bccada" strokeWidth="2"/></svg></span>
    </div>
      </div>
    </div>
  </>;
}

function BackToTop({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <a className="back-to-top" href="#top" aria-label={label} title={label} hidden={!visible}
    onClick={(e) => {
      e.preventDefault();
      document.getElementById("top")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }}><Symbol kind="up" size={22}/></a>;
}

export function Home({ locale, m }: { locale: Locale; m: Messages }) {
  const copy = siteCopy[locale];
  const [skin, setSkin] = useState<Skin>(builtInSkins[0]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  return <>
    <a className="skip-link" href="#main">{copy.skip}</a>
    <header className="site-header page-width" id="top" tabIndex={-1}>
      <a className="home-link" href={`/${locale}/`} aria-label="SnapSlot"><Brand/>{locale.startsWith("zh") && <span className="chinese-name">{locale === "zh-Hans" ? "快照贴" : "快照貼"}</span>}</a>
      <nav aria-label={[copy.usageNav, ...copy.nav.slice(1)].join(" / ")}><button className="usage-nav" aria-haspopup="dialog" onClick={() => setUsageOpen(true)}>{copy.usageNav}</button><a href="#skins">{copy.nav[1]}</a><a href="#about">{copy.nav[2]}</a></nav>
      <LanguagePicker locale={locale} label={m.language}/>
    </header>
    <main id="main">
      <section className="hero">
        <div className="scene-wallpaper" aria-hidden="true"/>
        <div className="playground" id="playground"><RailDemo m={m} locale={locale} skin={skin} onCustomize={() => setEditorOpen(true)}><div className="hero-copy">
          <h1>{copy.headline.join(" ")}</h1>
          <div className="hero-description">
            <p className="hero-intro">{copy.intro}</p>
            <button className="usage-trigger" aria-haspopup="dialog" onClick={() => setUsageOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="m10 8 6 4-6 4z" fill="currentColor"/></svg>{copy.usage}</button>
          </div>
        </div></RailDemo></div>
      </section>
      <SkinEditor locale={locale} m={m} skin={skin} onChange={setSkin} open={editorOpen} onClose={() => setEditorOpen(false)}/>
      <UsageGuide locale={locale} m={m} open={usageOpen} onClose={() => setUsageOpen(false)}/>
      <section className="appearance-section page-width" id="skins">
        <div className="appearance-heading"><h2 data-reveal>{copy.skinTitle.join(" ")}</h2><div><p data-reveal>{copy.skinIntro}</p><button className="customize-link" aria-haspopup="dialog" onClick={() => setEditorOpen(true)}>{copy.customize}<Symbol kind="arrow" size={18}/></button></div></div>
        <div className="theme-options" data-ui="skin-selector" role="group" aria-label={copy.preview}>
          {builtInSkins.map((preset, index) => <button key={preset.name} className={`theme-option ${isSameSkin(skin, preset) ? "selected" : ""}`} aria-label={index ? copy.card : copy.paper} aria-pressed={isSameSkin(skin, preset)} onClick={() => setSkin(preset)}>
            <span className="theme-caption"><span className="theme-name">{index ? copy.card : copy.paper}<small>{index ? copy.cardDetail : copy.paperDetail}</small></span><span className="theme-choice"><Symbol kind="check" size={14}/><span>{copy.selected}</span></span></span>
            <SkinPreview m={m} skin={preset} label={index ? copy.card : copy.paper}/>
          </button>)}
        </div>
      </section>
      <section className="privacy" id="privacy">
        <div className="page-width privacy-content"><h2 data-reveal>{copy.privacy}</h2><p data-reveal>{copy.privacyBody}</p></div>
      </section>
      <section className="faq page-width" id="about"><h2 data-reveal>{copy.faq}</h2><div>{copy.questions.map(([q, a]) => <details name="faq" key={q} data-reveal><summary>{q}<span aria-hidden="true" className="faq-toggle"/></summary><p>{a}</p></details>)}</div></section>
      <section className="release page-width" id="download"><div><h2 data-reveal>{copy.release}</h2><p data-reveal>{copy.releaseBody}</p></div><div className="release-actions"><a className="source-link" href="https://github.com/LING-0001/SnapSlot" target="_blank" rel="noreferrer">{copy.source}</a></div></section>
    </main>
    <footer className="site-footer page-width"><p>{copy.footer}</p><a href="#privacy">{m.privacyTitle}</a><span>© {new Date().getFullYear()} SnapSlot</span></footer>
    <BackToTop label={m.top}/>
  </>;
}

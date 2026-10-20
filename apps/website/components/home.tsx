"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { edgeHints, localeNames, locales, type Locale, type Messages } from "@/lib/messages";
import { useRailReveal } from "./use-rail-reveal";

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
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    windows: <><path d="M3 4h8v8H3zm10 0h8v8h-8zM3 14h8v8H3zm10 0h8v8h-8z" fill="currentColor" stroke="none"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
function Brand({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "small" : ""}`}><img src="/icon.svg" alt="" width="34" height="34" /><span>SnapSlot<span className="brand-period">.</span></span></span>;
}
function Lights() { return <span className="lights" aria-hidden="true"><i/><i/><i/><i/></span>; }

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
        }}><span>{localeNames[l]}</span><span aria-hidden="true">{l === locale ? "✓" : ""}</span></a>)}
    </div>}
  </div>;
}

function RailDemo({ m, locale }: { m: Messages; locale: Locale }) {
  const seed = (): Card[] => [
    { id: 1, kind: "image", art: "/mountains.svg", name: m.sampleImage },
    { id: 2, kind: "text", art: "", name: m.sampleText },
    { id: 3, kind: "image", art: "/studio.svg", name: m.samplePhoto },
  ];
  const [cards, setCards] = useState<Card[]>(seed);
  const { expanded, desktop, rail, handle, reveal, collapse, peek, pin, unpin } = useRailReveal();
  const [overflow, setOverflow] = useState(false);
  const [deleting, setDeleting] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [arrival, setArrival] = useState<number | null>(null);
  const nextId = useRef(4);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const copyButtons = useRef<Map<number, HTMLButtonElement>>(new Map());
  const pageCards = overflow ? cards.slice(8) : cards.slice(0, 8);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { if (cards.length <= 8) setOverflow(false); }, [cards.length]);
  useEffect(() => {
    if (!expanded || !arrival) return;
    const row = rail.current?.querySelector<HTMLDivElement>(".slot-row");
    const card = row?.querySelector<HTMLElement>(`[data-card="${arrival}"]`);
    if (row && card) row.scrollLeft = Math.max(0, card.offsetLeft - row.clientWidth + card.offsetWidth + 24);
  }, [expanded, overflow, arrival, rail]);
  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { timers.current.delete(timer); fn(); }, ms);
    timers.current.add(timer);
  }
  function add(kind: "image" | "text") {
    if (cards.length >= 16) { setStatus(m.limit); return; }
    const id = nextId.current++;
    const card: Card = { id, kind, art: id % 2 ? "/studio.svg" : "/mountains.svg", name: kind === "text" ? m.sampleText : m.sampleImage };
    setCards((old) => [...old, card]);
    setArrival(id);
    setOverflow(cards.length >= 8);
    setStatus("");
    peek();
    later(() => setArrival((current) => current === id ? null : current), 2500);
  }
  function reset() {
    timers.current.forEach(clearTimeout); timers.current.clear();
    collapse();
    setCards(seed()); nextId.current = 4; setDeleting([]); setOverflow(false); setArrival(null); setStatus("");
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
    if (deleting.includes(card.id)) return;
    const active = document.activeElement;
    const focusWasInCard = active?.closest(`[data-card="${card.id}"]`) != null;
    const neighbor = pageCards.find((c) => c.id !== card.id && !deleting.includes(c.id));
    setDeleting((old) => [...old, card.id]);
    later(() => {
      setCards((old) => old.filter((c) => c.id !== card.id));
      setDeleting((old) => old.filter((id) => id !== card.id));
      setStatus(m.removed);
      if (focusWasInCard) {
        const target = neighbor && copyButtons.current.get(neighbor.id);
        (target || handle.current)?.focus();
      }
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 560);
  }
  function key(event: KeyboardEvent, card: Card, index: number) {
    if (event.key === "Delete") { event.preventDefault(); remove(card); }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = pageCards[(index + delta + pageCards.length) % pageCards.length];
      copyButtons.current.get(next.id)?.focus();
    }
  }
  return <>
    <div className="demo-meta"><span>{edgeHints[locale]}</span><span className="demo-version">SNAPSLOT</span></div>
    <div ref={desktop} className="desktop" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); collapse(true); } }}>
      <div className="wallpaper"><div className="wallpaper-sun"/><div className="wallpaper-hill back"/><div className="wallpaper-hill front"/></div>
      <div className="desktop-note" aria-hidden="true"><span className="note-pin"/><span className="tiny-caps">{m.sample} / SNAPSLOT</span><strong>{m.desktopTitle}</strong><span>{m.desktopText}</span><div className="note-rule"/><Lights/></div>
      <div ref={rail} className={`rail ${expanded ? "expanded" : "collapsed"}`}
        onKeyDown={pin}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) unpin(); }}>
        <div id="rail-items" className="rail-drawer" hidden={!expanded}>
          <button className="rail-dismiss" onClick={() => collapse(true)} aria-label={m.collapse}><Symbol kind="chevron" size={16}/></button>
          <div className="slot-row" role="group" aria-label={m.demoLabel}>
            {pageCards.map((card, index) => <div key={card.id} data-card={card.id} className={`capture-card ${card.kind} ${arrival === card.id ? "just-added" : ""} ${deleting.includes(card.id) ? "dissolving" : ""}`}>
              <div className="card-anchor" aria-hidden="true"/>
              <button className="card-copy" ref={(el) => { if (el) copyButtons.current.set(card.id, el); else copyButtons.current.delete(card.id); }}
                onKeyDown={(e) => key(e, card, index)} onClick={() => copy(card)} disabled={deleting.includes(card.id)} aria-label={`${m.copy}: ${card.name}`}>
                {card.kind === "image" ? <img src={card.art} alt={card.name} draggable={false}/> :
                  <div className="text-preview"><span className="text-tag">Aa</span><strong>{m.noteTitle}</strong>{m.noteLines.map((line) => <p key={line}>{line}</p>)}</div>}
                <span className="copy-overlay"><Symbol kind="copy" size={16}/>{m.copy}</span>
              </button>
              <div className="card-caption"><span>{card.name}</span><span className="card-type">{card.kind === "text" ? "TXT" : "PNG"}</span></div>
              <button className="card-remove" onClick={() => remove(card)} disabled={deleting.includes(card.id)} aria-label={`${m.remove}: ${card.name}`}><Symbol kind="close" size={12}/></button>
              {deleting.includes(card.id) && <div className="fragments" aria-hidden="true">{Array.from({ length: 24 }, (_, i) =>
                <i key={i} style={{ "--x": `${(i % 6) * 18}%`, "--y": `${Math.floor(i / 6) * 24}%`, "--delay": `${(i % 5) * 13}ms`, "--fragment": ["#eabd42", "#a7c8ae", "#f6f4ed", "#6e96ad"][i % 4] } as CSSProperties}/>)}</div>}
            </div>)}
            {cards.length === 0 && <button className="empty-slot" onClick={() => add("image")}><Symbol kind="camera" size={28}/><span>{m.empty}</span></button>}
            {cards.length > 8 && <button className="overflow-slot" onClick={() => setOverflow(!overflow)}><span>{overflow ? "←" : `+${cards.length - 8}`}</span>{overflow ? m.less : m.more}</button>}
          </div>
        </div>
      </div>
      <div className="desktop-corner" aria-hidden="true"><span className="pixel-cross"/><span>{m.local}<br/>{m.noAccount}</span></div>
      <div className="taskbar" aria-hidden="true"><span className="taskbar-app"><Symbol kind="windows" size={18}/></span><span className="taskbar-folder"/><span className="taskbar-browser"/><img src="/icon.svg" width="23" height="23" alt=""/><span className="taskbar-clock">10:24</span></div>
    </div>
    <div className="demo-controls">
      <div className="capture-actions"><button className="button capture-button" onClick={() => add("image")}><Symbol kind="camera"/>{m.addImage}<span className="keycap" aria-hidden="true">+</span></button><button className="button text-button" onClick={() => add("text")}><Symbol kind="text"/>{m.addText}</button></div>
      <div className="demo-utilities">
        <button ref={handle} className="reveal-button" aria-expanded={expanded} aria-controls="rail-items"
          onClick={() => expanded ? collapse() : reveal(true)}>{expanded ? m.collapse : m.expand}<Symbol kind="chevron" size={14}/></button>
        <button className="reset-button" onClick={reset}><Symbol kind="reset" size={16}/>{m.reset}</button>
      </div>
    </div>
    <div className="demo-feedback">
      <p role="status" aria-live="polite" aria-atomic="true">{status || m.demoNote}</p>
      <p className="sr-only">{m.keyboard}</p>
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
  return <>
    <header className="site-header" id="top" tabIndex={-1}>
      <a className="home-link" href={`/${locale}/`} aria-label="SnapSlot"><Brand/>{m.name && <span className="chinese-name">{m.name}</span>}</a>
      <nav aria-label={m.nav.join(" / ")}><a href="#playground">{m.nav[0]}</a><a href="#how">{m.nav[1]}</a><a href="#download">{m.nav[2]}</a></nav>
      <LanguagePicker locale={locale} label={m.language}/>
    </header>
    <main>
      <section className="hero">
        <div className="hero-eyebrow"><Lights/><span>{m.eyebrow}</span></div>
        <h1>{m.headline[0]}<br/><span>{m.headline[1]}</span><span className="headline-pixel" aria-hidden="true"/></h1>
        <p className="hero-intro">{m.intro}</p>
        <div className="hero-actions"><a href="#playground" className="button primary">{m.try}<Symbol kind="arrow" size={18}/></a><a href="#download" className="button secondary"><Symbol kind="windows" size={17}/>{m.download}</a></div>
        <div className="hero-facts"><span>{m.platform}</span><span>{m.local}</span><span>{m.noAccount}</span></div>
      </section>
      <section className="playground page-width" id="playground" aria-label={m.try}><RailDemo m={m} locale={locale}/></section>
      <section className="features page-width" id="how">
        <div className="section-heading"><span className="section-mark" aria-hidden="true">⌑</span><h2>{m.featureHeading}</h2></div>
        <div className="feature-grid">{m.features.map((feature, i) => <article key={feature.title}>
          <div className={`feature-illustration illustration-${i}`} aria-hidden="true">
            {i === 0 ? <div className="mini-rail"><Lights/><div className="mini-card"/></div> : i === 1 ? <div className="mini-pair"><span className="mini-picture">◒</span><span className="mini-text">Aa<span>━━<br/>━━━━</span></span></div> : <div className="mini-dissolve"><span/>{Array.from({ length: 8 }, (_, j) => <i key={j}/>)}</div>}
          </div><h3>{feature.title}</h3><p>{feature.body}</p></article>)}</div>
      </section>
      <section className="workflow page-width"><h2>{m.workflow}</h2><div className="steps">{m.steps.map((step, i) => <article key={step.title}><span className="step-number">0{i + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></article>)}</div></section>
      <section className="privacy page-width"><div className="privacy-emblem" aria-hidden="true"><Symbol kind="shield" size={56}/><span className="privacy-pixel"/></div><div><h2>{m.privacyTitle}</h2><p>{m.privacyBody}</p><div className="privacy-tags">{m.privacyTags.map((tag) => <span key={tag}><i/>{tag}</span>)}</div></div></section>
      <section className="release page-width" id="download"><div className="release-logo"><img src="/icon.svg" alt="" width="86" height="86"/></div><span className="release-label">{m.releaseLabel}</span><h2>{m.releaseTitle}</h2><p>{m.releaseBody}</p><span className="release-pending"><Symbol kind="windows" size={18}/>{m.releaseStatus}<span className="pending-dot"/></span><small>{m.releaseMeta}</small></section>
      <section className="faq page-width"><h2>{m.faqTitle}</h2><div>{m.faq.map((item) => <details key={item.q}><summary>{item.q}<span>+</span></summary><p>{item.a}</p></details>)}</div></section>
    </main>
    <footer className="site-footer page-width"><div><Brand small/><p>{m.footer}</p></div><div className="footer-right"><Lights/><span>© {new Date().getFullYear()} SnapSlot</span></div></footer>
    <BackToTop label={m.top}/>
  </>;
}

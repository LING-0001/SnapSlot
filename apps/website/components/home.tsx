"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { locales, localeNames, type Locale } from "@/lib/locales";
import { fill, homeCopy } from "@/lib/home-copy";
import { demoCopy } from "@/lib/demo-copy";
import { navigateMenu } from "@/lib/menu-navigation";
import { downloads, githubReleases } from "@/lib/releases";
import s from "./home.module.css";

type Note =
  | { id: string; kind: "image"; src: string; label: string; fresh?: boolean }
  | { id: string; kind: "text"; text: string; fresh?: boolean };
type DocItem = { id: string; kind: "image"; src: string } | { id: string; kind: "text"; text: string };
type Skin = "glass" | "paper" | "graphite";
type Os = "win" | "mac";
type Box = { x: number; y: number; w: number; h: number; stageHeight: number };

const CAPACITY = 30;
const DWELL_MS = 500;
const GRACE_MS = 450;
const PEEK_MS = 2500;
const DRAG_TYPE = "application/x-snapslot-note";
const GITHUB = "https://github.com/LING-0001/SnapSlot";
const EMAIL = "e1347605313@gmail.com";
const ART = ["/mountains.svg", "/studio.svg"];
const SKINS: Skin[] = ["glass", "paper", "graphite"];
// Guided steps, in order: reveal from the edge, collect an image, use a note, open the menu.
const STEPS = ["edge", "file", "drag", "tray"] as const;

const uid = () => Math.random().toString(36).slice(2, 9);

/** The app mark as a CSS image, so extensions that annotate <img> tags cannot break hydration. */
function Mark({ size }: { size: number }) {
  return <span className={s.mark} style={{ width: size, height: size }} aria-hidden="true"/>;
}

function Keys({ keys }: { keys: string[] }) {
  return <span className={s.keys}>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`${s.toggle} ${on ? s.toggleOn : ""}`} onClick={onChange}><span/></button>;
}

function GitHubMark({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>;
}

function Glyphs() {
  return <span className={s.glyphs} aria-hidden="true">
    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 12.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-2.6-2.7a3.7 3.7 0 0 1 5.2 0l.9-.9a5 5 0 0 0-7 0l.9.9ZM3.5 7.9a6.4 6.4 0 0 1 9 0l.9-.9a7.7 7.7 0 0 0-10.8 0l.9.9Z" fill="currentColor"/></svg>
    <svg viewBox="0 0 16 16" width="14" height="14"><path d="M2 6h2.5L8 3v10L4.5 10H2Z" fill="currentColor"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12 4a5.5 5.5 0 0 1 0 8" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinecap="round"/></svg>
  </span>;
}

async function copyNote(note: Note) {
  if (note.kind === "text") return navigator.clipboard.writeText(note.text);
  const img = new Image();
  img.src = note.src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 800;
  canvas.height = img.naturalHeight || 520;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail()), "image/png"));
  return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function Home({ locale }: { locale: Locale }) {
  const t = homeCopy[locale];
  const [appLocale, setAppLocale] = useState<Locale>(locale);
  const a = homeCopy[appLocale];
  const demo = demoCopy[locale];
  const [notes, setNotes] = useState<Note[]>(() => [
    { id: "s1", kind: "image", src: ART[0], label: t.stage.fileLabels[0] },
    { id: "s2", kind: "text", text: t.stage.sampleText },
    { id: "s3", kind: "image", src: ART[1], label: t.stage.fileLabels[1] },
  ]);
  const [focus, setFocus] = useState(1);
  const [os, setOs] = useState<Os>("win");
  const [running, setRunning] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [intake, setIntake] = useState(true);
  const [hover, setHover] = useState(false);
  const [arming, setArming] = useState(false);
  const [peek, setPeek] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [demoDensity, setDemoDensity] = useState<"regular" | "compact" | "tight">("regular");
  const [touch, setTouch] = useState(false);
  const [skin, setSkin] = useState<Skin>("glass");
  const [copied, setCopied] = useState<string | null>(null);
  const [copiedLocally, setCopiedLocally] = useState(false);
  const [demoClipboard, setDemoClipboard] = useState<Note | null>(null);
  const [demoNoteCopied, setDemoNoteCopied] = useState(false);
  const [chip, setChip] = useState<{ x: number; y: number } | null>(null);
  const [island, setIsland] = useState<Note | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [stageVisible, setStageVisible] = useState(true);
  const [doc, setDoc] = useState<DocItem[]>([]);
  const [docOver, setDocOver] = useState(false);
  const [clock, setClock] = useState("");
  const [step, setStep] = useState(0);
  const [coachBox, setCoachBox] = useState<Box | null>(null);
  const [coachShift, setCoachShift] = useState(0);
  const [coachHeight, setCoachHeight] = useState(0);
  const coachRef = useRef<HTMLDivElement>(null);
  const [langOpen, setLangOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuKeyboard = useRef(false);
  const trayRef = useRef<HTMLButtonElement>(null);
  const languageRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef(false);
  const noteCount = useRef(notes.length);
  noteCount.current = notes.length;
  const timers = useRef<Record<string, number>>({});
  const edgeArmed = useRef(false), leaving = useRef(false);
  const wheel = useRef(0);
  const stageSeen = useRef(true);
  const intakeRef = useRef(intake);
  intakeRef.current = running && intake;

  const later = (key: string, ms: number, fn: () => void) => {
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(fn, ms);
  };
  const cancel = (key: string) => window.clearTimeout(timers.current[key]);
  const tell = useCallback((message: string) => { setNotice(message); later("notice", 2200, () => setNotice(null)); }, []);

  const coach = STEPS[step] as (typeof STEPS)[number] | undefined;
  // While the drag step is showing, keep the notes down so there is something to drag.
  const open = pinned || hover || peek || coach === "drag";
  const mac = os === "mac";
  const reach = narrow || demoDensity !== "regular" ? 1.6 : 2.2;
  const mod = mac ? ["⌃", "⌥"] : ["Ctrl", "Alt"];
  const edgePx = mac ? 26 : 14;

  const reached = useCallback((name: (typeof STEPS)[number]) => setStep((n) => (STEPS[n] === name ? n + 1 : n)), []);

  const turn = (by: number) => setFocus((f) => Math.min(Math.max(f + by, 0), Math.max(0, noteCount.current - 1)));
  const close = () => {
    ["leave", "peek", "dwell"].forEach(cancel);
    setHover(false); setPeek(false); setArming(false);
    leaving.current = false; edgeArmed.current = false;
  };
  const restoreTrayFocus = () => trayRef.current?.focus({ preventScroll: true });
  const closeMenu = () => { setMenu(false); restoreTrayFocus(); };
  const closeSettings = () => { setSettings(false); restoreTrayFocus(); };
  const showNotes = () => {
    if (!running) return;
    cancel("leave"); setHover(true);
    requestAnimationFrame(() => dialRef.current?.querySelector<HTMLElement>("[data-focus='true']")?.focus({ preventScroll: true }));
  };
  const replay = () => {
    setRunning(true);
    Object.values(timers.current).forEach(window.clearTimeout); timers.current = {};
    setNotes([{ id: "s1", kind: "image", src: ART[0], label: t.stage.fileLabels[0] }, { id: "s2", kind: "text", text: t.stage.sampleText }, { id: "s3", kind: "image", src: ART[1], label: t.stage.fileLabels[1] }]);
    setFocus(1); setPinned(false); setIntake(true); setHover(false); setArming(false); setPeek(false);
    edgeArmed.current = false; leaving.current = false;
    setDoc([]); setDemoClipboard(null); setDemoNoteCopied(false); setCopied(null); setNotice(null); setIsland(null); setMenu(false); setSettings(false); setStep(0);
  };
  useEffect(() => () => { Object.values(timers.current).forEach(window.clearTimeout); }, []);
  useLayoutEffect(() => {
    if (settings) settingsRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [settings]);
  useLayoutEffect(() => {
    if (menu && menuKeyboard.current) { menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); menuKeyboard.current=false; }
  }, [menu]);

  const add = useCallback((note: Note) => {
    setNotes((list) => {
      const next = [...list, note].slice(-CAPACITY);
      setFocus(next.length - 1);
      return next;
    });
    setPeek(true);
    later("peek", PEEK_MS, () => setPeek(false));
    later("fresh", 1400, () => setNotes((list) => list.map((n) => (n.fresh ? { ...n, fresh: false } : n))));
    if (!stageSeen.current) {
      setIsland(note);
      later("island", 2600, () => setIsland(null));
    }
  }, []);

  const pinSelection = useCallback(() => {
    if (!running) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || stageRef.current?.contains(selection!.anchorNode)) return;
    add({ id: uid(), kind: "text", text: text.slice(0, 2000), fresh: true });
    navigator.clipboard?.writeText(text).catch(() => {});
    selection?.removeAllRanges();
    setChip(null);
  }, [add, running]);

  // Clicking a desktop file stands in for copying an image in another app.
  const copyFile = (from: HTMLElement, index: number) => {
    setDemoClipboard({ id: uid(), kind: "image", src: ART[index], label: t.stage.fileLabels[index] });
    if (!running) return tell(demo.exited);
    if (!intake) return tell(a.notice.notPinned);
    const id = uid();
    const src = ART[index];
    add({ id, kind: "image", src, label: t.stage.fileLabels[index], fresh: true });
    reached("file");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = from.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = s.ghost;
    Object.assign(ghost.style, { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, backgroundImage: `url("${src}")` });
    document.body.append(ghost);
    window.setTimeout(() => {
      const target = document.querySelector(`[data-note="${id}"]`)?.getBoundingClientRect();
      const tx = target ? target.left - start.left : 0;
      const ty = target ? target.top - start.top : -start.top;
      const scale = target ? target.width / start.width : 1;
      ghost.animate(
        [{ transform: "none", opacity: 1 }, { transform: `translate(${tx}px, ${ty}px) scale(${scale})`, opacity: 0 }],
        { duration: 620, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" },
      ).finished.then(() => ghost.remove());
    }, 80);
  };

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString(appLocale, { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const clockTimer = window.setInterval(tick, 15000);
    return () => window.clearInterval(clockTimer);
  }, [appLocale]);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setOs("mac");
    const measureDemo = () => {
      const height = stageRef.current!.getBoundingClientRect().height;
      setDemoDensity(height < 480 ? "tight" : height < 560 ? "compact" : "regular");
    };
    const sizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(measureDemo) : null;
    sizeObserver?.observe(stageRef.current!); measureDemo();
    addEventListener("resize", measureDemo);
    const media = matchMedia("(max-width: 760px)");
    const coarse = matchMedia("(hover: none)");
    const sync = () => { setNarrow(media.matches); setTouch(coarse.matches); };
    sync();
    media.addEventListener("change", sync);
    coarse.addEventListener("change", sync);

    const seen = typeof IntersectionObserver === "function" ? new IntersectionObserver(([entry]) => { stageSeen.current = entry.isIntersecting; setStageVisible(entry.isIntersecting); }, { threshold: 0.25 }) : null;
    seen?.observe(stageRef.current!);

    const reveal = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.setAttribute("data-shown", ""); reveal?.unobserve(e.target); }
    }), { threshold: 0.15 }) : null;
    document.querySelectorAll("[data-reveal]").forEach((el) => reveal?.observe(el));

    return () => {
      media.removeEventListener("change", sync);
      sizeObserver?.disconnect(); removeEventListener("resize", measureDemo);
      coarse.removeEventListener("change", sync);
      seen?.disconnect();
      reveal?.disconnect();
    };
  }, []);

  // Opening the notes by any route completes the first step.
  useEffect(() => { if (hover || pinned) reached("edge"); }, [hover, pinned, reached]);

  // Wheel and swipe turn the fan one note at a time.
  useEffect(() => {
    const dial = dialRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheel.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(wheel.current) < 40) return;
      const by = Math.sign(wheel.current);
      wheel.current = 0;
      turn(by);
    };
    let startX = 0, startY = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; swipe.current = false; };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) >= 30 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swipe.current = true; turn(-Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / 80)));
      }
    };
    dial.addEventListener("wheel", onWheel, { passive: false });
    dial.addEventListener("touchstart", onTouchStart, { passive: true });
    dial.addEventListener("touchend", onTouchEnd);
    return () => {
      dial.removeEventListener("wheel", onWheel);
      dial.removeEventListener("touchstart", onTouchStart);
      dial.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menu) { setMenu(false); restoreTrayFocus(); }
        else if (settings) closeSettings();
        else if (langOpen) { setLangOpen(false); languageRef.current?.focus({ preventScroll: true }); }
        else { setPinned(false); close(); (document.activeElement as HTMLElement)?.blur(); }
        return;
      }
      if (!running || !(e.ctrlKey && e.altKey)) return;
      if (e.code === "KeyT") { e.preventDefault(); pinSelection(); }
      if (e.code === "Space") {
        e.preventDefault();
        showNotes();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file || !intakeRef.current) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => add({ id: uid(), kind: "image", src: String(reader.result), label: t.stage.pasted, fresh: true });
      reader.readAsDataURL(file);
    };
    const onSelection = () => {
      if (!running) return setChip(null);
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim() || stageRef.current?.contains(selection.anchorNode)) return setChip(null);
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setChip({ x: Math.min(Math.max(rect.left + rect.width / 2, 110), innerWidth - 110), y: rect.bottom + 10 });
    };
    const hideChip = () => setChip(null);
    addEventListener("keydown", onKey);
    addEventListener("paste", onPaste);
    document.addEventListener("selectionchange", onSelection);
    addEventListener("scroll", hideChip, { passive: true });
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("paste", onPaste);
      document.removeEventListener("selectionchange", onSelection);
      removeEventListener("scroll", hideChip);
    };
  }, [add, pinSelection, t, menu, settings, langOpen, pinned, running]);

  // Close menus on any outside press.
  useEffect(() => {
    if (!menu && !langOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!target.closest(`.${s.trayMenu}, [data-coach="tray"]`)) setMenu(false);
      if (!target.closest(`.${s.lang}`)) setLangOpen(false);
    };
    addEventListener("pointerdown", onDown, true);
    return () => removeEventListener("pointerdown", onDown, true);
  }, [menu, langOpen]);

  // The coach bubble follows whatever the current step points at.
  useLayoutEffect(() => {
    if (!coach) { setCoachBox(null); return; }
    const measure = () => {
      const stage = stageRef.current!.getBoundingClientRect();
      const target = coach === "drag" && touch
        ? demoNoteCopied ? stageRef.current!.querySelector<HTMLElement>("[data-coach='paste']") : dialRef.current!.querySelector<HTMLElement>("[data-focus='true']")
        : stageRef.current!.querySelector<HTMLElement>(`[data-coach="${coach}"]`);
      if (!target) return setCoachBox(null);
      const r = target.getBoundingClientRect();
      setCoachBox({ x: r.left - stage.left, y: r.top - stage.top, w: r.width, h: r.height, stageHeight: stage.height });
    };
    measure();
    const late = window.setTimeout(measure, 600);
    addEventListener("resize", measure);
    return () => { window.clearTimeout(late); removeEventListener("resize", measure); };
  }, [coach, os, narrow, touch, open, focus, notes.length, demoNoteCopied]);

  useLayoutEffect(() => {
    const bubble = coachRef.current, stage = stageRef.current;
    if (!bubble || !stage) return;
    // Measure the unshifted bubble: its centre is the target's centre, so the shift is absolute.
    const width = bubble.offsetWidth, r = stage.getBoundingClientRect(), pad = 12;
    setCoachHeight(bubble.offsetHeight);
    const centre = parseFloat(bubble.style.left);
    if (Number.isNaN(centre)) return setCoachShift(0);
    const left = centre - width / 2, right = centre + width / 2;
    setCoachShift(right > r.width - pad ? r.width - pad - right : left < pad ? pad - left : 0);
  }, [coachBox, step, appLocale, narrow]);

  // The screen's top edge (Windows) or menu bar (Mac): rest the pointer there for 500 ms.
  const onStageMove = (e: React.MouseEvent) => {
    if (!running) return;
    const y = e.clientY - stageRef.current!.getBoundingClientRect().top;
    const dialBottom = dialRef.current!.offsetTop + dialRef.current!.offsetHeight;
    if (y <= edgePx) {
      cancel("leave");
      leaving.current = false;
      if (!open && !edgeArmed.current) {
        edgeArmed.current = true;
        setArming(true);
        later("dwell", DWELL_MS, () => { setArming(false); setHover(true); edgeArmed.current = false; });
      }
      return;
    }
    if (edgeArmed.current) { edgeArmed.current = false; cancel("dwell"); setArming(false); }
    if (!open || pinned || settings || menu || coach === "drag") return;
    if (y > dialBottom) {
      if (!leaving.current) { leaving.current = true; later("leave", GRACE_MS, close); }
    } else if (leaving.current) { leaving.current = false; cancel("leave"); }
  };
  const onStageLeave = () => {
    if (edgeArmed.current) { edgeArmed.current = false; cancel("dwell"); setArming(false); }
    if (open && !pinned && coach !== "drag") later("leave", GRACE_MS, close);
  };
  // Touch has no hover: tapping the top strip opens, tapping bare desktop closes.
  const onStageTap = (e: React.PointerEvent) => {
    if (!running || e.pointerType !== "touch") return;
    const y = e.clientY - stageRef.current!.getBoundingClientRect().top;
    if (y <= 40) setHover(true);
    else if (open && !pinned && coach !== "drag" && !(e.target as Element).closest(`.${s.dial}, .${s.taskbar}, .${s.menubar}, .${s.dock}, .${s.doc}, .${s.files}, .${s.window}, .${s.trayMenu}`)) close();
  };

  const copy = async (note: Note, index: number) => {
    if (swipe.current) return;
    setFocus(index);
    setDemoClipboard(note); setDemoNoteCopied(true);
    try {
      await copyNote(note);
      setCopiedLocally(false);
      setCopied(note.id);
      later("copied", 1400, () => setCopied(null));
    } catch {
      setCopiedLocally(true); setCopied(note.id);
      later("copied", 1800, () => setCopied(null)); tell(demo.clipboardHint);
    }
  };
  const remove = (id: string) => {
    const current = notes[focus]?.id, next = notes.filter((n) => n.id !== id);
    const keep = next.findIndex((note) => note.id === current);
    setFocus(keep >= 0 ? keep : Math.max(0, focus - 1)); setNotes(next);
  };

  const onCardKey = (e: React.KeyboardEvent<HTMLElement>, note: Note, index: number) => {
    const go = (i: number) => {
      setFocus(i);
      requestAnimationFrame(() => dialRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.focus());
    };
    if (e.key === "ArrowRight" && index < notes.length - 1) go(index + 1);
    else if (e.key === "ArrowLeft" && index > 0) go(index - 1);
    else if (e.key === "Delete" || e.key === "Backspace") { remove(note.id); go(Math.max(index - 1, 0)); }
    else return;
    e.preventDefault();
  };

  const toDoc = (item: DocItem) => {
    setDoc((list) => [...list, item].slice(-8));
    reached("drag");
    requestAnimationFrame(() => docRef.current?.querySelector(`.${s.docBody}`)?.scrollTo({ top: 9999, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
  };
  const pasteDemo = () => {
    if (!demoClipboard) return;
    toDoc(demoClipboard.kind === "image" ? { id: uid(), kind: "image", src: demoClipboard.src } : { id: uid(), kind: "text", text: demoClipboard.text });
    tell(demo.pasted);
  };
  const onDocPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      const reader = new FileReader();
      reader.onload = () => toDoc({ id: uid(), kind: "image", src: String(reader.result) });
      reader.readAsDataURL(file);
      return;
    }
    const text = e.clipboardData.getData("text/plain");
    if (text) toDoc({ id: uid(), kind: "text", text });
  };
  const onDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDocOver(false);
    const note = notes.find((n) => n.id === e.dataTransfer.getData(DRAG_TYPE));
    if (note) toDoc(note.kind === "image" ? { id: uid(), kind: "image", src: note.src } : { id: uid(), kind: "text", text: note.text });
    else if (e.dataTransfer.getData("text/plain")) toDoc({ id: uid(), kind: "text", text: e.dataTransfer.getData("text/plain") });
  };

  // Pinning shows the notes; unpinning lets them go.
  const togglePinned = () => {
    if (pinned) { setPinned(false); close(); }
    else { setPinned(true); setHover(true); }
  };
  const quitDemo = () => {
    Object.values(timers.current).forEach(window.clearTimeout);
    close(); setRunning(false); setPinned(false); setMenu(false); setSettings(false);
    setNotes([]); setFocus(0); setStep(STEPS.length + 1); setChip(null); setCopied(null);
    tell(demo.exited);
  };
  const toggleIntake = () => {
    setIntake((v) => !v);
    tell(intake ? a.notice.intakeOff : a.notice.intakeOn);
  };
  const openMenu = (keyboard=false) => {
    menuKeyboard.current=keyboard;
    if (menu && keyboard) menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    setMenu(true); reached("tray");
  };
  const openSettings = () => { setMenu(false); setSettings(true); };
  // Windows: left click shows or hides the notes, right click opens the menu. Mac: any click opens the menu.
  const onTrayClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (mac || (e.nativeEvent as PointerEvent).pointerType === "touch") return menu ? setMenu(false) : openMenu();
    setMenu(false);
    if (open && !pinned) close(); else setHover(true);
  };

  const trayButton = <button
    ref={trayRef}
    data-coach="tray"
    className={`${s.trayIcon} ${!intake ? s.trayOff : ""} ${menu ? s.trayIconOn : ""}`}
    onClick={onTrayClick}
    onContextMenu={(e) => { e.preventDefault(); openMenu(); }}
    onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openMenu(true); } }}
    aria-haspopup="menu"
    aria-expanded={menu}
    aria-label={mac ? a.menu.trayMac : a.menu.trayWin}
  >
    {mac
      ? <svg viewBox="0 0 18 16" width="17" height="15" aria-hidden="true"><rect x="1" y="1.2" width="16" height="1.4" rx=".7" fill="currentColor" opacity=".55"/><rect x="4" y="4" width="10" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="4" r="1.6" fill="currentColor"/></svg>
      : <Mark size={16}/>}
    {pinned && <span className={s.trayPinned}/>}
  </button>;

  const coachText = coach === "edge" ? (touch ? t.coach.edgeTouch : t.coach.edge)
    : coach === "file" ? t.coach.file
    : coach === "drag" ? (touch ? demo.touchCopy : t.coach.drag)
    : coach === "tray" ? (touch ? t.coach.trayTouch : mac ? t.coach.trayMac : t.coach.trayWin) : "";
  // Where the bubble sits relative to its target.
  let coachSide = coach === "edge" || (coach === "tray" && mac) ? "below" : coach === "file" ? (narrow ? "below" : mac ? "left" : "right") : coach === "drag" && touch ? "below" : "above";
  if (coachBox) {
    const height = coachHeight || 64;
    if (coachSide === "below" && coachBox.y + coachBox.h + 12 + height > coachBox.stageHeight - 8) coachSide = "above";
    else if (coachSide === "above" && coachBox.y - 12 - height < 8) coachSide = "below";
  }

  return <div className={s.page} data-skin={skin}>
    <header className={s.nav}>
      <div className={s.navInner}>
        <a href="#top" className={s.brand}><Mark size={22}/>SnapSlot{t.name && <small>{t.name}</small>}</a>
        <nav aria-label="SnapSlot">
          <a href="#features">{t.nav.features}</a>
          <a href={GITHUB} target="_blank" rel="noopener" className={s.navIcon} aria-label="GitHub"><GitHubMark/></a>
          <div className={s.lang}>
            <button ref={languageRef} onClick={() => setLangOpen((v) => !v)} aria-expanded={langOpen} aria-haspopup="true" aria-label={t.nav.language}>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M1.7 8h12.6M8 1.7c1.8 1.7 2.6 3.9 2.6 6.3S9.8 12.6 8 14.3C6.2 12.6 5.4 10.4 5.4 8S6.2 3.4 8 1.7Z" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
              {localeNames[locale]}
            </button>
            {langOpen && <ul>{locales.map((l) => <li key={l}><a href={`/${l}/`} lang={l} aria-current={l === locale ? "page" : undefined}>{localeNames[l]}</a></li>)}</ul>}
          </div>
        </nav>
      </div>
    </header>

    <div className={`${s.island} ${island && !stageVisible ? s.islandOn : ""}`} role="status" aria-live="polite">
      {island && <>
        {island.kind === "image"
          ? <span className={s.islandThumb} style={{ backgroundImage: `url("${island.src}")` }}/>
          : <span className={s.islandThumb + " " + s.islandText}>Aa</span>}
        <span>{fill(t.island, notes.length)}</span>
      </>}
    </div>

    <main id="top" className={s.main}>
      <div className={s.fold} data-os={os}>
        <section className={s.hero}>
          <h1>{t.headline}</h1>
          <p className={s.sub}>{t.sub}</p>
          <div id="downloads" className={s.ctas}>
            <a href={downloads[os].href} download={downloads[os].filename} title={downloads[os].title} className={s.buttonPrimary}>{mac ? t.get.mac : t.get.win}</a>
            <a href={downloads[mac ? "win" : "mac"].href} download={downloads[mac ? "win" : "mac"].filename} title={downloads[mac ? "win" : "mac"].title} className={s.buttonSecondary}>{mac ? t.get.win : t.get.mac}</a>
          </div>
        </section>

        <div className={s.demoBar} role="group" aria-label={demo.title}>
          <span className={s.demoTitle}>{demo.title}</span>
          <div className={s.platforms} role="group" aria-label={demo.platforms}>
            {(["win", "mac"] as const).map((platform) => <button key={platform} aria-pressed={os === platform} onClick={() => { setOs(platform); setMenu(false); }} aria-controls="stage">{platform === "win" ? "Windows" : "macOS"}</button>)}
          </div>
          <button className={s.demoReveal} disabled={!running} onClick={showNotes} aria-controls="stage">{demo.reveal}</button>
          <button className={s.replay} onClick={replay} title={demo.replay} aria-label={demo.replay}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 5a5.2 5.2 0 1 1-.1 5M3 1.8V5h3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{demo.replay}</span>
          </button>
        </div>
        <section className={s.stageWrap} id="stage">
          <div
            data-ui
            data-active={stageVisible}
            data-density={demoDensity}
            className={s.stage}
            data-os={os}
            ref={stageRef}
            onMouseMove={onStageMove}
            onMouseLeave={onStageLeave}
            onPointerDown={onStageTap}
            aria-label={t.stage.desktop}
          >
            <div className={s.wallpaper} aria-hidden="true"/>

            {mac
              ? <div className={s.menubar} data-coach="edge">
                <span className={s.menuLogo} aria-hidden="true"/>
                <b>{t.stage.docTitle}</b>
                <span className={s.menubarRight}>{running && trayButton}<Glyphs/><span className={s.clock}>{clock}</span></span>
              </div>
              : <div className={s.edgeZone} data-coach="edge" aria-hidden="true"/>}
            <div className={`${s.edgeGlow} ${arming ? s.edgeArming : ""}`} aria-hidden="true"><i/></div>

            <div
              ref={dialRef}
              className={`${s.dial} ${open ? s.dialOpen : ""} ${arming ? s.dialArming : ""}`}
              role="list"
              aria-label={a.stage.list}
              inert={!open}
              aria-hidden={!open}
            >
              {notes.map((note, index) => {
                const d = index - focus;
                const hidden = Math.abs(d) > reach;
                return <div
                  role="listitem"
                  key={note.id}
                  className={`${s.arm} ${note.kind === "text" ? s.textNote : ""} ${note.fresh ? s.fresh : ""} ${d === 0 ? s.current : ""}`}
                  style={{ "--d": d, "--ad": Math.abs(d), zIndex: 50 - Math.round(Math.abs(d) * 2), opacity: hidden ? 0 : 1 - Math.max(Math.abs(d) - reach + 1, 0) * 0.7, pointerEvents: hidden ? "none" : undefined } as React.CSSProperties}
                  aria-hidden={hidden}
                >
                  <div className={s.card}>
                    <span className={s.pin} aria-hidden="true"/>
                    <button
                      className={s.face}
                      data-note={note.id}
                      data-index={index}
                      data-focus={d === 0}
                      tabIndex={d === 0 ? 0 : -1}
                      draggable
                      onFocus={() => { cancel("leave"); setHover(true); }}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, note.id);
                        e.dataTransfer.setData("text/plain", note.kind === "text" ? note.text : note.label);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => copy(note, index)}
                      onKeyDown={(e) => onCardKey(e, note, index)}
                      aria-label={note.kind === "text" ? a.stage.copyText + note.text.slice(0, 20) : a.stage.copyImage + note.label}
                    >
                      {note.kind === "image"
                        ? <span className={s.photo} style={{ backgroundImage: `url("${note.src}")` }}/>
                        : <span className={s.noteText}>{note.text}</span>}
                      <span className={`${s.copied} ${copied === note.id ? s.copiedOn : ""}`} aria-hidden="true">{copiedLocally ? demo.copiedHere : a.stage.copied}</span>
                    </button>
                    <button className={s.remove} onClick={() => remove(note.id)} aria-label={a.stage.remove} tabIndex={-1}>×</button>
                  </div>
                </div>;
              })}
              {notes.length === 0 && <p className={s.emptyFan}>{a.stage.empty}</p>}
              {notes.length > 1 && <p className={s.counter} aria-hidden="true">{pinned && <span className={s.pinnedDot}/>}{focus + 1} / {notes.length}</p>}
            </div>

            <p className={`${s.notice} ${notice ? s.noticeOn : ""}`} role="status" aria-live="polite">{notice}</p>

            <div className={s.files}>
              {t.stage.files.map((name, index) => <button key={name} className={s.file} data-coach={index === 0 ? "file" : undefined} onClick={(e) => copyFile(e.currentTarget.querySelector("span")!, index)} aria-label={t.stage.copyFile + name}>
                <span className={s.fileThumb} style={{ backgroundImage: `url("${ART[index]}")` }}/>
                <span className={s.fileName}>{name}</span>
              </button>)}
            </div>

            <div
              ref={docRef}
              data-coach="drag"
              className={`${s.doc} ${docOver ? s.docOver : ""}`}
              tabIndex={0}
              onPaste={onDocPaste}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDocOver(true); }}
              onDragLeave={() => setDocOver(false)}
              onDrop={onDocDrop}
              aria-label={t.stage.docTitle}
            >
              <div className={s.docBar}>
                {mac && <span className={s.lights} aria-hidden="true"><i/><i/><i/></span>}
                <span className={s.docName}>{t.stage.docTitle}</span>
                {doc.length > 0 && <button onClick={() => setDoc([])}>{t.stage.clear}</button>}
                {!mac && <span className={s.caption} aria-hidden="true"><i>—</i><i>□</i><i>×</i></span>}
              </div>
              <div className={s.docBody}>
                <p className={s.docTitle}>{t.stage.docHeading}</p>
                {doc.map((item) => item.kind === "image"
                  ? <span key={item.id} className={s.docImage} style={{ backgroundImage: `url("${item.src}")` }}/>
                  : <p key={item.id} className={s.docText}>{item.text}</p>)}
                {doc.length === 0 && <p className={s.placeholder}>{touch ? demo.pasteHint : t.stage.docEmpty}</p>}
              </div>
              <div className={s.docActions}>
                {!touch && <Keys keys={[mac ? "⌘" : "Ctrl", "V"]}/>}
                <button className={s.docPaste} data-coach="paste" disabled={!demoClipboard} onClick={pasteDemo}>{demo.paste}</button>
              </div>
            </div>

            {settings && <section ref={settingsRef} className={s.window} role="dialog" aria-label={a.settings.title}>
              <header className={s.windowBar}>
                {mac && <span className={s.lights}><button onClick={closeSettings} aria-label={a.settings.close}/><i/><i/></span>}
                {!mac && <Mark size={16}/>}
                <span>{a.settings.title}</span>
                {!mac && <button className={s.windowClose} onClick={closeSettings} aria-label={a.settings.close}>×</button>}
              </header>
              <div className={s.windowBody}>
                <div className={s.row}><span>{a.menu.intake}<small>{a.settings.intakeHint}</small></span><Toggle on={intake} onChange={toggleIntake} label={a.menu.intake}/></div>
                <div className={s.row}><span>{a.menu.pin}<small>{a.settings.pinHint}</small></span><Toggle on={pinned} onChange={togglePinned} label={a.menu.pin}/></div>
                <div className={s.row}><span>{a.settings.look}</span>
                  <span className={s.miniSkins}>{SKINS.map((option, i) => <button key={option} className={`${s.miniSkin} ${skin === option ? s.miniSkinOn : ""}`} data-swatch={option} onClick={() => setSkin(option)} aria-label={a.skins[i]} aria-pressed={skin === option}/>)}</span>
                </div>
                <label className={s.row}><span>{a.settings.language}</span>
                  <select className={s.select} value={appLocale} onChange={(e) => setAppLocale(e.target.value as Locale)}>
                    {locales.map((l) => <option key={l} value={l} lang={l}>{localeNames[l]}</option>)}
                  </select>
                </label>
                <div className={s.row}><span>{a.settings.pinText}</span><Keys keys={[...mod, "T"]}/></div>
                <div className={s.row}><span>{a.settings.openNotes}</span><Keys keys={[...mod, "Space"]}/></div>
                <div className={s.row}><span>{fill(a.settings.count, notes.length)}</span><button className={s.danger} onClick={() => { setNotes([]); setFocus(0); }} disabled={!notes.length}>{a.settings.clear}</button></div>
              </div>
            </section>}

            {mac
              ? <div className={s.dock} aria-hidden="true"><i className={s.appFinder}/><i className={s.appBrowser}/><i className={s.appNotes}/><i className={`${s.appDoc} ${s.appActive}`}/></div>
              : <div className={s.taskbar}>
                <span className={s.taskApps} aria-hidden="true">
                  <i className={s.appStart}/><i className={s.appFolder}/><i className={s.appBrowser}/><i className={`${s.appDoc} ${s.appActive}`}/>
                </span>
                <span className={s.tray}>{running && trayButton}<Glyphs/><span className={s.clock}>{clock}</span></span>
              </div>}

            {menu && <div ref={menuRef} className={s.trayMenu} role="menu" aria-label="SnapSlot" onKeyDown={navigateMenu}>
              <button role="menuitem" onClick={openSettings}><span className={s.check}/>{a.menu.settings}</button>
              <hr/>
              <button role="menuitemcheckbox" aria-checked={intake} onClick={() => { closeMenu(); toggleIntake(); }}><span className={s.check}>{intake ? "✓" : ""}</span>{a.menu.intake}</button>
              <button role="menuitemcheckbox" aria-checked={pinned} onClick={() => { closeMenu(); togglePinned(); }}><span className={s.check}>{pinned ? "✓" : ""}</span>{a.menu.pin}</button>
              <hr/>
              <button role="menuitem" onClick={quitDemo}><span className={s.check}/>{a.menu.quit}</button>
            </div>}

            {coach && coachBox && <>
              <span className={s.coachRing} data-target={coach} style={{ left: coachBox.x, top: coachBox.y, width: coachBox.w, height: coachBox.h }} aria-hidden="true"/>
              <div
                ref={coachRef}
                className={s.coach}
                data-side={coachSide}
                style={coachSide === "right"
                  ? { left: coachBox.x + coachBox.w + 14, top: coachBox.y + coachBox.h / 2 }
                  : coachSide === "left"
                  ? { left: coachBox.x - 14, top: coachBox.y + coachBox.h / 2 }
                  : coachSide === "below"
                    ? { left: coachBox.x + coachBox.w / 2, top: coachBox.y + coachBox.h + 12, "--shift": `${coachShift}px` } as React.CSSProperties
                    : { left: coachBox.x + coachBox.w / 2, top: coachBox.y - 12, "--shift": `${coachShift}px` } as React.CSSProperties}
                role="status"
                aria-live="polite"
              >
                <span className={s.coachStep}>{step + 1}/{STEPS.length}</span>
                <span>{coachText}</span>
                <button onClick={() => setStep(STEPS.length + 1)} aria-label={t.coach.skip}>×</button>
              </div>
            </>}
            {step === STEPS.length && <p className={s.coachDone} aria-hidden="true" onAnimationEnd={() => setStep(STEPS.length + 1)}>{t.coach.done}</p>}
          </div>
        </section>
      </div>

      <section className={s.bento} id="features">
        <article className={`${s.tile} ${s.tileDark} ${s.wide}`} data-reveal>
          <h2>{t.bento.selectTitle[0]}<br/>{t.bento.selectTitle[1]}</h2>
          <p className={s.selectable}>{t.bento.selectLine}</p>
          <p className={s.tileFoot}>{t.bento.selectFoot} <Keys keys={[...mod, "T"]}/></p>
        </article>

        <article className={s.tile} data-reveal>
          <h2>{notes.length}<small> / 30</small></h2>
          <div className={s.meter} aria-label={fill(t.bento.capacityLabel, notes.length)}>
            {Array.from({ length: CAPACITY }, (_, i) => <i key={i} className={i < notes.length ? s.meterOn : ""}/>)}
          </div>
          <p className={s.tileFoot}>{t.bento.capacityFoot}</p>
        </article>

        <article className={s.tile} data-reveal>
          <h2>{t.bento.skinTitle}</h2>
          <div className={s.skins} role="radiogroup" aria-label={t.bento.skinTitle}>
            {SKINS.map((option, i) => <button key={option} role="radio" aria-checked={skin === option} className={`${s.skin} ${skin === option ? s.skinOn : ""}`} data-swatch={option} onClick={() => setSkin(option)}>
              <span/>{t.skins[i]}
            </button>)}
          </div>
          <p className={s.tileFoot}>{t.bento.skinFoot}</p>
        </article>

        <article className={`${s.tile} ${s.wide} ${s.tilePrivacy}`} data-reveal>
          <h2>{t.bento.privacyTitle[0]}<br/>{t.bento.privacyTitle[1]}</h2>
          <p className={s.tileFoot}>{t.bento.privacyFoot}</p>
        </article>
      </section>
    </main>

    <footer className={s.footer}>
      <div className={s.footerInner}>
        <Mark size={44}/>
        <p className={s.footerName}>SnapSlot{t.name && <small>{t.name}</small>}</p>
        <p className={s.footerTagline}>{t.footer.tagline}</p>
        <nav className={s.footerLinks} aria-label={t.footer.contact}>
          <a href={githubReleases} target="_blank" rel="noopener"><GitHubMark size={15}/>GitHub Releases</a>
          <a href={`mailto:${EMAIL}`} title={t.footer.contact}><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="1.5" y="3" width="13" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="m2.5 4.5 5.5 4 5.5-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>{EMAIL}</a>
        </nav>
        <p className={s.legal}>© 2026 SnapSlot · {t.footer.license} · {t.get.meta}</p>
      </div>
    </footer>

    {chip && <button className={s.chip} style={{ left: chip.x, top: chip.y }} onMouseDown={(e) => e.preventDefault()} onClick={pinSelection}>
      {t.chip} <Keys keys={[...mod, "T"]}/>
    </button>}
  </div>;
}

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { homeCopy, fill } from "../website/lib/home-copy";
import { locales, localeNames, type Locale } from "../website/lib/locales";
import { navigateMenu } from "../website/lib/menu-navigation";
import s from "../website/components/home.module.css";
import { interactionCopy } from "../website/lib/interaction-copy";
import "../website/assets/fonts/fonts.css";
import {
  send,
  type Appearance,
  type AppPreferences,
  type Message,
  type NativeItem,
  type Surface,
  type Shortcut,
  type ShortcutTarget,
  type ShortcutChange,
  type UpdateStatus,
} from "./protocol";
import { shortcutCopy } from "./shortcut-copy";
import { nativeCopy } from "./native-copy";
import "./native.css";

const appearances: Appearance[] = ["glass", "paper", "graphite"];
const openShortcut: Shortcut = { key: "Space", control: true, alt: true, shift: false, meta: false };
const defaults: AppPreferences = {
  collectImages: true,
  textShortcut: { ...openShortcut, key: "KeyT" },
  openShortcut,
  launchAtLogin: false,
  showInDock: true,
};
const opacitySteps = [1, 0.85, 0.6];

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button className={`${s.toggle} ${on ? s.toggleOn : ""}`} role="switch" aria-checked={on} aria-label={label} onClick={onChange}>
      <span />
    </button>
  );
}
function Keys({ keys }: { keys: string[] }) {
  return (
    <span className={s.keys}>
      {keys.map(key => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut) {
  return (
    event.code === shortcut.key &&
    event.ctrlKey === shortcut.control &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift &&
    event.metaKey === shortcut.meta
  );
}
function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest("textarea, input, [contenteditable='true']");
}

function App() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "rail";
  const [preview, setPreview] = useState<NativeItem | null>(null);
  const [editingPreview, setEditingPreview] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeDraft, setComposeDraft] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const [fullImages, setFullImages] = useState<Record<string, string>>({});
  const [ocrMap, setOcrMap] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});
  const [floatItem, setFloatItem] = useState<NativeItem | null>(null);
  const [floatOpacity, setFloatOpacity] = useState(1);
  const [version, setVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: "idle", currentVersion: "" });
  const previewRef = useRef<NativeItem | null>(null);
  const editingPreviewRef = useRef(false);
  const composingRef = useRef(false);
  const previewClose = useRef<HTMLButtonElement>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  const composeInput = useRef<HTMLTextAreaElement>(null);
  const editInput = useRef<HTMLTextAreaElement>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [platform, setPlatform] = useState<"macos" | "windows">("macos");
  const [items, setItems] = useState<NativeItem[]>([]);
  const itemsRef = useRef<NativeItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [arming, setArming] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>("glass");
  const [preferences, setPreferences] = useState(defaults);
  const [count, setCount] = useState(0);
  const [focus, setFocus] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);
  const [narrow, setNarrow] = useState(() => matchMedia("(max-width: 760px)").matches);
  const [wide, setWide] = useState(() => matchMedia("(min-width: 1100px)").matches);
  const [fresh, setFresh] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");
  const [shortcutChanges, setShortcutChanges] = useState<ShortcutChange[]>([]);
  const currentPreferences = useRef(defaults);
  const recordingReady = useRef(false);
  const [recording, setRecording] = useState<ShortcutTarget | null>(null);
  const [recordError, setRecordError] = useState("");
  const settingsPanel = useRef<HTMLElement>(null);
  const settingsHeight = useRef(0);
  const dial = useRef<HTMLDivElement>(null);
  const known = useRef(new Map<string, NativeItem>());
  const initialized = useRef(false);
  const focusId = useRef("");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const focusAfterRemoval = useRef(false);
  const wheel = useRef(0);
  const pointer = useRef<{ id: string; x: number; y: number; time: number } | null>(null);
  const dragged = useRef(false);
  const hostPointer = useRef<{ x: number; y: number } | null>(null);
  const wakeSurfaces = useRef<() => void>(() => {});
  const a = homeCopy[locale];
  const interaction = interactionCopy[locale];
  const nc = nativeCopy[locale];

  editingPreviewRef.current = editingPreview;
  composingRef.current = composing;
  itemsRef.current = items;

  function closePreview() {
    previewRef.current = null;
    setPreview(null);
    setEditingPreview(false);
    send({ type: "closePreview" });
    (dial.current?.querySelector<HTMLElement>("[data-focus='true']") || previewTrigger.current)?.focus({ preventScroll: true });
  }
  function enlarge(item: NativeItem, trigger?: HTMLElement | null) {
    if (composingRef.current) closeComposer();
    previewRef.current = item;
    if (trigger) previewTrigger.current = trigger;
    setEditingPreview(false);
    setPreview(item);
    send({ type: "preview", id: item.id });
  }
  function stepPreview(delta: -1 | 1) {
    const current = previewRef.current;
    const list = itemsRef.current;
    if (!current || list.length <= 1) return;
    const idx = list.findIndex(item => item.id === current.id);
    if (idx < 0) return;
    const nextIdx = Math.min(Math.max(idx + delta, 0), list.length - 1);
    if (nextIdx === idx) return;
    const nextItem = list[nextIdx];
    setFocus(nextIdx);
    focusId.current = nextItem.id;
    previewRef.current = nextItem;
    setEditingPreview(false);
    setPreview(nextItem);
    send({ type: "preview", id: nextItem.id });
  }
  function openComposer() {
    if (previewRef.current) closePreview();
    composingRef.current = true;
    setComposeDraft("");
    setComposing(true);
    send({ type: "beginCompose" });
  }
  function closeComposer() {
    if (!composingRef.current) return;
    composingRef.current = false;
    setComposing(false);
    setComposeDraft("");
    send({ type: "endCompose" });
  }
  function submitComposer() {
    const trimmed = composeDraft.trim();
    if (!trimmed) return;
    composingRef.current = false;
    setComposing(false);
    setComposeDraft("");
    send({ type: "createText", text: trimmed });
  }
  function startEditPreview() {
    if (!previewRef.current || previewRef.current.kind !== "text") return;
    setEditDraft(previewRef.current.text || "");
    setEditingPreview(true);
  }
  function saveEditPreview() {
    const current = previewRef.current;
    const trimmed = editDraft.trim();
    if (!current || !trimmed) return;
    send({ type: "updateText", id: current.id, text: editDraft });
    setEditingPreview(false);
  }
  function runOcr(id: string) {
    setOcrMap(prev => ({ ...prev, [id]: { loading: true } }));
    send({ type: "ocr", id });
  }
  function floatNote(item: NativeItem) {
    if (previewRef.current) closePreview();
    send({ type: "float", id: item.id });
  }
  function collectSelection() {
    const text = getSelection()?.toString().trim();
    if (text) {
      if (previewRef.current) closePreview();
      send({ type: "collectText", text });
      getSelection()?.removeAllRanges();
    }
  }

  useLayoutEffect(() => {
    if (preview && !editingPreview) previewClose.current?.focus({ preventScroll: true });
    if (editingPreview) editInput.current?.focus({ preventScroll: true });
    if (composing) composeInput.current?.focus({ preventScroll: true });
    wakeSurfaces.current();
  }, [preview, editingPreview, composing, dropActive, items.length]);

  function later(key: string, fn: () => void, ms: number) {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(fn, ms));
  }
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
        const next = message.items.map(item => ({
          ...item,
          text: item.text ?? previous.get(item.id)?.text,
          preview: item.preview ?? previous.get(item.id)?.preview,
          width: item.width ?? previous.get(item.id)?.width,
          height: item.height ?? previous.get(item.id)?.height,
        }));
        const arrivals = next.filter(item => !previous.has(item.id));
        const liveIds = new Set(next.map(item => item.id));
        setItems(next);
        setCount(message.count);
        if (message.version) {
          setVersion(message.version);
          setUpdateStatus(prev => (prev.currentVersion ? prev : { ...prev, currentVersion: message.version! }));
        }
        setFullImages(prev => {
          const keys = Object.keys(prev);
          if (keys.every(id => liveIds.has(id))) return prev;
          const kept: Record<string, string> = {};
          for (const id of keys) if (liveIds.has(id)) kept[id] = prev[id];
          return kept;
        });
        setOcrMap(prev => {
          const keys = Object.keys(prev);
          if (keys.every(id => liveIds.has(id))) return prev;
          const kept: Record<string, { loading: boolean; text?: string; error?: string }> = {};
          for (const id of keys) if (liveIds.has(id)) kept[id] = prev[id];
          return kept;
        });
        if (previewRef.current) {
          const updatedPreview = next.find(item => item.id === previewRef.current?.id) || null;
          if (!updatedPreview) {
            previewRef.current = null;
            setPreview(null);
            setEditingPreview(false);
            send({ type: "closePreview" });
          } else {
            previewRef.current = updatedPreview;
            setPreview(updatedPreview);
          }
        }
        if (!message.expanded && composingRef.current) {
          composingRef.current = false;
          setComposing(false);
        }
        setExpanded(message.expanded);
        setArming(message.arming);
        setPinned(message.pinned);
        if (message.platform) setPlatform(message.platform);
        if (locales.includes(message.locale as Locale)) setLocale(message.locale as Locale);
        if (appearances.includes(message.appearance)) setAppearance(message.appearance);
        document.documentElement.classList.toggle("reduce-motion", message.reducedMotion);
        // Keep the selected card stable through incremental state updates and removals.
        const selected = next.findIndex(item => item.id === focusId.current);
        const nextFocus = arrivals.length ? next.length - 1 : selected >= 0 ? selected : Math.max(0, next.length - 1);
        setFocus(nextFocus);
        focusId.current = next[nextFocus]?.id || "";
        if (initialized.current && arrivals.length) {
          setFresh(arrivals.map(item => item.id));
          later("fresh", () => setFresh([]), 1400);
        }
        initialized.current = true;
        known.current = new Map(next.map(item => [item.id, item]));
        if (message.focus) setFocusRequest(value => value + 1);
      } else if (message.type === "preferences") {
        const merged: AppPreferences = {
          ...defaults,
          ...message.value,
          launchAtLogin: message.value.launchAtLogin ?? false,
          showInDock: message.value.showInDock ?? true,
        };
        currentPreferences.current = merged;
        setPreferences(merged);
        setPlatform(message.platform);
        setShortcutChanges(message.shortcutChanges || []);
        if (message.version) {
          setVersion(message.version);
          setUpdateStatus(prev => (prev.currentVersion ? prev : { ...prev, currentVersion: message.version! }));
        }
      } else if (message.type === "recordingCancelled") {
        recordingReady.current = false;
        setRecording(null);
      } else if (message.type === "recordingReady") {
        recordingReady.current = true;
      } else if (message.type === "shortcutKey") {
        window.dispatchEvent(
          new KeyboardEvent(message.down ? "keydown" : "keyup", {
            code: message.code,
            key: message.key,
            ctrlKey: message.control,
            altKey: message.alt,
            shiftKey: message.shift,
            metaKey: message.meta,
            repeat: message.repeat,
            bubbles: true,
          })
        );
      } else if (message.type === "copied") {
        setCopied(message.id);
        later("copied", () => setCopied(""), 1400);
      } else if (message.type === "pointer") {
        hostPointer.current = message.x !== null && message.y !== null ? { x: message.x, y: message.y } : null;
        updateHover();
        wakeSurfaces.current();
      } else if (message.type === "previewImage") {
        setFullImages(prev => ({ ...prev, [message.id]: message.src }));
        setFloatItem(prev => (prev && prev.id === message.id ? { ...prev, preview: message.src } : prev));
      } else if (message.type === "ocrResult") {
        setOcrMap(prev => ({
          ...prev,
          [message.id]: { loading: false, text: message.text, error: message.error },
        }));
      } else if (message.type === "updateStatus") {
        setUpdateStatus(message.value);
      } else if (message.type === "dropTarget") {
        setDropActive(message.active);
      } else if (message.type === "floatNote") {
        setFloatItem(message.item);
        if (!message.item) {
          setOcrMap({});
          setCopied("");
        }
        setPlatform(message.platform);
        if (locales.includes(message.locale as Locale)) setLocale(message.locale as Locale);
        if (appearances.includes(message.appearance)) setAppearance(message.appearance);
        if (typeof message.opacity === "number") setFloatOpacity(message.opacity);
        document.documentElement.classList.toggle("reduce-motion", message.reducedMotion);
      } else if (message.type === "error") {
        setNotice(message.message);
        later("notice", () => setNotice(""), 7000);
      }
    }
    const receiveWebView = (event: { data: Message }) => receive(event.data);
    window.snapslotReceive = receive;
    window.chrome?.webview?.addEventListener("message", receiveWebView);
    send({ type: "ready" });
    return () => {
      delete window.snapslotReceive;
      window.chrome?.webview?.removeEventListener("message", receiveWebView);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const narrowMedia = matchMedia("(max-width: 760px)");
    const wideMedia = matchMedia("(min-width: 1100px)");
    const updateNarrow = () => setNarrow(narrowMedia.matches);
    const updateWide = () => setWide(wideMedia.matches);
    narrowMedia.addEventListener("change", updateNarrow);
    wideMedia.addEventListener("change", updateWide);
    return () => {
      narrowMedia.removeEventListener("change", updateNarrow);
      wideMedia.removeEventListener("change", updateWide);
    };
  }, []);

  useLayoutEffect(() => {
    focusId.current = items[focus]?.id || "";
    updateHover();
    wakeSurfaces.current();
    if (focusAfterRemoval.current) {
      focusAfterRemoval.current = false;
      dial.current?.querySelector<HTMLButtonElement>("[data-focus='true']")?.focus({ preventScroll: true });
    }
  }, [items, focus, expanded, arming, appearance, narrow, wide]);

  useEffect(() => {
    if (!focusRequest) return;
    if (composingRef.current) composeInput.current?.focus({ preventScroll: true });
    else if (!previewRef.current) dial.current?.querySelector<HTMLButtonElement>("[data-focus='true']")?.focus({ preventScroll: true });
  }, [focusRequest]);

  // A WKWebView cannot blur the desktop outside its own document. Supply the
  // animated card geometry to AppKit's behind-window material, below the web view.
  useEffect(() => {
    if (mode !== "rail") return;
    let frame = 0;
    let until = 0;
    let last = "";
    let disposed = false;
    const measure = () => {
      frame = 0;
      const node = dial.current;
      const surfaces: Surface[] = [];
      if (node) {
        const dialOpacity = Number(getComputedStyle(node).opacity);
        node.querySelectorAll<HTMLElement>("[data-arm]").forEach(arm => {
          const face = arm.querySelector<HTMLElement>("[data-note]")!;
          const card = face.parentElement!;
          const style = getComputedStyle(arm);
          const rect = face.getBoundingClientRect();
          const rotation = new DOMMatrix(style.transform);
          const scale = new DOMMatrix(getComputedStyle(card).transform);
          const opacity = dialOpacity * Number(style.opacity) * Number(getComputedStyle(card).opacity);
          if (opacity < 0.01 || rect.bottom < 0 || rect.top > innerHeight || arm.getAttribute("aria-hidden") === "true") return;
          const size = Math.hypot(scale.a, scale.b) * (parseFloat(getComputedStyle(card).scale) || 1);
          surfaces.push({
            id: arm.dataset.arm!,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: face.offsetWidth * size,
            height: face.offsetHeight * size,
            angle: (Math.atan2(rotation.b, rotation.a) * 180) / Math.PI,
            opacity,
          });
        });
      }
      document.querySelectorAll<HTMLElement>("[data-native-region]").forEach(region => {
        const r = region.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        surfaces.push({
          id: region.dataset.nativeRegion!,
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          width: r.width,
          height: r.height,
          angle: 0,
          opacity: 1,
        });
      });
      const value = JSON.stringify(surfaces);
      if (value !== last) {
        last = value;
        send({ type: "surfaces", surfaces });
      }
      if (!disposed && performance.now() < until) frame = requestAnimationFrame(measure);
    };
    const wake = () => {
      until = performance.now() + 850;
      if (!frame) frame = requestAnimationFrame(measure);
    };
    wakeSurfaces.current = wake;
    wake();
    addEventListener("resize", wake);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      removeEventListener("resize", wake);
      wakeSurfaces.current = () => {};
    };
  }, [mode, appearance]);

  useEffect(() => {
    const node = dial.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      wheel.current += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(wheel.current) < 40) return;
      const by = Math.sign(wheel.current);
      wheel.current = 0;
      setFocus(value => Math.min(Math.max(value + by, 0), Math.max(0, known.current.size - 1)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode === "float") {
        if (event.key === "Escape" && floatItem) {
          event.preventDefault();
          send({ type: "closeFloat", id: floatItem.id });
        }
        return;
      }
      if (event.key === "Escape" && !recording) {
        event.preventDefault();
        if (editingPreviewRef.current) setEditingPreview(false);
        else if (previewRef.current) closePreview();
        else if (composingRef.current) closeComposer();
        else send({ type: mode === "rail" ? "collapse" : "close" });
        return;
      }
      if (mode === "rail" && previewRef.current && !editingPreviewRef.current && !isEditableTarget(event.target)) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          stepPreview(-1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          stepPreview(1);
          return;
        }
        if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          send({ type: "copy", id: previewRef.current.id });
          return;
        }
      }
      if (mode === "rail" && !editingPreviewRef.current && !composingRef.current && matchesShortcut(event, currentPreferences.current.textShortcut) && getSelection()?.toString().trim()) {
        event.preventDefault();
        collectSelection();
        return;
      }
      if (mode === "rail" && expanded && !previewRef.current && !composingRef.current && !isEditableTarget(event.target) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        if (event.key === "n" || event.key === "N") {
          event.preventDefault();
          openComposer();
        }
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [mode, recording, expanded, floatItem]);

  useEffect(() => {
    if (!recording) return;
    recordingReady.current = false;
    let candidate: Shortcut | null = null;
    const copy = shortcutCopy[locale];
    const down = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!recordingReady.current) return;
      if (event.key === "Escape") {
        setRecording(null);
        return;
      }
      if (event.repeat || /^(Control|Alt|Shift|Meta)(Left|Right)$/.test(event.code)) return;
      candidate = null;
      if (!/^(Key[A-Z]|Digit[0-9]|Space|F([1-9]|10|11))$/.test(event.code) || !(event.ctrlKey || event.altKey || event.metaKey)) {
        setRecordError(
          copy.invalid
            .replaceAll("Control", platform === "windows" ? "Ctrl" : "Control")
            .replaceAll("Option", platform === "windows" ? "Alt" : "Option")
            .replaceAll("Command", platform === "windows" ? "Win" : "Command")
        );
        return;
      }
      const value = { key: event.code, control: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey };
      if (value.key === "KeyC" && !value.alt && !value.shift && value.control !== value.meta) {
        setRecordError(copy.copyReserved);
        return;
      }
      setRecordError("");
      candidate = value;
    };
    const up = (event: KeyboardEvent) => {
      if (!candidate || event.code !== candidate.key) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Register after the key is released, so recording does not trigger its action.
      send({
        type: "savePreferences",
        value: { ...currentPreferences.current, [recording === "text" ? "textShortcut" : "openShortcut"]: candidate },
        editingShortcut: recording,
      });
      candidate = null;
      setRecording(null);
    };
    const cancel = () => setRecording(null);
    const outside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(`[data-shortcut-row="${recording}"]`)) cancel();
    };
    send({ type: "beginShortcutRecording" });
    addEventListener("keydown", down, true);
    addEventListener("keyup", up, true);
    addEventListener("blur", cancel);
    addEventListener("pointerdown", outside, true);
    return () => {
      recordingReady.current = false;
      removeEventListener("keydown", down, true);
      removeEventListener("keyup", up, true);
      removeEventListener("blur", cancel);
      removeEventListener("pointerdown", outside, true);
      send({ type: "endShortcutRecording" });
    };
  }, [recording, platform, locale]);

  useLayoutEffect(() => {
    if (!settingsPanel.current) return;
    const body = settingsPanel.current.querySelector<HTMLElement>(`.${s.windowBody}`)!;
    const header = settingsPanel.current.querySelector<HTMLElement>("header")!;
    const height = Math.ceil(header.offsetHeight + body.scrollHeight);
    if (height !== settingsHeight.current) {
      settingsHeight.current = height;
      send({ type: "resizePreferences", height });
    }
  }, [platform, shortcutChanges, recording, recordError, locale, updateStatus.status]);

  const savePreferences = (next: AppPreferences) => send({ type: "savePreferences", value: next });
  const togglePin = () => send({ type: pinned ? "unpin" : "pin" });
  const closeMenu = () => send({ type: "close" });
  const mac = platform === "macos";
  const keys = (value: AppPreferences["textShortcut"]) =>
    [
      value.control ? (mac ? "⌃" : "Ctrl") : "",
      value.alt ? (mac ? "⌥" : "Alt") : "",
      value.shift ? (mac ? "⇧" : "Shift") : "",
      value.meta ? (mac ? "⌘" : "Win") : "",
      value.key.replace(/^Key|^Digit/, ""),
    ].filter(Boolean);

  const shortcutRow = (target: ShortcutTarget, title: string, value: Shortcut) => {
    const copy = shortcutCopy[locale];
    const change = shortcutChanges.find(item => item.target === target);
    const conflict = change ? copy.conflict.replace("{old}", keys(change.requested).join(" + ")).replace("{new}", keys(change.replacement).join(" + ")) : "";
    const hint = [conflict, recording === target ? recordError || copy.hint : ""].filter(Boolean).join(" ");
    return (
      <div className="native-shortcut-row" data-shortcut-row={target}>
        <div className={s.row} data-settings-row>
          <span>{title}</span>
          <button
            className="native-shortcut"
            aria-label={`${title} · ${copy.change}`}
            aria-pressed={recording === target}
            title={copy.change}
            onClick={() => {
              setRecordError("");
              setRecording(recording === target ? null : target);
            }}
          >
            {change && (
              <svg className="native-shortcut-warning" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="currentColor" />
                <path d="M8 4.5v4M8 11v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {recording === target ? (
              <span>{copy.record}</span>
            ) : (
              <>
                <Keys keys={keys(value)} />
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m10.5 2.5 3 3M3 10l7-7a2.12 2.12 0 0 1 3 3l-7 7-4 1 1-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </div>
        {hint && (
          <p className="native-shortcut-hint" role="status" aria-live="polite">
            {hint}
          </p>
        )}
      </div>
    );
  };

  const remove = (item: NativeItem, index: number) => {
    const next = items[index - 1] || items[index + 1];
    focusId.current = next?.id || "";
    focusAfterRemoval.current = !!document.activeElement?.closest("[data-arm]");
    send({ type: "remove", id: item.id });
  };
  const select = (index: number, keyboard = false) => {
    setFocus(index);
    focusId.current = items[index]?.id || "";
    if (keyboard) later("focus", () => dial.current?.querySelector<HTMLButtonElement>(`[data-index='${index}']`)?.focus({ preventScroll: true }), 0);
  };

  if (mode === "float") {
    const item = floatItem;
    const ocr = item ? ocrMap[item.id] : undefined;
    const cycleOpacity = () => {
      if (!item) return;
      const currentIdx = opacitySteps.findIndex(v => Math.abs(v - floatOpacity) < 0.05);
      const next = opacitySteps[(currentIdx + 1) % opacitySteps.length];
      setFloatOpacity(next);
      send({ type: "setFloatOpacity", id: item.id, opacity: next });
    };
    return (
      <main className={`${s.page} ${s.embedded} native-page`} data-skin={appearance}>
        <div className={`${s.stage} native-surface`} data-os={mac ? "mac" : "win"} data-mode="float" data-density="regular">
          {item && (
            <section
              className="native-float-root"
              aria-label={item.title}
              onWheel={event => {
                if (item.kind !== "image") return;
                event.preventDefault();
                send({ type: "resizeFloat", id: item.id, delta: event.deltaY < 0 ? 1 : -1 });
              }}
            >
              <header
                className="native-float-bar"
                onPointerDown={event => {
                  if (event.button === 0 && !(event.target as HTMLElement).closest("button")) send({ type: "moveFloat", id: item.id });
                }}
                onDoubleClick={() => send({ type: "closeFloat", id: item.id })}
              >
                <span className="native-float-title">{item.title}</span>
                <span className="native-float-controls">
                  <button type="button" title={nc.floatOpacity} aria-label={nc.floatOpacity} onClick={cycleOpacity}>
                    {Math.round(floatOpacity * 100)}%
                  </button>
                  <button type="button" title={nc.copy} aria-label={nc.copy} onClick={() => send({ type: "copy", id: item.id })}>
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
                      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M10.5 5.5V3.6A1.6 1.6 0 0 0 8.9 2H3.6A1.6 1.6 0 0 0 2 3.6v5.3a1.6 1.6 0 0 0 1.6 1.6h1.9" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </button>
                  {item.kind === "image" && (
                    <button type="button" disabled={ocr?.loading} title={nc.ocr} aria-label={nc.ocr} onClick={() => runOcr(item.id)}>
                      {ocr?.loading ? (
                        "…"
                      ) : (
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
                          <path d="M2.5 5V3.5a1 1 0 0 1 1-1H5M11 2.5h1.5a1 1 0 0 1 1 1V5M13.5 11v1.5a1 1 0 0 1-1 1H11M5 13.5H3.5a1 1 0 0 1-1-1V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          <path d="M5.5 6h5M8 6v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button type="button" className="native-float-close" title={nc.floatClose} aria-label={nc.floatClose} onClick={() => send({ type: "closeFloat", id: item.id })}>
                    ×
                  </button>
                </span>
              </header>
              <div
                className="native-float-body"
                onPointerDown={event => {
                  if (item.kind === "image" && event.button === 0 && !(event.target as HTMLElement).closest(".native-float-ocr")) {
                    send({ type: "moveFloat", id: item.id });
                  }
                }}
              >
                {item.kind === "image" ? <img src={fullImages[item.id] || item.preview} alt={item.title} draggable={false} /> : <p>{item.text}</p>}
                {ocr && !ocr.loading && (ocr.text || ocr.error) && (
                  <div className="native-float-ocr">
                    <div className="native-float-ocr-bar">
                      <span>{nc.ocrTitle}</span>
                      {ocr.text && (
                        <button type="button" onClick={() => send({ type: "copyText", text: ocr.text! })}>
                          {nc.copy}
                        </button>
                      )}
                    </div>
                    <pre className="native-float-ocr-text">{ocr.text || ocr.error}</pre>
                  </div>
                )}
                {copied === item.id && <span className="native-float-copied">{a.stage.copied}</span>}
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  const reach = wide ? 2.2 : 1.25;
  const previewIndex = preview ? items.findIndex(item => item.id === preview.id) : -1;
  const previewOcr = preview ? ocrMap[preview.id] : undefined;
  const updateSubtitle =
    updateStatus.status === "checking"
      ? nc.checkingUpdates
      : updateStatus.status === "upToDate"
        ? nc.upToDate
        : updateStatus.status === "available" && updateStatus.latestVersion
          ? nc.updateAvailable.replace("{v}", updateStatus.latestVersion)
          : updateStatus.status === "error"
            ? updateStatus.message || nc.updateFailed
            : version
              ? `v${version}`
              : "";

  return (
    <main className={`${s.page} ${s.embedded} native-page`} data-skin={appearance}>
      <div className={`${s.stage} native-surface`} data-os={mac ? "mac" : "win"} data-mode={mode} data-density="regular">
        {mode === "tray" ? (
          <div className={`${s.trayMenu} native-menu`} role="menu" aria-label="SnapSlot" onKeyDown={navigateMenu}>
            <button role="menuitem" onClick={() => send({ type: "openPreferences" })}>
              <span className={s.check} />
              {a.menu.settings}
            </button>
            <hr />
            <button
              role="menuitemcheckbox"
              aria-checked={preferences.collectImages}
              onClick={() => {
                savePreferences({ ...preferences, collectImages: !preferences.collectImages });
                closeMenu();
              }}
            >
              <span className={s.check}>{preferences.collectImages ? "✓" : ""}</span>
              {a.menu.intake}
            </button>
            <button
              role="menuitemcheckbox"
              aria-checked={pinned}
              onClick={() => {
                togglePin();
                closeMenu();
              }}
            >
              <span className={s.check}>{pinned ? "✓" : ""}</span>
              {a.menu.pin}
            </button>
            <hr />
            <button role="menuitem" onClick={() => send({ type: "quit" })}>
              <span className={s.check} />
              {a.menu.quit}
            </button>
          </div>
        ) : mode !== "rail" ? (
          <section
            ref={settingsPanel}
            className={`${s.window} native-window`}
            onPointerDown={event => {
              if (event.button === 0 && !(event.target as HTMLElement).closest("button, select, input, a, [role=switch], [data-swatch], [data-shortcut-row]")) {
                send({ type: "moveWindow" });
              }
            }}
            role="dialog"
            aria-label={a.settings.title}
          >
            <header className={s.windowBar} data-drag-region>
              {mac ? (
                <span className={s.lights}>
                  <button onClick={() => send({ type: "close" })} aria-label={a.settings.close} />
                  <button onClick={() => send({ type: "minimizePreferences" })} aria-label={shortcutCopy[locale].minimize} />
                  <i />
                </span>
              ) : (
                <span className={s.mark} style={{ width: 20, height: 20 }} aria-hidden="true" />
              )}
              <span>{a.settings.title}</span>
              {!mac && (
                <span className="native-window-controls">
                  <button className="native-minimize" onClick={() => send({ type: "minimizePreferences" })} aria-label={shortcutCopy[locale].minimize}>
                    −
                  </button>
                  <button className={s.windowClose} onClick={() => send({ type: "close" })} aria-label={a.settings.close}>
                    ×
                  </button>
                </span>
              )}
            </header>
            <div className={s.windowBody}>
              <div className={s.row} data-settings-row>
                <span>
                  {a.menu.intake}
                  <small>{a.settings.intakeHint}</small>
                </span>
                <Toggle on={preferences.collectImages} label={a.menu.intake} onChange={() => savePreferences({ ...preferences, collectImages: !preferences.collectImages })} />
              </div>
              <div className={s.row} data-settings-row>
                <span>
                  {a.menu.pin}
                  <small>{a.settings.pinHint}</small>
                </span>
                <Toggle on={pinned} label={a.menu.pin} onChange={togglePin} />
              </div>
              <div className={s.row} data-settings-row>
                <span>
                  {nc.launchAtLogin}
                  <small>{nc.launchAtLoginHint}</small>
                </span>
                <Toggle
                  on={!!preferences.launchAtLogin}
                  label={nc.launchAtLogin}
                  onChange={() => savePreferences({ ...preferences, launchAtLogin: !preferences.launchAtLogin })}
                />
              </div>
              {mac && (
                <div className={s.row} data-settings-row>
                  <span>
                    {nc.showInDock}
                    <small>{nc.showInDockHint}</small>
                  </span>
                  <Toggle
                    on={preferences.showInDock !== false}
                    label={nc.showInDock}
                    onChange={() => savePreferences({ ...preferences, showInDock: preferences.showInDock === false })}
                  />
                </div>
              )}
              <div className={s.row} data-settings-row>
                <span>{a.settings.look}</span>
                <span className={s.miniSkins}>
                  {appearances.map((option, index) => (
                    <button
                      key={option}
                      className={`${s.miniSkin} ${appearance === option ? s.miniSkinOn : ""}`}
                      data-swatch={option}
                      onClick={() => send({ type: "setAppearance", value: option })}
                      aria-label={a.skins[index]}
                      aria-pressed={appearance === option}
                    />
                  ))}
                </span>
              </div>
              <label className={s.row} data-settings-row>
                <span>{a.settings.language}</span>
                <select className={s.select} value={locale} onChange={event => send({ type: "setLocale", value: event.target.value })}>
                  {locales.map(value => (
                    <option key={value} value={value} lang={value}>
                      {localeNames[value]}
                    </option>
                  ))}
                </select>
              </label>
              {shortcutRow("text", a.settings.pinText, preferences.textShortcut)}
              {shortcutRow("open", a.settings.openNotes, preferences.openShortcut || openShortcut)}
              <div className={s.row} data-settings-row>
                <span>{fill(a.settings.count, count)}</span>
                <button className={s.danger} disabled={!count} onClick={() => send({ type: "clearNotes" })}>
                  {a.settings.clear}
                </button>
              </div>
              <div className={s.row} data-settings-row data-update-row>
                <span>
                  {nc.updates}
                  {updateSubtitle && <small>{updateSubtitle}</small>}
                </span>
                <span className="native-update-group">
                  {updateStatus.status === "available" && updateStatus.releaseUrl ? (
                    <button
                      className="native-update-btn native-update-primary"
                      onClick={() => send({ type: "openUrl", url: updateStatus.releaseUrl! })}
                    >
                      {nc.downloadUpdate}
                    </button>
                  ) : (
                    <button
                      className="native-update-btn"
                      disabled={updateStatus.status === "checking"}
                      onClick={() => {
                        setUpdateStatus(prev => ({ ...prev, status: "checking" }));
                        send({ type: "checkUpdates" });
                      }}
                    >
                      {updateStatus.status === "checking" ? nc.checkingUpdates : nc.checkUpdates}
                    </button>
                  )}
                </span>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className={`${s.edgeGlow} ${arming || dropActive ? s.edgeArming : ""}`} aria-hidden="true">
              <i />
            </div>
            {dropActive && (
              <div className="native-drop-banner" role="status" aria-live="polite">
                <span>{nc.dropHint}</span>
              </div>
            )}
            <div ref={dial} className={`${s.dial} ${expanded ? s.dialOpen : ""} ${arming ? s.dialArming : ""}`} role="list" aria-label={a.stage.list} inert={!expanded} aria-hidden={!expanded}>
              {items.map((item, index) => {
                const d = index - focus;
                const hidden = Math.abs(d) > reach;
                const Face = item.kind === "text" ? "div" : "button";
                const cardOpacity = hidden ? 0 : Math.max(0.25, 1 - Math.max(Math.abs(d) - reach + 1, 0) * (reach > 1.5 ? 0.35 : 0.7));
                return (
                  <div
                    key={item.id}
                    role="listitem"
                    data-arm={item.id}
                    data-kind={item.kind}
                    className={`${s.arm} ${item.kind === "text" ? s.textNote : ""} ${fresh.includes(item.id) ? s.fresh : ""} ${d === 0 ? s.current : ""}`}
                    aria-hidden={hidden}
                    style={{ "--d": d, "--ad": Math.abs(d), zIndex: 50 - Math.round(Math.abs(d) * 2), opacity: cardOpacity, pointerEvents: hidden ? "none" : undefined } as React.CSSProperties}
                  >
                    <div className={s.card}>
                      <span className={s.pin} aria-hidden="true" />
                      <Face
                        role={item.kind === "text" ? "button" : undefined}
                        draggable
                        className={s.face}
                        data-note={item.id}
                        data-index={index}
                        data-focus={d === 0}
                        tabIndex={d === 0 ? 0 : -1}
                        aria-label={item.kind === "text" ? a.stage.copyText + (item.text || "").slice(0, 20) : a.stage.copyImage + item.title}
                        onPointerDown={event => {
                          dragged.current = false;
                          pointer.current = { id: item.id, x: event.clientX, y: event.clientY, time: performance.now() };
                        }}
                        onPointerMove={event => {
                          const start = pointer.current;
                          if (
                            !getSelection()?.toString().trim() &&
                            start?.id === item.id &&
                            event.buttons === 1 &&
                            !dragged.current &&
                            performance.now() - start.time >= 160 &&
                            Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6
                          ) {
                            dragged.current = true;
                            pointer.current = null;
                            send({ type: "drag", id: item.id });
                          }
                        }}
                        onPointerUp={() => {
                          pointer.current = null;
                        }}
                        onPointerCancel={() => {
                          pointer.current = null;
                        }}
                        onDragStart={event => {
                          event.preventDefault();
                          if (dragged.current) return;
                          dragged.current = true;
                          pointer.current = null;
                          const text = getSelection()?.toString().trim();
                          if (text) send({ type: "dragText", text });
                          else send({ type: "drag", id: item.id });
                        }}
                        onClick={() => {
                          if (!dragged.current && !getSelection()?.toString().trim()) {
                            select(index);
                            send({ type: "copy", id: item.id });
                          }
                          dragged.current = false;
                        }}
                        onKeyDown={event => {
                          if (event.ctrlKey || event.altKey || event.metaKey) return;
                          if (event.key === " ") {
                            event.preventDefault();
                            enlarge(item, event.currentTarget);
                            return;
                          }
                          if (event.key === "Enter") {
                            event.preventDefault();
                            send({ type: "copy", id: item.id });
                            return;
                          }
                          if (event.key === "f" || event.key === "F") {
                            event.preventDefault();
                            floatNote(item);
                            return;
                          }
                          if (event.key === "Home" && index > 0) select(0, true);
                          else if (event.key === "End" && index < items.length - 1) select(items.length - 1, true);
                          else if (event.key === "ArrowRight" && index < items.length - 1) select(index + 1, true);
                          else if (event.key === "ArrowLeft" && index > 0) select(index - 1, true);
                          else if (event.key === "Delete" || event.key === "Backspace") remove(item, index);
                          else return;
                          event.preventDefault();
                        }}
                      >
                        {item.kind === "image" ? (
                          <>
                            <span className={s.photo} style={{ backgroundImage: `url("${item.preview}")` }} />
                            <span className={s.photoCaption}>
                              <i />
                              {item.title}
                            </span>
                          </>
                        ) : (
                          <span className={s.noteText} data-note-text>
                            {item.text}
                          </span>
                        )}
                        <span className={`${s.copied} ${copied === item.id ? s.copiedOn : ""}`} role={copied === item.id ? "status" : undefined} aria-hidden={copied !== item.id}>
                          {a.stage.copied}
                        </span>
                      </Face>
                      <button
                        className="native-float-btn native-card-action"
                        aria-label={nc.float}
                        title={nc.float}
                        tabIndex={-1}
                        onClick={() => floatNote(item)}
                      >
                        <svg viewBox="0 0 20 20" width="13" height="13" fill="none" aria-hidden="true">
                          <rect x="3" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M9 3h6a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        className={`${s.enlarge} native-card-action native-enlarge-btn`}
                        aria-label={interaction.zoom}
                        title={interaction.zoom}
                        onClick={event => enlarge(item, event.currentTarget)}
                        tabIndex={d === 0 ? 0 : -1}
                      >
                        <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
                          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <path d="m13 13 4 4M6 8.5h5M8.5 6v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button className={s.remove} aria-label={a.stage.remove} tabIndex={-1} onClick={() => remove(item, index)}>
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
              {!items.length && !composing && (
                <div className="native-empty-wrap" data-native-region="__empty-wrap">
                  <span>{a.stage.empty}</span>
                  <button type="button" className="native-empty-add" onClick={openComposer}>
                    + {nc.quickNote}
                  </button>
                </div>
              )}
              {items.length > 1 && (
                <p className={s.counter} data-native-counter data-note-index aria-hidden="true">
                  {focus + 1} / {items.length}
                </p>
              )}
              {items.length > 0 && expanded && !preview && !composing && (
                <button
                  type="button"
                  className="native-quick-trigger"
                  data-native-region="__compose-trigger"
                  aria-label={nc.quickNote}
                  title={`${nc.quickNote} (N)`}
                  onClick={openComposer}
                >
                  <span>+</span>
                  <span>{nc.quickNote}</span>
                </button>
              )}
            </div>
          </>
        )}
        {mode === "rail" && preview && (
          <>
            <div className="native-preview-backdrop" onClick={closePreview} />
            <section className={`${s.notePreview} native-preview`} role="dialog" aria-label={interaction.zoom} data-native-region="__preview">
              <header>
                <span className="native-preview-title">
                  <b>{preview.title || interaction.zoom}</b>
                  {items.length > 1 && previewIndex >= 0 && (
                    <span className="native-preview-index">
                      {previewIndex + 1} / {items.length}
                    </span>
                  )}
                </span>
                <span className="native-preview-actions">
                  {items.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="native-preview-btn native-preview-icon"
                        disabled={previewIndex <= 0}
                        aria-label={nc.prev}
                        title={nc.prev}
                        onClick={() => stepPreview(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="native-preview-btn native-preview-icon"
                        disabled={previewIndex < 0 || previewIndex >= items.length - 1}
                        aria-label={nc.next}
                        title={nc.next}
                        onClick={() => stepPreview(1)}
                      >
                        ›
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="native-preview-btn"
                    onClick={() => send({ type: "copy", id: preview.id })}
                  >
                    {copied === preview.id ? a.stage.copied : nc.copy}
                  </button>
                  {preview.kind === "text" ? (
                    <button type="button" className="native-preview-btn" onClick={() => (editingPreview ? setEditingPreview(false) : startEditPreview())}>
                      {editingPreview ? nc.cancel : nc.edit}
                    </button>
                  ) : (
                    <button type="button" className="native-preview-btn" disabled={previewOcr?.loading} onClick={() => runOcr(preview.id)}>
                      {previewOcr?.loading ? nc.ocrBusy : nc.ocr}
                    </button>
                  )}
                  <button type="button" className="native-preview-btn" onClick={() => floatNote(preview)}>
                    {nc.float}
                  </button>
                  <button ref={previewClose} className="native-preview-close" aria-label={a.settings.close} onClick={closePreview}>
                    ×
                  </button>
                </span>
              </header>
              <div className={s.previewContent} data-preview-content>
                {preview.kind === "image" ? (
                  <>
                    <img src={fullImages[preview.id] || preview.preview} alt={preview.title} />
                    {previewOcr && !previewOcr.loading && (
                      <div className="native-ocr-box" data-ocr-result>
                        <div className="native-ocr-head">
                          <span>{nc.ocrTitle}</span>
                          {previewOcr.text && (
                            <span className="native-ocr-actions">
                              <button
                                type="button"
                                className="native-btn-ghost"
                                onClick={() => send({ type: "copyText", text: previewOcr.text! })}
                              >
                                {nc.copy}
                              </button>
                              <button
                                type="button"
                                className="native-btn-ghost"
                                onClick={() => {
                                  send({ type: "collectText", text: previewOcr.text! });
                                  closePreview();
                                }}
                              >
                                {nc.ocrCollect}
                              </button>
                            </span>
                          )}
                        </div>
                        <pre className="native-ocr-text">{previewOcr.text || previewOcr.error || nc.ocrEmpty}</pre>
                      </div>
                    )}
                  </>
                ) : editingPreview ? (
                  <div>
                    <textarea
                      ref={editInput}
                      className="native-preview-editor"
                      value={editDraft}
                      onChange={event => setEditDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setEditingPreview(false);
                        } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault();
                          saveEditPreview();
                        }
                      }}
                    />
                    <div className="native-preview-edit-bar">
                      <button type="button" className="native-btn-ghost" onClick={() => setEditingPreview(false)}>
                        {nc.cancel}
                      </button>
                      <button type="button" className="native-btn-primary" disabled={!editDraft.trim()} onClick={saveEditPreview}>
                        {nc.save}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{preview.text}</p>
                )}
              </div>
            </section>
          </>
        )}
        {mode === "rail" && composing && (
          <section className="native-composer" role="dialog" aria-label={nc.quickNote} data-native-region="__composer">
            <header>
              <span>{nc.quickNote}</span>
              <button type="button" aria-label={nc.cancel} onClick={closeComposer}>
                ×
              </button>
            </header>
            <textarea
              ref={composeInput}
              placeholder={nc.quickNotePlaceholder}
              value={composeDraft}
              onChange={event => setComposeDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeComposer();
                } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  submitComposer();
                }
              }}
            />
            <footer>
              <button type="button" className="native-btn-ghost" onClick={closeComposer}>
                {nc.cancel}
              </button>
              <button type="button" className="native-btn-primary" disabled={!composeDraft.trim()} onClick={submitComposer}>
                {nc.save}
              </button>
            </footer>
          </section>
        )}
        <p className={`${s.notice} ${notice ? s.noticeOn : ""} native-notice`} role="status" aria-live="polite">
          {notice}
        </p>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

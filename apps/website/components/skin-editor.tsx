"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { builtInSkins, isSameSkin, MAX_SKIN_BYTES, parseSkin, skinStyle, type Skin } from "@/lib/skin";
import { readSkinImage, SkinImageError } from "@/lib/skin-image";
import { siteCopy } from "@/lib/site-copy";
import type { Locale, Messages } from "@/lib/messages";
import { SampleArtwork } from "./sample-artwork";

export function SkinPreview({ m, skin, label }: { m: Messages; skin: Skin; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const contentWidth = skin.card.width + skin.card.textWidth + skin.card.gap;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(Math.max(.1, Math.min(1, (element.clientWidth - 56) / contentWidth))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [contentWidth]);
  return <div ref={root} className="skin-preview" data-ui="skin-preview" style={skinStyle(skin)} aria-label={label}>
    <div className="preview-composition" style={{ width: contentWidth * scale, height: (skin.card.height + 48) * scale }}><div className="preview-row" style={{ width: contentWidth, transform: `scale(${scale})` }}>
      <div className="preview-card"><span className="card-pin" aria-hidden="true"><i/><b/></span><div className="preview-surface"><SampleArtwork src="/mountains.svg" label={m.sampleImage}/></div></div>
      <div className="preview-card text"><span className="card-pin" aria-hidden="true"><i/><b/></span><div className="preview-surface"><div className="text-preview"><strong>{m.noteTitle}</strong>{m.noteLines.map((line) => <p key={line}>{line}</p>)}</div></div></div>
    </div></div>
  </div>;
}

function EditorIcon({ kind }: { kind: "check" | "close" | "import" | "export" | "chevron" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "check" ? <path d="m5 12 4 4L19 6"/> : kind === "close" ? <path d="m6 6 12 12M6 18 18 6"/> : kind === "chevron" ? <path d="m9 5 7 7-7 7"/> : <><path d="M5 14v6h14v-6"/>{kind === "import" ? <path d="M12 3v12m-5-5 5 5 5-5"/> : <path d="M12 15V3m-5 5 5-5 5 5"/>}</>}
  </svg>;
}

export function SkinEditor({ locale, m, skin, onChange, open, onClose, onExport, footer }: { locale: Locale; m: Messages; skin: Skin; onChange: (skin: Skin) => void; open: boolean; onClose: () => void; onExport?: () => void; footer?: ReactNode }) {
  const copy = siteCopy[locale];
  const [draft, setDraft] = useState(JSON.stringify(skin, null, 2));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const imageUpload = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState<number | null>(null);
  const uploadVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  // Synchronize when reopening, not on each valid keystroke (which would move the caret).
  const currentSkin = useRef(skin);
  currentSkin.current = skin;
  useEffect(() => {
    uploadVersion.current++;
    if (timer.current) clearTimeout(timer.current);
    if (open) { setDraft(JSON.stringify(currentSkin.current, null, 2)); setError(""); setMessage(""); setImageLoading(null); }
  }, [open]);
  useEffect(() => () => { uploadVersion.current++; if (timer.current) clearTimeout(timer.current); }, []);
  function apply(next: Skin) {
    if (timer.current) clearTimeout(timer.current);
    uploadVersion.current++;
    setImageLoading(null);
    try {
      const valid = parseSkin(JSON.stringify(next));
      onChange(valid); setDraft(JSON.stringify(valid, null, 2)); setError(""); setMessage("");
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid JSON"); }
  }
  function edit(value: string) {
    setDraft(value); setMessage(""); uploadVersion.current++; setImageLoading(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { const next = parseSkin(value); onChange(next); setError(""); }
      catch (e) { setError(e instanceof Error ? e.message : "Invalid JSON"); }
    }, 250);
  }
  function download() {
    if (onExport) { onExport(); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(skin, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "skin.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function changeCard(key: "width" | "height" | "radius", value: number) {
    apply({ ...skin, card: { ...skin.card, [key]: value, ...(key === "width" ? { textWidth: value } : {}) } });
  }
  return <dialog ref={dialog} className="skin-dialog" data-ui="skin-editor" aria-labelledby="skin-dialog-title" onClose={onClose} onCancel={onClose} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button,input,textarea,select,a[href],summary,[tabindex]")]
      .filter((element) => {
        const closedDetails = element.closest("details:not([open])");
        return element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0
          && (!closedDetails || closedDetails.firstElementChild === element);
      });
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className="skin-dialog-heading"><h2 id="skin-dialog-title">{copy.customize}</h2><button autoFocus className="dialog-close" aria-label={copy.close} onClick={onClose}><EditorIcon kind="close"/></button></div>
    <div className="skin-workbench">
      <div className="skin-output">
        <div className="preview-status"><span className="preview-live-dot"/>{copy.preview}<span>{builtInSkins.some((preset) => isSameSkin(skin, preset)) ? (isSameSkin(skin, builtInSkins[0]) ? copy.paper : copy.card) : copy.custom}</span></div>
        <SkinPreview m={m} skin={skin} label={copy.preview}/>
        <p className="preview-dimensions">{skin.card.width} × {skin.card.height} <span>px</span></p>
      </div>
      <div className="skin-controls">
        <div className="skin-tabs" role="group" aria-label={copy.preview}>
          {builtInSkins.map((preset, index) => <button key={preset.name} className={isSameSkin(skin, preset) ? "selected" : ""} aria-pressed={isSameSkin(skin, preset)} onClick={() => apply(preset)}><span className={`preset-mini ${index ? "card" : "paper"}`} aria-hidden="true"/>{index ? copy.card : copy.paper}<span className="preset-check"><EditorIcon kind="check"/></span></button>)}
        </div>
        <fieldset className="skin-artwork"><legend>{copy.imageTitle}</legend>
          <div className="artwork-upload">
            <span className={`artwork-thumbnail ${skin.background ? "has-image" : ""}`} aria-hidden="true" style={skin.background ? { backgroundImage: `url("${skin.background.image}")` } : undefined}>{!skin.background && <EditorIcon kind="import"/>}</span>
            <div><button className="artwork-choose" disabled={imageLoading !== null} onClick={() => imageUpload.current?.click()}>{imageLoading !== null ? copy.imageLoading : skin.background ? copy.replaceImage : copy.uploadImage}</button><p>{copy.imageHint}</p></div>
          </div>
          {skin.background && <div className="artwork-options"><div role="group" aria-label={copy.imageTitle}>{(["cover", "contain"] as const).map((fit) => <button key={fit} aria-pressed={skin.background?.fit === fit} onClick={() => apply({ ...skin, background: { ...skin.background!, fit } })}>{fit === "cover" ? copy.fillImage : copy.fitImage}</button>)}</div><button className="artwork-remove" onClick={() => { const next = { ...skin }; delete next.background; apply(next); }}>{copy.removeImage}</button></div>}
        </fieldset>
        <fieldset className="skin-colors"><legend>{copy.colors}</legend><div className="color-swatches" role="group" aria-label={copy.color}>{["#FFFCEB", "#EBF3FF", "#EEF5EF", "#FBEFF0", "#FFFFFF"].map((color) => <button key={color} className="color-swatch" style={{ background: color }} aria-label={`${copy.color}: ${color}`} aria-pressed={skin.card.textBackground.toUpperCase() === color} onClick={() => apply({ ...skin, card: { ...skin.card, textBackground: color } })}><EditorIcon kind="check"/></button>)}<label className="color-custom"><span className="sr-only">{copy.color}</span><input type="color" aria-label={copy.color} value={skin.card.textBackground.slice(0, 7)} onChange={(event) => apply({ ...skin, card: { ...skin.card, textBackground: event.target.value } })}/><span aria-hidden="true">+</span></label></div></fieldset>
        <fieldset className="skin-fields"><legend>{copy.dimensions}</legend>
          {([["width", 100, 320], ["height", 80, 240], ["radius", 0, 48]] as const).map(([key, min, max]) => <label key={key}>
            <span>{copy[key]}</span><input type="range" min={min} max={Math.max(max, skin.card[key])} value={skin.card[key]} onChange={(event) => changeCard(key, Number(event.target.value))}/><output>{skin.card[key]} px</output>
          </label>)}
        </fieldset>
        <input ref={imageUpload} id="skin-image-upload" type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label={copy.uploadImage} tabIndex={-1} onChange={async (event) => {
          const input = event.currentTarget, file = input.files?.[0]; if (!file) return;
          const version = ++uploadVersion.current;
          if (timer.current) clearTimeout(timer.current);
          setImageLoading(version); setMessage(""); setError("");
          try {
            const image = await readSkinImage(file);
            if (version !== uploadVersion.current) return;
            const active = currentSkin.current;
            apply({ ...active, card: { ...active.card, imageFit: "contain" }, background: { image, fit: "cover" } });
            setMessage(copy.applied);
          } catch (e) {
            if (version === uploadVersion.current) setError(e instanceof SkinImageError ? copy[e.code] : copy.imageInvalid);
          } finally { setImageLoading((current) => current === version ? null : current); input.value = ""; }
        }}/>
        <div className="skin-tools"><button onClick={() => upload.current?.click()}><EditorIcon kind="import"/>{copy.import}</button><button onClick={download}><EditorIcon kind="export"/>{copy.export}</button></div>
        <input ref={upload} id="skin-json-upload" hidden type="file" accept=".json,application/json" aria-label={copy.import} tabIndex={-1} onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          const version = ++uploadVersion.current;
          setImageLoading(null);
          if (timer.current) clearTimeout(timer.current);
          try {
            if (file.size > MAX_SKIN_BYTES) throw new Error("JSON: maximum 2 MB");
            const source = await file.text();
            if (version !== uploadVersion.current) return;
            const next = parseSkin(source); apply(next); setMessage(copy.applied);
          } catch (e) { if (version === uploadVersion.current) { setMessage(""); setError(e instanceof Error ? e.message : "Invalid JSON"); } }
          event.target.value = "";
        }}/>
        <details className="json-editor"><summary><span>{copy.json}</span><EditorIcon kind="chevron"/></summary><label className="sr-only" htmlFor="skin-json">{copy.json}</label><textarea id="skin-json" spellCheck={false} value={draft} onChange={(event) => edit(event.target.value)} aria-invalid={!!error} aria-describedby="skin-feedback"/></details>
        <p className={`skin-feedback ${error ? "error" : ""}`} id="skin-feedback" role="status" aria-live="polite">{error ? copy.invalid + error : message || copy.live}</p>
        <button className="skin-reset" onClick={() => apply(builtInSkins[0])}>{copy.reset}</button>
        {footer}
      </div>
    </div>
  </dialog>;
}

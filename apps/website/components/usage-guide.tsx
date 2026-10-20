"use client";

import { useEffect, useRef, useState } from "react";
import { siteCopy } from "@/lib/site-copy";
import type { Locale, Messages } from "@/lib/messages";
import { SampleArtwork } from "./sample-artwork";

export function UsageGuide({ locale, m, open, onClose }: { locale: Locale; m: Messages; open: boolean; onClose: () => void }) {
  const copy = siteCopy[locale];
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"copy" | "drag">("copy");
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    if (!open) { dialog.current?.close(); setPlaying(false); return; }
    dialog.current?.showModal();
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setReplay((value) => value + 1);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <dialog ref={dialog} className="usage-dialog" data-ui="usage-guide" aria-labelledby="usage-title" onClose={onClose} onCancel={onClose}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="usage-heading"><h2 id="usage-title">{copy.usageTitle}</h2><button autoFocus className="dialog-close" onClick={onClose} aria-label={copy.close}>×</button></div>
    <div className="usage-tabs" role="group" aria-label={copy.usageTitle}>
      <button aria-pressed={mode === "copy"} onClick={() => setMode("copy")}>{copy.copyMode}</button>
      <button aria-pressed={mode === "drag"} onClick={() => setMode("drag")}>{copy.dragMode}</button>
    </div>
    <div key={`${mode}-${replay}`} className="guide-scene" data-mode={mode} data-playing={playing} aria-hidden="true">
      <div className="guide-source"><span className="guide-pin"/><SampleArtwork src="/mountains.svg" label=""/></div>
      <div className="guide-document"><span>{copy.workDocument}</span><i/><i/><div className="guide-destination"><span>{copy.pasteHere}</span><div className="guide-result"><SampleArtwork src="/mountains.svg" label=""/></div></div></div>
      <div className="guide-drag-ghost"><SampleArtwork src="/mountains.svg" label=""/></div>
      <span className="guide-click-ring"/>
      <svg className="guide-cursor" width="24" height="30" viewBox="0 0 24 30"><path d="M2 2v23l6-7 5 10 4-2-5-10h9z" fill="white" stroke="#183b64" strokeWidth="1.5" strokeLinejoin="round"/></svg>
      <span className="guide-copy-receipt"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6"/></svg>{m.copied}</span>
      <span className="guide-scene-label">{copy.usageDemo}</span>
    </div>
    <div className="guide-playback"><button aria-pressed={!playing} onClick={() => setPlaying(!playing)}>{playing ? copy.pause : copy.play}</button><button onClick={() => { setReplay((value) => value + 1); setPlaying(true); }}>{copy.replay}</button></div>
    <ol className="usage-steps">{(mode === "copy" ? copy.copySteps : copy.dragSteps).map((step) => <li key={step}>{step}</li>)}</ol>
    <p className="usage-note">{mode === "copy" ? copy.webCopy : copy.dragNote}</p>
  </dialog>;
}

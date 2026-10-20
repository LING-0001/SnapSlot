"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Web-only pointer geometry. Never observes the OS pointer outside the page. */
export function useRailReveal(initialExpanded = false) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const desktop = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const open = useRef(initialExpanded);
  // Initial visibility showcases the cards; only an explicit action pins them.
  const pinned = useRef(false);
  const inside = useRef(false);
  const peekUntil = useRef(0);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHover = useCallback(() => {
    if (hover.current) clearTimeout(hover.current);
    hover.current = null;
  }, []);
  const cancelDismiss = useCallback(() => {
    if (dismiss.current) clearTimeout(dismiss.current);
    dismiss.current = null;
  }, []);
  const collapse = useCallback((restoreFocus = false) => {
    cancelHover(); cancelDismiss();
    open.current = false; pinned.current = false; peekUntil.current = 0;
    setExpanded(false);
    if (restoreFocus || rail.current?.contains(document.activeElement)) handle.current?.focus({ preventScroll: true });
  }, [cancelHover, cancelDismiss]);
  const leave = useCallback(() => {
    cancelDismiss();
    if (pinned.current) return;
    dismiss.current = setTimeout(() => {
      dismiss.current = null;
      if (!inside.current && !pinned.current) collapse();
    }, Math.max(450, peekUntil.current - Date.now()));
  }, [cancelDismiss, collapse]);
  const reveal = useCallback((pin = false) => {
    cancelHover(); cancelDismiss();
    if (pin) pinned.current = true;
    open.current = true;
    setExpanded(true);
  }, [cancelHover, cancelDismiss]);
  const peek = useCallback(() => {
    pinned.current = false;
    peekUntil.current = Date.now() + 2500;
    reveal();
    leave();
  }, [reveal, leave]);
  const pin = useCallback(() => { pinned.current = true; cancelDismiss(); }, [cancelDismiss]);
  const unpin = useCallback(() => { pinned.current = false; leave(); }, [leave]);

  useEffect(() => {
    let previous: { x: number; y: number } | null = null;
    let pointer: { x: number; y: number } | null = null;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const bounds = desktop.current?.getBoundingClientRect();
      if (!bounds || bounds.bottom < 0 || bounds.top > innerHeight) return;
      const x = event.clientX, y = event.clientY;
      pointer = { x, y };
      const across = x >= bounds.left && x <= bounds.right;
      const rowBottom = rail.current?.getBoundingClientRect().bottom ?? bounds.top;
      // Like Pegline, movement above the open rail remains in its keep-open zone.
      inside.current = across && y >= 0 && y <= Math.max(bounds.top + 40, rowBottom + 16);
      if (event.buttons) { cancelHover(); previous = null; return; }
      if (open.current) {
        if (inside.current) cancelDismiss();
        else if (!dismiss.current) leave();
      } else {
        const near = across && y >= bounds.top - 40 && y <= bounds.top + 40;
        const crossed = across && previous && previous.x >= bounds.left && previous.x <= bounds.right
          && previous.y >= bounds.top && previous.y <= bounds.bottom && y < bounds.top;
        if (near || crossed) {
          if (!hover.current) hover.current = setTimeout(() => reveal(), 500);
        } else if (!(hover.current && inside.current && previous && y < previous.y)) {
          cancelHover();
        }
      }
      previous = { x, y };
    };
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) { inside.current = false; previous = null; pointer = null; cancelHover(); leave(); }
    };
    const scroll = () => {
      previous = null; cancelHover();
      const bounds = desktop.current?.getBoundingClientRect();
      const bottom = rail.current?.getBoundingClientRect().bottom;
      // Scrolling can move the card beneath a stationary pointer. Recalculate
      // the hit zone rather than treating every scroll as a pointer departure.
      inside.current = !!(pointer && bounds && bottom !== undefined
        && pointer.x >= bounds.left && pointer.x <= bounds.right
        && pointer.y >= 0 && pointer.y <= Math.max(bounds.top + 40, bottom + 16));
      if (open.current) { if (inside.current) cancelDismiss(); else leave(); }
    };
    const blur = () => { previous = null; pointer = null; inside.current = false; collapse(); };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("pointerdown", cancelHover, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("blur", blur);
    return () => {
      cancelHover(); cancelDismiss();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", cancelHover);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("blur", blur);
    };
  }, [cancelDismiss, cancelHover, collapse, leave, reveal]);

  return { expanded, desktop, rail, handle, reveal, collapse, peek, pin, unpin };
}

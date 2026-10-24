import type { KeyboardEvent } from "react";

/** Roving focus for the product menu in the demo and both clients. */
export function navigateMenu(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
    : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
  event.preventDefault();
  items[next]?.focus({ preventScroll: true });
}

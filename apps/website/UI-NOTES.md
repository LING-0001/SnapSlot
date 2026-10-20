# Web demo refinement · 2026-10-20 · revision 4

Scope: website only. These changes do not alter the Windows prototype.

## Direction

Keep the rail metaphor without a drawer surface: a 5 px metal track spans the
desktop, with separate 140 × 84 px image cards and 128 × 84 px text cards.
Short rows are centered; long rows scroll. Transparent white borders, subtle
shadows and neutral slider mounts replace the colored tabs and blue outlines.
Empty space remains visually transparent. Pixel effects remain on removal.

Retain the product tokens: paper `#f6f4ed`, ink `#252b28`, blue `#2878ed`,
red `#e95843`, gold `#eabd42`, green `#508b62`. Segoe UI and regional
system fallbacks remain the interface faces; Consolas marks file types.
The rail uses soft silver/sage highlights instead of a large dark background.

## Interaction

- Additions immediately reveal the rail for 2.5 seconds, scroll to the new
  card on its overflow page, and animate it into its slot without moving
  keyboard focus. Each arrival renews the timeout. Hover or keyboard use
  keeps the rail open. There is no added-item receipt, count, or View button.
- Reset stays a bordered, labeled button. It silently restores three
  examples and cancels pending reveal/dismissal/deletion timers.
- The floating back-to-top icon appears after scrolling more than one
  viewport. Returning to the top also restores keyboard focus.
- Pointer approach is recognized from 40 px below to 40 px above the demo's
  upper edge, after 80 ms. Upward movement crossing the edge is also
  recognized even when events skip the band. Once open, the keep-open zone
  extends upward to the browser viewport edge. Exit grace is 450 ms.
- Explicit opening stays open for keyboard/touch use; Escape closes it.
- This is browser-page geometry only, not global OS pointer detection.

## Reference and diagnosis

Read-only reference: `D:/gitlab02/Pegline/src/App.cs`, particularly
`Reveal(false, 2.5)` and `Tick()`'s upward keep-open zone; `CardView.cs`
informed the use of centered content and restrained framing. No Pegline
source or assets were copied or modified.

The old web implementation listened only for entry into a 6 px strip and
cancelled the 220 ms timer on exit. This caused both near-edge approaches and
upward sweeps to fail. The two minimal browser regressions failed before
the change and pass after it. Pointer geometry and reveal timers now live
in `components/use-rail-reveal.ts` so capture, hover and explicit opening
share the same state transitions instead of competing event handlers.

## Verification

20 Playwright tests cover six locales, responsive layout, native clipboard
payloads and permission denial, overflow, reset/deletion races, keyboard
focus, reduced motion, forgiving edge reveal, repeated approach/leave,
upward keep-open, held-button suppression, capture peek timing, mobile
latest-card visibility, language navigation, and back-to-top behavior.
Static export and TypeScript validation pass.

Visual review: desktop open rail, capture arrival, mobile Spanish capture.
The surrounding desktop is now visible through gaps and unused rail area;
the screenshot content remains unpixelated.

# Website refinement · 2026-10-21 · revision 13

Hovering near the upper edge requires 500 ms before revealing; brief contact
cancels the pending reveal. Direct toolbar/dock actions still respond immediately.
The five relevant pointer-reveal regressions and production export pass.

The note row now transitions in both directions instead of removing it from
rendering as soon as collapse starts. Entry decelerates over 360 ms with a 12 px
vertical travel and a 240 ms fade; exit accelerates over 240 ms with a 200 ms fade.
CSS transitions reverse from the current position when interrupted. Initial
appearance uses starting-style; repeated reveals no longer restart each card's
mount animation. New-card arrivals retain their separate arrival treatment.

Collapsed/closing notes are immediately inert and hidden from assistive technology;
visibility changes after the exit completes. The row keeps its layout footprint,
so the headline and dock stay still. Existing reduced-motion settings disable
transitions. Browser frame checks cover the exit, immediate inert behavior,
layout stability and mid-exit reversal. Desktop and phone exit frames reviewed.
All 47 browser checks, production export and source lint pass.
Native clients unchanged.

---

## Archived: revision 12

Initial note visibility no longer also initializes the pointer-reveal hook as
pinned. The first load and refresh still show sample cards, while leaving their
keep-open zone now starts the existing 450 ms dismissal. Explicit toolbar/dock
opening and keyboard interaction retain their existing pin behavior.

A regression reproduces the original stuck-open state, then verifies first load,
reload, hover retention, pointer departure, edge reveal and repeated departure.
The other 44 browser checks and the production export pass. The new regression
passes after correcting its pointer coordinates to stay inside the viewport
when browser scrolling shifts the demo above the top edge. Native clients unchanged.

---

## Archived: revision 11

Appearance controls now prioritize presets, card artwork and paper color before
geometry. Upload/replace is a visible button near the top of the panel; image
fit and removal stay directly below it. Width, height and radius each use one
compact horizontal row, with values still visible and keyboard sliders intact.
Preset heights, section gaps and secondary tool spacing are reduced. JSON
editing retains its existing disclosure; no settings or upload behavior removed.

Verified upload, replacement, fit and removal visibility without initial dialog
scrolling across all six locales at 1280×720 and 390×667. Desktop and phone
screenshots reviewed. Skin regression checks and production export pass.
Native clients unchanged.

---

## Archived: revision 10

Website only. Hero copy now explains clicking a note, switching apps and pasting.
“看看怎么用” opens an animated guide with Click to copy and Hold and drag modes.
The header's first item is now a real How to use button, retaining access on short
screens where the supporting hero copy is hidden.

The guide uses lightweight CSS/HTML sample artwork, a cursor, copy feedback and
a document destination. It is explicitly labeled as an illustration, with separate
copy/drag instructions. Copy points to the working sample cards; drag is clearly
identified as a desktop client illustration, not a live web file-drop feature.
It supports pause, replay, reduced motion, Escape, backdrop close, focus wrapping
and focus restoration. All text is localized in the existing six languages.

All 43 Playwright checks and the production build pass. Desktop/phone guide states
and 30 locale/viewport combinations were checked for page overflow and overlap
with the existing toolbar. Native clients unchanged.

---

## Archived: revision 9


Website only. The reported hydration diff contained injected `data-vton-pinned`
attributes and a `vton-btn` sibling. A regression test reproduces that extension
behavior before hydration and fails with the original DOM. Sample artwork,
wallpaper and app marks now use CSS imagery; meaningful samples retain image roles
and localized accessible names. The injection regression now passes on load/reload.
No global hydration-warning suppression or browser-extension setting changes.

Appearance now uploads local PNG/JPEG/WebP card artwork, with replace/remove and
Fill/Fit controls. Images are decoded/resized locally, embedded into optional
`background` JSON fields and round-trip with exports. Old version 1 skins still
work. Source images are limited to 5 MB; exported JSON including artwork to 2 MB.
Invalid inputs preserve the last valid skin; preset changes cancel pending uploads.
Desktop/phone previews and original clipboard payloads remain intact.

Validation: all 41 Playwright checks, production export and TypeScript pass; extension-injection, artwork
round-trip, invalid/oversized image and upload race regressions added. Source lint
passes; browser inspector has no failures and the three previously documented
imagery/low-motion warnings. See [SKINS.md](SKINS.md) for the updated data format.

---

## Archived: revision 8


Website only. Deleting a card releases its layout slot in the same update instead
of waiting 560ms. Remaining cards interpolate to their new positions for 180ms;
brief decorative fragments live outside the flex layout. Rapid repeated deletes,
focus transfer, reduced motion and reset cleanup remain supported.

Removed the redundant trial anchor from the hero and release section. The first
screen already contains working capture/text buttons. The keyboard skip link now
has a proper localized “Skip to content” label.

Header and desktop share one viewport-height calculation. The instruction, card
row, heading and footer occupy separate grid rows. The footer stacks the toolbar,
status and four app icons using their actual heights, so wrapped status text does
not overlap controls. The hint also occupies its own row, resolving the Spanish
text/pin collision. Reveal motion travels only 4px, keeping notes below the hint.

Short viewports use compact type and suppress supporting hero copy; very short
phones prioritize the working demonstration. Dock visibility is verified on fresh
loads and reloads of #playground, including 320×568 and 1280×600. Long phone capture
labels truncate visually while retaining their full accessible names.

Validation: 38 Playwright checks pass, including immediate deletion, rapid keyboard
removal, hint/pin separation in six locales, and full dock visibility across six
viewport sizes. Production export and TypeScript pass. Native clients unchanged.

---

## Archived: revision 7


Website only. The toolbar reserves the longest expand/collapse label so it stays
still across state changes in all six locales. The simulated desktop now includes
a four-icon dock; SnapSlot is active and opens the notes when clicked.

The inbox is a continuous horizontal list with no fixed item ceiling or +N
pagination. A mouse wheel moves the row directly, yielding to normal page scroll
at either end. Trackpad/touch scrolling remains native. Whole-row reveal/hide is
retained. Scroll-triggered marketing entrances were removed.

The appearance gallery and modal were redesigned: explicit blue selection outlines,
checks and selected labels; fitted preview pairs; a wallpaper-backed live preview;
separate size/color controls, swatches and clearer import/export buttons. Editing
any field clears the built-in selection unless the complete preset still matches.

Verification: 31 Playwright checks, production static export and TypeScript. Source
lint: no failures/warnings. Browser inspection: no failures, three explained imagery/
low-motion warnings. Six locales at four widths were checked, including 320px
English/Spanish controls. See [DESIGN.md](DESIGN.md) and [SKINS.md](SKINS.md).

---

## Archived: revision 6


Scope: website only; Windows and macOS clients are unchanged.

The first screen is now an immersive blue/white desktop with a generated glacial
wallpaper, live pinned notes, a short centered headline and floating toolbar.
Removed the long workflow sequence. Platform development labels stay out of the
hero; honest availability information remains lower down.

Two skin previews apply directly to the live inbox. Customization opens a native
modal instead of occupying the page: dimensions/color, import/export and JSON
remain available. Escape/backdrop dismiss it, keyboard focus stays inside and
returns to its opener; reopening synchronizes with the current preset.

Six locales and 24 locale/viewport combinations were checked for overflow and
heading wrapping. All 28 Playwright checks pass. Production export and TypeScript pass. Taste source lint has
no warnings; browser inspection has no failures and two intentional imagery
warnings. See [DESIGN.md](DESIGN.md) for rationale, visual critique and asset
provenance, and [SKINS.md](SKINS.md) for JSON behavior.

---

## Archived: revision 5


Scope: website only; Windows and macOS clients are unchanged.

Blue/white palette, compact independent pinned notes, no metallic track or stems.
The Chinese website name is now 快照贴 / 快照貼. The first web visit shows the
cards, with existing collapse/reveal, copy, removal and overflow interactions.

The new skin workbench imports/exports JSON and previews valid edits immediately.
Two built-in presets exercise the same parser as user definitions. Width, height,
text width, gap, radius, frame, text colors, pin anchors, shadow and button styling
are configurable. See [SKINS.md](SKINS.md) for the format and current boundaries.

The website retains all six locales. Desktop, tablet and phone have distinct
compositions; phone usage examples are inline to avoid text occlusion. Documentation
and visual critique: [DESIGN.md](DESIGN.md).

Verification: static export and TypeScript pass; 25 Playwright checks pass, covering
existing interactions and new skin validation/import/export/rollback/size behavior.
Taste Skill source lint passes. Browser inspection at 1440/768/390 passes with only
an intentional no-video warning; the working UI demonstrates the subject directly.

---

## Archived: Web demo refinement · 2026-10-20 · revision 4

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

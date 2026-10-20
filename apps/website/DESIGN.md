# Blue and white website redesign

Scope: website only. Chinese product name: 快照贴 / 快照貼. English name:
SnapSlot. Native Windows and macOS sources are unchanged.

## Brief and direction

A temporary place for screenshots and text: compact white note frames pinned
independently to the top of a desktop, with small flat blue pins. No rope, rail,
stems, account requirement or invented release claim.

The user chose the blue/white palette of https://tendedero.app/?lang=zh-Hans and
rejected the previous split hero, conspicuous platform status labels and exposed
configuration workbench. The reference palette was researched; its assets and
implementation were not copied.

Taste direction: **The product performs**, seed **1784680698**. The live inbox is
the hero: collect examples, copy actual PNG/text, remove cards, change their skin.
The first visit opens the sample cards. Settings are secondary to that experience.

## Current composition

- Header: compact brand, three plain links and a keyboard-accessible locale menu.
- Hero: nearly full-viewport blue/white desktop; actual pinned cards at the top,
  short centered headline in the sky, floating functional toolbar and a small simulated app dock at the bottom. The dock includes an active SnapSlot icon that opens the notes.
- Appearance: two framed preset previews with a blue outline, checkmark and localized selected label. Selecting either changes the actual inbox.
  “自定义外观” opens a native modal with dimensions, color, JSON import/export
  and an expandable text editor. A wallpaper-backed live preview sits beside the settings. Preset selection compares every field, so a custom edit no longer leaves a misleading selected preset.
- Privacy: one flat statement band describing browser-local behavior.
- FAQ: plain expandable questions, including availability and demo boundaries.
- Release: a small, honest explanation lower down; no hero platform badges.

The previous long workflow section was removed. Its illustrative screenshots
remain as archived assets, not current page content.

## Tokens and adaptation

White ground, `#142b45` ink, `#3f566e` secondary text, `#1263d7` action blue and
`#eaf3fe` light fields. System typography supports six languages without remote
font requests. Product frames, pins and the functional toolbar retain their own
radii/shadows under `data-ui`; surrounding marketing layout remains restrained.

Preview pairs scale to fit their gallery/modal, including on phones. Card skins use a finer navy frame with a full-height crop. Default image notes: 220 × 136 pixels; text notes: 208 × 136. Their horizontal
row scrolls inside the stage on small screens, with a partial next card making
that behavior visible. Hero height and headline position accommodate taller
JSON skins. All six locales were checked at 320, 390, 768 and 1440 pixels with
no page overflow or hero headings over two lines.

Phone: two-line navigation, cropped desktop wallpaper, two-line headline and
compact toolbar. Modal preview moves above controls. Native dialog semantics,
Escape/backdrop dismissal, explicit Tab wrapping and focus restoration support
keyboard operation. Closed JSON details are excluded from the focus loop.

The reveal/collapse, arrival peek, clipboard and removal behavior remain. The entire inbox is one horizontal list: no eight-item pages, +N expansion or 16-item ceiling. Mouse wheels move the overflowing row directly; trackpad and touch scrolling remain native, and wheel events at either end return to page scrolling. Expand/collapse labels share a reserved grid cell, keeping the toolbar width and position stable in every locale. Scroll-triggered page entrances were removed. Reduced-motion settings remove nonessential travel/transitions.

## Image provenance

`public/images/ice-desktop.png` is an original image generated with the built-in
ImageGen tool in this task. Source output:
`/Users/ling/.codex/generated_images/01a159dd-2f09-7830-a712-ac25c55fe2f6/exec-34e8b078-a3c9-44b7-91b1-95eec1e21701.png`.

Brief: a refined blue/white glacial bay desktop wallpaper, near-white/pale blue
sky across the upper 70%, ice cape at lower right, ocean in the bottom quarter,
photographic illustration, no UI, text or logos. The generated wallpaper is a
background illustration, not a photograph or product capture.

`mountains.svg` and `studio.svg` are existing project sample illustrations.
`desktop.svg` and `public/previews/*.png` are earlier original website assets,
currently unused. Preview captures show the website demo, not native clients.
The app mark is a provisional blue pinned-note SVG. The dock uses original, decorative SVG app illustrations; only the SnapSlot app icon is interactive.

## Latest visual critique

ROUND 3
Seen in one second: pinned white notes on a blue/white desktop.
Idea (one sentence): the temporary screenshot inbox is the page's working scene.
Live thing: add/copy/remove cards and apply/import a skin without losing them.
Layout words by section: hero=immersive scene / appearance=paired previews /
privacy=statement band / FAQ=accordion / release=sentence-action / footer=line.
Scores: design 6.5 · usability 8 · creativity 7 · content 8 → overall 7.15.
Caps applied: fewer than four real photographs caps design at 6.5; a familiar
desktop metaphor caps creativity at 7. This does not meet the skill's 7.5 target.
The two inspector imagery warnings are retained intentionally: one generated
wallpaper plus actual interactive UI is more relevant here than unrelated photos
or stock footage. No generated image is claimed as photographic proof.
Top three findings, from the latest desktop/tablet/phone captures:
1. Earlier dark secondary text was weak on the ocean: status now uses a compact
   white surface; supporting text was darkened.
2. Earlier phone labels were too small: visible captions and status now use at
   least 13px; icon-only toolbar controls retain accessible names.
3. Phone previews show part of the next note. This is deliberate horizontal
   product overflow; gallery selection and the workbench provide a second way
   to inspect/change the skin. It remains less immediate than the desktop view.

The remaining visual limits are the stock desktop metaphor and reduced note
visibility on phones. Further style approval belongs to the user, not the tests.

## Verification

Static production export and TypeScript pass. All 31 Playwright checks pass, covering localization,
clipboard payloads/denial, removal/focus, overflow, reveal timing, reduced motion,
JSON validation/import/export/rollback, large skins, preset/editor synchronization,
and modal focus/dismissal at phone and desktop widths.

Taste source lint: 0 failures, 0 warnings. Browser inspector at 1440/768/390:
0 failures, 3 intentional warnings: the two imagery warnings described above and a low-motion warning after removing scroll-triggered page entrances. Desktop, tablet and
phone fold screenshots and page sheets were reviewed after the final CSS changes.

## Revision 7 visual follow-up

Desktop, tablet and phone hero, appearance and modal captures were reviewed.
The repeated blue wallpaper anchors the editor to the live desktop; settings
use a quieter white pane. Selection now uses text and a check as well as color.
The previous phone-preview clipping limitation is resolved by fitting the pair.
The old round-3 score above records the earlier revision, not an approval of
these latest changes. The actual demo row still scrolls at its configured size.

The compact simulated dock and toolbar coexist as separate layers; the disclosure
strip keeps copy/add behavior honest. It remains a web scene, not an OS shell.
No native source files or global desktop integrations were changed.

## Revision 8 interaction and fitting follow-up

The viewport stage now uses grid rows for hint, notes, heading and footer. Its
height is 100svh minus the shared header height and 16px breathing room. The
footer's toolbar/status/dock stack uses normal flow instead of three independently
positioned layers. This preserves full dock visibility on fresh and anchored
reloads, and accommodates multi-line Spanish/English status and hint text.
Supporting copy is suppressed on short viewports; very short phones prioritize
the working demo over the headline. The repeated trial links were removed.

Deletion no longer leaves an invisible occupied card slot during a 560ms timer.
The item is removed immediately; remaining positions animate for 180ms. Decorative
fragments have no layout footprint and expire independently. Reduced motion skips
both positional animation and particles. Rapid removals preserve keyboard focus.

38 Playwright checks pass, with added regression coverage for the four reported
issues. Source lint passes. The six-locale layout matrix was checked at seven
viewport sizes; the only initial failures were long English capture labels on
390px phones, fixed with visual truncation and full accessible labels. Fresh and
#playground reloads keep every dock app fully within the viewport. First-screen
screenshots were reviewed in desktop, tablet and phone sizes, including Spanish.

## Revision 9: extension-safe images and uploaded card artwork

The user's hydration screenshot identifies injected `data-vton-pinned` attributes
and a `vton-btn` Try-On sibling. A simulated image extension reproduced the same
server/client mismatch before the fix. CSS-rendered wallpaper, sample images and
app marks preserve the visuals without exposing SSR image tags to that injector.
Meaningful sample artwork retains `role="img"` and localized names. Clipboard
PNG generation still reads the original source, independently of its presentation.
The first-load/refresh extension regression passes without suppressing hydration.

The workbench now uploads, replaces and removes raster card artwork. A thumbnail,
localized format/size help and Fit/Fill choices sit below the color controls. The
artwork appears under the content on both the live inbox and modal preview; text
uses a translucent reading surface. Local processing embeds a resized raster in
the optional `background` group, included in JSON exports/imports. No image POSTs
are made. Invalid or oversized images retain the current skin, and stale image
uploads cannot override a subsequently selected preset.

Uploaded/default desktop and phone states were visually reviewed. Browser source
lint has no failures/warnings, and rendered inspection retains only the three
previously justified imagery/low-motion warnings. The new artwork controls use
the existing blue/white workbench, with no new marketing section or native changes.

All 41 Playwright checks pass, including native clipboard behavior, a before/after
extension-injection reproduction, embedded artwork round-trip and invalid-upload
rollback. Production static export and TypeScript pass. The current in-app preview
was reloaded without console errors and its Upload image control was verified.

## Revision 10: explain the product's actual gestures

The generic hero paragraph was replaced with click/copy/paste guidance and a
“See how it works” button. The header exposes the same guide on short screens.
A small native dialog illustrates click → copy → switch/paste and hold → drag →
release using the existing sample art, a cursor and a simple document destination.
This is illustrative frontend animation, not a recording or an OS integration.

Both modes have localized ordered instructions, pause/replay controls and a clear
boundary between the working web clipboard demo and illustrated desktop dragging.
Reduced motion presents a completed static transfer. Focus is contained and restored;
the modal closes with Escape or the backdrop. Desktop and phone views were reviewed,
and 30 locale/viewport combinations were checked for overflow and hero collisions.

All 43 Playwright checks, production export and TypeScript pass. Source lint has
no failures/warnings; rendered inspection has no failures and the existing three
imagery/low-motion warnings. The guide is on demand rather than a constantly
playing hero animation, keeping the main desktop calm.

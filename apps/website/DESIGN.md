# Website design

Scope: the marketing site in `app/[locale]` (`components/home.tsx`, `components/home.module.css`,
copy in `lib/home-copy.ts`). Chinese product name 快照贴 / 快照貼, English SnapSlot.
The native clients' note surface (`apps/native-ui`) is separate and unchanged by this page.

## Direction

A product launch page in an Apple-like register: white and `#f5f5f7`, near-black ink,
one blue (`#0071e3`) for actions, glass for the app itself. Inter Tight for Latin,
Noto Sans SC (self-hosted through `next/font`) for Han, system CJK fonts for Japanese
and Korean. Copy stays to one line per block; the page explains by letting people use it.

Earlier rounds (blue/white SaaS layout, cyanotype sun print) were rejected as templated
or wordy. The user liked selecting page text and pinning it with Ctrl+Alt+T; every
direction keeps that.

## First screen

Headline, one sentence, one download button and a link to the other platform. The rest
of the viewport is a working desktop (`.fold` sizes hero + desktop to `100svh`), so the
whole desktop, including its taskbar or Dock, is visible without scrolling at 1280×720
and up.

The desktop follows the visitor's OS (Mac → menu bar + Dock, else Windows 11 taskbar);
“Also on Mac/Windows” switches it and the download button.

- Notes hang from the top edge as a fan on an arc; wheel or swipe turns it.
  Hidden until the pointer rests within 14 px of the top (Mac: the menu bar) for
  500 ms; a glow line charges during the wait; moving below the fan hides it after
  450 ms. New notes peek for 2.5 s.
- Desktop images: clicking one stands in for copying an image in another app.
- The document window accepts dragged notes and pasted clipboard content.
- Tray (Windows, right-click) or menu-bar icon (Mac, click) opens: Settings…, Collect
  clipboard images (checkable), Pin notes (checkable). The settings window mirrors both
  switches. Pin keeps the fan open when the pointer leaves; collect off greys the icon
  and stops desktop images from pinning.
- A four-step guide replaces instructional text: a pulsing ring on the target and a
  dark bubble beside it (top edge → an image → drag into the document → the tray
  icon). Each step advances when the visitor does it; × skips the guide.

## Below the fold

A bento on a mist band: select-to-pin demo (black tile), 30-slot capacity meter,
skin switcher (changes the notes on the desktop), privacy statement. Footer: brand and
tagline, Product and Contact columns (GitHub, email), legal line with license and
platform requirements. Downloads link to GitHub Releases; no installers are published yet.

## Verification

`tests/home.spec.ts` covers all six locales fitting the first screen without horizontal
overflow, the 500 ms edge dwell and leave, the guide order, tray menu ↔ settings sync,
pin/collect behaviour, select-to-pin with clipboard, the Mac variant, hydration with
image-annotating extensions, and footer links.

## Image provenance

`mountains.svg` and `studio.svg` are project sample illustrations. `icon.svg` is the
app mark; `assets/brand/SnapSlot.ico` and `scripts/make-icon.swift` reproduce it for
Windows and macOS.

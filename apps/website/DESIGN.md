# Current website and desktop design

The reference is the running page implemented in `components/home.tsx`,
`components/home.module.css` and `lib/home-copy.ts`. Desktop presentation in
`apps/native-ui` imports the same CSS module and localized product copy.

## Visuals

White and `#f5f5f7` backgrounds, near-black ink, `#0071e3` actions, Inter Tight and
Noto Sans SC with system CJK fallbacks. Product imagery is a working desktop demo,
not a static mockup. `mountains.svg` and `studio.svg` are its sample illustrations.
`public/icon.svg` is the app mark; native icons use the matching brand render.

The first screen contains a headline, one sentence, platform download actions and
the complete desktop. Windows has a taskbar; Mac has a menu bar and Dock. A four-step
interactive guide covers the edge, copying an image, dragging and opening the menu.

## Product interface

Notes hang from the top edge as a fan. Image cards are 220 × 144 px; text cards
200 × 144 px. The radius is 1500 px, angular step 7.2 degrees, face radius 14 px.
Wheel or arrows turn the fan; responsive geometry comes from the same stylesheet.

The three appearances are glass, paper and graphite. A single appearance applies
to all notes. Hover reveals the upper-right remove button and lowers the card face.
Click shows centered copy feedback. There is no separate skin workbench.

The popup contains Settings…, collection, pinning and Quit below a separator. Mac hover is blue with white
text/checkmarks; Windows uses the website's neutral highlight. Settings contains
two switches, appearance swatches, language, shortcut labels and Clear all/count.

Below the desktop are select-to-pin, capacity, appearance and privacy demonstrations.
The footer contains the repository, contact, license and platform information.

## Validation

`tests/home.spec.ts` checks localized layouts, dwell, guide, selection, menu/settings
state, platform variants and links. `tests/native-ui.spec.ts` compares the shared
bundle to the website and tests host commands, keyboard, dragging, inactive hover,
reduced motion and offline resources. Native acceptance is in `docs/native-testing.md`.

## Experience details

Download actions are real links. The website's separate demo toolbar chooses the
platform, opens notes and restarts the guide without reloading the page. It keeps
the chosen platform when the in-demo language changes.

The document accepts native drag/paste and offers an explicit Paste button for
touch users. A browser clipboard denial is reported honestly: the note is copied
inside this demo only and can still be pasted into its document. The guide follows
that route and flips above its target when there is insufficient room below.

Closed notes are inert. Product menus support arrows, Home and End; Escape closes
the foremost menu/settings surface before unpinning notes. Settings focus returns
to the menu trigger. A clipped desktop must not become horizontally scrollable
when a control receives focus.

Fresh notes settle in 520 ms with 64 px of travel and a .94 starting scale, using
the existing ease-out curve. Guide pulses stop after three repetitions. Feature
content is visible before its one-time entrance, with readable fallbacks when
JavaScript, observers or motion are unavailable.

Both website desktops stay entirely inside the first fold on desktop. They reserve
separate note and document/file areas. Short desktop previews use a smaller fan,
fewer visible side notes, compact Dock and side-by-side files. Windows keeps the document on the right and files on the left; Mac uses its
centered document and right-side files. The in-demo document also reduces its
chrome rather than extending the page. Mobile keeps its separate
composition. The final feature-to-footer-logo gap is 64 px on desktop and 44 px on
mobile.

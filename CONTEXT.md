# Current product contract

The user-approved blue/white pinned-note website is the visual and interaction
source of truth for Windows and macOS. Later user decisions supersede the older
Pixel Rail/clothesline prototype documents; historical ADRs remain as history.

## Language

**Text note**:
A temporary pinned card created from text selected in another application and
explicitly collected through SnapSlot's text shortcut. _Avoid_: pasted text,
manual note.

**External image**:
A temporary pinned card created from a newly written image on the system
clipboard by another application. _Avoid_: imported file, self-copied image.

**External-image intake**:
The default-enabled local preference that permits collecting external images
from the system clipboard and persists the user's last choice. _Avoid_: screen
capture, manual image import.

**Pinned row**:
The entire visible row of temporary notes held open until the user explicitly
unpins or dismisses it. Pinning a hidden row makes it visible. _Avoid_: pinned
card, saved note.

**Tray menu**:
The right-click menu of the system status icon, which mirrors the row's pinned
state and offers settings and external-image intake control. _Avoid_: row
toolbar, card menu.

**Shortcut fallback**:
The automatically selected unoccupied Ctrl+Alt+letter binding that replaces a
conflicting user-selected shortcut, with the replacement shown in settings.
_Avoid_: silent shortcut failure, manual conflict resolution.

**Current note skin**:
The single active appearance applied uniformly to every current and future
temporary note on one device. _Avoid_: portable skin, per-note skin, card
theme.

**Note background image**:
The local source image referenced by the current skin, which covers every
temporary note while preserving aspect ratio; cropping is permitted and
stretching is not. If the source is unavailable, the skin reverts to default.
_Avoid_: embedded image, per-note image.

**Note dimensions**:
The current skin's shared card size, limited to 180–480 px wide and 120–280 px
high. _Avoid_: per-note dimensions, freeform panel size.

**Arrival peek**:
A short automatic expansion that acknowledges a newly collected external image
or selected-text note when the row is not pinned. _Avoid_: persistent alert.

**Card hover**:
The focused visual state of one temporary note, which reveals a remove control
at the upper left and a copy control at the lower left without obscuring its
content. _Avoid_: always-visible card toolbar.

**Remove note**:
The explicit action that discards one temporary note from the current row.
_Avoid_: unpin, archive.

**Session note**:
An external-image or text note that exists only for the current SnapSlot run;
it is not restored after restart. _Avoid_: library item, saved note.

**Note capacity**:
The row holds at most 30 session notes; a newly arriving note removes the oldest
one from the left when full; notes are ordered left-to-right from oldest to
newest. _Avoid_: unlimited inbox, archive.

**Clear notes**:
The explicit action in both the tray menu and settings that discards every
current session note immediately, without confirmation or follow-up feedback.
_Avoid_: unpin, reset skin.

**Shared note surface**:
The same offline note interface and interaction rules rendered in Windows and
macOS native hosts. _Avoid_: platform-specific note design.

## Temporary notes

A local, session-only inbox for screenshots and plain text. It is a transfer
surface, not a permanent library. Normal startup is empty and fully hidden.
Exit removes only session-owned temporary exports. Original imported files are
never deleted. Export files survive card removal until application exit so
external drag targets can finish reading them. Text is limited to 64 KB UTF-8.
The visible row holds at most 30 notes; a new note evicts the oldest one.

## Pinned-note appearance

Independent paper cards with small flat blue pushpins, white rounded frames and
subtle shadows; no rope or permanent rail background. The initial Paper preset
and optional Card preset share the website's version 1 data-only JSON format.
Card geometry, colors, artwork, pin and button appearance are configurable.
The appearance editor is the same component on all three surfaces.

## Reveal and motion

Idle overlays have no visible or input-intercepting window. Physical screen-edge
contact must last 500 ms before pointer reveal. Moving away starts a 450 ms grace
period; returning cancels dismissal. Keyboard use, dragging and open dialogs keep
the surface available. Explicit opening is immediate. Arrivals peek for 2500 ms.
Full-screen foreground windows and held buttons suppress automatic edge reveal.

The row fades and moves 12 logical pixels: 360 ms decelerating entry/240 ms fade,
240 ms accelerating exit/200 ms fade. Exit disables interaction immediately and
hides the native window after animation. Reduced-motion preferences disable
movement. Remaining cards reflow immediately, with a 180 ms positional transition.
The local pixel dissolve is bounded and does not delay layout removal.

## Native gestures and operating systems

Click copies the original image/native PNG or full plain text. Holding for at
least 160 ms and moving exports a PNG/TXT file copy; the item remains in the inbox.
Explicit removal affects only the temporary note. Arrow keys navigate, Enter
copies, Delete removes and Escape collapses. A global Ctrl+Alt+Space shortcut
(Control+Option+Space on Mac) supports keyboard opening.

Screenshots may be requested through the UI or global shortcut. The Windows
native selector captures the chosen region; macOS invokes its system selector.
Following the user's Mac testing feedback, new screenshot files on macOS and new
clipboard images on both platforms are collected automatically by default, with
a persistent menu/tray toggle. macOS watches the system screenshot destination
and live Spotlight screenshot metadata; originals are retained. Clipboard intake
ignores existing launch content, plain text and the client's own copy writes.
This receives user-created screenshots; it does not capture the screen on a timer.

Mac clients show both a real Dock icon and a menu-bar icon. Dock clicks open the
notes. Native mouse coordinates supply hover highlighting even while another app
is active; hovering never copies, and the first click copies without an activation
click. The 500 ms screen-edge dwell remains unchanged.

The menu-bar/tray context menu opens a compact Settings window separate from
Appearance. It has a default-on external screenshot/image intake switch and
recorders for screenshot and selected-text shortcuts (Control+Option/Alt+S/T by
default). Settings are persisted atomically in application-data preferences.json.
Duplicate bindings, the fixed open-notes shortcut and ordinary Copy are rejected.
OS registration failures retain prior bindings/settings. Shortcuts pause while
editing settings and resume when its window loses focus or closes.

The text shortcut receives the selection the user has made, including Select All,
then pins and copies the full text. It never imports stale clipboard text on an
empty selection. Mac requests Accessibility only when this action is invoked,
reads AX selected text, and falls back to a fresh normal Copy in unsupported
editors. Windows reads UI Automation TextPattern or a fresh Ctrl+C copy. Copy
fallbacks verify foreground identity, modifier release and a new clipboard write.

## Shared presentation, platform hosts

`apps/native-ui` bundles only offline React/CSS note and appearance views. It
reuses the website styles, skin parser, presets and six locales. macOS uses
AppKit/WKWebView; Windows uses WPF/WebView2 Composition. Platform APIs handle
edge events, shortcuts, screen geometry, capture, clipboard and file dragging.
No Next.js server, Electron or Node runtime is needed by an installed client.
Messages carry item IDs, validated skin data and a fixed command vocabulary;
file paths and process execution are resolved only by the native host.

Cards are scoped to the display selected when they are added. A single overlay
moves between displays and renders that display's inbox. Multimonitor/DPI/hotplug
behavior remains subject to native verification, especially on Windows.

## Skin lifetime and hot reload

Each platform stores `active.json` plus two bundled examples in its application
support skin directory. Directory and active-file changes are debounced for
250 ms. Both in-place writes and atomic file replacement are supported. Invalid
edits preserve the current valid skin; `last-good.json` survives restart.
Optional artwork embeds PNG/JPEG/WebP data, with the same field and 2 MB JSON
limits as the website. No remote URLs, scripts, HTML or arbitrary CSS are accepted.

## Brand and locales

SnapSlot / 快照贴 (快照貼 in Traditional Chinese). Six locales: en, zh-Hans,
zh-Hant, ja, ko, es. User content is never translated. Code is MIT licensed;
brand assets remain subject to BRANDING.md. There is no published installer,
update channel, signed/notarized public release or website deployment.

## Validation boundaries

A compile, browser test, native smoke test and physical machine acceptance are
separate evidence. This Mac can compile/test AppKit and cross-compile Windows;
it cannot confirm Windows transparency, real target-app drops or high-refresh
performance. No 144 Hz/8.3 ms or idle CPU guarantee is claimed without measurement.

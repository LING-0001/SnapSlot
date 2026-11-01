# Desktop acceptance

The current website is the reference. Both hosts load the same offline bundle.
A successful compile or browser run does not establish physical-machine behavior.

## Common checks

1. Start empty and hidden. The status/tray icon uses the current brand mark; the
   hidden overlay does not block clicks. Mac has a monochrome menu-bar symbol, gray
   when automatic image collection is off, plus the adopted Dock icon. No desktop tutorial is added.
2. Copy an image in another application: one note appears and peeks for 4 s without pinning.
   Existing launch clipboard content, ordinary copied text, file URLs and files
   saved to disk must not be collected. Copying a note must not add it again.
3. Select text and press Control+Option+T / Ctrl+Alt+T. Check the full Unicode
   payload in both the note and clipboard. Empty selection must not import stale
   clipboard text. Reject text above 64 KB. Test Mac Accessibility permission on
   first use and unsupported editors' fresh Copy fallback.
4. Rest at the top edge for 500 ms. Check fan geometry, glow and eased entry;
   leave for 450 ms and check exit. Test returning, full-screen suppression,
   Control+Option+Space / Ctrl+Alt+Space and Escape.
5. Turn the fan with the wheel and arrows. Click to copy, Delete to remove and
   hover to reveal the remove button. The first click must work without a prior
   activation click. The copied label stays small in the note's lower-right corner.
   Space/magnifier shows full text or image; Escape closes reading only and restores
   focus. Select words in a text card or reading view and collect them again; whole-card
   dragging must still work. Remaining cards, keyboard focus and counter stay consistent.
6. Add more than 30 notes. Retain the newest 30, oldest to newest. Clear all empties
   the session immediately. Exports for removed/cleared notes survive until exit.
7. Hold and drag PNG/TXT copies into a file manager and a document/chat app. Keep
   the original note and preserve pinned state. Text drops offer both plain text and
   an exported file. Verify the exported bytes/content.
8. On macOS, right-click the Dock icon: Show notes, Settings, image collection and
   pinning must work even when the status icon is hidden by other menu-bar items.
   Reopen the Dock menu to check live marks, toggle pinning/collection, and restore
   minimized Settings. System Options/Hide/Quit stay system-owned without duplication.
   Open the four-entry status/tray menu. Move across every row while another application is
   active: highlight follows the pointer and clears on departure. Checkmarks are
   legible; hovering never toggles a setting. Pinning adds the website's lower-right
   dot to the status/tray icon; unpinning, Escape and hiding notes clear it. Check
   both menu and settings switches and retain the dot after receiving/copying notes.
9. Settings is the compact website window: collection, pinning, three appearances,
   language, two shortcuts, count and Clear all. Changes apply immediately.
   On both platforms, occupy both preferred combinations before startup: each receives an
   actually registered replacement and a persistent explanation in its settings row.
   Open Settings before editing either row: both conflict explanations and warning
   icons must already be visible, including conflicts claimed since SnapSlot started.
   Click either row to record a new combination; warnings for both actions must stay
   visible while recording. Standard Copy is rejected and Escape cancels without
   closing settings.
   Cancel, close or switch apps during recording and confirm both shortcuts resume.
   Recording pauses only SnapSlot's bindings; QQ screenshots and system shortcuts
   are allowed to trigger. Verify SnapSlot's bindings resume after commit, Escape,
   close and app switching. Mac recording must work without Accessibility permission
   or a permission prompt. Open settings over pinned images;
   it must stay above them while active. Drag the title and blank margins; controls
   must remain clickable. Check all four window corners against a dark background.
   Minimize settings, then open Settings from the status menu: the same window must
   restore, become key and activate the app. A fresh image must not replay its
   entrance or drop opacity when its temporary arrival marker expires.
   Appearance/language/collection survive restart; session notes do not. Closing
   settings, receiving notes and dragging preserve pinning.
   With settings foreground, background and minimized, move below the unpinned fan:
   notes must dismiss while settings remains available. Repeat while pinned to
   confirm notes remain visible. Reveal again at the edge while settings exists.
10. Check all six locales, reduced motion, screen-reader/keyboard access, two
    monitors, mixed DPI, negative origins, hotplug, sleep/wake and full-screen apps.
    Measure performance separately; no refresh-rate or idle-cost guarantee is made.

## Commands

```sh
npm ci --prefix apps/website
npm run build --prefix apps/website
npm run build:native --prefix apps/website
npm test --prefix apps/website
./scripts/build-macos.sh
bash scripts/check-macos-hotkeys.sh
artifacts/macos/SnapSlot.app/Contents/MacOS/SnapSlot --smoke-test /tmp/snapslot-qa
artifacts/macos/SnapSlot.app/Contents/MacOS/SnapSlot --status-icon-check /tmp/snapslot-status-qa
```

```powershell
.\scripts\build-windows.ps1
```

Mac smoke checks use a named pasteboard, generated test content and isolated
preferences. They verify real WKWebView/AppKit behavior without reading selections
from other apps, requesting screen capture or changing the general clipboard.
The focused status-icon check compares light/dark AppKit rendering with a standard
untinted status item, including collection on/off and pin on/off. It checks the
3 pt marker mask, unchanged symbol size and that dimming preserves menu access.
Windows logical checks exercise preferences and edge rules; Windows smoke rendering
and actual file drops must run on Windows.

The focused Mac shortcut check runs a separate process holding exclusive shortcuts.
It reproduces the shared-registration false success, then verifies rejection,
automatic replacements, notices, rollback and recording with the production code.
The Mac build runs this check automatically. Same-process registration tests alone
cannot cover the cross-app conflict reported with QQ.

Keep generated QA output outside `artifacts` when retaining only the latest package.
The Mac build is ad-hoc signed. Public signing/notarization and an installer are not
part of these local builds.

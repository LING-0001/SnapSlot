# Desktop acceptance

The current website is the reference. Both hosts load the same offline bundle.
A successful compile or browser run does not establish physical-machine behavior.

## Common checks

1. Start empty and hidden. The status/tray icon uses the current brand mark; the
   hidden overlay does not block clicks. Mac also has the same Dock icon.
2. Copy an image in another application: one note appears and peeks for 2.5 s.
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
   activation click. Remaining cards, keyboard focus and counter stay consistent.
6. Add more than 30 notes. Retain the newest 30, oldest to newest. Clear all empties
   the session immediately. Exports for removed/cleared notes survive until exit.
7. Hold and drag PNG/TXT copies into a file manager and a document/chat app. Keep
   the original note and preserve pinned state. Verify the exported bytes/content.
8. Open the four-entry menu. Move across every row while another application is
   active: highlight follows the pointer and clears on departure. Checkmarks are
   legible; hovering never toggles a setting. Pinning adds the website's lower-right
   dot to the status/tray icon; unpinning, Escape and hiding notes clear it. Check
   both menu and settings switches and retain the dot after receiving/copying notes.
9. Settings is the compact website window: collection, pinning, three appearances,
   language, two shortcuts, count and Clear all. Changes apply immediately.
   On both platforms, occupy both preferred combinations before startup: each receives an
   actually registered replacement and a persistent explanation in its settings row.
   Click either row to record a new combination; confirm the other action stays
   registered, standard Copy is rejected and Escape cancels without closing settings.
   Cancel, close or switch apps during recording and confirm both shortcuts resume.
   With QQ running, record its screenshot combination: no screenshot should start.
   Verify global shortcuts work again after commit, Escape, close and app switching.
   Without Mac Accessibility permission, recording must stop with an explanation
   rather than accepting keys without protection. Open settings over pinned images;
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
```

```powershell
.\scripts\build-windows.ps1
```

Mac smoke checks use a named pasteboard, generated test content and isolated
preferences. They verify real WKWebView/AppKit behavior without reading selections
from other apps, requesting screen capture or changing the general clipboard.
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

# Pinned-note clients — local preview status

The approved website is now the shared presentation for Windows and macOS.
Current behavior and build/run commands are documented in the root README;
platform acceptance cases are in `docs/native-testing.md`.

## Implemented

- Offline shared React/CSS cards and the exact website appearance editor.
- Paper/Card skins, pins, sizes, colors, embedded artwork and strict JSON checks.
- Active-file and directory hot reload, including in-place writes and atomic
  replacement; invalid edits retain the current style and a last-good recovery.
- 500 ms physical top-edge dwell, 450 ms departure grace, entry/exit transitions,
  keyboard opening and global capture shortcuts, native menu/tray commands.
- Session-owned PNG/TXT exports, full native clipboard payloads, real capture
  selectors, explicit clipboard paste, file import, text composer and drag source.
- Continuous horizontally scrolling mixed notes with no eight/sixteen-item limit,
  immediate layout removal, keyboard controls and bounded pixel feedback.
- Display-assigned notes, monitor-aware placement and reduced-motion integration.
- Cached thumbnails and incremental item/skin messages; full image files are not
  resent on every UI update or kept in the Windows item model as full bitmaps.
- Platform-separated sources and build scripts; CI builds macOS/Windows artifacts.
- Newly saved system screenshot intake on Mac, new clipboard image intake on
  both platforms, persistent menu/tray switches and own-copy suppression.
- Mac Dock icon/reopen action, inactive-window hover highlighting and first-click
  copying; screenshot files and the clipboard present at launch are ignored.
- Right-click Settings with screenshot intake and two editable global shortcuts,
  persistent preferences, OS conflict rollback, recording-time pause/resume and
  selected-text capture (Mac Accessibility / Windows UI Automation or fresh Copy).

## Verified on this Mac

- Production website export and the original 51 browser checks pass. Seven checks now target
  the offline native bundle, host commands, artwork/export and incremental state.
- Six Swift core check groups pass with Command Line Tools, without XCTest.
- The packaged, ad-hoc-signed Apple Silicon `.app` includes native checks for:
  no pointer activation; native text and original-PNG writing to a named test
  pasteboard; export survival after removal; 21 notes; actual in-place and atomic
  filesystem reload; invalid-edit retention; offline WKWebView appearance editor.
  Additional checks cover native hover/first-click copying, screenshot metadata
  arrival after file creation, new clipboard-only images, duplicate suppression,
  self-copy exclusion, intake disabling and preserving notes during a local update.
  Settings checks cover actual WKWebView controls and native persistence, complete
  selected-text payloads, and actual Carbon shortcut conflicts/registration rollback.
- Packaged app resources and code signature checked. The packaged smoke test
  caught a relative bundle-resource URL problem, which is fixed and rechecked.
- Native rendered screenshots: `artifacts/qa/macos-packaged/macos-notes.png`
  and `macos-appearance.png`; detailed results in `macos-smoke.txt`.
- Windows skin checks pass on the Mac .NET SDK, including real FileSystemWatcher
  changes and recovery of the last good skin after restart.
- Windows x64 self-contained publish produces a PE GUI exe and complete runtime
  directory. This is compilation evidence, not Windows GUI acceptance.

## Still requires physical-machine acceptance

- User-selected screenshot capture permission/selection/cancellation on macOS.
- Selected-text hotkeys in third-party editors/browsers, first-use Mac Accessibility
  permission and unsupported selection providers; isolated tests never grant this
  permission, read another app's selection or inject Copy into the user's apps.
- Cross-application file drops in Finder/Explorer, chat and document applications.
- Full keyboard/screen-reader operation, full-screen transitions, different
  monitor arrangements/DPI, hotplug and sleep/wake.
- Windows transparency/WebView2 Composition behavior and region selection.
- Idle CPU/memory and high-refresh/p95 frame timing. The old 144 Hz/8.3 ms gate
  has not been declared satisfied. WebView2 Composition can have different frame
  timing from the standard control and must be measured on Windows.

There is no public installer, Developer ID/notarized release, auto-start setting,
update service, account or cloud store. Automatic screenshot/image intake can be
disabled from the native menu; it never initiates screen recording or captures.
Normal clients start empty and hidden; test samples are isolated from user data.

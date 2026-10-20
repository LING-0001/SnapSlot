# Native acceptance checklist

Build commands and output paths are in the root README. Build folders are named
`artifacts/macos` and `artifacts/windows/<runtime>`; the source folders are
`apps/macos`, `apps/windows`, and `apps/native-ui`.

## Mac first

1. Open the app. Check both the SnapSlot Dock and menu-bar icons. Clicking Dock
   opens notes. There should be no invisible top-edge window intercepting clicks
   while idle. Hovering a card highlights it before clicking; the first click
   copies even when another app is active.
2. Use Take a screenshot. Approve the system's capture permission if requested,
   select a region and check its original image after copy/paste. Esc cancels
   without adding a note. No screenshot should be taken on ordinary startup.
   Also test the ordinary Command+Shift+3/4/5 shortcuts, a custom screenshot save
   folder, and Control+Command+Shift+4 to the clipboard. Newly saved screenshots
   should be collected once, with originals intact. The system's floating preview
   may defer final file saving. Test disabling/re-enabling intake from the menu;
   old screenshots, launch clipboard contents and plain text must stay excluded.
   Copying a note must never create another note.
3. Add text with several lines, including Chinese/emoji. Copy and paste its full
   content; only the preview is shortened. Reject payloads above 64 KB.
4. At the physical screen top, a brief pass must not reveal. Dwell 0.5 seconds;
   notes should arrive without taking focus from the target app. Leaving starts
   450 ms grace plus eased exit; entering again retains them. Test the global
   Control+Option+Space shortcut and Escape.
5. Hold and drag an image into Finder and a chat/document app; repeat with text.
   Check copied PNG/TXT files and keep the original note. Removing it afterward
   must not interrupt an external application's pending file read.
6. Add over 16 notes, scroll the row and delete rapidly. Remaining notes should
   move immediately. Check keyboard arrows, Enter, Delete and focus recovery.
7. Open Appearance: image upload/replacement should be visible. Test both
   presets, dimensions, roundness, colors, Fill/Fit, JSON import and OS export.
   Compare with the approved website. Uploaded art must not alter copied content.
8. Open the skin folder and edit active.json both in-place and using an editor
   that replaces files on save. Check valid updates, invalid JSON retention,
   returning to a valid file and a restart while active.json is invalid.
9. Test Reduce Motion, six locales, two monitors with different scale factors,
   full-screen foreground apps, monitor disconnect/reconnect and sleep/wake.
10. Quit from the menu. Notes should not return after restart. Skin and language
    preferences should remain; original imported files must be untouched.
11. Right-click the menu-bar icon → Settings. Check the intake switch defaults on;
    record a new screenshot shortcut and text shortcut, save, leave Settings and
    use both. Reject duplicate/reserved shortcuts and ones occupied by another
    application; previous values and registrations should survive rejection.
    Check Escape cancels recording, ordinary keys are not intercepted while
    editing, and settings persist after restart. Switch intake off and check the
    app's own screenshot command still works.
12. In TextEdit, a browser and a code editor, select part of some text (then all of
    it) and use Control+Option+T or the configured text shortcut. On Mac, accept the
    first-use Accessibility request. Check full Unicode text in the note and
    clipboard, empty selection feedback, the 64 KB limit and foreground changes.
    Never import whatever text happened to be in the clipboard before the action.

The automated Mac smoke checks use a named test pasteboard and generated images,
not the general pasteboard or screen capture. It verifies real WKWebView rendering,
native PNG/text writing, first-click copying, inactive hover feedback, newly saved
screenshot intake with delayed metadata, image-only clipboard intake, deduplication,
self-copy suppression, disabling intake, update handoff, export lifetime, 21 notes
and real filesystem reloads. Screenshot files are synthetic with the system's
screenshot metadata; this does not claim end-to-end testing of the OS shortcuts.
Settings are exercised through the real WKWebView bridge and an isolated config
file. Carbon shortcut conflict rollback uses temporary modifier-heavy function
keys; third-party selection access and real global keypress delivery remain manual.
Screenshot selection and cross-application drag/drop still require manual checks.

## Windows later

1. Carry the complete ZIP or build from source using build-windows.ps1.
2. Confirm WebView2 Runtime availability and transparent cards on real Windows.
   Check that the shared UI does not become a black/white rectangular overlay.
3. Repeat the clipboard, region capture, file drag, deletion, JSON, keyboard and
   locale cases above. Windows uses Ctrl+Alt+Space and Ctrl+Alt+S.
   Win+Shift+S / Print Screen should automatically collect newly published images.
   Test the tray intake switch, clipboard contention/retries and own-copy suppression.
4. Check 100/125/150/200% scale factors, negative monitor origins, a top taskbar,
   mixed-DPI moves, hotplug, full-screen apps and shortcut conflicts.
5. Run SnapSlot.exe --smoke-test <output-directory>. This checks initialization
   and captures the actual WebView2 frame; it is not a replacement for target-app
   drag/drop or UI Automation/screen-reader checks.
6. Measure idle CPU/memory and p95 frame timing at the target refresh rate. The
   original 144 Hz/8.3 ms gate has not been accepted merely because code compiles.

There is no signing/notarization, installer, update service or auto-start change
in these local preview packages. No external communication is performed by tests.

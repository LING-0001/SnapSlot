# Current implementation

The website and both desktop hosts use the current fan presentation. The native
bundle imports website styles and six-language copy directly. Windows and macOS
implement their own clipboard, shortcut, selected-text, window and drag operations.

Implemented product controls are automatic clipboard-image collection, pinning,
glass/paper/graphite appearance, language, shortcuts and clearing the session.
Both desktop settings can record both shortcuts, automatically register available replacements
for occupied combinations and show a persistent explanation beside the changed action.
Minimized desktop settings restore to the foreground when opened from the status menu.
Unpinned notes dismiss on pointer departure even with settings foreground, background
or minimized. The session limit is 30. There is no separate JSON appearance system or manual
image/text import UI. The app does not start screen capture or monitor image folders.

Tests and acceptance commands are maintained in `CONTRIBUTING.md` and
`docs/native-testing.md`. Run them for the current revision; historical counts and
screenshots are not a substitute for current verification. Windows visual behavior
requires a real Windows machine even when cross-compilation succeeds on macOS.

Local Mac packaging retains only `artifacts/macos/SnapSlot.app`. The optional
`--archive` format replaces it with one ZIP for CI; intermediate UI/icon files are
temporary. The website is statically exported. No Developer ID / notarized Mac distribution or signed Windows installer,
auto-start setting, update service, account or cloud store is implemented.

Installer distribution follows `release.json` and the formal release workflow. Local
source/native verification does not create a release, change the version or replace
website installers. Source-only website previews skip installer validation and must
not be deployed. See `docs/releases/hosting.md` for deployment.

The website also provides a replayable demo toolbar and an explicit in-demo paste
path. Clipboard denial keeps the local demo usable and shows a truthful explanation.
Small-screen settings and guide positioning, keyboard menu/focus behavior, inert
closed notes and touch direction handling have dedicated browser regression checks.

Desktop functional parity uses the current website note stylesheet directly. The
old standalone stylesheet and separate macOS SwiftUI shelf are retired. Both hosts
support unpinned arrival peeks, explicit pinning, full-note reading, small copied
feedback, text selection/recollection, whole-note dragging and the existing editable
shortcuts. No desktop tutorial is included. The real operating system remains the
user's workspace; the website's draft document and wallpaper are demo surroundings.

Current local evidence is maintained privately outside the public product repository.
The shared browser bridge suite covers both platform contracts. macOS host smoke
checks use isolated data and a named clipboard; cross-compilation is recorded
separately from Windows-machine interaction acceptance.

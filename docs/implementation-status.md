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

The v1.0.0 distribution contains a universal Mac DMG and self-contained Windows
x64 Setup installer in `apps/website/public/downloads/v1.0.0/`. Website builds verify their
versions and checksums before copying them into `out/downloads/`. GitHub tag
releases publish those same files. See `docs/releases/hosting.md` for deployment.

The website also provides a replayable demo toolbar and an explicit in-demo paste
path. Clipboard denial keeps the local demo usable and shows a truthful explanation.
Small-screen settings and guide positioning, keyboard menu/focus behavior, inert
closed notes and touch direction handling have dedicated browser regression checks.

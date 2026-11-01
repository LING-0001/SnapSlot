# Native presentation

Windows (WPF/WebView2 Composition) and macOS (AppKit/WKWebView) load this same offline
React interface. It imports `apps/website/components/home.module.css` and the current
six-language product copy. Fan geometry, three appearances, hover/copy/arrival
feedback, compact settings and the four-entry menu follow the website. The hosts
do not show the website tutorial, mock wallpaper, Dock or draft document. There is
one renderer and one note stylesheet for both desktop platforms.

`protocol.ts` is the complete host contract. Hosts own clipboard bytes, selected
text, shortcuts, display placement and file-copy dragging. The UI uses session item
IDs and validated commands; it cannot authorize arbitrary file paths or processes.
Mac supplies behind-window materials and always-active pointer tracking. The Windows
bridge uses WebView2 messages and native cursor coordinates.

Both desktop shortcut settings record combinations and show registered conflict
replacements. Both bindings are checked at startup, when opening Settings, and
before recording begins, so existing conflicts appear together before editing.
Warnings remain visible during recording. macOS checks enabled system shortcuts and
exclusive registrations; shared third-party registrations may not report a conflict.
The bridge suspends only SnapSlot's own shortcuts and signals readiness before accepting foreground key events. Other apps
and system shortcuts continue to work during recording; Mac recording requires no
Accessibility permission. Both restore this app's shortcuts on commit, cancel,
close or blur. Selected-text collection separately requires Accessibility on Mac.
Settings reports its content height to the host so explanations fit.
Space or the magnifier opens full text/image reading; Escape closes that layer
and restores the card without changing pinning. Copy feedback stays in the lower
right corner. A text card remains draggable, while selected words can be collected
again through the selection action or shortcut. Hosts validate note IDs and the
reserved preview/selection input regions; they keep transparent space click-through.
Text drops expose both file and plain-text formats.

Settings never suppresses unpinned pointer dismissal or top-edge reveal. Temporary arrival
markers change CSS animation parameters rather than restarting the animation.
Settings owns its rounded clipping and can be dragged from non-interactive blank
areas; buttons and shortcut rows keep their own interaction.

```sh
npm run build:native --prefix apps/website
apps/website/node_modules/.bin/tsc -p apps/native-ui/tsconfig.json
cd apps/website && npx playwright test tests/native-ui.spec.ts
```

`SNAPSLOT_UI_OUTPUT` selects a temporary bundle directory. Packaging uses this to
avoid leaving duplicate resources. Default standalone output is `artifacts/native-ui`.
Mac local builds keep only `artifacts/macos/SnapSlot.app`; `--archive` keeps only its
ZIP for CI. Windows local builds keep one runtime directory; `-Archive` keeps one ZIP.
Windows packages include the runtime and NativeUI beside the exe.

Inter Tight and Noto Sans SC are shared from `apps/website/assets/fonts` and bundled with SIL Open Font Licenses. No installed
client needs a website server or requests remote fonts. Browser parity and native
acceptance procedures are in `docs/native-testing.md`.

To update both platform icon formats from the adopted PNG master, run `swift scripts/make-icon.swift /tmp/snapslot-iconset assets/brand/snapslot-icon-1024.png assets/brand/SnapSlot.ico`; the temporary directory contains the matching macOS PNG sizes.

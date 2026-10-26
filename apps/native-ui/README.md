# Native presentation

Windows (WPF/WebView2 Composition) and macOS (AppKit/WKWebView) load this same offline
React interface. It imports `apps/website/components/home.module.css` and the current
six-language product copy. Fan geometry, three appearances, hover/copy/arrival
feedback, compact settings and the four-entry menu follow the website.

`protocol.ts` is the complete host contract. Hosts own clipboard bytes, selected
text, shortcuts, display placement and file-copy dragging. The UI uses session item
IDs and validated commands; it cannot authorize arbitrary file paths or processes.
Mac supplies behind-window materials and always-active pointer tracking. The Windows
bridge uses WebView2 messages and native cursor coordinates.

Both desktop shortcut settings record both combinations, show registered conflict replacements,
and report their content height to their host so explanations fit. The bridge suspends
this app's shortcuts during recording. The UI waits for native recording protection
before accepting keys; Mac pauses system-registered hotkeys while foreground,
and Windows captures them with a temporary keyboard hook. Both restore normal
handling on commit, cancel, close or blur. Mac requires existing Accessibility
permission for this protection and refuses unprotected recording.
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

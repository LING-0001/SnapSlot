# Native client presentation

Windows (WPF + WebView2) and macOS (AppKit + WKWebView) load this bundled,
offline presentation. It reuses the approved website card styles, version 1
skin parser, presets, six locales and appearance editor. No website server,
account, remote JavaScript or network access is required at runtime.

Build with `npm run build:native` in `apps/website`. Output is generated in
`artifacts/native-ui`; the platform build scripts copy it into their bundles.
Native hosts implement the commands in `protocol.ts`. UI data never authorizes
arbitrary paths or processes; item IDs resolve to session-owned files in the host.

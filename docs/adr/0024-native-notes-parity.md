# ADR 0024: Approved pinned notes with a shared offline UI and native hosts

Accepted following the user's instruction to implement Windows and macOS from
the completed website and permission to choose the implementation approach.
Supersedes the old visual/overflow/timing details of ADRs 0001, 0009, 0019 and 0023
for this implementation. It does not declare the original performance gate met.

The website's Paper/Card presets, independent pushpins, custom artwork, continuous
row, immediate removal, 500 ms edge dwell and eased entry/exit are the reference.
A small esbuild bundle reuses the actual card CSS, strict JSON parser, six-locale
copy and appearance editor. It is not the website shell and needs no local server.

Native integrations remain platform-specific: AppKit/WKWebView on macOS and
WPF/WebView2CompositionControl on Windows. This avoids separate copies of visual
behavior and includes no Electron runtime. Platform code owns screen coordinates,
global shortcuts, native PNG/text clipboard, screenshots and file dragging.
Commands resolve session item IDs to host-owned export files, never arbitrary
frontend paths or executables. Static navigation, CSP and bridge origin checks
keep the presentation offline. The user's subsequent Mac feedback adds automatic
intake of newly saved system screenshots on macOS and new clipboard images on
both hosts, with a persistent menu switch. Startup clipboard contents, plain text
and the hosts' own copy writes are excluded. macOS also exposes a real Dock icon.

The Windows Composition control permits WPF transparency/composition, but its
GraphicsCaptureSession presentation can have different frame timing from a normal
WebView2. Windows visual and performance acceptance must be measured on Windows;
Mac compilation and a produced exe do not establish that acceptance.

Thumbnails and text are sent once per view/item, and skins only when changed;
subsequent states contain IDs and metadata. Full PNG files stay in the native
session directory and are read only for clipboard/drag operations. Skin files
are watched and validated on both platforms; atomic replacement and in-place
writes keep the last valid style, with a persisted recovery copy.

Native clients start empty and hidden. The website's sample content, mock desktop,
fake dock and hero copy remain website-only. Test clients use separate sample
sessions and named pasteboards so smoke tests do not read or overwrite user data.

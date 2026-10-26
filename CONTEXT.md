# Current product contract

The current website (`apps/website/components/home.tsx`, `home.module.css` and
`lib/home-copy.ts`) is the only visual and interaction reference. The desktop
hosts use `apps/native-ui`; there is no second note renderer or appearance editor.

## Product

SnapSlot / 快照贴 / 快照貼 is a local, temporary clipboard transfer tool. New image
bytes written by another application become notes when automatic collection is
on. Selected text becomes a note only when the user presses its shortcut (default
Control+Option+T on macOS or Ctrl+Alt+T on Windows). Ordinary copied text and launch clipboard content
are ignored. Copying an existing note does not add it again.

The app does not capture the screen, scan screenshot folders, import arbitrary
files, compose manual notes, upload content or require an account. Images copied
by an operating-system screenshot tool are ordinary clipboard images.

Each session holds at most 30 notes, oldest first. A new note evicts the oldest.
Normal startup is empty; normal exit removes session-owned exports. Removing or
clearing notes keeps their PNG/TXT exports alive until exit for pending file drops.
Text is limited to 64 KB UTF-8. A local development update may explicitly hand off
an existing session; this is not a permanent library or a normal restart restore.

## Presentation

Notes form a rotating fan: image cards 220 × 144 px, text cards 200 × 144 px,
14 px rounded faces, a 1500 px rotation radius and a 7.2 degree step. Narrow
surfaces use the website's responsive geometry. The current note is centered;
wheel and arrow navigation change it. Images cover their face without stretching.
Three appearances apply uniformly to the current session: glass, paper and graphite.
There is no JSON skin, size editor, artwork upload or per-note styling.

Hover reveals a remove button at the upper right and lowers the face by 5 px.
Click copies the original image or full text; a centered overlay confirms the copy.
Holding and moving starts a native file-copy drag. Delete removes; Escape closes.

The top-edge dwell is 500 ms. Departure grace is 450 ms; arrivals peek for 2500 ms.
Entry is 420 ms with a 260 ms fade, exit 240 ms with a 200 ms fade. Fan rotation
uses 520 ms; fresh arrivals use a gentler 520 ms. Use the website CSS values rather than
maintaining duplicate animations. Reduced motion removes animation. Hidden notes
and transparent regions must not intercept another application's clicks.

## Menu and settings

The tray/menu-bar popup has four entries: Settings…, automatically collect
clipboard images, pin notes, and Quit. Collection and pinning show their checked
state. Quit sits below a separator and performs normal session cleanup.
Windows uses right click for the menu and left click to show/hide notes. Mac accepts
left or right click. Menu hover follows the website's platform-specific highlight,
including inactive-window pointer movement; hovering does not trigger actions.

The compact settings window contains the two switches, three appearance swatches,
six-language selector, selected-text shortcut, open-notes shortcut and note count
with Clear all. These are the only settings controls. Pinning opens the fan; closing
settings, copying, receiving new notes and dragging preserve the pinned state.

On macOS and Windows, both shortcut combinations are editable by clicking their keys. Occupied
combinations receive alternatives only after successful system registration; settings
shows the old combination and actual replacement until the user changes that action.
Recording temporarily releases this app's registrations and restores them on cancel,
focus loss or closing settings. Escape cancels recording without closing the window.
Reopening a minimized settings window restores that same window and activates it.
Unpinned notes still dismiss on pointer departure while settings is foreground,
background or minimized; settings does not suppress top-edge reveal.

macOS shows a Dock icon and menu-bar icon. Both use the current brand render;
Windows uses the matching ICO. Pinning adds the website's lower-right status marker:
5 px in the Mac label color; Windows uses a 7 px blue dot with a light ring (scaled
to its system tray image). Unpinning, Escape and hiding notes clear it immediately.
Windows dims/desaturates the mark when automatic collection is off, as on the site.
Quit is available from the status/tray popup and the operating-system application menu.
Distribution uses a Mac DMG and a Windows Setup installer. No auto-start preference,
update service or account is implemented.

## Hosts and validation

AppKit/WKWebView and WPF/WebView2 Composition own clipboard bytes, selected-text
access, global shortcuts, screen placement and file dragging. The shared offline
React bundle uses item IDs and a bounded command protocol; it does not receive
arbitrary filesystem/process authority. All six locales are supported: en, zh-Hans,
zh-Hant, ja, ko, es. User content is not translated.

Mac supplies behind-window material for the website's glass appearances and native
pointer tracking. Preferences persist atomically. Native hosts accept old preference
field names only to retain the user's collection choice during migration.

A browser comparison, compile, isolated native check and physical-machine acceptance
are separate evidence. macOS checks do not establish Windows rendering, real external
file drops, screen-reader behavior, multiple-display correctness or performance.

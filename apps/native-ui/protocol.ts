export type NativeItem = { id: string; kind: "image" | "text"; title: string; text?: string; preview?: string };
export type Shortcut = { key: string; control: boolean; alt: boolean; shift: boolean; meta: boolean };
export type ShortcutTarget = "text" | "open";
export type ShortcutChange = { target: ShortcutTarget; requested: Shortcut; replacement: Shortcut };
export type AppPreferences = { collectImages: boolean; textShortcut: Shortcut; openShortcut?: Shortcut };
export type Appearance = "glass" | "paper" | "graphite";
export type Message =
  | { type: "state"; items: NativeItem[]; locale: string; expanded: boolean; reducedMotion: boolean; focus?: boolean; pinned: boolean; arming: boolean; appearance: Appearance; count: number; platform?: "macos" | "windows" }
  | { type: "preferences"; value: AppPreferences; platform: "macos" | "windows"; shortcutChanges?: ShortcutChange[] }
  | { type: "recordingCancelled" }
  | { type: "copied"; id: string }
  | { type: "pointer"; x: number | null; y: number | null }
  | { type: "error"; message: string };
export type Surface = { id: string; x: number; y: number; width: number; height: number; angle: number; opacity: number };
export type Command =
  | { type: "ready" | "collapse" | "pin" | "unpin" | "close" | "quit" | "openPreferences" | "clearNotes" | "moveWindow" }
  | { type: "copy" | "remove" | "drag"; id: string }
  | { type: "savePreferences"; value: AppPreferences; editingShortcut?: ShortcutTarget }
  | { type: "beginShortcutRecording" | "endShortcutRecording" | "minimizePreferences" }
  | { type: "resizePreferences"; height: number }
  | { type: "setAppearance"; value: Appearance }
  | { type: "setLocale"; value: string }
  | { type: "surfaces"; surfaces: Surface[] };
declare global {
  interface Window {
    snapslotReceive?: (message: Message) => void;
    webkit?: { messageHandlers?: { snapslot?: { postMessage: (command: Command) => void } } };
    chrome?: { webview?: { postMessage: (command: Command) => void; addEventListener: (event: "message", handler: (event: { data: Message }) => void) => void; removeEventListener: (event: "message", handler: (event: { data: Message }) => void) => void } };
  }
}
export function send(command: Command) {
  if (window.chrome?.webview) window.chrome.webview.postMessage(command);
  else window.webkit?.messageHandlers?.snapslot?.postMessage(command);
}

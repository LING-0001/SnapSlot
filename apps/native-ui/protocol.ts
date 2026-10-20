export type NativeItem = { id: string; kind: "image" | "text"; title: string; text?: string; preview?: string };
export type Shortcut = { key: string; control: boolean; alt: boolean; shift: boolean; meta: boolean };
export type AppPreferences = { collectScreenshots: boolean; captureShortcut: Shortcut; textShortcut: Shortcut };
export type HostMessage =
  | { type: "state"; items: NativeItem[]; skin?: string | null; locale: string; expanded: boolean; reducedMotion: boolean; focus?: boolean }
  | { type: "error"; message: string }
  | { type: "copied"; id: string }
  | { type: "pointer"; x: number | null; y: number | null }
  | { type: "preferences"; value: AppPreferences; platform: "macos" | "windows" }
  | { type: "skin"; source: string };
export type Command =
  | { type: "ready" | "collapse" | "pin" | "capture" | "paste" | "addImages" | "newText" | "appearance" | "close" | "openSkinFolder" }
  | { type: "copy" | "remove" | "drag"; id: string }
  | { type: "saveText"; text: string }
  | { type: "savePreferences"; value: AppPreferences }
  | { type: "applySkin" | "exportSkin"; source: string };
declare global {
  interface Window {
    snapslotReceive?: (message: HostMessage) => void;
    chrome?: { webview?: { postMessage: (message: Command) => void; addEventListener: (event: "message", handler: (event: { data: HostMessage }) => void) => void } };
    webkit?: { messageHandlers?: { snapslot?: { postMessage: (message: Command) => void } } };
  }
}
export function send(command: Command) {
  if (window.chrome?.webview) window.chrome.webview.postMessage(command);
  else window.webkit?.messageHandlers?.snapslot?.postMessage(command);
}

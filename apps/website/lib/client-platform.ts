export type DesktopPlatform = "mac" | "win";

export function clientPlatform(): DesktopPlatform {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "win";
}

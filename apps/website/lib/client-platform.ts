"use client";

import {useLayoutEffect,useState} from "react";

export type DesktopPlatform = "mac" | "win";

export function clientPlatform(): DesktopPlatform {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "mac" : "win";
}

export function useDesktopPlatform() {
  // Static HTML cannot know the visitor's OS. Keep platform UI unpainted until
  // hydration resolves it, then reveal the matching UI before the next paint.
  const [platform,setPlatform]=useState<DesktopPlatform|null>(null);
  useLayoutEffect(()=>{setPlatform(clientPlatform());},[]);
  return [platform,setPlatform] as const;
}

import notes from "@/public/skins/notes.json";
import cards from "@/public/skins/cards.json";
import type { CSSProperties } from "react";

export type Skin = {
  schemaVersion: 1;
  name: string;
  background?: { image: string; fit: "cover" | "contain" };
  card: { width: number; height: number; textWidth: number; gap: number; padding: number; radius: number; borderWidth: number; frame: string; textBackground: string; ink: string; fontSize: number; imageFit: "contain" | "cover" };
  shadow: { color: string; blur: number; offsetY: number };
  pin: { enabled: boolean; color: string; shade: string; width: number; height: number; x: number; y: number };
  buttons: { size: number; inset: number; background: string; foreground: string; copyBackground: string; copyForeground: string };
};

const limits: Record<string, [number, number]> = {
  "card.width": [100, 480], "card.textWidth": [100, 480], "card.height": [80, 280],
  "card.gap": [8, 64], "card.padding": [2, 24], "card.radius": [0, 48],
  "card.borderWidth": [0, 8], "card.fontSize": [12, 24],
  "shadow.blur": [0, 48], "shadow.offsetY": [0, 24],
  "pin.width": [8, 40], "pin.height": [8, 48], "pin.x": [10, 90], "pin.y": [-24, 8],
  "buttons.size": [20, 40], "buttons.inset": [0, 16],
};

export const MAX_SKIN_BYTES = 2 * 1024 * 1024;

function isEmbeddedRaster(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  try {
    const bytes = atob(match[2]);
    if (match[1] === "png") return bytes.startsWith("\x89PNG\r\n\x1a\n");
    if (match[1] === "jpeg") return bytes.startsWith("\xff\xd8\xff");
    return bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  } catch { return false; }
}

/** Data only: optional embedded raster artwork, never CSS, remote URLs or HTML. */
export function parseSkin(source: string): Skin {
  if (new TextEncoder().encode(source).length > MAX_SKIN_BYTES) throw new Error("JSON: maximum 2 MB");
  const value: unknown = JSON.parse(source);
  function validate(actual: unknown, sample: unknown, path: string) {
    if (sample !== null && typeof sample === "object") {
      if (!actual || typeof actual !== "object" || Array.isArray(actual)) throw new Error(`${path || "skin"}: expected object`);
      const data = actual as Record<string, unknown>;
      const model = sample as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        if (!path && key === "background") {
          const background = data.background;
          if (!background || typeof background !== "object" || Array.isArray(background)) throw new Error("background: expected object");
          const artwork = background as Record<string, unknown>;
          if (Object.keys(artwork).some((field) => !["image", "fit"].includes(field))) throw new Error("background: unknown field");
          if (!isEmbeddedRaster(artwork.image)) throw new Error("background.image: embedded PNG, JPEG or WebP required");
          if (!["cover", "contain"].includes(artwork.fit as string)) throw new Error("background.fit: cover / contain");
        } else if (!Object.hasOwn(model, key)) throw new Error(`${path ? `${path}.` : ""}${key}: unknown field`);
      }
      for (const key of Object.keys(model)) {
        if (!Object.hasOwn(data, key)) throw new Error(`${path ? `${path}.` : ""}${key}: required`);
        validate(data[key], model[key], path ? `${path}.${key}` : key);
      }
      return;
    }
    if (typeof actual !== typeof sample) throw new Error(`${path}: expected ${typeof sample}`);
    if (typeof actual === "number") {
      const [min, max] = limits[path] || [1, 1];
      if (!Number.isFinite(actual) || actual < min || actual > max) throw new Error(`${path}: ${min}–${max}`);
    }
    if (typeof actual === "string") {
      if (path === "name") { if (!actual.trim() || actual.length > 60) throw new Error("name: 1–60 characters"); }
      else if (path === "card.imageFit") { if (!["contain", "cover"].includes(actual)) throw new Error("card.imageFit: contain / cover"); }
      else if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(actual)) throw new Error(`${path}: #RRGGBB or #RRGGBBAA`);
    }
  }
  validate(value, notes, "");
  const skin = value as Skin;
  const inner = Math.min(skin.card.width, skin.card.textWidth, skin.card.height) - 2 * (skin.card.padding + skin.card.borderWidth);
  if (inner < 48) throw new Error("card: content area must be at least 48 px");
  return skin;
}

export const builtInSkins: Skin[] = [notes, cards].map((skin) => parseSkin(JSON.stringify(skin)));

export function isSameSkin(skin: Skin, preset: Skin): boolean {
  return skin.name === preset.name && skin.schemaVersion === preset.schemaVersion
    && skin.background?.image === preset.background?.image && skin.background?.fit === preset.background?.fit
    && (["card", "pin", "shadow", "buttons"] as const).every((group) =>
      Object.entries(preset[group]).every(([key, value]) => Reflect.get(skin[group], key) === value));
}

export function skinStyle(skin: Skin): CSSProperties {
  const c = skin.card, p = skin.pin, b = skin.buttons;
  return {
    "--card-width": `${c.width}px`, "--text-width": `${c.textWidth}px`, "--card-height": `${c.height}px`,
    "--card-gap": `${c.gap}px`, "--card-padding": `${c.padding}px`, "--card-radius": `${c.radius}px`,
    "--card-border": `${c.borderWidth}px`, "--card-frame": c.frame, "--note-bg": c.textBackground,
    "--card-ink": c.ink, "--card-font": `${c.fontSize}px`, "--image-fit": c.imageFit,
    "--skin-image": skin.background ? `url("${skin.background.image}")` : "none",
    "--skin-image-fit": skin.background?.fit || "cover",
    "--text-surface": skin.background ? "color-mix(in srgb, var(--note-bg) 82%, transparent)" : "var(--note-bg)",
    "--card-shadow": `0 ${skin.shadow.offsetY}px ${skin.shadow.blur}px ${skin.shadow.color}`,
    "--pin-display": p.enabled ? "block" : "none", "--pin-color": p.color, "--pin-shade": p.shade,
    "--pin-width": `${p.width}px`, "--pin-height": `${p.height}px`, "--pin-x": `${p.x}%`, "--pin-y": `${p.y}px`,
    "--button-size": `${b.size}px`, "--button-inset": `${b.inset}px`, "--button-bg": b.background,
    "--button-ink": b.foreground, "--copy-bg": b.copyBackground, "--copy-ink": b.copyForeground,
  } as CSSProperties;
}

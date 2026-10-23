import { test, expect } from "@playwright/test";
import { builtInSkins, MAX_SKIN_BYTES, parseSkin } from "../lib/skin";

test("skin validation rejects incompatible versions, unsafe values and unusable geometry", () => {
  const base = builtInSkins[0];
  for (const invalid of [
    { ...base, schemaVersion: 2 },
    { ...base, pin: { ...base.pin, enabled: "yes" } },
    { ...base, card: { ...base.card, width: -1 } },
    { ...base, card: { ...base.card, frame: "url(https://example.com)" } },
    { ...base, card: { ...base.card, height: 80, padding: 24, borderWidth: 8 } },
    { ...base, card: { ...base.card, imageFit: "stretch" } },
    { ...base, script: "alert(1)" },
    { ...base, background: { image: "https://example.com/image.png", fit: "cover" } },
    { ...base, background: { image: "data:image/svg+xml;base64,PHN2Zy8+", fit: "cover" } },
    { ...base, background: { image: "data:image/png;base64,bm90LWFuLWltYWdl", fit: "cover" } },
  ]) expect(() => parseSkin(JSON.stringify(invalid))).toThrow();
  expect(() => parseSkin(" ".repeat(MAX_SKIN_BYTES + 1))).toThrow("2 MB");
});

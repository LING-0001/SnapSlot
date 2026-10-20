export type SkinImageErrorCode = "imageType" | "imageSize" | "imageInvalid";

export class SkinImageError extends Error {
  constructor(public code: SkinImageErrorCode) { super(code); }
}

/** Decode and resize locally; the exported skin contains no file paths or URLs. */
export async function readSkinImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new SkinImageError("imageType");
  if (file.size > 5 * 1024 * 1024) throw new SkinImageError("imageSize");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new SkinImageError("imageInvalid"); }
  try {
    const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new SkinImageError("imageInvalid");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", .86);
    if (result.length > 1500000) throw new SkinImageError("imageSize");
    return result;
  } finally { bitmap.close(); }
}

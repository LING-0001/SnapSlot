"""Turns the captures in docs/media/<locale>/ into README assets.

    python scripts/readme-gif.py [locale ...]

Run after `node apps/website/scripts/readme-media.mjs`. Needs Pillow and FFmpeg.
- frames/ (a timestamped screencast) becomes demo.gif and demo.mp4, cropped to the demo desktop
  and resampled to a steady frame rate.
- PNG stills become WebP: the gradient wallpaper bands visibly in a 256-colour PNG.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

media = Path(__file__).resolve().parent.parent / "docs" / "media"
locales = sys.argv[1:] or sorted(p.name for p in media.iterdir() if p.is_dir())
WIDTH = 640  # GitHub shows README images at most ~880 px wide
FPS = 12

for locale in locales:
    folder = media / locale
    frames_dir = folder / "frames"
    index_file = frames_dir / "index.json"
    if index_file.exists():
        index = json.loads(index_file.read_text())
        crop, shots = index["crop"], index["frames"]
        start, end = shots[0]["t"], shots[-1]["t"]
        # Hold whichever screencast frame was on screen at each tick.
        picks, j = [], 0
        for k in range(int((end - start) * FPS) + 1):
            t = start + k / FPS
            while j + 1 < len(shots) and shots[j + 1]["t"] <= t:
                j += 1
            picks.append(shots[j]["name"])
        cache, frames = {}, []
        for name in picks:
            if name not in cache:
                im = Image.open(frames_dir / name).convert("RGB")
                w, h = im.size
                box = (round(crop["x"] * w), round(crop["y"] * h), round((crop["x"] + crop["w"]) * w), round((crop["y"] + crop["h"]) * h))
                im = im.crop(box)
                cache[name] = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
            frames.append(cache[name])
        # Keep a full-colour recording alongside the smaller README GIF.
        video = subprocess.Popen([
            "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pixel_format", "rgb24",
            "-video_size", f"{WIDTH}x{frames[0].height}", "-framerate", str(FPS), "-i", "-", "-an",
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(folder / "demo.mp4")
        ], stdin=subprocess.PIPE)
        for frame in frames:
            video.stdin.write(frame.tobytes())
        video.stdin.close()
        if video.wait() != 0:
            raise RuntimeError(f"Failed to encode {locale} demo recording")
        # One shared palette keeps the gradient wallpaper from flickering between frames.
        sample = Image.new("RGB", (WIDTH, frames[0].height * 3))
        for row, f in enumerate([frames[0], frames[len(frames) // 2], frames[-1]]):
            sample.paste(f, (0, row * f.height))
        palette = sample.quantize(colors=224, method=Image.Quantize.MEDIANCUT)
        quantized = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
        quantized[0].save(folder / "demo.gif", save_all=True, append_images=quantized[1:], duration=round(1000 / FPS), loop=0, optimize=True)
        shutil.rmtree(frames_dir)
    for still in folder.glob("*.png"):
        im = Image.open(still).convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        im.save(still.with_suffix(".webp"), quality=86, method=6)
        still.unlink()
    total = sum(f.stat().st_size for f in folder.iterdir()) / 1024
    print(f"{locale}: {total:.0f} KB")

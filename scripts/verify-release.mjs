#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid release version");
const folder = path.join(root, "apps/website/public/downloads", `v${version}`);
const manifest = JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8"));
if (manifest.version !== version || manifest.tag !== `v${version}`) throw new Error("Release manifest version mismatch");
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== manifest.tag) throw new Error("The Git tag does not match release.json");
const expected = { macos: `SnapSlot-${version}-macOS-universal.dmg`, windows: `SnapSlot-${version}-windows-x64-setup.exe` };
const sums = [];
for (const [platform, filename] of Object.entries(expected)) {
  const pkg = manifest.packages[platform];
  if (pkg?.file !== filename || pkg.url !== `/downloads/v${version}/${filename}`) throw new Error(`Invalid ${platform} download path`);
  const file = path.join(folder, filename), info = await stat(file);
  if (info.size !== pkg.size || info.size >= 100 * 1024 * 1024) throw new Error(`Invalid archive size: ${filename}`);
  const data = await readFile(file);
  if (platform === "macos") {
    if (data.length < 512 || data.toString("ascii", data.length - 512, data.length - 508) !== "koly" || pkg.format !== "dmg") throw new Error(`Invalid DMG: ${filename}`);
  } else {
    if (data.toString("ascii", 0, 2) !== "MZ" || data.toString("ascii", data.readUInt32LE(0x3c), data.readUInt32LE(0x3c) + 4) !== "PE\0\0" || !data.includes(Buffer.from("NullsoftInst")) || pkg.format !== "nsis") throw new Error(`Invalid Windows installer: ${filename}`);
  }
  const hash = createHash("sha256").update(data).digest("hex");
  if (hash !== pkg.sha256) throw new Error(`Checksum mismatch: ${filename}`);
  sums.push(`${hash}  ${filename}`);
  console.log(`Verified ${filename} (${(info.size / 1048576).toFixed(1)} MiB)`);
}
if ((await readFile(path.join(folder, "SHA256SUMS.txt"), "utf8")).replace(/\r\n/g, "\n").trim() !== sums.join("\n")) throw new Error("SHA256SUMS.txt is out of date");
if ((await readdir(folder)).sort().join("\n") !== [...Object.values(expected), "manifest.json", "SHA256SUMS.txt"].sort().join("\n")) throw new Error("Unexpected files in release directory");
const macVersion = await readFile(path.join(root, "apps/macos/Info.plist"), "utf8");
const windowsVersion = await readFile(path.join(root, "apps/windows/SnapSlot.Windows.csproj"), "utf8");
if (!macVersion.includes(`<key>CFBundleShortVersionString</key><string>${version}</string>`) || !windowsVersion.includes(`<Version>${version}</Version>`)) throw new Error("Native source versions do not match release.json");
const website = JSON.parse(await readFile(path.join(root, "apps/website/package.json"), "utf8"));
const websiteLock = JSON.parse(await readFile(path.join(root, "apps/website/package-lock.json"), "utf8"));
if (website.version !== version || websiteLock.version !== version || websiteLock.packages[""].version !== version) throw new Error("Website versions do not match release.json");
console.log(`Release v${version} is ready for direct hosting and GitHub Releases.`);

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { repositoryRoot, verifySourceVersion } from './verify-source.mjs';

export function validateManifest(manifest, version) {
  if (manifest.version !== version || manifest.tag !== `v${version}` || Object.keys(manifest.packages || {}).sort().join(',') !== 'macos,windows') throw new Error('Downloaded release version mismatch.');
  for (const [platform, suffix] of [['macos', 'macOS-universal.dmg'], ['windows', 'windows-x64-setup.exe']]) {
    const pkg = manifest.packages?.[platform], name = `SnapSlot-${version}-${suffix}`;
    if (pkg?.file !== name || pkg.url !== `/downloads/v${version}/${name}` || !/^[a-f0-9]{64}$/.test(pkg.sha256) || !Number.isSafeInteger(pkg.size) || pkg.size < 512 || pkg.size >= 2 * 1024 * 1024 * 1024) throw new Error(`Invalid ${platform} release metadata.`);
  }
  return manifest;
}
export async function verifyDownloaded(folder, version) {
  const manifest = validateManifest(JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8')), version);
  const sums = [];
  for (const pkg of Object.values(manifest.packages)) {
    if (!['macos', 'windows'].some(platform => manifest.packages[platform] === pkg)) throw new Error('Unexpected package.');
    const data = await readFile(path.join(folder, pkg.file));
    if (data.length !== pkg.size || createHash('sha256').update(data).digest('hex') !== pkg.sha256) throw new Error(`Invalid cached package: ${pkg.file}`);
    sums.push(`${pkg.sha256}  ${pkg.file}`);
  }
  if ((await readFile(path.join(folder, 'SHA256SUMS.txt'), 'utf8')).trim().replace(/\r\n/g, '\n') !== sums.join('\n')) throw new Error('Downloaded checksum list mismatch.');
  return manifest;
}
export async function fetchRelease({ root = repositoryRoot, version, base = `https://github.com/LING-0001/SnapSlot/releases/download/v${version}`, fetcher = fetch } = {}) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Invalid release version.');
  const downloads = path.join(root, 'apps/website/public/downloads'), destination = path.join(downloads, `v${version}`);
  try { await verifyDownloaded(destination, version); return destination; } catch {}
  await mkdir(downloads, { recursive: true });
  const stage = await mkdtemp(path.join(downloads, '.incoming-'));
  async function download(name) {
    const response = await fetcher(`${base}/${name}`);
    if (!response.ok) throw new Error(`Cannot download ${name}: HTTP ${response.status}. Publish this version before deploying the website.`);
    return Buffer.from(await response.arrayBuffer());
  }
  try {
    const raw = await download('manifest.json');
    const manifest = validateManifest(JSON.parse(raw), version);
    await writeFile(path.join(stage, 'manifest.json'), raw);
    await writeFile(path.join(stage, 'SHA256SUMS.txt'), await download('SHA256SUMS.txt'));
    for (const pkg of Object.values(manifest.packages)) await writeFile(path.join(stage, pkg.file), await download(pkg.file));
    await verifyDownloaded(stage, version);
    await rm(destination, { recursive: true, force: true });
    await rename(stage, destination);
    return destination;
  } finally { await rm(stage, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(`Website installers ready: ${await fetchRelease({ version: await verifySourceVersion() })}`);

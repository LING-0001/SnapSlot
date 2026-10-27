import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function verifySourceVersion(root = repositoryRoot) {
  const { version } = JSON.parse(await readFile(path.join(root, 'release.json'), 'utf8'));
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Invalid release version');
  const [mac, windows, website, lock] = await Promise.all([
    readFile(path.join(root, 'apps/macos/Info.plist'), 'utf8'),
    readFile(path.join(root, 'apps/windows/SnapSlot.Windows.csproj'), 'utf8'),
    readFile(path.join(root, 'apps/website/package.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'apps/website/package-lock.json'), 'utf8').then(JSON.parse),
  ]);
  if (!mac.includes(`<key>CFBundleShortVersionString</key><string>${version}</string>`) || !windows.includes(`<Version>${version}</Version>`)) throw new Error('Native source versions do not match release.json');
  if (website.version !== version || lock.version !== version || lock.packages[''].version !== version) throw new Error('Website versions do not match release.json');
  return version;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(`Source version v${await verifySourceVersion()} is consistent.`);

import release from "../package.json";

export const releaseVersion = process.env.NEXT_PUBLIC_SNAPSLOT_RELEASE_VERSION || release.version;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(releaseVersion)) throw new Error('Invalid website download version');
export const githubReleases = "https://github.com/LING-0001/SnapSlot/releases";
const base = `/downloads/v${releaseVersion}`;
const macFile = `SnapSlot-${releaseVersion}-macOS-universal.dmg`;
const windowsFile = `SnapSlot-${releaseVersion}-windows-x64-setup.exe`;
export const downloads = {
  mac: { href: `${base}/${macFile}`, filename: macFile, title: `v${releaseVersion} · macOS 13+ · Apple Silicon / Intel` },
  win: { href: `${base}/${windowsFile}`, filename: windowsFile, title: `v${releaseVersion} · Windows 10 1809+ / 11 · x64` },
};

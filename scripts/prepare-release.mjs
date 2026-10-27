#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Invalid release version");
if (process.platform !== "darwin") throw new Error("Prepare the Mac DMG + Windows installer on macOS.");
const args = process.argv.slice(2);
let suppliedStage, replace = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from" && args[i + 1]) suppliedStage = path.resolve(args[++i]);
  else if (args[i] === "--replace-unpublished") replace = true;
  else throw new Error("Usage: node scripts/prepare-release.mjs [--from STAGING_DIRECTORY] [--replace-unpublished]");
}
const downloads = path.join(root, "apps/website/public/downloads");
const destination = path.join(downloads, `v${version}`);
if (existsSync(destination) && !replace) throw new Error(`${destination} already exists. Use a new version after publication.`);
if (replace && spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/tags/v${version}`], { cwd: root }).status === 0) throw new Error("Cannot replace a tagged release. Use a new version.");
const temporary = await mkdtemp(path.join(tmpdir(), "snapslot-release-"));
const stage = suppliedStage || temporary;
function run(command, values, env = {}) {
  const result = spawnSync(command, values, { cwd: root, env: { ...process.env, ...env }, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`);
}
async function inventory(folder, prefix = "") {
  const files = [], directories = [];
  for (const entry of await readdir(path.join(folder, prefix), { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) { directories.push(name); const nested = await inventory(folder, name); files.push(...nested.files); directories.push(...nested.directories); }
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unexpected link in installer payload: ${name}`);
  }
  return { files: files.sort(), directories: directories.sort((a, b) => b.split("/").length - a.split("/").length) };
}
const nsisPath = value => value.replaceAll("$", () => "$$").replaceAll('"', '$\\"').replaceAll("/", "\\");
async function packagingTool(command, packageName, override) {
  if (override) return override;
  const located = spawnSync("which", [command], { encoding: "utf8" });
  if (located.status === 0) return located.stdout.trim();
  const directory = path.join(root, ".tools/installer-tools", packageName);
  const versions = await readdir(directory).catch(() => []);
  versions.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  const bundled = versions.map(v => path.join(directory, v, "bin", command)).find(existsSync);
  if (!bundled) throw new Error(`Install ${packageName} or set its executable override. See docs/releases/hosting.md.`);
  return bundled;
}
try {
  if (!suppliedStage) {
    if (!existsSync(path.join(root, "apps/website/node_modules"))) run("npm", ["ci", "--prefix", "apps/website"]);
    run("bash", ["scripts/build-macos.sh", "--universal"], { SNAPSLOT_MAC_OUTPUT: path.join(stage, "macos") });
    const native = path.join(stage, "NativeUI");
    run(process.execPath, ["apps/native-ui/build.mjs"], { SNAPSLOT_UI_OUTPUT: native });
    const bundled = path.join(root, ".tools/dotnet/dotnet");
    const dotnet = process.env.DOTNET_EXECUTABLE || (existsSync(bundled) ? bundled : "dotnet");
    run(dotnet, ["run", "--project", "apps/windows/Checks/SnapSlot.Windows.Checks.csproj"]);
    run(dotnet, ["publish", "apps/windows/SnapSlot.Windows.csproj", "-c", "Release", "-r", "win-x64", "--self-contained", "true", "-p:PublishSingleFile=false", `-p:Version=${version}`, `-p:NativeUiPath=${native}`, "-p:DebugType=None", "-p:DebugSymbols=false", "-o", path.join(stage, "windows")]);
  }
  const app = path.join(stage, "macos/SnapSlot.app"), windows = path.join(stage, "windows");
  run("codesign", ["--verify", "--deep", "--strict", app]);
  run("lipo", [path.join(app, "Contents/MacOS/SnapSlot"), "-verify_arch", "arm64", "x86_64"]);
  const stamp = spawnSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", path.join(app, "Contents/Info.plist")], { encoding: "utf8" });
  if (stamp.status !== 0 || stamp.stdout.trim() !== version) throw new Error("Mac version does not match release.json");
  if ((await readFile(path.join(windows, "SnapSlot.exe"))).toString("ascii", 0, 2) !== "MZ") throw new Error("Invalid Windows executable");
  const notices = path.join(windows, "ThirdPartyNotices");
  await mkdir(notices, { recursive: true });
  for (const name of ["microsoft.netcore.app.runtime.win-x64", "microsoft.windowsdesktop.app.runtime.win-x64", "microsoft.web.webview2"]) {
    if ((await readdir(notices)).some(file => file.toLowerCase().startsWith(`${name}-license`))) continue;
    const assets = JSON.parse(await readFile(path.join(root, "apps/windows/obj/project.assets.json"), "utf8"));
    const dependencies = JSON.parse(await readFile(path.join(windows, "SnapSlot.deps.json"), "utf8"));
    const dependency = Object.keys(dependencies.libraries).find(key => key.toLowerCase().replace(/^runtimepack\./, "").split("/")[0] === name);
    if (!dependency) throw new Error(`Missing bundled dependency: ${name}`);
    const source = Object.keys(assets.packageFolders).map(folder => path.join(folder, name, dependency.split("/")[1])).find(existsSync);
    if (!source) throw new Error(`Cannot locate license files for ${name}`);
    let copiedLicense = false;
    for (const file of await readdir(source)) {
      if (!/^(license(?:\.txt)?|notice\.txt|third-party-notices\.txt)$/i.test(file)) continue;
      await cp(path.join(source, file), path.join(notices, `${name}-${file}`));
      if (/^license/i.test(file)) copiedLicense = true;
    }
    if (!copiedLicense) throw new Error(`Missing license for ${name}`);
  }
  for (const file of ["index.html", "desktop.js", "desktop.css", "menus.json"]) {
    if (!(await readFile(path.join(app, "Contents/Resources/NativeUI", file))).equals(await readFile(path.join(windows, "NativeUI", file)))) throw new Error(`Desktop UI differs: ${file}`);
  }
  const legal = path.join(app, "Contents/Resources/Legal");
  await mkdir(legal, { recursive: true });
  for (const folder of [legal, windows]) {
    await cp(path.join(root, "LICENSE"), path.join(folder, "SNAPSLOT-LICENSE.txt"));
    await cp(path.join(root, "BRANDING.md"), path.join(folder, "BRANDING.md"));
  }
  await writeFile(path.join(legal, "Installation.txt"), `SnapSlot ${version}\n\n打开 DMG，将 SnapSlot 拖到“应用程序”，再从“应用程序”启动。\n选中文字功能需要辅助功能权限。此包使用 ad-hoc 签名，未经 Apple 公证，系统可能阻止首次启动。\n\nOpen the DMG, drag SnapSlot to Applications, then open it from Applications.\nSelected-text collection requires Accessibility permission. This package is ad-hoc signed and not notarized; macOS may block the first launch.\n`);
  await writeFile(path.join(windows, "README.txt"), `SnapSlot ${version}\n\n安装后可从桌面或开始菜单打开 SnapSlot。从 Windows 设置的“已安装的应用”中可卸载。\n缺少必要显示组件时，安装器会自动联网安装 Microsoft Edge WebView2 Runtime。已包含 .NET 运行时。\n\nOpen SnapSlot from your desktop or Start menu. Uninstall through Windows Settings > Installed apps.\nSetup installs Microsoft Edge WebView2 Runtime online if it is missing. The .NET runtime is included.\n`);
  run("codesign", ["--force", "--deep", "--sign", "-", app]);
  run("codesign", ["--verify", "--deep", "--strict", app]);
  const bundle = path.join(temporary, "ready"); await mkdir(bundle);
  const files = { macos: `SnapSlot-${version}-macOS-universal.dmg`, windows: `SnapSlot-${version}-windows-x64-setup.exe` };
  run(process.execPath, ["scripts/installers/build-macos-dmg.mjs", app, path.join(bundle, files.macos)]);

  const bootstrapperURL = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
  const bootstrapper = path.join(temporary, "MicrosoftEdgeWebview2Setup.exe");
  if (existsSync(path.join(stage, "MicrosoftEdgeWebview2Setup.exe"))) await cp(path.join(stage, "MicrosoftEdgeWebview2Setup.exe"), bootstrapper);
  else run("curl", ["--fail", "--location", "--proto", "=https", "--tlsv1.2", "--connect-timeout", "20", "--max-time", "180", bootstrapperURL, "--output", bootstrapper]);
  const bootstrapperData = await readFile(bootstrapper);
  if (bootstrapperData.toString("ascii", 0, 2) !== "MZ" || bootstrapperData.length < 100000) throw new Error("Invalid WebView2 bootstrapper download");
  const contents = await inventory(windows);
  const uninstallFiles = path.join(temporary, "uninstall-files.nsh");
  await writeFile(uninstallFiles, [...contents.files.map(file => `Delete "$INSTDIR\\${nsisPath(file)}"`), ...contents.directories.map(dir => `RMDir "$INSTDIR\\${nsisPath(dir)}"`)].join("\n") + "\n");
  let installedBytes = 0;
  for (const file of contents.files) installedBytes += (await stat(path.join(windows, file))).size;
  const makensis = await packagingTool("makensis", "makensis", process.env.MAKENSIS_EXECUTABLE);
  const resources = path.resolve(path.dirname(makensis), "../share/nsis");
  run(makensis, ["-V2", `-DVERSION=${version}`, `-DPAYLOAD_DIR=${windows}`, `-DOUTPUT_FILE=${path.join(bundle, files.windows)}`, `-DAPP_ICON=${path.join(root, "assets/brand/SnapSlot.ico")}`, `-DWEBVIEW_BOOTSTRAPPER=${bootstrapper}`, `-DUNINSTALL_FILES=${uninstallFiles}`, `-DINSTALLED_KB=${Math.ceil(installedBytes / 1024)}`, "scripts/installers/windows.nsi"], !process.env.NSISDIR && existsSync(resources) ? { NSISDIR: resources } : {});
  const sevenZip = await packagingTool("7zz", "sevenzip", process.env.SEVENZIP_EXECUTABLE);
  run(sevenZip, ["t", path.join(bundle, files.windows)]);
  const unpacked = path.join(temporary, "installer-check");
  run(sevenZip, ["x", "-y", "-bso0", `-o${unpacked}`, path.join(bundle, files.windows)]);
  for (const file of contents.files) {
    if (!(await readFile(path.join(windows, file))).equals(await readFile(path.join(unpacked, file)))) throw new Error(`Installer payload differs: ${file}`);
  }
  if (!(await readFile(path.join(unpacked, "$PLUGINSDIR/MicrosoftEdgeWebview2Setup.exe"))).equals(bootstrapperData)) throw new Error("Installer is missing its WebView2 bootstrapper");

  const manifest = { version, tag: `v${version}`, githubReleases: "https://github.com/LING-0001/SnapSlot/releases", dependencies: { webview2Bootstrapper: { source: bootstrapperURL, sha256: createHash("sha256").update(bootstrapperData).digest("hex"), size: bootstrapperData.length } }, packages: {} };
  const sums = [];
  for (const [platform, file] of Object.entries(files)) {
    const data = await readFile(path.join(bundle, file));
    if (data.length >= 2 * 1024 * 1024 * 1024) throw new Error(`${file} exceeds the 2 GiB release asset limit`);
    const sha256 = createHash("sha256").update(data).digest("hex");
    manifest.packages[platform] = { file, url: `/downloads/v${version}/${file}`, size: data.length, sha256, format: platform === "macos" ? "dmg" : "nsis", architecture: platform === "macos" ? "universal (arm64, x86_64)" : "x64", minimumOS: platform === "macos" ? "macOS 13" : "Windows 10", signing: platform === "macos" ? "ad-hoc app, DMG not notarized" : "unsigned" };
    sums.push(`${sha256}  ${file}`);
  }
  await writeFile(path.join(bundle, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(bundle, "SHA256SUMS.txt"), sums.join("\n") + "\n");
  await mkdir(downloads, { recursive: true });
  const incoming = path.join(downloads, `.incoming-${process.pid}`), backup = path.join(downloads, `.previous-${process.pid}`);
  try {
    await cp(bundle, incoming, { recursive: true });
    if (existsSync(destination)) await rename(destination, backup);
    try { await rename(incoming, destination); }
    catch (error) { if (existsSync(backup)) await rename(backup, destination); throw error; }
    await rm(backup, { recursive: true, force: true });
  } finally { await rm(incoming, { recursive: true, force: true }); }
  for (const entry of await readdir(downloads)) {
    if (entry !== `v${version}` && /^v\d+\.\d+\.\d+$/.test(entry) && existsSync(path.join(downloads, entry, "manifest.json"))) await rm(path.join(downloads, entry), { recursive: true });
  }
  console.log(`Prepared ${version}: ${destination}`);
  for (const pkg of Object.values(manifest.packages)) console.log(`${pkg.file}: ${(pkg.size / 1048576).toFixed(1)} MiB, SHA-256 ${pkg.sha256}`);
} finally { await rm(temporary, { recursive: true, force: true }); }

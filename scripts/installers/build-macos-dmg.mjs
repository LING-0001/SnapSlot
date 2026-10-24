import { mkdtemp, readFile, readlink, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [appArgument, outputArgument] = process.argv.slice(2);
if (!appArgument || !outputArgument) throw new Error("Usage: node scripts/installers/build-macos-dmg.mjs APP OUTPUT.dmg");
const app = path.resolve(appArgument), output = path.resolve(outputArgument);
const { version } = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
const scratch = await mkdtemp(path.join(tmpdir(), "snapslot-dmg-"));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`);
}
let mounted = false;
const mount = path.join(scratch, "mounted");
try {
  run("codesign", ["--verify", "--deep", "--strict", app]);
  const background = path.join(scratch, "background.png");
  run("swift", ["scripts/installers/dmg-background.swift", background]);
  const dmgbuild = process.env.DMGBUILD_EXECUTABLE || path.join(root, ".tools/dmgbuild/bin/dmgbuild");
  run(dmgbuild, ["-s", "scripts/installers/dmg-settings.py", "-D", `app=${app}`, "-D", `background=${background}`, `SnapSlot ${version}`, output]);
  run("hdiutil", ["verify", output]);
  run("hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mount, output]);
  mounted = true;
  run("codesign", ["--verify", "--deep", "--strict", path.join(mount, "SnapSlot.app")]);
  run("lipo", [path.join(mount, "SnapSlot.app/Contents/MacOS/SnapSlot"), "-verify_arch", "arm64", "x86_64"]);
  if (await readlink(path.join(mount, "Applications")) !== "/Applications") throw new Error("DMG is missing its Applications shortcut");
  console.log("DMG verified: mounted app retains a valid signature and both architectures; Applications shortcut is correct.");
} finally {
  if (mounted) run("hdiutil", ["detach", mount]);
  await rm(scratch, { recursive: true, force: true });
}

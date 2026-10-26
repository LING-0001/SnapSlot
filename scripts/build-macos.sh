#!/bin/bash
set -euo pipefail
snapslot_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$snapslot_root"
snapslot_archive=false
snapslot_universal=false
while [[ "$#" != 0 ]]; do
  case "$1" in
    --archive) snapslot_archive=true ;;
    --universal) snapslot_universal=true ;;
    *) printf 'Usage: %s [--archive] [--universal]\n' "$0" >&2; exit 2 ;;
  esac
  shift
done
snapslot_version="$(node -p "require('./release.json').version")"
snapslot_temporary="$(mktemp -d "${TMPDIR:-/tmp}/snapslot-build.XXXXXX")"
trap 'rm -rf "$snapslot_temporary"' EXIT
if [[ ! -d apps/website/node_modules ]]; then npm ci --prefix apps/website; fi
SNAPSLOT_UI_OUTPUT="$snapslot_temporary/NativeUI" node apps/native-ui/build.mjs
swift run --package-path apps/macos SnapSlotCoreChecks
bash scripts/check-macos-hotkeys.sh
if $snapslot_universal; then
  for snapslot_arch in arm64 x86_64; do
    swift build --package-path apps/macos -c release --product SnapSlot --triple "$snapslot_arch-apple-macosx13.0" --scratch-path "$snapslot_temporary/$snapslot_arch"
  done
else
  swift build --package-path apps/macos -c release --product SnapSlot
fi
snapslot_output="${SNAPSLOT_MAC_OUTPUT:-$snapslot_root/artifacts/macos}"
snapslot_app="$snapslot_temporary/SnapSlot.app"
mkdir -p "$snapslot_app/Contents/MacOS" "$snapslot_app/Contents/Resources" "$snapslot_output"
if $snapslot_universal; then
  snapslot_arm_bin="$(swift build --package-path apps/macos -c release --triple arm64-apple-macosx13.0 --scratch-path "$snapslot_temporary/arm64" --show-bin-path)"
  snapslot_intel_bin="$(swift build --package-path apps/macos -c release --triple x86_64-apple-macosx13.0 --scratch-path "$snapslot_temporary/x86_64" --show-bin-path)"
  lipo -create "$snapslot_arm_bin/SnapSlot" "$snapslot_intel_bin/SnapSlot" -output "$snapslot_app/Contents/MacOS/SnapSlot"
  lipo "$snapslot_app/Contents/MacOS/SnapSlot" -verify_arch arm64 x86_64
else
  cp apps/macos/.build/release/SnapSlot "$snapslot_app/Contents/MacOS/SnapSlot"
fi
cp apps/macos/Info.plist "$snapslot_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $snapslot_version" "$snapslot_app/Contents/Info.plist"
cp -R "$snapslot_temporary/NativeUI" "$snapslot_app/Contents/Resources/NativeUI"
cp assets/brand/snapslot-icon-1024.png "$snapslot_app/Contents/Resources/BrandIcon.png"
snapslot_icon_hash="$(shasum -a 256 assets/brand/snapslot-icon-1024.png | cut -c 1-12)"
snapslot_icon="AppIcon-$snapslot_icon_hash"
swift scripts/make-icon.swift "$snapslot_temporary/AppIcon.iconset" "$snapslot_root/assets/brand/snapslot-icon-1024.png"
iconutil -c icns "$snapslot_temporary/AppIcon.iconset" -o "$snapslot_app/Contents/Resources/$snapslot_icon.icns"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile $snapslot_icon" "$snapslot_app/Contents/Info.plist"
codesign --force --deep --sign - "$snapslot_app"
codesign --verify --deep --strict "$snapslot_app"
if $snapslot_archive; then
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent "$snapslot_app" "$snapslot_temporary/SnapSlot-macOS.zip"
fi
# Publish only after the replacement is built and verified. Formats are exclusive:
# local builds keep the app; CI builds keep the ZIP.
rm -rf "$snapslot_output/SnapSlot.app" "$snapslot_output/SnapSlot-macOS.zip" "$snapslot_output/AppIcon.iconset"
if $snapslot_archive; then
  mv "$snapslot_temporary/SnapSlot-macOS.zip" "$snapslot_output/SnapSlot-macOS.zip"
  printf '\nBuilt: %s\n' "$snapslot_output/SnapSlot-macOS.zip"
else
  mv "$snapslot_app" "$snapslot_output/SnapSlot.app"
  printf '\nBuilt: %s\nRun: open "%s"\n' "$snapslot_output/SnapSlot.app" "$snapslot_output/SnapSlot.app"
fi

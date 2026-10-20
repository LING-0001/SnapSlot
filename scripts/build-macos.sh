#!/bin/bash
set -euo pipefail
snapslot_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$snapslot_root"
if [[ ! -d apps/website/node_modules ]]; then npm ci --prefix apps/website; fi
npm run build:native --prefix apps/website
swift run --package-path apps/macos SnapSlotCoreChecks
swift build --package-path apps/macos -c release --product SnapSlot
snapslot_output="${SNAPSLOT_MAC_OUTPUT:-$snapslot_root/artifacts/macos}"
snapslot_app="$snapslot_output/SnapSlot.app"
mkdir -p "$snapslot_app/Contents/MacOS" "$snapslot_app/Contents/Resources"
cp apps/macos/.build/release/SnapSlot "$snapslot_app/Contents/MacOS/SnapSlot"
cp apps/macos/Info.plist "$snapslot_app/Contents/Info.plist"
rm -rf "$snapslot_app/Contents/Resources/NativeUI"
cp -R artifacts/native-ui "$snapslot_app/Contents/Resources/NativeUI"
swift scripts/make-icon.swift "$snapslot_root/artifacts/macos/AppIcon.iconset"
iconutil -c icns artifacts/macos/AppIcon.iconset -o "$snapslot_app/Contents/Resources/AppIcon.icns"
codesign --force --deep --sign - "$snapslot_app"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$snapslot_app" "$snapslot_output/SnapSlot-macOS.zip"
printf '\nBuilt: %s\nRun: open "%s"\n' "$snapslot_app" "$snapslot_app"

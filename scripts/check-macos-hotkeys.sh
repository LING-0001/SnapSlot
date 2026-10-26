#!/bin/bash
set -euo pipefail
snapslot_root="$(cd "$(dirname "$0")/.." && pwd)"
snapslot_check="$(mktemp -d "${TMPDIR:-/tmp}/snapslot-hotkeys.XXXXXX")"
trap 'rm -rf "$snapslot_check"' EXIT
# Compile the production registration code with a lightweight native test driver.
swiftc -emit-library -emit-module -module-name SnapSlotCore \
  "$snapslot_root/apps/macos/Sources/SnapSlotCore/AppPreferences.swift" \
  -emit-module-path "$snapslot_check/SnapSlotCore.swiftmodule" \
  -o "$snapslot_check/libSnapSlotCore.dylib"
swiftc -I "$snapslot_check" -L "$snapslot_check" -lSnapSlotCore \
  -Xlinker -rpath -Xlinker "$snapslot_check" \
  "$snapslot_root/apps/macos/Sources/SnapSlot/HotKeys.swift" \
  "$snapslot_root/apps/macos/Tests/HotKeyChecks/main.swift" \
  -o "$snapslot_check/HotKeyChecks"
"$snapslot_check/HotKeyChecks"

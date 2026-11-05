#!/bin/bash
set -euo pipefail
if [[ -z "${SNAPSLOT_MAC_KEYCHAIN_DIR:-}" ]]; then exit 0; fi
case "$SNAPSLOT_MAC_KEYCHAIN_DIR" in
  "$RUNNER_TEMP"/snapslot-signing.*)
    snapslot_restore_status=0
    if [[ -f "$SNAPSLOT_MAC_KEYCHAIN_DIR/original-keychains.txt" ]]; then
      node -e '
const fs=require("fs"),cp=require("child_process");
const original=[...fs.readFileSync(process.argv[1],"utf8").matchAll(/"([^"\n]+)"/g)].map(match=>match[1]);
cp.execFileSync("security",["list-keychains","-d","user","-s",...original]);
' "$SNAPSLOT_MAC_KEYCHAIN_DIR/original-keychains.txt" || snapslot_restore_status=$?
    fi
    if [[ -e "$SNAPSLOT_MAC_KEYCHAIN_DIR/distribution.keychain-db" ]]; then
      security delete-keychain "$SNAPSLOT_MAC_KEYCHAIN_DIR/distribution.keychain-db"
    fi
    rm -rf -- "$SNAPSLOT_MAC_KEYCHAIN_DIR"
    exit "$snapslot_restore_status"
    ;;
  *) printf 'Refusing to clean an unexpected signing directory\n' >&2; exit 1 ;;
esac

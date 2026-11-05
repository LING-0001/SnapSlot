#!/bin/bash
set -euo pipefail
if [[ -z "${SNAPSLOT_MAC_KEYCHAIN_DIR:-}" ]]; then exit 0; fi
case "$SNAPSLOT_MAC_KEYCHAIN_DIR" in
  "$RUNNER_TEMP"/snapslot-signing.*)
    if [[ -e "$SNAPSLOT_MAC_KEYCHAIN_DIR/distribution.keychain-db" ]]; then
      security delete-keychain "$SNAPSLOT_MAC_KEYCHAIN_DIR/distribution.keychain-db"
    fi
    rm -rf -- "$SNAPSLOT_MAC_KEYCHAIN_DIR"
    ;;
  *) printf 'Refusing to clean an unexpected signing directory\n' >&2; exit 1 ;;
esac

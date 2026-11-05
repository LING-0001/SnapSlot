#!/bin/bash
set -euo pipefail
# Dedicated ephemeral keychain; preserve the default and restore the search list.
for snapslot_name in RUNNER_TEMP GITHUB_ENV MACOS_CERTIFICATE_P12_BASE64 MACOS_CERTIFICATE_PASSWORD APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID; do
  if [[ -z "${!snapslot_name:-}" ]]; then printf 'Missing signing setting: %s\n' "$snapslot_name" >&2; exit 1; fi
done
if [[ ! "$APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then printf 'Invalid Apple team ID\n' >&2; exit 1; fi
snapslot_signing_dir="$(mktemp -d "$RUNNER_TEMP/snapslot-signing.XXXXXX")"
snapslot_keychain="$snapslot_signing_dir/distribution.keychain-db"
snapslot_keychain_password="$(openssl rand -hex 32)"
printf '::add-mask::%s\n' "$snapslot_keychain_password"
printf 'SNAPSLOT_MAC_KEYCHAIN_DIR=%s\nSNAPSLOT_MAC_KEYCHAIN=%s\n' "$snapslot_signing_dir" "$snapslot_keychain" >> "$GITHUB_ENV"
umask 077
security list-keychains -d user > "$snapslot_signing_dir/original-keychains.pending"
mv "$snapslot_signing_dir/original-keychains.pending" "$snapslot_signing_dir/original-keychains.txt"
node -e 'require("fs").writeFileSync(process.argv[1], Buffer.from(process.env.MACOS_CERTIFICATE_P12_BASE64, "base64"), {mode:0o600})' "$snapslot_signing_dir/certificate.p12"
security create-keychain -p "$snapslot_keychain_password" "$snapslot_keychain"
node -e '
const fs=require("fs"),cp=require("child_process");
const original=[...fs.readFileSync(process.argv[1],"utf8").matchAll(/"([^"\n]+)"/g)].map(match=>match[1]);
cp.execFileSync("security",["list-keychains","-d","user","-s",process.argv[2],...original]);
' "$snapslot_signing_dir/original-keychains.txt" "$snapslot_keychain"
security set-keychain-settings -lut 21600 "$snapslot_keychain"
security unlock-keychain -p "$snapslot_keychain_password" "$snapslot_keychain"
security import "$snapslot_signing_dir/certificate.p12" -k "$snapslot_keychain" -P "$MACOS_CERTIFICATE_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security > /dev/null
rm "$snapslot_signing_dir/certificate.p12"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$snapslot_keychain_password" "$snapslot_keychain" > /dev/null
security find-identity -v -p codesigning "$snapslot_keychain" > "$snapslot_signing_dir/identities.txt"
snapslot_identity="$(node -e '
const fs = require("fs");
const matches = [...fs.readFileSync(process.argv[1], "utf8").matchAll(/\b([A-F0-9]{40}) "Developer ID Application: [^"\n]+ \(([A-Z0-9]{10})\)"/g)]
  .filter(match => match[2] === process.env.APPLE_TEAM_ID);
if (matches.length !== 1) throw new Error("Import exactly one valid Developer ID Application identity for the configured Apple team.");
process.stdout.write(matches[0][1]);
' "$snapslot_signing_dir/identities.txt")"
xcrun notarytool store-credentials snapslot-release --keychain "$snapslot_keychain" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --validate > /dev/null
printf 'SNAPSLOT_MAC_SIGN_IDENTITY=%s\nSNAPSLOT_NOTARY_PROFILE=snapslot-release\n' "$snapslot_identity" >> "$GITHUB_ENV"
printf 'Developer ID identity and notarization credentials validated in the temporary keychain.\n'

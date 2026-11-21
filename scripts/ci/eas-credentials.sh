#!/usr/bin/env bash
# CI only: rebuild the gitignored credentials.json + upload keystore from the
# SEISHIN_UPLOAD_* secrets, for eas.json profiles with credentialsSource "local".
set -euo pipefail
: "${SEISHIN_UPLOAD_KEYSTORE_BASE64:?Add the SEISHIN_UPLOAD_KEYSTORE_BASE64 repo secret (base64 of the upload .jks)}"
: "${SEISHIN_UPLOAD_STORE_PASSWORD:?Add the SEISHIN_UPLOAD_STORE_PASSWORD repo secret}"
: "${SEISHIN_UPLOAD_KEY_ALIAS:?Add the SEISHIN_UPLOAD_KEY_ALIAS repo secret}"
: "${SEISHIN_UPLOAD_KEY_PASSWORD:?Add the SEISHIN_UPLOAD_KEY_PASSWORD repo secret}"
cd "$(dirname "$0")/../.."
echo "$SEISHIN_UPLOAD_KEYSTORE_BASE64" | base64 -d > seishin-upload.jks
node -e '
const e = process.env;
require("fs").writeFileSync("credentials.json", JSON.stringify({ android: { keystore: {
  keystorePath: "seishin-upload.jks",
  keystorePassword: e.SEISHIN_UPLOAD_STORE_PASSWORD,
  keyAlias: e.SEISHIN_UPLOAD_KEY_ALIAS,
  keyPassword: e.SEISHIN_UPLOAD_KEY_PASSWORD,
} } }));'
echo "credentials.json written"

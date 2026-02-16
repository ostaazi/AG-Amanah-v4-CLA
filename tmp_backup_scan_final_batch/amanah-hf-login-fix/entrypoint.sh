#!/bin/sh
set -eu

PORT="${PORT:-7860}"
DIST_DIR="/app/dist"
CONFIG_PATH="${DIST_DIR}/runtime-config.js"

# Create runtime-config.js from container environment variables.
# This allows Firebase config to be injected at runtime in Docker Spaces.
cat > "${CONFIG_PATH}" <<EOF
window.__ENV__ = {
  FIREBASE_API_KEY: "${FIREBASE_API_KEY:-}",
  FIREBASE_AUTH_DOMAIN: "${FIREBASE_AUTH_DOMAIN:-}",
  FIREBASE_PROJECT_ID: "${FIREBASE_PROJECT_ID:-}",
  FIREBASE_STORAGE_BUCKET: "${FIREBASE_STORAGE_BUCKET:-}",
  FIREBASE_MESSAGING_SENDER_ID: "${FIREBASE_MESSAGING_SENDER_ID:-}",
  FIREBASE_APP_ID: "${FIREBASE_APP_ID:-}"
};
EOF

exec serve -s "${DIST_DIR}" -l "${PORT}"

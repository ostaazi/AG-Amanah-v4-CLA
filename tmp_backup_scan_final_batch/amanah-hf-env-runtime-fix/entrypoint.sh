#!/bin/sh
set -e

# Hugging Face Spaces expects the app to listen on port 7860
PORT="${PORT:-7860}"

# Serve the built Vite app
# ---- Runtime env injection for static frontend ----
# Hugging Face "Secrets" are available as environment variables at CONTAINER runtime.
# The JS bundle is static, so we generate /env.js on startup.
cat > /app/dist/env.js <<'EOF'
window.__ENV = {
  API_KEY: "__API_KEY__",
  FIREBASE_API_KEY: "__FIREBASE_API_KEY__",
  FIREBASE_AUTH_DOMAIN: "__FIREBASE_AUTH_DOMAIN__",
  FIREBASE_PROJECT_ID: "__FIREBASE_PROJECT_ID__",
  FIREBASE_STORAGE_BUCKET: "__FIREBASE_STORAGE_BUCKET__",
  FIREBASE_MESSAGING_SENDER_ID: "__FIREBASE_MESSAGING_SENDER_ID__",
  FIREBASE_APP_ID: "__FIREBASE_APP_ID__"
};
EOF

# Replace placeholders safely (avoid sed delimiter issues)
node - <<'NODE'
const fs = require('fs');
const p = '/app/dist/env.js';
let s = fs.readFileSync(p,'utf8');
const repl = {
  '__API_KEY__': process.env.API_KEY || '',
  '__FIREBASE_API_KEY__': process.env.FIREBASE_API_KEY || '',
  '__FIREBASE_AUTH_DOMAIN__': process.env.FIREBASE_AUTH_DOMAIN || '',
  '__FIREBASE_PROJECT_ID__': process.env.FIREBASE_PROJECT_ID || '',
  '__FIREBASE_STORAGE_BUCKET__': process.env.FIREBASE_STORAGE_BUCKET || '',
  '__FIREBASE_MESSAGING_SENDER_ID__': process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  '__FIREBASE_APP_ID__': process.env.FIREBASE_APP_ID || ''
};
for (const [k,v] of Object.entries(repl)) {
  s = s.split(k).join(String(v).replace(/\\/g,'\\\\').replace(/\"/g,'\\\"'));
}
fs.writeFileSync(p,s);
NODE
# ---- End runtime env injection ----

exec serve -s dist -l "$PORT"
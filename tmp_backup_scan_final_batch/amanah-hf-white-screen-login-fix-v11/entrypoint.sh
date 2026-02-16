#!/usr/bin/env sh
set -eu

# Runtime env injection for a Vite static build running on Hugging Face Spaces.
# We generate a unique env file name each start to avoid aggressive browser caching.
TS="$(date +%s)"
ENV_FILE="env.${TS}.js"
DIST_DIR="/app/dist"

mkdir -p "$DIST_DIR"

cat > "$DIST_DIR/$ENV_FILE" <<'JS'
(function () {
  const pick = (k) => {
    try {
      const v = (typeof process !== 'undefined' && process.env && process.env[k]) || '';
      return (v === undefined || v === null) ? '' : String(v);
    } catch (_) {
      return '';
    }
  };

  // Exposed to the client (do NOT put server-only secrets here).
  const env = {
    API_KEY: pick('API_KEY') || pick('VITE_API_KEY'),

    FIREBASE_API_KEY: pick('FIREBASE_API_KEY') || pick('VITE_FIREBASE_API_KEY'),
    FIREBASE_AUTH_DOMAIN: pick('FIREBASE_AUTH_DOMAIN') || pick('VITE_FIREBASE_AUTH_DOMAIN'),
    FIREBASE_PROJECT_ID: pick('FIREBASE_PROJECT_ID') || pick('VITE_FIREBASE_PROJECT_ID'),
    FIREBASE_STORAGE_BUCKET: pick('FIREBASE_STORAGE_BUCKET') || pick('VITE_FIREBASE_STORAGE_BUCKET'),
    FIREBASE_MESSAGING_SENDER_ID: pick('FIREBASE_MESSAGING_SENDER_ID') || pick('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    FIREBASE_APP_ID: pick('FIREBASE_APP_ID') || pick('VITE_FIREBASE_APP_ID'),
    FIREBASE_MEASUREMENT_ID: pick('FIREBASE_MEASUREMENT_ID') || pick('VITE_FIREBASE_MEASUREMENT_ID'),
  };

  // Keep both styles available.
  window.__ENV = env;
  window.process = window.process || { env: {} };
  window.process.env = window.process.env || {};
  Object.assign(window.process.env, env);
})();
JS

# Keep a stable name too (useful for manual testing).
cp "$DIST_DIR/$ENV_FILE" "$DIST_DIR/env.js" 2>/dev/null || true

# Update dist/index.html to reference the unique env file to bust cache.
if [ -f "$DIST_DIR/index.html" ]; then
  # Replace only the first occurrence to avoid unintended changes.
  # Vite keeps the original "/env.js" reference in the built HTML.
  sed -i "0,/\\/env\\.js/s//\\/${ENV_FILE}/" "$DIST_DIR/index.html" || true
fi

# Start static server (SPA mode)
exec serve -s "$DIST_DIR" -l 7860

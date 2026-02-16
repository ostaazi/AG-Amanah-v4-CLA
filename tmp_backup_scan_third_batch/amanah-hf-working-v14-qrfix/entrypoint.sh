#!/bin/sh
set -eu

# Runtime env injection for a static Vite build on Hugging Face Spaces.
# HF "Variables" and "Secrets" are available to this container as environment variables.
# The browser cannot read process.env, so we generate /env.js (served from /app/dist) at startup.

DIST_DIR="/app/dist"

mkdir -p "$DIST_DIR"

node <<'NODE'
const fs = require('fs');

const pick = (k) => {
  const v = process.env[k];
  return v === undefined || v === null ? '' : String(v);
};

const firstNonEmpty = (...keys) => {
  for (const k of keys) {
    const v = pick(k).trim();
    if (v) return v;
  }
  return '';
};

// Build an env object that contains BOTH styles:
// - Vite style: VITE_*
// - App style:  FIREBASE_*, API_KEY
const env = {};

// Gemini / general API key
env.API_KEY = firstNonEmpty('API_KEY', 'VITE_API_KEY');
env.VITE_API_KEY = env.API_KEY;

// Firebase keys
const fb = {
  apiKey: firstNonEmpty('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY'),
  authDomain: firstNonEmpty('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'),
  projectId: firstNonEmpty('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'),
  storageBucket: firstNonEmpty('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: firstNonEmpty('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID'),
  appId: firstNonEmpty('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID'),
  measurementId: firstNonEmpty('VITE_FIREBASE_MEASUREMENT_ID', 'FIREBASE_MEASUREMENT_ID'),
};

env.VITE_FIREBASE_API_KEY = fb.apiKey;
env.FIREBASE_API_KEY = fb.apiKey;

env.VITE_FIREBASE_AUTH_DOMAIN = fb.authDomain;
env.FIREBASE_AUTH_DOMAIN = fb.authDomain;

env.VITE_FIREBASE_PROJECT_ID = fb.projectId;
env.FIREBASE_PROJECT_ID = fb.projectId;

env.VITE_FIREBASE_STORAGE_BUCKET = fb.storageBucket;
env.FIREBASE_STORAGE_BUCKET = fb.storageBucket;

env.VITE_FIREBASE_MESSAGING_SENDER_ID = fb.messagingSenderId;
env.FIREBASE_MESSAGING_SENDER_ID = fb.messagingSenderId;

env.VITE_FIREBASE_APP_ID = fb.appId;
env.FIREBASE_APP_ID = fb.appId;

env.VITE_FIREBASE_MEASUREMENT_ID = fb.measurementId;
env.FIREBASE_MEASUREMENT_ID = fb.measurementId;

const js = `(function () {
  const env = ${JSON.stringify(env)};
  window.__ENV = env;
  window.process = window.process || { env: {} };
  window.process.env = window.process.env || {};
  Object.assign(window.process.env, env);
})();\n`;

fs.writeFileSync('/app/dist/env.js', js);

const present = Object.keys(env).filter(k => env[k] && String(env[k]).trim() !== '').sort();
console.log('[entrypoint] wrote /app/dist/env.js; present keys:', present);
NODE

# Serve the built static app
exec npx serve -s dist -l 7860

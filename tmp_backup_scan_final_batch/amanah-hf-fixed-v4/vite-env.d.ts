/// <reference types="vite/client" />

// Ensure `process.env` exists in the browser build (injected by Vite define).
// We keep it permissive to avoid blocking builds when env keys vary by platform.
declare const process: {
  env: Record<string, string | undefined>;
};

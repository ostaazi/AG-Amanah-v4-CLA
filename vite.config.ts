import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_GEMINI_API_KEY',
  'VITE_APP_PEPPER',
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Validate required environment variables
  const missingVars = requiredEnvVars.filter((key) => !env[key]);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missingVars.join('\n')}\n\nPlease copy .env.example to .env and fill in your values.`
    );
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      assetsInlineLimit: 0, // Disable asset inlining
      cssCodeSplit: false, // Disable CSS code splitting
    },
  };
});

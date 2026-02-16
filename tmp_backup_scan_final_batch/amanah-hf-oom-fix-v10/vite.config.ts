import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env': env,
    },
    build: {
      outDir: 'dist',
      // HF Spaces builders are memory-constrained; Terser can trigger OOM (exit 137).
      // Use esbuild minifier (lighter) and disable CSS minification to reduce peak RAM.
      minify: 'esbuild',
      cssMinify: false,
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: 7860,
      host: '0.0.0.0',
    },
  };
});

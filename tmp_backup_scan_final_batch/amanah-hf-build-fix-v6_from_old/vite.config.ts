
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env': env
    },
    build: {
      outDir: 'dist',
      minify: 'terser',
    },
    server: {
      port: 7860,
      host: '0.0.0.0'
    }
  };
});

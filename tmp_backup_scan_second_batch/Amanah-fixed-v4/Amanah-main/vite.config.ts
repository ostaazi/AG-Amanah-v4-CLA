import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Import process explicitly to resolve type issues with process.cwd() in Vite configuration
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // تحميل متغيرات البيئة لتمكين استخدامها في التكوين
  // Fix: use process.cwd() from explicitly imported process to avoid TypeScript errors
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // هذا الجزء حيوي لتمكين كود الجافا سكريبت في المتصفح من الوصول لـ process.env
      'process.env': env
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
        },
      },
    },
    server: {
      port: 3000,
    }
  };
});

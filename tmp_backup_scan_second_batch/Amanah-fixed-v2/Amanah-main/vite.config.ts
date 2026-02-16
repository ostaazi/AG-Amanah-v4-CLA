import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Import process explicitly to resolve type issues with process.cwd() in Vite configuration
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // تحميل متغيرات البيئة من ملفات .env (إن وجدت) + دمجها مع متغيرات بيئة المنصة (مثل Vercel)
  // ملاحظة: هذا المشروع يستخدم process.env داخل كود المتصفح (Firebase/Gemini)، لذلك نقوم بحقن القيم أثناء البناء.
  // Fix: use process.cwd() from explicitly imported process to avoid TypeScript errors
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const mergedEnv = { ...process.env, ...fileEnv } as Record<string, string | undefined>;

  // لا تُصدِّر كل متغيرات البيئة للمتصفح. فقط المفاتيح المطلوبة للتشغيل.
  // تحذير: أي مفتاح يُحقن هنا سيصبح متاحًا في كود الواجهة الأمامية.
  const EXPOSED_KEYS = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'API_KEY',
  ] as const;

  const defineEnv: Record<string, string> = {};
  for (const key of EXPOSED_KEYS) {
    defineEnv[`process.env.${key}`] = JSON.stringify(mergedEnv[key] ?? '');
  }
  
  return {
    plugins: [react()],
    define: {
      // حقن مفاتيح محددة فقط من process.env أثناء البناء
      ...defineEnv
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

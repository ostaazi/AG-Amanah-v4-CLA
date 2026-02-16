import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Bootstrap safely to avoid a "white screen" if a module throws at import-time.
const mountEl = document.getElementById('root');

function renderFallback(title: string, details?: string) {
  if (!mountEl) return;
  mountEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#e5e7eb;padding:24px;">
      <div style="max-width:720px;width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:22px;">
        <div style="font-size:18px;font-weight:700;margin-bottom:10px;">${title}</div>
        <div style="font-size:14px;line-height:1.7;color:rgba(229,231,235,0.88);">
          <div style="margin-bottom:10px;">تعذر تحميل الواجهة بسبب خطأ JavaScript في المتصفح.</div>
          <div style="margin-bottom:10px;">أكثر الأسباب شيوعًا هنا: متغيرات البيئة غير مقروءة (env.js)، أو مفتاح API غير مضاف، أو خطأ في خدمة Gemini/Firebase أدى لتعطل التحميل.</div>
          ${details ? `<pre style="white-space:pre-wrap;background:rgba(0,0,0,0.35);padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);overflow:auto;">${details}</pre>` : ''}
          <div style="margin-top:12px;opacity:0.85;">جرّب تحديثًا قاسيًا (Hard Refresh)، ثم راجع إعدادات Secrets/Variables، أو افتح Console لقراءة الخطأ.</div>
        </div>
      </div>
    </div>
  `;
}

function renderLoading() {
  if (!mountEl) return;
  mountEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#e5e7eb;">
      <div style="font-size:14px;opacity:0.85;">Loading…</div>
    </div>
  `;
}

(async () => {
  try {
    renderLoading();

    // Dynamically import App so that any import-time error is catchable.
    const mod = await import('./App');
    const App = mod.default;

    if (!mountEl) return;
    ReactDOM.createRoot(mountEl).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Bootstrap error:', err);
    renderFallback('Amanah لم يبدأ بشكل صحيح', String(err?.stack || err?.message || err));
  }
})();

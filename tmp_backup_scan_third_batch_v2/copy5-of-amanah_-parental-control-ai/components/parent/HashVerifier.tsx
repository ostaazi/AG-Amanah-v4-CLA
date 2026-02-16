'use client';

import React, { useMemo, useState } from 'react';

async function sha256FileHex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function HashVerifier({
  expectedSha256,
}: {
  expectedSha256: string;
}) {
  const [picked, setPicked] = useState<File | null>(null);
  const [computed, setComputed] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'hashing' | 'match' | 'mismatch' | 'error'>('idle');
  const [err, setErr] = useState<string>('');

  const normalizedExpected = useMemo(() => (expectedSha256 || '').trim().toLowerCase(), [expectedSha256]);

  async function onPick(file: File | null) {
    setPicked(file);
    setComputed('');
    setErr('');
    setStatus('idle');

    if (!file) return;

    try {
      setStatus('hashing');
      const h = await sha256FileHex(file);
      setComputed(h);

      if (h === normalizedExpected) setStatus('match');
      else setStatus('mismatch');
    } catch (e: any) {
      setStatus('error');
      setErr(e?.message || 'Hashing failed');
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6 text-right" dir="rtl">
      <div className="text-sm font-black text-slate-900 mb-1">التحقق من سلامة الملف (SHA-256)</div>
      <p className="text-[10px] text-slate-500 font-bold mb-4">
        ارفع الملف الذي قمت بتحميله للتأكد من مطابقته للبصمة الجنائية المخزنة في النظام.
      </p>

      <div className="space-y-4">
        <input
          type="file"
          className="block w-full text-xs text-slate-600 file:ml-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-[10px] file:font-black file:text-white hover:file:bg-black cursor-pointer"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />

        <div className="grid grid-cols-1 gap-3">
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">البصمة المتوقعة</div>
            <div className="break-all rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-[9px] font-bold text-slate-400">
              {normalizedExpected}
            </div>
          </div>

          {computed && (
            <div className="animate-in slide-in-from-top-2">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">البصمة المحسوبة محلياً</div>
              <div className={`break-all rounded-xl border px-4 py-2 font-mono text-[9px] font-bold ${status === 'match' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {computed}
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-2xl border px-6 py-4 text-xs font-black flex items-center gap-3 ${
          status === 'idle' ? 'bg-white border-slate-200 text-slate-400' :
          status === 'hashing' ? 'bg-indigo-50 border-indigo-100 text-indigo-600 animate-pulse' :
          status === 'match' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-sm' :
          'bg-red-50 border-red-100 text-red-700 shadow-sm'
        }`}>
          <span className="text-xl">
            {status === 'idle' ? '📁' : status === 'hashing' ? '⚙️' : status === 'match' ? '✅' : '❌'}
          </span>
          <div>
            {status === 'idle' && 'بانتظار اختيار ملف...'}
            {status === 'hashing' && 'جاري معالجة الملف وحساب البصمة...'}
            {status === 'match' && 'تمت المطابقة بنجاح. الملف سليم تماماً.'}
            {status === 'mismatch' && 'تحذير: البصمة غير متطابقة! الملف قد يكون تعرض للتعديل.'}
            {status === 'error' && `خطأ: ${err}`}
          </div>
        </div>
      </div>
    </div>
  );
}

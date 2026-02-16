
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import HashVerifier from './HashVerifier';

type EvidenceRow = {
  evidence_id: string;
  incident_id: string | null;
  content_type: string;
  object_uri: string;
  mime_type: string;
  size_bytes?: number;
  sha256: string;
  created_at: string;
  download_url: string;
  download_exp: number;
  preview_url: string;
  preview_exp: number;
};

type ApiResp = {
  ok: boolean;
  items: EvidenceRow[];
  next_cursor: string | null;
};

type JobStatusResp = {
  ok: boolean;
  job: {
    id: string;
    name: string;
    state: string;
    progress: number;
    attemptsMade: number;
    failedReason: string | null;
  };
  result: null | {
    fileKey: string | null;
    filename: string | null;
    downloadUrl: string | null;
    manifestSignature: string | null;
  };
};

function shortId(id: string) {
  if (!id) return '';
  if (id.length <= 14) return id;
  return id.slice(0, 12) + '...';
}

function bytes(n?: number) {
  if (n === undefined || !Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let x = n;
  let u = 0;
  while (x >= 1024 && u < units.length - 1) {
    x /= 1024;
    u++;
  }
  return `${x.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

function buildUrl(base: string, params: Record<string, string | number | null | undefined>) {
  const u = new URL(base, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === '') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

function inlineKind(mime: string): 'image' | 'audio' | 'video' | 'unknown' {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  return 'unknown';
}

function toWatermarkPreviewUrl(preview_url: string) {
  if (!preview_url) return preview_url;
  return preview_url.replace('/api/storage/blob', '/api/storage/preview-image');
}

export default function EvidenceVaultTable({ familyId }: { familyId: string }) {
  const baseEndpoint = useMemo(() => {
    return `/api/families/${encodeURIComponent(familyId)}/evidence`;
  }, [familyId]);

  const jobEndpoint = useMemo(() => {
    return `/api/families/${encodeURIComponent(familyId)}/evidence-package-job`;
  }, [familyId]);

  const [items, setItems] = useState<EvidenceRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState('');

  const [type, setType] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  const [preview, setPreview] = useState<{ open: boolean; row: EvidenceRow | null }>({
    open: false,
    row: null,
  });

  /* Fix: Added missing openPreview helper function */
  const openPreview = (row: EvidenceRow) => {
    setPreview({ open: true, row });
  };

  const [pkg, setPkg] = useState<{
    open: boolean;
    jobId: string | null;
    state: string;
    progress: number;
    downloadUrl: string | null;
    filename: string | null;
    error: string | null;
  }>({
    open: false,
    jobId: null,
    state: 'idle',
    progress: 0,
    downloadUrl: null,
    filename: null,
    error: null,
  });

  async function loadFirstPage() {
    setLoading(true);
    setErr('');
    try {
      const url = buildUrl(baseEndpoint, {
        limit: 30,
        type: type || null,
        device_id: deviceId || null,
        incident_id: incidentId || null,
        from: from || null,
        to: to || null,
        q: q || null,
      });

      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      const json = (await res.json()) as ApiResp;

      if (!res.ok || !json.ok) {
        throw new Error((json as any)?.error?.message || 'فشل تحميل الأدلة');
      }

      setItems(json.items || []);
      setNextCursor(json.next_cursor ?? null);
    } catch (e: any) {
      setErr(e?.message || 'خطأ غير متوقع');
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setErr('');
    try {
      const url = buildUrl(baseEndpoint, {
        limit: 30,
        cursor: nextCursor,
        type: type || null,
        device_id: deviceId || null,
        incident_id: incidentId || null,
        from: from || null,
        to: to || null,
        q: q || null,
      });

      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      const json = (await res.json()) as ApiResp;

      if (!res.ok || !json.ok) {
        throw new Error((json as any)?.error?.message || 'فشل تحميل المزيد');
      }

      setItems((prev) => [...prev, ...(json.items || [])]);
      setNextCursor(json.next_cursor ?? null);
    } catch (e: any) {
      setErr(e?.message || 'خطأ غير متوقع');
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFirstPage();
  }, [baseEndpoint]);

  const pRow = preview.row;
  const kind = pRow ? inlineKind(pRow.mime_type) : 'unknown';
  const inlineUrl = pRow && kind === 'image' ? toWatermarkPreviewUrl(pRow.preview_url) : pRow?.preview_url || '';

  async function startPackageJob() {
    setPkg({
      open: true,
      jobId: null,
      state: 'starting',
      progress: 0,
      downloadUrl: null,
      filename: null,
      error: null,
    });

    try {
      const res = await fetch(jobEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          type: type || null,
          device_id: deviceId || null,
          incident_id: incidentId || null,
          from: from || null,
          to: to || null,
          q: q || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to start job');

      setPkg((p) => ({
        ...p,
        jobId: String(json.jobId),
        state: 'queued',
        progress: 1,
      }));
    } catch (e: any) {
      setPkg((p) => ({ ...p, state: 'failed', error: e?.message || 'Unexpected error' }));
    }
  }

  async function pollJob(jobId: string) {
    try {
      const res = await fetch(`/api/jobs/evidence-package/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const json = (await res.json()) as JobStatusResp;
      if (!res.ok || !json.ok) throw new Error((json as any)?.error?.message || 'Failed to load job');

      const state = json.job.state;
      const progress = Math.max(0, Math.min(100, Number(json.job.progress || 0)));

      if (state === 'completed' && json.result?.downloadUrl) {
        setPkg((p) => ({
          ...p,
          state,
          progress: 100,
          downloadUrl: json.result?.downloadUrl || null,
          filename: json.result?.filename || null,
        }));
        return;
      }

      if (state === 'failed') {
        setPkg((p) => ({
          ...p,
          state,
          progress,
          error: json.job.failedReason || 'Job failed',
        }));
        return;
      }

      setPkg((p) => ({
        ...p,
        state,
        progress: progress || p.progress,
      }));
    } catch (e: any) {
      setPkg((p) => ({ ...p, error: e?.message || 'Polling error' }));
    }
  }

  useEffect(() => {
    if (!pkg.open || !pkg.jobId) return;
    const id = pkg.jobId;
    const t = setInterval(() => pollJob(id), 1200);
    return () => clearInterval(t);
  }, [pkg.open, pkg.jobId]);

  return (
    <div className="p-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">خزنة الأدلة المؤسسية</h1>
          <p className="text-sm font-bold text-slate-500">
            المستودع المركزي لكافة الأدلة الرقمية. يدعم المعاينة الفورية والبث المباشر الموثق.
          </p>
        </div>
        <button 
          onClick={startPackageJob}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"
        >
          <span>📦</span>
          إنشاء حزمة بلاغ رسمي (Job)
        </button>
      </div>

      <div className="mt-6 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">مرشحات البحث المتقدم</div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase px-3">النوع</label>
            <select
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">الكل</option>
              <option value="IMAGE">IMAGE (صور)</option>
              <option value="AUDIO">AUDIO (صوت)</option>
              <option value="VIDEO">VIDEO (فيديو)</option>
              <option value="TEXT">TEXT (نصوص)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase px-3">معرف الجهاز</label>
            <input
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              placeholder="dev_..."
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase px-3">معرف الحادثة</label>
            <input
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              placeholder="inc_..."
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase px-3">من تاريخ</label>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase px-3">إلى تاريخ</label>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase px-3">بحث نصي</label>
            <input
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              placeholder="كلمة دلالية..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            className="rounded-2xl bg-slate-900 px-10 py-4 text-sm font-black text-white hover:bg-black disabled:opacity-60 transition-all active:scale-95 shadow-xl"
            onClick={loadFirstPage}
            disabled={loading}
          >
            {loading ? 'جاري البحث...' : 'تطبيق الفلترة السيادية'}
          </button>

          <button
            className="rounded-2xl border-2 border-slate-100 bg-white px-10 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
            onClick={() => {
              setType(''); setDeviceId(''); setIncidentId(''); setFrom(''); setTo(''); setQ('');
            }}
          >
            إعادة تعيين
          </button>
        </div>

        {err && (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700 font-bold animate-shake">
            ⚠️ {err}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="min-w-full border-separate border-spacing-0 text-right">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-slate-200 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">الدليل</th>
                <th className="border-b border-slate-200 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">النوع</th>
                <th className="border-b border-slate-200 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">تاريخ الرصد</th>
                <th className="border-b border-slate-200 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">الحجم</th>
                <th className="border-b border-slate-200 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">SHA-256</th>
                <th className="border-b border-slate-200 px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">الإجراءات</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center text-sm font-bold text-slate-300 animate-pulse">
                    جاري سحب الأرشيف الجنائي من السحابة...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center text-sm font-bold text-slate-200">
                    لا توجد أدلة مطابقة في الوقت الحالي.
                  </td>
                </tr>
              ) : (
                items.map((x) => (
                  <tr key={x.evidence_id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="border-b border-slate-100 px-8 py-5">
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{shortId(x.evidence_id)}</div>
                      <div className="mt-1 text-[9px] font-mono font-bold text-slate-400 truncate max-w-[150px]">{x.object_uri}</div>
                      <div className="mt-1 text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                        Incident: {x.incident_id ? shortId(x.incident_id) : 'N/A'}
                      </div>
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5 text-sm text-slate-700">
                      <div className="font-black text-xs">{x.content_type}</div>
                      <div className="mt-1 text-[10px] font-bold text-slate-400">{x.mime_type}</div>
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5 text-[11px] font-bold text-slate-600">
                      {new Date(x.created_at).toLocaleString('ar-EG')}
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5 text-[11px] font-bold text-slate-600">
                      {bytes(x.size_bytes)}
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5">
                      <div className="max-w-[120px] truncate rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 font-mono text-[9px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                        {x.sha256}
                      </div>
                    </td>

                    <td className="border-b border-slate-100 px-8 py-5">
                      <div className="flex flex-wrap gap-3 justify-end">
                        <button
                          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                          onClick={() => openPreview(x)}
                        >
                          👁️ معاينة فورية
                        </button>

                        <a
                          className="rounded-xl bg-slate-950 px-5 py-2.5 text-[10px] font-black text-white hover:bg-black transition-all active:scale-95 shadow-lg"
                          href={x.download_url}
                        >
                          📥 تحميل
                        </a>

                        <button
                          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                          onClick={() => navigator.clipboard.writeText(x.sha256)}
                        >
                          📋 بصمة
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-8 py-8 bg-slate-50/50">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">عدد السجلات: {items.length}</div>

            <button
              className="rounded-2xl bg-white border-2 border-slate-100 px-12 py-4 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95"
              onClick={loadMore}
              disabled={!nextCursor || loadingMore}
            >
              {loadingMore ? 'جاري سحب البيانات...' : nextCursor ? 'عرض المزيد من الأرشيف' : 'نهاية الأرشيف الجنائي'}
            </button>
          </div>
        </div>
      </div>

      {preview.open && pRow ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-5xl rounded-[4rem] border-4 border-white bg-white shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between gap-6 border-b border-slate-100 p-10 bg-slate-50/50">
              <div className="text-right">
                <div className="text-2xl font-black text-slate-900 tracking-tighter">معاينة الدليل الجنائي</div>
                <div className="mt-1 text-[10px] font-mono font-bold text-slate-400 truncate max-w-xl">
                  Evidence ID: {pRow.evidence_id}
                </div>
              </div>

              <button
                className="rounded-2xl border-2 border-slate-200 bg-white px-8 py-3 text-sm font-black text-slate-900 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                onClick={() => setPreview({ open: false, row: null })}
              >
                إغلاق النافذة
              </button>
            </div>

            <div className="p-10 space-y-10 overflow-y-auto max-h-[75vh] custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Signed Media Stream</h4>
                  </div>
                  
                  <div className="rounded-[3rem] overflow-hidden border-4 border-slate-50 shadow-2xl bg-slate-900 aspect-video flex items-center justify-center group relative">
                    {kind === 'image' ? (
                      <img src={inlineUrl} alt="Forensic Preview" className="w-full h-full object-contain bg-slate-900 transition-transform duration-1000 group-hover:scale-105" />
                    ) : kind === 'audio' ? (
                      <div className="w-full p-12 text-center space-y-8">
                         <div className="text-6xl animate-pulse">🎙️</div>
                         <audio controls className="w-full shadow-2xl" preload="metadata" src={inlineUrl} />
                      </div>
                    ) : kind === 'video' ? (
                      <video controls className="w-full h-full bg-black shadow-2xl" preload="metadata" src={inlineUrl} />
                    ) : (
                      <div className="text-center space-y-4 opacity-40 grayscale">
                        <div className="text-8xl">📄</div>
                        <p className="font-black text-white text-sm">هذا الملف غير مدعوم للمعاينة الفورية.</p>
                      </div>
                    )}
                    
                    <div className="absolute top-6 right-6 bg-slate-950/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                       <p className="text-[8px] font-mono font-bold text-white uppercase tracking-widest">Preview Mode: Active (Watermarked)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 space-y-10">
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-1 text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع المحتوى</p>
                          <p className="font-black text-slate-800 text-lg">{pRow.content_type}</p>
                       </div>
                       <div className="space-y-1 text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">صيغة الملف</p>
                          <p className="font-black text-slate-800 text-lg uppercase">{pRow.mime_type.split('/')[1]}</p>
                       </div>
                    </div>

                    <div className="space-y-3 text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">بصمة النزاهة الجنائية (SHA-256)</p>
                      <div className="break-all rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-5 font-mono text-[10px] font-black text-indigo-700 shadow-inner">
                        {pRow.sha256}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <a
                        className="flex-1 rounded-[1.5rem] bg-slate-900 py-5 text-center text-sm font-black text-white hover:bg-black shadow-xl transition-all active:scale-95 border-b-4 border-black"
                        href={pRow.download_url}
                      >
                        📥 تحميل كملف جنائي
                      </a>

                      <button
                        className="px-10 rounded-[1.5rem] border-2 border-slate-200 bg-white py-5 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        onClick={() => navigator.clipboard.writeText(pRow.sha256)}
                      >
                        📋 نسخ البصمة
                      </button>
                    </div>
                  </div>

                  <HashVerifier expectedSha256={pRow.sha256} />
                </div>
              </div>
              
              <div className="bg-emerald-50 border-2 border-dashed border-emerald-100 p-8 rounded-[3rem] flex items-center gap-8">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-sm border border-emerald-100">⚖️</div>
                 <div>
                    <h4 className="font-black text-emerald-900 mb-1">بيان النزاهة (Integrity Statement)</h4>
                    <p className="text-[11px] font-bold text-emerald-700 leading-relaxed">
                      يتم تخديم هذا الملف عبر قناة مشفرة وموقعة برمجياً. تم تسجيل عملية المعاينة هذه في سجل الحيازة الجنائية الدائم لضمان الامتثال لسياسات أمانة المؤسسية.
                    </p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pkg.open ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-[3.5rem] border-4 border-white bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-8 bg-slate-50/50">
              <div className="text-right">
                <div className="text-xl font-black text-slate-900">حزمة البلاغ الجنائي</div>
                <div className="mt-1 text-[10px] font-mono font-bold text-slate-400">
                  Job ID: <span className="text-indigo-600">{pkg.jobId || 'Starting...'}</span>
                </div>
              </div>

              <button
                className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-2 text-xs font-black text-slate-900 hover:bg-slate-50"
                onClick={() => setPkg((p) => ({ ...p, open: false }))}
              >
                إغلاق
              </button>
            </div>

            <div className="p-10 space-y-8 text-right">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-slate-950 text-white rounded-2xl flex items-center justify-center text-xl">
                   {pkg.state === 'completed' ? '✅' : pkg.state === 'failed' ? '❌' : '⚙️'}
                 </div>
                 <div className="flex-1">
                    <p className="text-sm font-black text-slate-800">الحالة: {pkg.state.toUpperCase()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sovereign Archive Generation</p>
                 </div>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-400">{pkg.progress}%</span>
                    <span className="text-[10px] font-black text-slate-400">جاري التجهيز...</span>
                 </div>
                 <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200 p-0.5 shadow-inner">
                   <div 
                     className="h-full bg-indigo-600 rounded-full transition-all duration-500 shadow-lg shadow-indigo-100" 
                     style={{ width: `${pkg.progress}%` }} 
                   />
                 </div>
              </div>

              {pkg.error ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700 font-black">
                  ⚠️ خطأ في المعالجة: {pkg.error}
                </div>
              ) : null}

              {pkg.downloadUrl ? (
                <div className="animate-in slide-in-from-bottom-2 space-y-6">
                  <div className="p-6 bg-emerald-50 border-2 border-dashed border-emerald-100 rounded-[2rem] text-right">
                     <p className="text-xs font-bold text-emerald-700 leading-relaxed">
                        تم تجميع كافة الأدلة وتوقيع الـ Manifest رقمياً. الحزمة جاهزة للتحميل كدليل جنائي رسمي.
                     </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <a
                      className="w-full py-6 bg-slate-950 text-white rounded-[2rem] text-center text-lg font-black shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-4 border-b-4 border-black"
                      href={pkg.downloadUrl}
                    >
                      <span>📥</span> تحميل ملف ZIP الموقع
                    </a>
                    <p className="text-[9px] font-mono text-center font-bold text-slate-400 uppercase tracking-widest">
                       Filename: {pkg.filename || 'bundle.zip'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-indigo-50/30 rounded-[2rem] border border-indigo-50 text-center space-y-4">
                   <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                      The kernel is processing your request. Do not close this tab.
                   </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

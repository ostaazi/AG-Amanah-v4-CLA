
'use client';

import React, { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { sha256HexBrowser } from '../../../lib/forensics/webHash';
import { verifyManifest } from '../../../lib/forensics/crypto';

type VerifyResult = {
  ok: boolean;
  signature_ok: boolean;
  manifest_ok: boolean;
  file_checks: {
    path: string;
    expected_sha256: string;
    actual_sha256: string;
    ok: boolean;
  }[];
  errors: string[];
};

function safeJsonParse(txt: string) {
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export default function VerifyEvidencePackagePage() {
  const [publicKeyB64, setPublicKeyB64] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [msg, setMsg] = useState('');

  const passCount = useMemo(() => result?.file_checks.filter((x) => x.ok).length ?? 0, [result]);
  const failCount = useMemo(() => result?.file_checks.filter((x) => !x.ok).length ?? 0, [result]);

  async function onPickZip(file: File) {
    setBusy(true);
    setMsg('');
    setResult(null);

    const errors: string[] = [];

    try {
      const zipBuf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuf);

      const manifestEntry = zip.file('manifest.json');
      const sigEntry = zip.file('manifest.sig');

      if (!manifestEntry) throw new Error('manifest.json not found in ZIP');
      if (!sigEntry) throw new Error('manifest.sig not found in ZIP');

      const manifestJson = await manifestEntry.async('string');
      const sigB64 = (await sigEntry.async('string')).trim();

      const manifestObj = safeJsonParse(manifestJson);
      if (!manifestObj) throw new Error('manifest.json is not valid JSON');

      if (!Array.isArray(manifestObj.files)) throw new Error('manifest.files must be an array');
      if (String(manifestObj.hash_algo || '').toUpperCase() !== 'SHA-256') {
        errors.push('manifest.hash_algo is not SHA-256');
      }
      if (String(manifestObj.signature_algo || '').toUpperCase() !== 'ED25519') {
        errors.push('manifest.signature_algo is not Ed25519');
      }

      if (!publicKeyB64.trim()) {
        throw new Error('Public key is required to verify Ed25519 signature');
      }

      // Signature verification
      let signature_ok = false;
      try {
        signature_ok = verifyManifest(manifestJson, sigB64, publicKeyB64.trim());
      } catch (e: any) {
        errors.push(`Signature verification error: ${e?.message || 'unknown'}`);
        signature_ok = false;
      }

      // Files verification
      const file_checks: VerifyResult['file_checks'] = [];

      for (const f of manifestObj.files) {
        const p = String(f?.path || '');
        const expected = String(f?.sha256_hex || '').toLowerCase();

        if (!p || !expected) {
          errors.push(`Invalid file entry in manifest: ${JSON.stringify(f)}`);
          continue;
        }

        const zf = zip.file(p);
        if (!zf) {
          file_checks.push({
            path: p,
            expected_sha256: expected,
            actual_sha256: '',
            ok: false,
          });
          continue;
        }

        const data = await zf.async('arraybuffer');
        const actual = (await sha256HexBrowser(data)).toLowerCase();

        file_checks.push({
          path: p,
          expected_sha256: expected,
          actual_sha256: actual,
          ok: actual === expected,
        });
      }

      const manifest_ok = file_checks.every((x) => x.ok);
      const ok = signature_ok && manifest_ok && errors.length === 0;

      setResult({
        ok,
        signature_ok,
        manifest_ok,
        file_checks,
        errors,
      });

      setMsg(ok ? 'تم التحقق بنجاح (PASS). الحزمة أصلية ولم تتعرض للتلاعب.' : 'فشل التحقق (FAIL). الحزمة غير موثوقة أو تعرضت للتعديل.');
    } catch (e: any) {
      setMsg(e?.message || 'Unexpected verify error');
      setResult({
        ok: false,
        signature_ok: false,
        manifest_ok: false,
        file_checks: [],
        errors: [e?.message || 'Unexpected verify error'],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-10 space-y-10 animate-in fade-in" dir="rtl">
      <div className="text-right">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">التحقق من حزم الأدلة (Forensic Verify)</h1>
        <p className="mt-2 text-sm font-bold text-slate-500">
          ارفع ملف ZIP الجنائي للتحقق من التوقيع الرقمي Ed25519 وبصمات SHA-256 للملفات.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
           <div className="rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-xl space-y-8">
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">المفتاح العام للتوقيع (Public Key - Base64)</label>
                 <textarea
                   value={publicKeyB64}
                   onChange={(e) => setPublicKeyB64(e.target.value)}
                   placeholder="الصق هنا مفتاح التحقق ED25519_PUBLIC_KEY..."
                   className="w-full h-32 rounded-[2rem] border-2 border-slate-100 bg-slate-50 p-6 text-xs font-mono font-bold text-indigo-700 outline-none focus:border-indigo-600 transition-all shadow-inner"
                 />
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">رفع حزمة ZIP للمراجعة</label>
                 <label className={`w-full h-40 rounded-[2.5rem] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer gap-4 ${busy ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/30 border-indigo-100 hover:border-indigo-400 hover:bg-white'}`}>
                    <input
                      type="file"
                      accept=".zip"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPickZip(f);
                      }}
                      className="hidden"
                    />
                    <div className="text-5xl">{busy ? '⚙️' : '📦'}</div>
                    <p className="font-black text-slate-600">{busy ? 'جاري الفحص الرقمي...' : 'اختر ملف الحزمة من جهازك'}</p>
                 </label>
              </div>

              {msg && (
                <div className={`p-8 rounded-[2rem] border-2 font-black text-sm flex items-center gap-6 ${result?.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700 animate-shake'}`}>
                   <span className="text-3xl">{result?.ok ? '✅' : '❌'}</span>
                   <p>{msg}</p>
                </div>
              )}
           </div>

           <div className="rounded-[3rem] border border-slate-100 bg-white shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h3 className="text-xl font-black text-slate-800">تقرير نزاهة الملفات (Integrity Report)</h3>
                 {result && (
                   <div className="flex gap-2">
                      <span className="bg-emerald-50 text-emerald-600 px-4 py-1 rounded-lg text-[10px] font-black">Passed: {passCount}</span>
                      <span className="bg-red-50 text-red-600 px-4 py-1 rounded-lg text-[10px] font-black">Failed: {failCount}</span>
                   </div>
                 )}
              </div>
              <div className="w-full overflow-x-auto">
                 <table className="min-w-full border-separate border-spacing-0 text-right">
                    <thead>
                       <tr className="bg-slate-50/50">
                          <th className="border-b border-slate-100 px-8 py-4 text-[10px] font-black uppercase text-slate-500">المسار</th>
                          <th className="border-b border-slate-100 px-8 py-4 text-[10px] font-black uppercase text-slate-500">البصمة المتوقعة</th>
                          <th className="border-b border-slate-100 px-8 py-4 text-[10px] font-black uppercase text-slate-500">الحالة</th>
                       </tr>
                    </thead>
                    <tbody>
                       {!result || result.file_checks.length === 0 ? (
                         <tr><td colSpan={3} className="px-8 py-16 text-center text-sm font-bold text-slate-300">لا توجد بيانات للفحص حالياً.</td></tr>
                       ) : (
                         result.file_checks.map((r) => (
                           <tr key={r.path} className="hover:bg-slate-50 transition-colors">
                              <td className="border-b border-slate-50 px-8 py-4 text-xs font-black text-slate-700">{r.path}</td>
                              <td className="border-b border-slate-50 px-8 py-4 font-mono text-[9px] text-slate-400 max-w-[200px] truncate">{r.expected_sha256}</td>
                              <td className="border-b border-slate-50 px-8 py-4">
                                 {r.ok ? (
                                   <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[9px] font-black">MATCH</span>
                                 ) : (
                                   <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-black">MISMATCH</span>
                                 )}
                              </td>
                           </tr>
                         ))
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
           <div className="rounded-[2.5rem] bg-slate-900 p-10 text-white shadow-2xl space-y-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
              <h3 className="text-2xl font-black relative z-10 border-b border-white/10 pb-6">ملخص التحقق السيادي</h3>
              
              {!result ? (
                <div className="py-10 text-center opacity-40 italic font-bold relative z-10">ارفع حزمة ZIP لبدء عملية التوثيق الجنائي.</div>
              ) : (
                <div className="space-y-10 relative z-10">
                   <SummaryRow label="توقيع Ed25519" ok={result.signature_ok} />
                   <SummaryRow label="مطابقة SHA-256" ok={result.manifest_ok} />
                   <SummaryRow label="هيكل الحزمة" ok={result.errors.length === 0} />
                   
                   {result.errors.length > 0 && (
                     <div className="p-6 bg-red-950/40 rounded-3xl border border-red-500/30">
                        <p className="text-[10px] font-black text-red-400 uppercase mb-3">تفاصيل الأخطاء:</p>
                        <ul className="space-y-2">
                           {result.errors.map((e, i) => <li key={i} className="text-[10px] font-bold text-red-200/80 leading-relaxed">• {e}</li>)}
                        </ul>
                     </div>
                   )}
                </div>
              )}
           </div>

           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-indigo-100">⚖️</div>
                 <h4 className="text-xl font-black text-slate-800">بيان النزاهة</h4>
              </div>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                هذه الصفحة تقوم بعملية "التحقق من العميل" (Client-side Verification). لا يتم إرسال بيانات الحزمة للخادم، مما يضمن خصوصية الأدلة وسرعة المعالجة. يتم استخدام خوارزميات التشفير المعيارية Ed25519 و SHA-256 لضمان استقلالية الدليل.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, ok }: { label: string, ok: boolean }) {
  return (
    <div className="flex justify-between items-center">
       <span className="text-sm font-bold text-slate-400">{label}</span>
       <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${ok ? 'text-emerald-400' : 'text-red-500'}`}>{ok ? 'Valid ✓' : 'Failed ✕'}</span>
          <div className={`w-3 h-3 rounded-full ${ok ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-600 animate-pulse'}`}></div>
       </div>
    </div>
  );
}

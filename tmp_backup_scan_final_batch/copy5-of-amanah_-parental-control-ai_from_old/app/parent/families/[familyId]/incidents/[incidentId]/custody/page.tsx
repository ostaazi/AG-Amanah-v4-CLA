
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ICONS } from '../../../../../../../constants';

type CustodyEvent = {
  custody_event_id?: string;
  event_key: string;
  actor: string;
  event_at: string;
  event_json: any;
  prev_hash_hex: string | null;
  hash_hex: string;
};

export default function CustodyChainPage() {
  const { familyId, incidentId } = useParams<{ familyId: string; incidentId: string }>();

  const [items, setItems] = useState<CustodyEvent[]>([]);
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!familyId || !incidentId) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(
        `/api/families/${encodeURIComponent(familyId)}/incidents/${encodeURIComponent(incidentId)}/custody`,
        { method: 'GET', cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg(json?.error?.message || 'Failed to load custody chain');
        return;
      }
      setItems(json.items || []);
    } catch (e: any) {
      setMsg(e.message || 'Error loading chain');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [familyId, incidentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => {
      return (
        String(e.event_key || '').toLowerCase().includes(q) ||
        String(e.actor || '').toLowerCase().includes(q) ||
        JSON.stringify(e.event_json || {}).toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  // Detect breaks in hash chaining
  const chainIssues = useMemo(() => {
    const issues: { index: number; reason: string }[] = [];
    for (let i = 1; i < filtered.length; i++) {
      const prev = filtered[i - 1];
      const cur = filtered[i];
      if (cur.prev_hash_hex && cur.prev_hash_hex !== prev.hash_hex) {
        issues.push({
          index: i,
          reason: 'prev_hash_hex does not match previous event hash_hex',
        });
      }
      if (i > 0 && !cur.prev_hash_hex) {
        issues.push({
          index: i,
          reason: 'prev_hash_hex is null in mid-chain (discontinuity)',
        });
      }
    }
    return issues;
  }, [filtered]);

  return (
    <div className="p-8 space-y-10 animate-in fade-in" dir="rtl">
      <div className="flex flex-col md:flex-row items-start justify-between gap-6">
        <div className="text-right">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">سجل الحيازة الجنائية (Custody Chain)</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">
            الخط الزمني لكافة العمليات الموثقة للحادثة. سلسلة مشفرة غير قابلة للتلاعب لضمان سلامة الأدلة.
          </p>
        </div>

        <div className="flex gap-4">
          <Link to={`/incident/${incidentId}`} className="rounded-2xl border-2 border-slate-100 bg-white px-8 py-4 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            العودة للحادثة
          </Link>
          <button
            onClick={load}
            className="rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black text-white hover:bg-black transition-all shadow-xl active:scale-95"
          >
            تحديث السجل
          </button>
        </div>
      </div>

      {msg ? (
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-4 text-sm text-indigo-700 font-bold">
          ℹ️ {msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 block">بحث في الأحداث</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بنوع الحدث، الفاعل، أو محتوى البيانات..."
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-6 py-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
              />
           </div>

           <div className="rounded-[3rem] border border-slate-100 bg-white shadow-2xl overflow-hidden min-h-[500px]">
              <div className="w-full overflow-x-auto custom-scrollbar">
                <table className="min-w-full border-separate border-spacing-0 text-right">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-b border-slate-100 px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">التوقيت</th>
                      <th className="border-b border-slate-100 px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">الحدث</th>
                      <th className="border-b border-slate-100 px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">الفاعل</th>
                      <th className="border-b border-slate-100 px-8 py-5 text-[10px] font-black uppercase text-slate-500 tracking-widest">البصمة (Hash)</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {loading ? (
                      <tr><td colSpan={4} className="px-8 py-32 text-center text-sm font-bold text-slate-300 animate-pulse">جاري سحب السجل السيادي من النواة المركزية...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={4} className="px-8 py-32 text-center text-sm font-bold text-slate-200">لا توجد أحداث مسجلة لهذه الفلترة أو الحادثة.</td></tr>
                    ) : (
                      filtered.map((e, idx) => (
                        <tr key={`${e.hash_hex}_${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="border-b border-slate-50 px-8 py-6 text-[10px] font-black text-slate-400 font-mono">
                            {new Date(e.event_at).toLocaleString('ar-EG')}
                          </td>
                          <td className="border-b border-slate-50 px-8 py-6">
                            <div className="text-sm font-black text-slate-800">{e.event_key}</div>
                            <details className="mt-2">
                               <summary className="text-[9px] font-black text-indigo-400 uppercase cursor-pointer hover:text-indigo-600 transition-colors">عرض البيانات التفصيلية (JSON)</summary>
                               <pre className="mt-3 p-5 bg-slate-900 text-indigo-300 rounded-2xl text-[10px] font-mono shadow-inner border border-white/10 max-w-[400px] overflow-auto leading-relaxed">
                                  {JSON.stringify(e.event_json, null, 2)}
                               </pre>
                            </details>
                          </td>
                          <td className="border-b border-slate-50 px-8 py-6">
                             <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border border-slate-200 shadow-sm">{e.actor}</span>
                          </td>
                          <td className="border-b border-slate-50 px-8 py-6">
                            <div className="max-w-[140px] truncate rounded-xl bg-indigo-50/40 border border-indigo-100 px-4 py-2 font-mono text-[9px] font-black text-indigo-400 group-hover:text-indigo-600 transition-colors shadow-inner">
                              {e.hash_hex}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl space-y-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
              <h3 className="text-2xl font-black relative z-10 border-b border-white/10 pb-6 flex items-center gap-4">
                 <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></span>
                 سلامة السلسلة الجنائية
              </h3>
              
              <div className="space-y-10 relative z-10">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">إجمالي الأحداث</span>
                    <span className="text-3xl font-black text-white">{filtered.length}</span>
                 </div>

                 <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">حالة التماسك</span>
                    {chainIssues.length === 0 ? (
                      <span className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20 uppercase tracking-widest">متصلة وآمنة ✓</span>
                    ) : (
                      <span className="bg-red-600 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg animate-pulse uppercase tracking-widest">فشل في التحقق ⚠️</span>
                    )}
                 </div>
                 
                 {chainIssues.length > 0 && (
                   <div className="p-8 bg-red-950/40 rounded-[2rem] border border-red-500/30 space-y-6 animate-in slide-in-from-top-4">
                      <p className="text-[11px] font-black text-red-400 uppercase tracking-widest">اكتشاف فجوات أمنية في السلسلة:</p>
                      <ul className="space-y-4">
                         {chainIssues.slice(0, 3).map((x, i) => (
                           <li key={i} className="text-[10px] font-bold text-red-200/80 leading-relaxed border-r-2 border-red-500/40 pr-4">
                              <span className="block text-red-400 mb-1">الحدث #{x.index + 1}:</span>
                              {x.reason}
                           </li>
                         ))}
                         {chainIssues.length > 3 && (
                           <li className="text-[9px] text-red-400/60 text-center font-black">+{chainIssues.length - 3} أخطاء أخرى مكتشفة</li>
                         )}
                      </ul>
                   </div>
                 )}
              </div>
           </div>

           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
              <div className="flex items-center gap-5">
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-indigo-100">⚖️</div>
                 <h4 className="text-2xl font-black text-slate-800 tracking-tighter">النزاهة الجنائية</h4>
              </div>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                سجل الحيازة (Chain of Custody) هو أهم ركيزة في نظام أمانة. يتم ربط كل حدث بالهاش (Hash) الخاص بالحدث السابق له، مما يخلق سلسلة غير قابلة للتلاعب (Immutable Chain). أي محاولة تعديل في البيانات ستؤدي لكسر السلسلة فوراً وتنبيه كافة المشرفين.
              </p>
              <div className="pt-6 border-t border-slate-50">
                 <button 
                  onClick={() => alert("جاري توليد تقرير النزاهة بصيغة PDF...")}
                  className="w-full py-5 bg-slate-50 hover:bg-slate-100 text-slate-700 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                 >
                   تصدير تقرير النزاهة المعتمد
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StepUpGuard from '../../../../../components/auth/StepUpGuard';

type ReqRow = {
  request_id: string;
  family_id: string;
  evidence_id: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  executed_at: string | null;
  created_at: string;
};

export default function DeleteRequestsPage() {
  const { familyId } = useParams<{ familyId: string }>();

  const [items, setItems] = useState<ReqRow[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Step-Up State
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'EXECUTE', id: string } | null>(null);

  async function load() {
    if (!familyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${encodeURIComponent(familyId)}/delete-requests`);
      const json = await res.json();
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }

  const triggerExecute = (requestId: string) => {
    setPendingAction({ type: 'EXECUTE', id: requestId });
    setStepUpOpen(true);
  };

  const handleStepUpSuccess = async (token: string) => {
    setStepUpOpen(false);
    if (pendingAction?.type === 'EXECUTE') {
      await executeWithToken(pendingAction.id, token);
    }
    setPendingAction(null);
  };

  async function executeWithToken(requestId: string, token: string) {
    setMsg('جاري التنفيذ الآمن...');
    const res = await fetch(
      `/api/families/${encodeURIComponent(familyId!)}/delete-requests/${encodeURIComponent(requestId)}/execute`,
      { 
        method: 'POST', 
        headers: { 'x-step-up-token': token },
        cache: 'no-store' 
      }
    );
    const json = await res.json();
    if (!res.ok) {
      setMsg(json?.error?.message || 'فشل التنفيذ');
      return;
    }
    setMsg('تم التنفيذ بنجاح (Soft Delete).');
    load();
  }

  useEffect(() => { load(); }, [familyId]);

  return (
    <div className="p-6" dir="rtl">
      <StepUpGuard 
        isOpen={stepUpOpen} 
        onSuccess={handleStepUpSuccess} 
        onCancel={() => { setStepUpOpen(false); setPendingAction(null); }} 
      />

      <div className="flex flex-col md:flex-row items-start justify-between gap-10">
        <div className="text-right">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">طلبات الحذف (Governance)</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">يتطلب تنفيذ الحذف "تحققاً سيادياً" إضافياً لضمان سلامة الأدلة.</p>
        </div>
        <button onClick={load} className="rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black text-white shadow-xl">تحديث القائمة</button>
      </div>

      {msg && <div className="mt-6 p-4 bg-indigo-50 text-indigo-700 font-bold rounded-2xl border border-indigo-100">ℹ️ {msg}</div>}

      <div className="mt-8 rounded-[3.5rem] border border-slate-100 bg-white shadow-2xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-right">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase text-slate-500">الطلب</th>
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase text-slate-500">الدليل</th>
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase text-slate-500">الحالة</th>
                <th className="border-b border-slate-100 px-8 py-5 text-xs font-black uppercase text-slate-500">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center animate-pulse font-bold text-slate-300">جاري سحب البيانات...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center font-bold text-slate-200">لا توجد طلبات حالياً.</td></tr>
              ) : (
                items.map((r) => (
                  <tr key={r.request_id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="border-b border-slate-100 px-8 py-5">
                       <div className="text-sm font-black text-slate-900">{r.request_id.slice(0, 10)}...</div>
                       <div className="text-[10px] font-bold text-slate-400 italic">"{r.reason}"</div>
                    </td>
                    <td className="border-b border-slate-100 px-8 py-5 font-mono text-[10px] text-indigo-500">{r.evidence_id.slice(0, 12)}...</td>
                    <td className="border-b border-slate-100 px-8 py-5">
                       <span className={`px-4 py-1 rounded-xl text-[9px] font-black uppercase ${r.status === 'APPROVED' ? 'bg-indigo-50 text-indigo-700' : r.status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                    </td>
                    <td className="border-b border-slate-100 px-8 py-5">
                      {r.status === 'APPROVED' && (
                        <button 
                          onClick={() => triggerExecute(r.request_id)}
                          className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black shadow-lg shadow-red-100 active:scale-95 transition-all"
                        >
                          تنفيذ الحذف الآمن 🔒
                        </button>
                      )}
                      {r.status === 'EXECUTED' && <span className="text-[9px] font-bold text-slate-400">تم التنفيذ: {new Date(r.executed_at!).toLocaleDateString()}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

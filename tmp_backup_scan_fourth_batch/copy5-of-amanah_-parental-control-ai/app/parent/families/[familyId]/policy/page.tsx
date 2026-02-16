
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Policy = {
  family_id: string;
  retention_days: number;
  legal_hold_enabled: boolean;
  auto_legal_hold_severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  delete_mode: 'DIRECT' | 'REQUEST_ONLY';
  require_2fa_for_delete: boolean;
};

export default function FamilyPolicyPage() {
  const { familyId } = useParams<{ familyId: string }>();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    if (!familyId) return;
    setMsg('');
    const res = await fetch(`/api/families/${encodeURIComponent(familyId)}/policy`, {
      method: 'GET',
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMsg(json?.error?.message || 'Failed to load policy');
      return;
    }
    setPolicy(json.policy);
  }

  useEffect(() => {
    load();
  }, [familyId]);

  async function save() {
    if (!policy || !familyId) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/families/${encodeURIComponent(familyId)}/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(policy),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save');
      setPolicy(json.policy);
      setMsg('Saved successfully.');
    } catch (e: any) {
      setMsg(e?.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  if (!policy) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Family Policy</h1>
        <div className="mt-3 text-sm text-gray-600">Loading...</div>
        {msg ? <div className="mt-3 text-sm text-red-700">{msg}</div> : null}
      </div>
    );
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">سياسة الأسرة (Family Policy)</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">
            حوكمة المؤسسة: فترات الاحتفاظ، أتمتة الحجز القانوني، وقواعد الحذف.
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-60 transition-all shadow-xl"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {msg ? (
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-3 text-sm text-indigo-700 font-bold">
          {msg}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
          <div className="text-lg font-black text-slate-900 mb-6">فترة الاحتفاظ (Retention)</div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">عدد أيام الاحتفاظ</label>
              <input
                type="number"
                min={1}
                max={3650}
                value={policy.retention_days}
                onChange={(e) => setPolicy({ ...policy, retention_days: Number(e.target.value) })}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-[10px] font-bold text-amber-700 leading-relaxed">
            ملاحظة: لا يمكن حذف الأدلة أو إتلافها نهائياً قبل مرور هذه المدة من تاريخ الالتقاط.
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
          <div className="text-lg font-black text-slate-900 mb-6">حوكمة الحذف (Deletion)</div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">نمط الحذف</label>
              <select
                value={policy.delete_mode}
                onChange={(e) => setPolicy({ ...policy, delete_mode: e.target.value as any })}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              >
                <option value="REQUEST_ONLY">طلب حذف (موصى به)</option>
                <option value="DIRECT">حذف مباشر</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">تطلب 2FA للحذف</label>
              <select
                value={policy.require_2fa_for_delete ? 'YES' : 'NO'}
                onChange={(e) => setPolicy({ ...policy, require_2fa_for_delete: e.target.value === 'YES' })}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              >
                <option value="YES">نعم (أمان عالي)</option>
                <option value="NO">لا</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm md:col-span-2">
          <div className="text-lg font-black text-slate-900 mb-6">الحجز القانوني (Legal Hold)</div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">تفعيل ميزة الحجز</label>
              <select
                value={policy.legal_hold_enabled ? 'YES' : 'NO'}
                onChange={(e) => setPolicy({ ...policy, legal_hold_enabled: e.target.value === 'YES' })}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              >
                <option value="YES">مفعل</option>
                <option value="NO">معطل</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">حساسية الحجز التلقائي</label>
              <select
                value={policy.auto_legal_hold_severity}
                onChange={(e) => setPolicy({ ...policy, auto_legal_hold_severity: e.target.value as any })}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="mt-8 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex items-center gap-6">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-indigo-100">⚖️</div>
             <p className="text-xs font-bold text-indigo-700 leading-relaxed">
               الحجز التلقائي يقوم بحماية الأدلة فور رصد حوادث ذات خطورة عالية، مما يمنع حذفها أو إتلافها نهائياً لضمان النزاهة أمام الجهات المختصة.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ICONS } from '../../../../constants';

export default function VerifyArtifactPage() {
  const { id: incidentId } = useParams();
  const [artifactId, setArtifactId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact_id: artifactId.trim() })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      alert("Verification service error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">التحقق من صحة الأدلة</h2>
        <Link to={`/incident/${incidentId}`} className="text-indigo-600 font-bold text-sm">العودة للحادثة</Link>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100 space-y-8">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Artifact ID (من التقرير أو ملف التصدير)</label>
          <div className="flex gap-4">
            <input 
              value={artifactId} 
              onChange={e => setArtifactId(e.target.value)}
              placeholder="أدخل معرف المستند هنا..."
              className="flex-1 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none font-bold text-lg focus:border-indigo-500"
            />
            <button 
              onClick={handleVerify}
              disabled={isLoading || !artifactId}
              className="px-10 bg-slate-900 text-white rounded-[2rem] font-black hover:bg-black transition-all disabled:opacity-50"
            >
              {isLoading ? 'جاري الفحص...' : 'تحقق الآن'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`p-10 rounded-[3rem] border-4 animate-in zoom-in duration-500 ${result.verified ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg ${result.verified ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {result.verified ? '✓' : '✕'}
              </div>
              <div>
                <h3 className={`text-2xl font-black ${result.verified ? 'text-emerald-900' : 'text-red-900'}`}>
                  {result.verified ? 'مستند أصلي ومعتمد' : 'فشل التحقق من النزاهة'}
                </h3>
                <p className={`font-bold ${result.verified ? 'text-emerald-700' : 'text-red-700'}`}>
                  {result.verified ? 'تمت مطابقة التوقيع الرقمي مع سجلات النواة المركزية.' : 'تحذير: هذا المستند قد تم التلاعب به أو لم يصدر من نظام أمانة.'}
                </p>
              </div>
            </div>
            
            {result.artifact && (
              <div className="mt-8 pt-8 border-t border-black/5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                <div><span className="font-black">نوع المستند:</span> {result.artifact.type}</div>
                <div><span className="font-black">تاريخ الإصدار:</span> {new Date(result.artifact.created_at).toLocaleString()}</div>
                <div className="md:col-span-2 break-all"><span className="font-black">بصمة النزاهة:</span> {result.artifact.sha256}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex items-center gap-6">
        <span className="text-3xl">⚖️</span>
        <p className="text-sm font-bold opacity-80 leading-relaxed">نظام النزاهة في "أمانة" يعتمد على معايير التحقيق الجنائي الرقمي (Digital Forensics). كل عملية تصدير تُسجل للأبد في سلسلة الحيازة لضمان استقلال الأدلة وسلامتها القانونية.</p>
      </div>
    </div>
  );
}
'use client';

import React, { useState } from 'react';
// Fix: Corrected react-router-dom imports to resolve undefined navigate and params
import { Link, useParams, useNavigate } from 'react-router-dom';
// Fix: Corrected path for constants to ensure ICONS is available
import { ICONS } from '../../../../constants';

const IncidentDetailPage: React.FC = () => {
  // Fix: Defined 'id' by destructuring useParams hook
  const { id } = useParams<{ id: string }>();
  // Fix: Defined 'navigate' using useNavigate hook
  const navigate = useNavigate();
  // Fix: Added state for PDF generation status
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fix: Implemented handleDownloadPdf function with appropriate error handling
  const handleDownloadPdf = async () => {
    if (!id) return;
    setIsGeneratingPdf(true);
    try {
      const res = await fetch(`/api/incidents/${id}/report/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident_report_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("فشل توليد التقرير الرسمي من الخادم.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-12" dir="rtl">
      <div className="text-right">
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">إدارة الحادثة الجنائية</h2>
        <p className="text-slate-500 font-bold mt-2 font-mono">INCIDENT_ID: {id}</p>
      </div>

      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100">
        <div className="flex flex-wrap gap-4 justify-center">
          {/* Fix: Button now uses handleDownloadPdf and isGeneratingPdf state */}
          <button 
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="bg-white text-slate-900 px-6 py-4 rounded-2xl font-black text-xs transition-all shadow-xl flex items-center gap-3 hover:bg-slate-100 disabled:opacity-50"
          >
            {isGeneratingPdf ? '⌛ جاري التوليد...' : '📄 تقرير PDF رسمي'}
          </button>
          {/* Fix: Link now uses dynamic id from params */}
          <Link 
            to={`/incident/${id}/verify`}
            className="bg-white text-indigo-600 px-6 py-4 rounded-2xl font-black text-xs transition-all shadow-xl flex items-center gap-3 hover:bg-indigo-50"
          >
            ⚖️ التحقق من تقرير
          </Link>
          {/* Fix: Button now uses navigate with dynamic id */}
          <button 
            onClick={() => navigate(`/incident/${id}/custody`)}
            className="bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-4 rounded-2xl font-black text-xs transition-all flex items-center gap-3"
          >
            📜 سجل الحيازة
          </button>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex items-center gap-6">
        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg"><ICONS.Shield className="w-8 h-8" /></div>
        <p className="text-sm font-bold opacity-80 leading-relaxed">
          يتم توقيع كافة التقارير رقمياً لضمان سلامتها أمام الجهات القانونية. أي تلاعب في محتوى التقرير سيؤدي لفشل التحقق في نظام النواة المركزية.
        </p>
      </div>
    </div>
  );
};

export default IncidentDetailPage;
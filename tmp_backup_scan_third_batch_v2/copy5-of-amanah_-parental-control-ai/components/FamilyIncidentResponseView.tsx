import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IncidentReport, IncidentTimelineItem, AlertSeverity, ParentAccount } from '../types';
import { ICONS, AmanahShield } from '../constants';
import { sovereignApi } from '../services/sovereignApiService';

const FamilyIncidentResponseView: React.FC<{ currentUser: ParentAccount }> = ({ currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<IncidentReport | null>(null);
  const [timeline, setTimeline] = useState<IncidentTimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    // محاكاة تحميل البيانات مع حقول إثبات التنفيذ الجديدة
    setTimeout(() => {
      setIncident({
        incident_id: id || '1',
        child_id: 'c1',
        childName: 'أحمد',
        device_id: 'dev-9923',
        incident_type: 'تواصل مشبوه' as any,
        severity: 'critical' as any,
        status: 'CONTAINED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        legal_hold: false
      });
      setTimeline([
        { t: new Date().toISOString(), kind: 'COMMAND', data: { type: "BLACKOUT_OVERLAY", status: "ACKED", signed_proof: true } },
        { t: new Date().toISOString(), kind: 'EVIDENCE', data: { summary: "رصد محاولة استدراج رقمي" } }
      ]);
      setIsLoading(false);
    }, 600);
  }, [id]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-40 animate-in fade-in" dir="rtl">
      <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-[12px] border-indigo-600">
         <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-8">
               <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-xl animate-pulse">🛡️</div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">غرفة العمليات الدفاعية</h2>
                  <p className="text-indigo-300 font-bold opacity-80 uppercase tracking-widest text-xs">Proof of Execution Enabled</p>
               </div>
            </div>
            <button 
              onClick={() => navigate(`/incident/${id}/custody`)}
              className="bg-white/10 hover:bg-white/20 px-8 py-4 rounded-2xl font-black text-xs transition-all border border-white/10"
            >
              📜 عرض سجل الحيازة الكامل
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-6">
           <h3 className="text-2xl font-black text-slate-800 px-4">الخط الزمني (Chain of Command)</h3>
           <div className="space-y-4">
              {timeline.map((item, idx) => (
                <div key={idx} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-start gap-6 hover:border-indigo-100 transition-all">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${item.kind === 'COMMAND' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                      {item.kind === 'COMMAND' ? '⚡' : '👁️'}
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.kind}</span>
                        {item.data.signed_proof && (
                           <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[8px] font-black border border-emerald-100 shadow-sm animate-in zoom-in">✓ SIGNED PROOF OF EXECUTION</span>
                        )}
                      </div>
                      <p className="font-black text-slate-800 text-lg">
                        {item.kind === 'COMMAND' ? `${item.data.type} [${item.data.status}]` : item.data.summary}
                      </p>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="lg:col-span-4">
           <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50 sticky top-32 text-center space-y-8">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner border border-emerald-100">⚖️</div>
              <div>
                <h3 className="text-2xl font-black text-slate-800">النزاهة الدفاعية</h3>
                <p className="text-sm font-bold text-slate-400 mt-2 leading-relaxed">كافة الإجراءات التقنية المتخذة موثقة بتوقيعات رقمية غير قابلة للنقض.</p>
              </div>
              <button onClick={() => navigate(`/incident/${id}/evidence`)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all">
                 فتح الخزنة الجنائية
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyIncidentResponseView;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { EvidenceCustody } from '../types';
import { ICONS } from '../constants';
import { sovereignApi } from '../services/sovereignApiService';

const ChainOfCustodyView: React.FC = () => {
  const { id: incidentId } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<EvidenceCustody[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        setIsLoading(true);
        try {
            const items = await sovereignApi.getIncidentCustody(incidentId || '');
            setLogs(items || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    load();
  }, [incidentId]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-40 animate-in fade-in" dir="rtl">
      <div className="flex items-center justify-between">
         <Link to={`/incident/${incidentId}`} className="flex items-center gap-3 text-indigo-600 font-black text-xs bg-indigo-50 px-6 py-3 rounded-xl shadow-sm hover:bg-indigo-100 transition-all">
            <ICONS.Close className="w-4 h-4" />
            العودة للحادثة
         </Link>
         <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Chain of Custody</h2>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
         <div className="bg-slate-950 p-10 text-white relative">
            <div className="relative z-10">
               <h3 className="text-2xl font-black mb-2">سجل حيازة الأدلة</h3>
               <p className="text-slate-400 font-bold text-xs uppercase tracking-widest font-mono">TAMPER_PROOF_LEDGER // INCIDENT: {incidentId?.slice(0, 12)}</p>
            </div>
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.1)_0%,transparent_60%)]"></div>
         </div>

         <div className="p-10 space-y-6">
            {isLoading ? (
               <div className="py-20 text-center animate-pulse text-indigo-600 font-black">جاري سحب السجل من الخادم الآمن...</div>
            ) : logs.length === 0 ? (
               <div className="py-20 text-center text-slate-300 space-y-4">
                  <div className="text-6xl">📜</div>
                  <p className="font-black text-xl">لا توجد سجلات حيازة متاحة لهذه الحادثة.</p>
               </div>
            ) : (
               <div className="space-y-4">
                  {logs.map((log, idx) => (
                     <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 group">
                        <div className="flex items-center gap-6 flex-1">
                           <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner text-xl">
                              {log.event_key?.includes('CREATE') ? '🆕' : log.event_key?.includes('REDACT') ? '👁️‍🗨️' : '📝'}
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{log.event_key}</p>
                              <h4 className="font-black text-slate-800">{log.action || 'Unknown Action'}</h4>
                              <p className="text-[10px] font-bold text-slate-400 mt-1">الفاعل: {log.actor_user_id || 'System'}</p>
                           </div>
                        </div>
                        <div className="text-left font-mono text-[10px] text-slate-300">
                           {new Date(log.created_at).toLocaleString()}
                        </div>
                        <details className="w-full md:w-auto">
                           <summary className="cursor-pointer text-[9px] font-black text-indigo-400 uppercase tracking-tighter hover:text-indigo-600">Raw JSON</summary>
                           <pre className="mt-4 p-4 bg-slate-900 text-indigo-300 rounded-xl text-[9px] overflow-x-auto border border-white/10">
                              {JSON.stringify(log.event_json || log, null, 2)}
                           </pre>
                        </details>
                     </div>
                  ))}
               </div>
            )}
         </div>
      </div>

      <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-8 rounded-[2.5rem] flex items-center gap-6">
         <span className="text-4xl">🔬</span>
         <div>
            <h4 className="font-black text-amber-900">ملاحظة التدقيق</h4>
            <p className="text-xs font-bold text-amber-700 leading-relaxed">كافة العمليات في هذا السجل يتم توقيعها رقمياً في النواة السحابية. أي محاولة تعديل في قاعدة البيانات ستفشل التحقق من النزاهة (Integrity Check) فوراً.</p>
         </div>
      </div>
    </div>
  );
};

export default ChainOfCustodyView;

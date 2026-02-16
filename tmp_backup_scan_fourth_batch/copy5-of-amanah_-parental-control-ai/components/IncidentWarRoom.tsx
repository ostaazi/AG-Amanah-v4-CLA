
import React, { useState, useEffect } from 'react';
import { IncidentReport, EvidenceCustody, Category, AlertSeverity } from '../types';
import { ICONS, AmanahShield } from '../constants';
import { verifyChainIntegrity } from '../services/forensicsService';
import ExportBundleModal from './ExportBundleModal';

const IncidentWarRoom: React.FC<{ incidentId: string }> = ({ incidentId }) => {
  const [incident, setIncident] = useState<IncidentReport | null>(null);
  const [custodyChain, setCustodyChain] = useState<EvidenceCustody[]>([]);
  const [integrityStatus, setIntegrityStatus] = useState<'PENDING' | 'VERIFIED' | 'FAILED'>('PENDING');
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    // محاكاة جلب بيانات الحادثة
    setTimeout(async () => {
      const mockIncident: IncidentReport = {
        incident_id: incidentId,
        child_id: 'c1',
        childName: 'أحمد',
        device_id: 'DEV-99',
        incident_type: Category.PREDATOR,
        severity: AlertSeverity.CRITICAL,
        status: 'CONTAINED',
        summary: 'رصد محاولة استدراج صريحة عبر Instagram تتضمن طلب صور خاصة.',
        risk_level: 'critical',
        detected_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        legal_hold: true
      };
      
      const mockChain: EvidenceCustody[] = [
        { custody_id: 'c1', evidence_id: 'e1', actor: 'SYSTEM:ASE', action: 'CREATE', event_key: 'EVIDENCE_CAPTURED', created_at: new Date().toISOString(), hash_hex: 'h1', prev_hash_hex: '0' },
        { custody_id: 'c2', evidence_id: 'e1', actor: 'PARENT:FATHER', action: 'VIEW', event_key: 'EVIDENCE_REVIEWED', created_at: new Date().toISOString(), hash_hex: 'h2', prev_hash_hex: 'h1' }
      ];

      setIncident(mockIncident);
      setCustodyChain(mockChain);
      setIntegrityStatus('VERIFIED');
    }, 1000);
  }, [incidentId]);

  if (!incident) return <div className="p-20 text-center animate-pulse text-indigo-600 font-black">جاري تهيئة قمرة القيادة السيادية...</div>;

  return (
    <div className="space-y-8 animate-in fade-in pb-40" dir="rtl">
      {showExport && <ExportBundleModal incidentId={incidentId} onClose={() => setShowExport(false)} />}
      
      {/* Risk Header */}
      <div className={`p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border-b-8 ${incident.risk_level === 'critical' ? 'bg-[#8A1538] border-[#3A0715]' : 'bg-slate-900 border-indigo-600'}`}>
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-xl ring-4 ring-white/10 animate-pulse">🚨</div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter leading-none mb-2">غرفة إدارة الحوادث السيادية</h2>
                  <p className="text-white/60 font-bold text-sm uppercase tracking-[0.3em] font-mono">INCIDENT_ID: {incident.incident_id.slice(0, 16)}</p>
               </div>
            </div>
            <div className="flex gap-4">
               <div className={`px-8 py-4 rounded-2xl font-black text-xs flex items-center gap-4 shadow-xl ${integrityStatus === 'VERIFIED' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500 text-black'}`}>
                  <span className="text-xl">🛡️</span>
                  <span>{integrityStatus === 'VERIFIED' ? 'تم تأكيد سلامة سلسلة الحيازة' : 'جاري تدقيق النزاهة...'}</span>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
         <div className="xl:col-span-8 space-y-10">
            {/* Chain of Custody Timeline */}
            <div className="bg-white rounded-[4rem] p-12 shadow-xl border border-slate-100">
               <div className="flex justify-between items-center mb-12 px-2">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center gap-5">
                    <span className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-inner">📜</span>
                    سجل العمليات (Chain of Custody)
                  </h3>
                  <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-xl">مزامنة حية</span>
               </div>
               
               <div className="space-y-12 relative">
                  <div className="absolute top-0 bottom-0 right-9 w-1.5 bg-slate-50 rounded-full"></div>
                  {custodyChain.map((event, idx) => (
                    <div key={idx} className="relative pr-24 group">
                       <div className={`absolute top-1 right-6 w-8 h-8 rounded-full border-4 border-white shadow-xl z-10 transition-transform group-hover:scale-125 ${event.action === 'CREATE' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                       <div className="bg-slate-50/50 group-hover:bg-white group-hover:shadow-2xl p-8 rounded-[3rem] border-2 border-transparent group-hover:border-indigo-100 transition-all">
                          <div className="flex justify-between items-center mb-4">
                             <span className="text-[11px] font-black text-slate-400 font-mono tracking-widest">{new Date(event.created_at).toLocaleString()}</span>
                             <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black shadow-lg">{event.event_key}</span>
                          </div>
                          <p className="font-black text-slate-700 text-lg leading-relaxed">
                            {event.action === 'CREATE' ? 'تم التقاط الدليل وتشفيره بنجاح.' : `تمت مراجعة الدليل من قبل ${event.actor}.`}
                          </p>
                          <div className="mt-6 flex items-center gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                             <span className="text-[9px] font-mono font-bold text-slate-400 truncate tracking-tighter">FINGERPRINT: {event.hash_hex}</span>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="xl:col-span-4 space-y-10">
            {/* Intelligence Card */}
            <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl border-b-8 border-indigo-600 relative overflow-hidden group">
               <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
               <h3 className="text-xl font-black mb-10 border-b border-white/10 pb-6 flex items-center gap-4 relative z-10">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                  تحليل القرار (AI Intel)
               </h3>
               <div className="space-y-8 relative z-10">
                  <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400">نوع التهديد</span>
                     <span className="text-xs font-black text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-lg uppercase tracking-widest">{incident.incident_type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-400">الحالة الأمنية</span>
                     <span className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black shadow-lg">{incident.status}</span>
                  </div>
                  <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 italic text-sm font-bold leading-relaxed text-indigo-100 shadow-inner">
                     "{incident.summary}"
                  </div>
               </div>
            </div>

            <button 
              onClick={() => setShowExport(true)}
              className="w-full py-8 bg-gradient-to-br from-[#8A1538] to-[#3A0715] text-white rounded-[3rem] font-black text-2xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-6 border-b-[8px] border-black/40 group"
            >
               <span className="bg-white/20 p-3 rounded-2xl group-hover:rotate-12 transition-transform">🏛️</span>
               إنشاء رزمة بلاغ جنائي
            </button>
         </div>
      </div>
    </div>
  );
};

export default IncidentWarRoom;

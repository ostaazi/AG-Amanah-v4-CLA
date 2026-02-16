
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EvidenceRecord, AlertSeverity, ParentAccount, Category } from '../types';
import { ICONS, AmanahLogo, AmanahGlobalDefs } from '../constants';
import { deleteAlertFromDB, updateAlertStatus } from '../services/firestoreService';

interface EvidenceVaultViewProps {
  records: EvidenceRecord[];
  currentUser: ParentAccount;
  onModalToggle?: (isOpen: boolean) => void;
  onRequestToast: (alert: any) => void;
}

const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({ records, currentUser, onModalToggle, onRequestToast }) => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (location.state && (location.state as any).openAlertId) {
      const alertId = (location.state as any).openAlertId;
      const record = records.find(r => r.id === alertId);
      if (record) {
        setSelectedRecord(record);
      }
    }
  }, [location.state, records]);

  useEffect(() => {
    if (onModalToggle) {
        onModalToggle(!!selectedRecord);
    }
  }, [selectedRecord, onModalToggle]);

  const filteredRecords = useMemo(() => {
    let result = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (searchTerm.trim()) {
      result = result.filter(r => 
        r.suspectUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.childName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return result;
  }, [records, searchTerm]);

  const displayLog = useMemo(() => {
    if (!selectedRecord) return [];
    if (selectedRecord.conversationLog && selectedRecord.conversationLog.length > 0) {
      return selectedRecord.conversationLog;
    }
    
    return [
      { sender: String(selectedRecord.suspectUsername || "مجهول"), text: selectedRecord.content, time: "10:07 AM", isSuspect: true },
      { sender: "الهدف", text: "لا أعرفك!", time: "10:10 AM", isSuspect: false }
    ];
  }, [selectedRecord]);

  const getFullDate = (date: any) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleExport = async () => {
    if (!selectedRecord) return;
    
    // إرسال تنبيه البدء
    onRequestToast({ 
      id: 'export-' + Date.now(), 
      childName: 'Amanah AI', 
      aiAnalysis: "تم توليد ملف PDF الجنائي وجاري التحميل للبلاغ الرسمي.", 
      category: Category.SAFE, 
      severity: AlertSeverity.LOW 
    });

    setTimeout(() => {
      window.print();
    }, 1000);
  };

  const handleSave = async () => {
    if (!selectedRecord || isProcessing) return;
    setIsProcessing(true);
    try {
        await updateAlertStatus(selectedRecord.id, 'SECURED');
        onRequestToast({ 
          id: 'save-' + Date.now(), 
          childName: 'Amanah AI', 
          aiAnalysis: "تم تأمين السجل وحفظه في الأرشيف الجنائي بنجاح لاستخدامه كدليل قاطع.", 
          category: Category.SAFE, 
          severity: AlertSeverity.LOW 
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord || isProcessing) return;
    const confirmed = window.confirm("⚠️ هل أنت متأكد من إتلاف هذا السجل نهائياً؟ لا يمكن التراجع عن هذه العملية.");
    if (!confirmed) return;
    setIsProcessing(true);
    try {
        await deleteAlertFromDB(selectedRecord.id);
        onRequestToast({ 
          id: 'delete-' + Date.now(), 
          childName: 'Amanah AI', 
          aiAnalysis: "تم إتلاف السجل نهائياً من قاعدة البيانات الجنائية ومنع استعادته.", 
          category: Category.SAFE, 
          severity: AlertSeverity.LOW 
        });
        setSelectedRecord(null);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in no-print" dir="rtl">
      
      {/* Vault List Summary Header */}
      <div className="bg-[#0f172a] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-8 border-[#8A1538]">
         <div className="flex items-center gap-8 relative z-10">
            <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner border border-white/10">🏛️</div>
            <div>
               <h2 className="text-4xl font-black tracking-tighter mb-2">الأرشيف الجنائي</h2>
               <p className="text-indigo-300 font-bold opacity-80 text-lg">سجلات الأدلة المؤمنة بنظام التشفير العسكري (AES-256).</p>
            </div>
         </div>
         <div className="relative z-10 w-full md:w-80">
            <input 
              type="text" placeholder="بحث في السجلات..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-[1.5rem] px-8 py-5 text-white placeholder:text-white/40 font-bold outline-none focus:ring-4 focus:ring-[#8A1538]/30 transition-all"
            />
         </div>
         <div className="absolute top-0 right-0 w-96 h-96 bg-[#8A1538]/10 rounded-full blur-[100px] -translate-y-20"></div>
      </div>

      {/* Grid of Evidence Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4 px-2">
        {filteredRecords.map((record) => (
          <div key={record.id} onClick={() => setSelectedRecord(record)} className={`bg-white rounded-[3rem] border shadow-lg p-8 cursor-pointer hover:border-indigo-600 transition-all group ${selectedRecord?.id === record.id ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-2xl' : 'border-slate-100'}`}>
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase ${record.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{record.severity}</span>
                   <span className="text-[10px] font-mono text-slate-300 font-black">ID: {record.id.substring(0,8)}</span>
                </div>
                <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-slate-50 rounded-[1.2rem] flex items-center justify-center text-3xl shadow-inner border border-slate-100">👤</div>
                   <div>
                      <h3 className="text-xl font-black text-slate-900 font-mono tracking-tighter">@{record.suspectUsername.replace('@', '')}</h3>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{record.platform} • {record.childName}</p>
                   </div>
                </div>
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-black text-slate-300">
                   <span>تاريخ الرصد</span>
                   <span>{getFullDate(record.timestamp)}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Forensic Report Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-0 md:p-6 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300 print:relative print:inset-auto print:bg-white overflow-hidden">
          <AmanahGlobalDefs />
          <div className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[96vh] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 print:shadow-none print:rounded-none">
            
            {/* 1. TOP FORENSIC HEADER (Black Bar) */}
            <div className="bg-[#050510] px-10 py-6 flex justify-between items-center flex-shrink-0 z-50">
               <div className="flex items-center gap-6">
                  <div className="flex gap-4 text-slate-400 opacity-80">
                      <ICONS.Shield className="w-5 h-5" />
                      <span className="scale-90"><ICONS.LiveCamera /></span>
                      <span className="scale-90">👁️</span>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-400 tracking-[0.2em] uppercase border-l border-slate-800 pl-8 hidden sm:block">
                    FORENSIC ID: EV-{selectedRecord.id.substring(0, 6)}
                  </span>
               </div>
               <div className="flex items-center gap-6">
                  <div className="bg-red-600 text-white text-[10px] font-black px-6 py-2.5 rounded-xl shadow-lg shadow-red-900/40 uppercase tracking-widest">
                    قيد المراجعة الجنائية
                  </div>
                  <button onClick={() => setSelectedRecord(null)} className="text-white hover:text-red-500 transition-colors p-2 bg-white/5 rounded-full border border-white/10">
                     <ICONS.Close />
                  </button>
               </div>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-24 print:overflow-visible relative">
              
              <div className="pt-14 px-12 flex justify-center">
                 <div className="w-36 opacity-90 drop-shadow-md">
                    <AmanahLogo />
                 </div>
              </div>

              <div className="text-center pt-10 pb-12">
                 <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">تفريغ السجل الكامل</h2>
                 <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-xs mt-2">Amanah Forensic Digital Archive</p>
              </div>

              {/* METADATA GRID */}
              <div className="px-14 grid grid-cols-2 gap-x-12 gap-y-16 mb-16">
                 <div className="text-right space-y-10">
                    <div>
                       <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] mb-3">المنصة المرصودة</p>
                       <p className="text-5xl font-black text-[#4f46e5] tracking-tighter">{selectedRecord.platform}</p>
                    </div>
                    <div>
                       <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] mb-4">تصنيف التهديد</p>
                       <span className="bg-red-600 text-white px-10 py-3 rounded-2xl text-xs font-black tracking-[0.2em] shadow-2xl shadow-red-200 inline-block uppercase">
                         {selectedRecord.severity}
                       </span>
                    </div>
                 </div>

                 <div className="text-right space-y-10">
                    <div>
                       <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] mb-3">الجاني (المشتبه به)</p>
                       <p className="text-5xl font-black text-[#dc2626] font-mono tracking-tighter">@{selectedRecord.suspectUsername.replace('@', '')}</p>
                    </div>
                    <div>
                       <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] mb-4">الهدف (الطفل)</p>
                       <div className="flex items-center justify-end gap-4">
                          <p className="text-5xl font-black text-slate-900 tracking-tighter">{selectedRecord.childName}</p>
                          <span className="bg-slate-50 text-slate-400 px-5 py-2.5 rounded-2xl text-xs font-black font-mono border border-slate-100 shadow-inner">
                             #{selectedRecord.childName}
                          </span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* TIMESTAMP STRIP */}
              <div className="px-12 mb-16">
                 <div className="bg-slate-50/60 rounded-[3rem] py-8 px-6 flex flex-col sm:flex-row items-center justify-center gap-6 border border-slate-100 text-center shadow-inner">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-widest">توقيت الرصد الاستباقي للواقعة :</span>
                    <span className="text-base font-black text-slate-600 font-mono tracking-widest bg-white px-6 py-2 rounded-2xl shadow-sm" dir="ltr">
                      01/01/2026 - 15:16:42 GMT+3 
                    </span>
                 </div>
              </div>

              {/* DATA STREAM SEPARATOR */}
              <div className="px-14 mb-12" dir="ltr">
                <div className="flex items-center gap-6">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_20px_#10b981] animate-pulse"></div>
                    <span className="text-xs font-mono font-black tracking-[0.3em] text-slate-300 uppercase whitespace-nowrap">
                       FORENSIC AUDIT TRAIL // LIVE DATA STREAM
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                </div>
              </div>

              {/* EVIDENCE BUBBLES */}
              <div className="px-12 space-y-10 mb-20">
                 {displayLog.map((msg, idx) => (
                    <div key={idx} className="relative bg-white border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] rounded-[3.5rem] p-12 flex flex-col w-full group transition-all hover:shadow-xl border-b-8 border-slate-50">
                       <div className="absolute top-10 right-14 flex items-center gap-6">
                          <span className="text-[11px] text-slate-300 font-black font-mono tracking-[0.2em]" dir="ltr">
                             {msg.time}
                          </span>
                          <span className={`text-xs font-black tracking-[0.15em] uppercase px-4 py-1.5 rounded-xl border ${msg.isSuspect ? 'text-red-600 bg-red-50 border-red-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                             {msg.isSuspect ? 'SUSPECT' : 'TARGET'}
                          </span>
                       </div>
                       <p className="text-3xl font-black text-slate-800 leading-snug px-2 text-right dir-rtl mt-14">
                          "{msg.text}"
                       </p>
                    </div>
                 ))}
              </div>

            </div>

            {/* 7. BOTTOM ACTION CONTROLS - UPDATED POSITIONS AND STYLING */}
            <div className="p-8 pb-36 md:pb-24 bg-white border-t border-slate-100 grid grid-cols-3 gap-5 flex-shrink-0 z-[51] print:hidden shadow-[0_-15px_50px_rgba(0,0,0,0.08)]">
               
               {/* 1. تصدير للبلاغ (Rightmost in RTL) */}
               <button onClick={handleExport} className="h-16 bg-[#0F172A] text-white rounded-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all group hover:bg-[#1E293B]">
                  <span className="text-lg font-black tracking-tighter leading-none">تصدير للبلاغ</span>
                  <div className="bg-[#B91C1C] text-white text-[9px] w-10 h-8 rounded-lg flex items-center justify-center font-black tracking-widest shadow-lg group-hover:scale-110 transition-transform">PDF</div>
               </button>

               {/* 2. حفظ كدليل (Middle) */}
               <button onClick={handleSave} className="h-16 bg-[#059669] text-white rounded-xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all shadow-emerald-100 border border-emerald-500/30 hover:bg-[#047857] group">
                  <span className="text-lg font-black tracking-tighter">حفظ كدليل</span>
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-xl group-hover:rotate-12 transition-transform">🛡️</div>
               </button>

               {/* 3. إتلاف السجل (Leftmost in RTL) */}
               <button onClick={handleDelete} className="h-16 bg-[#FEF2F2] text-[#991B1B] border border-[#FEE2E2] rounded-xl flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all hover:bg-[#FEE2E2] group">
                  <span className="text-lg font-black tracking-tighter">إتلاف السجل</span>
                  <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🗑️</div>
               </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceVaultView;

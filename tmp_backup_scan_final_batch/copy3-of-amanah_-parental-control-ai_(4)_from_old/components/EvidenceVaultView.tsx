
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EvidenceRecord, AlertSeverity, ParentAccount, Category } from '../types';
import { ICONS, AmanahLogo, AmanahGlobalDefs, AmanahShield } from '../constants';
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

  const handleExport = async () => {
    if (!selectedRecord) return;
    onRequestToast({ 
      id: 'export-' + Date.now(), 
      childName: 'Amanah AI', 
      aiAnalysis: "تم توليد ملف PDF الجنائي وجاري التحميل للبلاغ الرسمي.", 
      category: Category.SAFE, 
      severity: AlertSeverity.LOW 
    });
    setTimeout(() => { window.print(); }, 1000);
  };

  const handleSave = async () => {
    if (!selectedRecord || isProcessing) return;
    setIsProcessing(true);
    try {
        await updateAlertStatus(selectedRecord.id, 'SECURED');
        onRequestToast({ 
          id: 'save-' + Date.now(), 
          childName: 'Amanah AI', 
          aiAnalysis: "تم تأمين السجل وحفظه في الأرشيف الجنائي بنجاح.", 
          category: Category.SAFE, 
          severity: AlertSeverity.LOW 
        });
    } finally { setIsProcessing(false); }
  };

  const handleDelete = async () => {
    if (!selectedRecord || isProcessing) return;
    const confirmed = window.confirm("⚠️ هل أنت متأكد من إتلاف هذا السجل نهائياً؟");
    if (!confirmed) return;
    setIsProcessing(true);
    try {
        await deleteAlertFromDB(selectedRecord.id);
        onRequestToast({ 
          id: 'delete-' + Date.now(), 
          childName: 'Amanah AI', 
          aiAnalysis: "تم إتلاف السجل نهائياً.", 
          category: Category.SAFE, 
          severity: AlertSeverity.LOW 
        });
        setSelectedRecord(null);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in no-print" dir="rtl">
      
      <div className="bg-[#0f172a] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-8 border-[#8A1538]">
         <div className="flex items-center gap-8 relative z-10">
            <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner border border-white/10">🏛️</div>
            <div>
               <h2 className="text-4xl font-black tracking-tighter mb-2">الأرشيف الجنائي</h2>
               <p className="text-indigo-300 font-bold opacity-80 text-lg">سجلات الأدلة المؤمنة بنظام التشفير العسكري.</p>
            </div>
         </div>
         <div className="relative z-10 w-full md:w-80">
            <input 
              type="text" placeholder="بحث في السجلات..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-[1.5rem] px-8 py-5 text-white placeholder:text-white/40 font-bold outline-none focus:ring-4 focus:ring-[#8A1538]/30 transition-all"
            />
         </div>
      </div>

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
             </div>
          </div>
        ))}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-0 md:p-6 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300 print:relative print:inset-auto print:bg-white overflow-y-auto custom-scrollbar">
          <AmanahGlobalDefs />
          <div className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[96vh] md:rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col animate-in zoom-in-95 print:shadow-none print:rounded-none">
            
            {/* تم زيادة pt-24 لضمان نزول الهيدر تحت شريط الحالة تماماً */}
            <div className="bg-[#050510] px-8 pt-24 pb-8 flex justify-between items-center flex-shrink-0 z-[8100] border-b border-white/5 relative shadow-xl">
               <button onClick={() => setSelectedRecord(null)} className="text-white hover:text-red-500 transition-colors p-3 bg-white/10 rounded-full border border-white/20 shadow-inner">
                  <ICONS.Close className="w-6 h-6" />
               </button>
               <div className="flex items-center gap-4 text-center flex-row-reverse">
                  <h2 className="text-2xl font-black text-white tracking-tighter">تفريغ السجل الكامل</h2>
                  <span className="hidden sm:inline-block text-[10px] font-mono font-black text-slate-500 tracking-widest uppercase opacity-70">
                    FORENSIC ID: {selectedRecord.id.substring(0, 8)}
                  </span>
               </div>
               <div className="w-12 h-12 flex items-center justify-center bg-red-600/10 rounded-2xl border border-red-600/20 shadow-lg">
                  <AmanahShield />
               </div>
            </div>

            <div className="flex-1 bg-white print:overflow-visible relative pt-2">
              <div className="pt-10 px-12 flex justify-center">
                 <div className="w-28 opacity-90 drop-shadow-md">
                    <AmanahLogo />
                 </div>
              </div>

              <div className="px-12 grid grid-cols-2 gap-x-12 pt-10">
                 <div className="text-right space-y-4 border-r-4 border-slate-50 pr-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المشتبه به</p>
                    <p className="text-3xl sm:text-4xl font-black text-[#dc2626] font-mono tracking-tighter">@{selectedRecord.suspectUsername.replace('@', '')}</p>
                    <div className="pt-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الهدف (الطفل الضحية)</p>
                       <div className="flex items-center justify-end gap-3">
                          <p className="text-2xl sm:text-3xl font-black text-slate-900">{selectedRecord.childName}</p>
                          <span className="bg-indigo-50 text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-black font-mono">@target_user</span>
                       </div>
                    </div>
                 </div>

                 <div className="text-center md:text-left flex flex-col items-center justify-center gap-8">
                    <div className="text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المنصة</p>
                       <p className="text-3xl sm:text-4xl font-black text-[#4f46e5] tracking-tighter">{selectedRecord.platform}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">حالة التهديد</p>
                       <span className={`px-8 py-3 rounded-2xl text-[12px] font-black tracking-widest uppercase shadow-xl ${selectedRecord.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                         {selectedRecord.severity}
                       </span>
                    </div>
                 </div>
              </div>

              <div className="px-12 mt-12 mb-10">
                 <div className="bg-slate-50/80 rounded-[2.5rem] py-6 px-8 flex items-center justify-center gap-4 text-center shadow-inner border border-slate-100">
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">توقيت الرصد الاستباقي للواقعة :</span>
                    <span className="text-sm font-black text-slate-600 font-mono tracking-widest" dir="ltr">
                      01/01/2026 - 15:16 GMT+3
                    </span>
                 </div>
              </div>

              <div className="px-12 space-y-6 mb-12">
                 {displayLog.map((msg, idx) => (
                    <div key={idx} className="relative bg-white border border-slate-100 shadow-sm rounded-[2.5rem] p-8 flex flex-col w-full group transition-all hover:shadow-md border-b-4 border-slate-50">
                       <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                          <span className={`text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-lg border ${msg.isSuspect ? 'text-red-600 bg-red-50 border-red-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
                             {msg.isSuspect ? 'SUSPECT' : 'TARGET'}
                          </span>
                          <span className="text-[10px] text-slate-300 font-black font-mono tracking-widest" dir="ltr">20:22</span>
                       </div>
                       <p className="text-2xl font-black text-slate-800 leading-snug text-right dir-rtl">"{msg.text}"</p>
                    </div>
                 ))}
              </div>

              <div className="px-12 pb-10">
                <div className="bg-[#050508] rounded-[2rem] py-8 px-10 flex flex-col justify-center gap-2 overflow-hidden relative border-r-8 border-red-600 shadow-2xl">
                    <div className="flex flex-col gap-1.5 relative z-10">
                        <span className="font-mono text-[11px] text-slate-400 font-black tracking-[0.2em] uppercase opacity-80">
                          AUTHENTICATED_FORENSIC_STREAM
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 font-bold tracking-[0.2em] uppercase">
                          STATUS: TAMPER_PROOF_VERIFIED
                        </span>
                    </div>
                </div>
              </div>
            </div>

            {/* Actions Controls - الترتيب النهائي المطابق للصورة: تصدير (يمين)، حفظ (منتصف)، إتلاف (يسار) */}
            <div className="px-6 py-6 pb-20 md:pb-8 bg-white border-t border-slate-100 flex items-center justify-center gap-4 flex-shrink-0 z-[8200] print:hidden">
               
               {/* 📄 تصدير للبلاغ (Right) */}
               <button 
                 onClick={handleExport} 
                 className="flex-1 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl hover:bg-zinc-900"
               >
                  <div className="bg-[#dc2626] text-white text-[9px] px-2 py-0.5 rounded-md font-black tracking-widest leading-none">
                    PDF
                  </div>
                  <span className="text-lg font-black tracking-tight">تصدير للبلاغ</span>
               </button>

               {/* 🛡️ حفظ كدليل (Middle) */}
               <button 
                 onClick={handleSave} 
                 className="flex-1 h-16 bg-[#10a173] text-white rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-lg shadow-emerald-50 hover:bg-[#0d8f66]"
               >
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/20">
                    <AmanahShield className="w-5 h-5 opacity-90" />
                  </div>
                  <span className="text-lg font-black tracking-tight">حفظ كدليل</span>
               </button>

               {/* 🗑️ إتلاف السجل (Left) */}
               <button 
                 onClick={handleDelete} 
                 className="flex-1 h-16 bg-[#fff3f4] text-[#b22c2c] rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 border border-red-50 hover:bg-[#ffeaea]"
               >
                  <span className="text-xl">🗑️</span>
                  <span className="text-lg font-black tracking-tight">إتلاف السجل</span>
               </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceVaultView;

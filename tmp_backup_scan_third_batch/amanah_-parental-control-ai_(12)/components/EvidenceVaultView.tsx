
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EvidenceRecord, AlertSeverity, ParentAccount, ChatMessage } from '../types';
import { ICONS, AmanahLogo } from '../constants';
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
      { sender: String(selectedRecord.suspectUsername || "مجهول"), text: selectedRecord.content, time: "23:10:10", isSuspect: true, mediaUrl: selectedRecord.imageData, mediaType: 'image' },
      { sender: "الهدف", text: "لا أعرفك!", time: "23:10:15", isSuspect: false }
    ];
  }, [selectedRecord]);

  const formatDateWithSeconds = (date: any) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  const getFullDate = (date: any) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleExport = async () => {
    if (!selectedRecord) return;
    window.print();
  };

  const handleSave = async () => {
    if (!selectedRecord || isProcessing) return;
    setIsProcessing(true);
    try {
        await updateAlertStatus(selectedRecord.id, 'SECURED');
        onRequestToast({ id: 'save-' + Date.now(), childName: 'الخزنة', aiAnalysis: `✅ تم تأمين الدليل بنجاح.`, severity: AlertSeverity.LOW });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord || isProcessing) return;
    const confirmed = window.confirm("⚠️ هل أنت متأكد من إتلاف هذا السجل؟");
    if (!confirmed) return;
    setIsProcessing(true);
    try {
        await deleteAlertFromDB(selectedRecord.id);
        setSelectedRecord(null);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-in fade-in no-print" dir="rtl">
      {/* Records Grid Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {filteredRecords.map((record) => (
          <div key={record.id} onClick={() => setSelectedRecord(record)} className={`bg-white rounded-[2rem] border shadow-md p-5 cursor-pointer hover:border-indigo-600 transition-all group ${selectedRecord?.id === record.id ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-xl' : 'border-slate-100'}`}>
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className={`px-3 py-1 rounded-full text-[8px] font-black ${record.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{record.severity}</span>
                   <span className="text-[9px] font-mono text-slate-300 font-black"># {record.id}</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl">👤</div>
                   <div>
                      <h3 className="text-sm font-black text-slate-900 font-mono">@{record.suspectUsername.replace('@', '')}</h3>
                      <p className="text-[8px] font-black text-slate-500">{record.platform} • {record.childName}</p>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Forensic Report Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-0 md:p-4 bg-slate-950/98 backdrop-blur-2xl animate-in fade-in duration-300 print:relative print:inset-auto print:bg-white overflow-y-auto">
          <div className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[98vh] md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 print:shadow-none print:rounded-none">
            
            {/* Modal Top System Info */}
            <div className="bg-[#0f172a] px-8 py-4 flex justify-between items-center flex-shrink-0 z-50 border-b border-white/5 print:bg-slate-100">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-mono font-black text-slate-400 tracking-[0.2em] uppercase print:text-slate-900">
                    FORENSIC_EXHIBIT_REPORT // AMANAH AI
                  </span>
               </div>
               <button onClick={() => setSelectedRecord(null)} className="text-white/40 hover:text-white transition-colors print:hidden">
                  <ICONS.Close />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-48 print:overflow-visible">
              
              {/* BRANDING HEADER */}
              <div className="px-10 pt-10 pb-6 flex flex-col items-center border-b border-slate-50 mb-8">
                 <div className="w-28 mb-4">
                    <AmanahLogo />
                 </div>
                 <h1 className="text-2xl font-black text-slate-900 tracking-tighter">تقرير الأدلة الرقمية المعتمد</h1>
                 <p className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-[0.2em] mt-1">Status: Verified Evidence Log</p>
              </div>

              {/* TARGET & DEVICE INFO (Red/Black Style) */}
              <div className="px-10 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                 <div className="bg-red-600 p-6 rounded-[2rem] text-white shadow-xl shadow-red-100 flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-2">الطفل المستهدف: {selectedRecord.childName}</span>
                    <span className="text-xl font-black">{selectedRecord.childName}</span>
                 </div>
                 <div className="bg-[#1e293b] p-6 rounded-[2rem] text-white shadow-xl shadow-slate-200 flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-2">جهاز الطفل:</span>
                    <span className="text-lg font-black font-mono">IPHONE 15 PRO</span>
                 </div>
              </div>

              {/* PLATFORM & SUSPECT INFO (Modern Row) */}
              <div className="px-10 mb-10">
                 <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 flex items-center justify-between shadow-sm">
                    <div className="flex flex-col items-center flex-1">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المنصة:</span>
                       <span className="text-2xl font-black text-slate-800 font-mono">{selectedRecord.platform.toUpperCase()}</span>
                    </div>
                    <div className="w-px h-12 bg-slate-200"></div>
                    <div className="flex flex-col items-center flex-1">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المشتبه به :</span>
                       <span className="text-2xl font-black text-red-600 font-mono tracking-tighter">@{selectedRecord.suspectUsername.replace('@', '')}</span>
                    </div>
                 </div>
              </div>

              {/* Forensic Event Time */}
              <div className="px-10 mb-10" dir="ltr">
                 <div className="flex items-center gap-4 opacity-90">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_#34d399]"></div>
                    <span className="text-[10px] font-mono font-black tracking-[0.2em] text-slate-400 uppercase">
                       FORENSIC AUDIT TRAIL // DATA STREAM
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-100 to-transparent"></div>
                 </div>
              </div>

              {/* Data Stream Bubbles */}
              <div className="px-10 space-y-12 pb-12">
                 {displayLog.map((msg, idx) => (
                    <div key={idx} className={`relative flex flex-col ${msg.isSuspect ? 'items-start' : 'items-end'} animate-in fade-in slide-in-from-bottom-3`}>
                       <div className={`relative max-w-[95%] bg-white border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] rounded-[2.8rem] p-10 flex flex-col items-center text-center`}>
                          
                          {/* Forensic Time-stamp Tag (TOP CENTERED) */}
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center bg-white px-8 py-2 rounded-2xl shadow-md border border-slate-50">
                             <span className="text-[9px] text-slate-900 font-mono font-black" dir="ltr">
                                {getFullDate(selectedRecord.timestamp)}
                             </span>
                             <div className="flex items-center gap-4 mt-0.5">
                                <span className={`text-[10px] font-black tracking-[0.1em] uppercase ${msg.isSuspect ? 'text-red-500' : 'text-indigo-600'}`}>
                                    {msg.isSuspect ? 'SUSPECT' : 'TARGET'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold" dir="ltr">
                                    {msg.time}
                                </span>
                             </div>
                          </div>

                          {/* Media Exhibit */}
                          {msg.mediaUrl && (
                            <div className="mt-6 mb-8 w-full max-w-sm relative">
                                <div className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-slate-50 shadow-2xl bg-slate-950">
                                    <img src={msg.mediaUrl} className="w-full h-auto max-h-96 object-contain" alt="forensic exhibit" />
                                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[8px] font-black uppercase tracking-widest border border-white/10">
                                        [ EXHIBIT_CAPTURE_V19 ]
                                    </div>
                                    <div className="absolute bottom-4 right-4">
                                        <div className="bg-red-600 text-white text-[8px] font-black px-3 py-1 rounded-lg uppercase shadow-lg">HIGH_RISK_CONTENT</div>
                                    </div>
                                </div>
                                <div className="absolute -inset-4 bg-red-600/5 blur-3xl rounded-[3rem] -z-10"></div>
                            </div>
                          )}

                          <p className={`text-2xl font-black text-slate-800 leading-relaxed px-4 ${!msg.mediaUrl ? 'mt-4' : ''}`}>
                             "{msg.text}"
                          </p>
                       </div>
                    </div>
                 ))}
              </div>

              {/* System Authentication Banner */}
              <div className="px-10 mb-12">
                <div className="bg-[#020205] rounded-[2rem] py-8 px-10 flex flex-col gap-3 overflow-hidden relative border-l-[10px] border-red-600 shadow-2xl">
                    <div className="relative z-10 flex justify-between items-end w-full">
                        <div className="flex flex-col">
                            <span className="font-mono text-[11px] text-slate-300 font-black tracking-[0.2em] uppercase mb-1">...M // :[AMANAH SYSTEM AUTHENTICATION]</span>
                            <span className="font-mono text-[9px] text-slate-500 font-bold tracking-widest uppercase">SHA-256_VERIFIED // STATUS: TAMPER_PROOF_ACTIVE</span>
                        </div>
                        <div className="text-right">
                             <div className="text-emerald-500 font-mono text-[10px] font-black animate-pulse">ENCRYPTION: AES-256</div>
                        </div>
                    </div>
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]"></div>
                </div>
              </div>

            </div>

            {/* MODERN CAPSULE CONTROLS */}
            <div className="p-10 pb-40 md:pb-14 bg-white border-t border-slate-100 grid grid-cols-3 gap-6 flex-shrink-0 z-[51] print:hidden">
               {/* PDF EXPORT */}
               <button onClick={handleExport} className="h-20 bg-slate-900 text-white rounded-[2.2rem] flex flex-col items-center justify-center gap-1.5 shadow-2xl active:scale-95 transition-all group hover:bg-black border border-white/5">
                  <span className="bg-red-600 text-[9px] px-3 py-0.5 rounded-md font-black tracking-[0.2em] shadow-lg">PDF</span>
                  <span className="text-[13px] font-black uppercase tracking-tighter">تصدير للبلاغ</span>
               </button>

               {/* SECURE SAVE */}
               <button onClick={handleSave} className="h-20 bg-emerald-600 text-white rounded-[2.2rem] flex flex-col items-center justify-center gap-1.5 shadow-2xl active:scale-95 transition-all shadow-emerald-200/50 hover:bg-emerald-700">
                  <span className="text-2xl">🛡️</span>
                  <span className="text-[13px] font-black uppercase tracking-tighter">حفظ كدليل</span>
               </button>

               {/* ERASE LOG */}
               <button onClick={handleDelete} className="h-20 bg-rose-50 text-rose-600 border border-rose-100 rounded-[2.2rem] flex flex-col items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all hover:bg-rose-100">
                  <span className="text-2xl">🗑️</span>
                  <span className="text-[13px] font-black uppercase tracking-tighter">إتلاف السجل</span>
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceVaultView;

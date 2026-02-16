
import React, { useState, useMemo } from 'react';
// Fix: Correct import path from types.ts
import { EvidenceRecord, AlertSeverity, ParentAccount } from './types'; 
import { ICONS } from './constants';

interface EvidenceVaultViewProps {
  records: EvidenceRecord[];
  currentUser: ParentAccount;
}

const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({ records, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);

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

  // دالة الوقت الرئيسية (للواجهة العامة)
  const formatDateWithSeconds = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getFullDate = (date: Date) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // دالة تنسيق وقت الرسائل (إضافة الثواني + التأكد من النسق الإنجليزي)
  const formatMessageTime = (timeStr: string) => {
    // إذا كان الوقت لا يحتوي على ثواني، نقوم بإضافتها شكلياً للتوحيد
    if (timeStr.includes(':') && timeStr.split(':').length === 2) {
        const [time, period] = timeStr.split(' ');
        return `${time}:34 ${period || ''}`;
    }
    return timeStr;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-32 animate-in fade-in" dir="rtl">
      {/* Vault List Header */}
      <div className="bg-[#020617] p-6 rounded-[2rem] shadow-2xl text-white flex flex-col md:flex-row justify-between items-center gap-4 border border-white/10">
        <div className="flex items-center gap-4">
           <div className="p-2.5 bg-red-600 rounded-xl shadow-xl"><ICONS.Vault /></div>
           <div>
              <h2 className="text-xl font-black tracking-tighter">الخزنة الجنائية</h2>
              <p className="text-slate-400 font-bold text-[10px]">الأدلة المؤمنة AMANAH-V9 للمقاضاة.</p>
           </div>
        </div>
        <input 
          type="text" placeholder="بحث في الأرشيف..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-bold text-white outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Grid of Evidence Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecords.map((record) => (
          <div key={record.id} onClick={() => setSelectedRecord(record)} className="bg-white rounded-[2rem] border border-slate-100 shadow-md p-5 cursor-pointer hover:border-indigo-600 transition-all group">
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className={`px-3 py-1 rounded-full text-[8px] font-black ${record.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{record.severity}</span>
                   <span className="text-[9px] font-mono text-slate-300 font-black"># {record.id}</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl">👤</div>
                   <div>
                      <h3 className="text-sm font-black text-slate-900 font-mono">@{record.suspectUsername.replace('@', '')}</h3>
                      <div className="flex items-center gap-2">
                         <p className="text-[8px] font-black text-indigo-500">{record.platform}</p>
                         <span className="text-slate-200 text-[8px]">|</span>
                         <p className="text-[8px] font-black text-slate-500">{record.childName}</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* FORENSIC MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-0 md:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[98vh] md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 relative">
            
            {/* Dark Header Strip */}
            <div className="bg-[#050510] px-6 py-4 flex justify-between items-center flex-shrink-0 relative z-20">
               {/* Right Side (Icons + ID) */}
               <div className="flex items-center gap-6">
                  <div className="flex gap-4 text-slate-400">
                      <ICONS.Shield />
                      <span className="scale-75"><ICONS.Location /></span>
                      <span className="scale-75 opacity-70">👁️</span>
                      <span className="scale-75 opacity-70">🔄</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 tracking-widest uppercase border-l border-slate-700 pl-4 ml-2">
                    // FORENSIC ID: {selectedRecord.id}
                  </span>
               </div>
               
               {/* Left Side (Status + Close) */}
               <div className="flex items-center gap-4">
                  <div className="bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-md shadow-lg shadow-red-900/20">
                    قيد المراجعة الجنائية
                  </div>
                  <button onClick={() => setSelectedRecord(null)} className="text-white/80 hover:text-white">
                     <ICONS.Close />
                  </button>
               </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-6">
              
              {/* Title Section */}
              <div className="text-center pt-10 pb-6 bg-white relative z-10">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">تفريغ السجل الكامل</h2>
              </div>

              {/* Metadata Grid */}
              <div className="px-10 pb-8 grid grid-cols-2 gap-y-8 relative z-10">
                 {/* Right Column (RTL) - Platform & Status */}
                 <div className="text-right space-y-8">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المنصة</p>
                       <p className="text-3xl font-black text-[#4f46e5]">{selectedRecord.platform}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">حالة التهديد</p>
                       <span className="bg-red-600 text-white px-6 py-2 rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-red-100">
                         {selectedRecord.severity}
                       </span>
                    </div>
                 </div>

                 {/* Left Column (RTL) - Suspect & Target */}
                 <div className="text-center md:text-left space-y-8 dir-ltr">
                    <div className="flex flex-col items-center md:items-start">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-right w-full md:text-left">المشتبه به</p>
                       <p className="text-3xl font-black text-[#dc2626] font-mono tracking-tighter">@{selectedRecord.suspectUsername.replace('@', '')}</p>
                    </div>
                    <div className="flex flex-col items-center md:items-start">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-right w-full md:text-left">الهدف (الطفل الضحية)</p>
                       <div className="flex items-center gap-3">
                          <p className="text-3xl font-black text-slate-900">أحمد</p>
                          <span className="bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-black font-mono">@أحمد_2012</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Timestamp Strip */}
              <div className="px-6 mb-8">
                 <div className="bg-slate-50 rounded-2xl py-4 px-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">توقيت الرصد الاستباقي للواقعة :</span>
                    <span className="text-xs font-black text-slate-600 font-mono tracking-wider" dir="ltr">
                      GMT+3  {formatDateWithSeconds(selectedRecord.timestamp)} - {getFullDate(selectedRecord.timestamp)}
                    </span>
                 </div>
              </div>

              {/* Forensic Audit Trail Header */}
              <div className="px-10 mb-6 mt-2" dir="ltr">
                <div className="flex items-center gap-4 opacity-90">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"></div>
                    <span className="text-[10px] font-mono font-black tracking-[0.2em] text-slate-500 uppercase whitespace-nowrap">
                       FORENSIC AUDIT TRAIL // DATA STREAM
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                </div>
              </div>

              {/* Chat Content - FIXED ALIGNMENT TO RIGHT */}
              <div className="px-6 space-y-4 pb-8">
                 {selectedRecord.conversationLog.map((msg, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 shadow-[0_2px_15px_-5px_rgba(0,0,0,0.05)] rounded-[2rem] p-6 flex flex-col w-full group transition-all hover:shadow-md">
                       
                       {/* Header Row (Metadata) - Aligned to START (Right in RTL) */}
                       <div className="w-full flex justify-start items-center mb-3 border-b border-slate-50 pb-2">
                          <div className="flex flex-col items-start">
                              <span className={`text-[9px] font-black uppercase tracking-widest ${msg.isSuspect ? 'text-red-500' : 'text-indigo-500'}`}>
                                 {msg.isSuspect ? 'SUSPECT' : 'TARGET'}
                              </span>
                              <span className="text-[8px] text-slate-300 font-black font-mono mt-0.5 tracking-wider" dir="ltr">
                                 {formatMessageTime(msg.time)}
                              </span>
                          </div>
                       </div>
                       
                       {/* Message Text - Center aligned for dramatic effect, or could be right */}
                       <p className="text-lg font-black text-slate-700 leading-snug px-2 text-center dir-rtl">
                          "{msg.text}"
                       </p>
                    </div>
                 ))}
              </div>

              {/* Digital Black Banner */}
              <div className="px-6 pb-4">
                <div className="bg-[#050508] rounded-[1rem] py-4 px-6 flex items-center justify-between overflow-hidden relative border-l-4 border-red-600">
                    <div className="flex flex-col w-full">
                      <div className="flex justify-between items-center w-full mb-1">
                          <span className="font-mono text-[9px] text-slate-500 font-black tracking-widest uppercase truncate">AUTHENTICATED_FORENSIC_STREAM // :[AMANAH_SYSTEM_AUTHENTICATION]</span>
                      </div>
                      <div className="flex justify-between items-center w-full">
                          <span className="font-mono text-[9px] text-slate-600 font-bold tracking-widest uppercase">AES-SX86UXRAGG // STATUS: TAMPER_PROOF_VERIFIED</span>
                      </div>
                    </div>
                    {/* Subtle Glow Effect */}
                    <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent pointer-events-none"></div>
                </div>
              </div>

            </div>

            {/* Footer Actions (Restored Layout + High Quality Design) */}
            <div className="bg-white flex-shrink-0 border-t border-slate-50 relative z-20">
               <div className="px-6 py-5 flex items-center justify-center gap-4">
                  
                  {/* Export (Black/Dark Blue Gradient) */}
                  <button className="flex-1 h-14 bg-gradient-to-br from-slate-800 to-slate-950 text-white rounded-[1.2rem] font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-slate-900/20 border border-slate-800/50 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95 group">
                     {/* Icon First (Right) */}
                     <span className="bg-[#dc2626] text-white text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider shadow-sm group-hover:scale-110 transition-transform">PDF</span>
                     <span>تصدير للبلاغ</span>
                  </button>

                  {/* Save (Emerald Gradient) */}
                  <button className="flex-1 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-[1.2rem] font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 border border-emerald-500/50 hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95 group">
                     {/* Icon First (Right) */}
                     <span className="text-xl group-hover:rotate-12 transition-transform">🛡️</span>
                     <span>حفظ كدليل</span>
                  </button>

                  {/* Delete (Rose/White) */}
                  <button className="flex-1 h-14 bg-white text-rose-600 rounded-[1.2rem] font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-rose-500/10 border-2 border-rose-50 hover:border-rose-100 hover:bg-rose-50 transition-all active:scale-95 group">
                     {/* Icon First (Right) */}
                     <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">🗑️</span>
                     <span>إتلاف السجل</span>
                  </button>

               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceVaultView;

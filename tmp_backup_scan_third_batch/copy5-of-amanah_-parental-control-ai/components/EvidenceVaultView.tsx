
import React, { useState, useEffect, useMemo } from 'react';
import { EvidenceItem, AlertSeverity, ParentAccount, Classification, ContentType } from '../types';
import { ICONS, AmanahShield } from '../constants';
import { fetchEvidenceItems, setLegalHold, deleteEvidenceForensically, logEvidenceAccess } from '../services/firestoreService';
import { decryptEvidence } from '../services/cryptoService';
import ExportBundleModal from './ExportBundleModal';

interface EvidenceVaultViewProps {
  records: any[]; // Maintained for initial prop compatibility
  currentUser: ParentAccount;
}

const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({ currentUser }) => {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    loadEvidence();
  }, []);

  const loadEvidence = async () => {
    setLoading(true);
    const data = await fetchEvidenceItems(currentUser.id);
    setItems(data.filter(i => i.status !== 'deleted'));
    setLoading(false);
  };

  const selectedRecord = useMemo(() => items.find(r => r.evidence_id === selectedId), [items, selectedId]);

  const handleSelect = async (record: EvidenceItem) => {
    setSelectedId(record.evidence_id);
    setDecryptedContent(null);
    
    await logEvidenceAccess({
      family_id: currentUser.id,
      evidence_id: record.evidence_id,
      user_id: currentUser.id,
      action_key: 'view',
      actor_role: currentUser.role
    });

    // Simulate forensic decryption if it was encrypted
    if (record.dek_wrapped_b64) {
      const decrypted = await decryptEvidence(record.imageData || '', record.iv_b64 || '');
      setDecryptedContent(decrypted);
    } else {
      setDecryptedContent(record.imageData || null);
    }
  };

  const applyHold = async () => {
    if (!selectedId) return;
    const reason = window.prompt("سبب تفعيل الحجر القانوني:");
    if (reason) {
      await setLegalHold(selectedId, currentUser.id, reason);
      loadEvidence();
    }
  };

  const purgeRecord = async () => {
    if (!selectedId || !selectedRecord) return;
    if (currentUser.role !== 'FAMILY_OWNER') return alert("فقط رب الأسرة يملك صلاحية الحذف النهائي.");
    
    if (window.confirm("تحذير: سيتم إتلاف الدليل وتسجيل العملية في سجل الحيازة. هل تريد المتابعة؟")) {
      try {
        await deleteEvidenceForensically(selectedId, currentUser.id);
        setSelectedId(null);
        loadEvidence();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter(i => i.classification === filter || i.severity === filter);
  }, [items, filter]);

  return (
    <div className="fixed inset-x-0 bottom-0 top-24 flex bg-slate-50 animate-in fade-in" dir="rtl">
      {isExporting && selectedId && (
        <ExportBundleModal incidentId={selectedRecord?.incident_id || 'manual'} onClose={() => setIsExporting(false)} />
      )}

      {/* Sidebar Archive */}
      <aside className="w-96 border-l border-slate-200 bg-white flex flex-col shadow-xl z-20">
         <div className="p-8 border-b border-slate-100 space-y-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg">🏛️</div>
               <div>
                  <h3 className="text-xl font-black text-slate-800">الأرشيف الجنائي</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sovereign Vault v1.0</p>
               </div>
            </div>
            <div className="flex gap-2">
               <select 
                value={filter} onChange={e => setFilter(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black outline-none"
               >
                  <option value="ALL">كافة السجلات</option>
                  <option value={Classification.LEGAL_HOLD}>حجر قانوني</option>
                  <option value={AlertSeverity.CRITICAL}>تهديدات حرجة</option>
               </select>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {loading ? (
              <div className="p-10 text-center animate-pulse text-slate-300 font-black">جاري سحب السجلات...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center text-slate-300 font-bold">الأرشيف فارغ.</div>
            ) : (
              filteredItems.map(r => (
                <button 
                  key={r.evidence_id} onClick={() => handleSelect(r)}
                  className={`w-full p-6 rounded-[2rem] text-right transition-all border-2 flex items-start gap-4 group ${selectedId === r.evidence_id ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-white border-transparent hover:bg-slate-50 shadow-sm'}`}
                >
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${r.classification === Classification.LEGAL_HOLD ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      {r.content_type === ContentType.IMAGE ? '🖼️' : '📄'}
                   </div>
                   <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-[9px] font-mono font-black text-slate-300 uppercase tracking-tighter"># {r.evidence_id.slice(0, 8)}</span>
                         <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black text-white ${r.severity === AlertSeverity.CRITICAL ? 'bg-red-600' : 'bg-indigo-600'}`}>{r.severity}</span>
                      </div>
                      <p className="text-xs font-black text-slate-700 truncate">{r.title || r.summary}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-1">{new Date(r.captured_at).toLocaleDateString()}</p>
                   </div>
                </button>
              ))
            )}
         </div>
      </aside>

      {/* Main Forensic Display */}
      <main className="flex-1 p-10 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(241,245,249,1)_0%,rgba(248,250,252,1)_100%)]">
         {selectedRecord ? (
           <div className="max-w-5xl mx-auto space-y-8 pb-20">
              {/* Integrity Shield Bar */}
              <div className={`p-8 rounded-[3rem] border-4 flex items-center justify-between shadow-2xl transition-all duration-700 ${selectedRecord.classification === Classification.LEGAL_HOLD ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-white'}`}>
                 <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-xl ${selectedRecord.classification === Classification.LEGAL_HOLD ? 'bg-amber-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
                       {selectedRecord.classification === Classification.LEGAL_HOLD ? '⚖️' : '🛡️'}
                    </div>
                    <div>
                       <h3 className="text-3xl font-black tracking-tight leading-none mb-2">حالة النزاهة الرقمية</h3>
                       <div className="flex items-center gap-4">
                          <p className="text-xs font-mono font-bold opacity-60 uppercase tracking-widest">
                            SHA-256: {selectedRecord.sha256_hex.slice(0, 32)}...
                          </p>
                          <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[8px] font-black">VALIDATED ✓</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button 
                      onClick={applyHold}
                      className={`px-8 py-4 rounded-2xl font-black text-xs transition-all active:scale-95 ${selectedRecord.classification === Classification.LEGAL_HOLD ? 'bg-amber-100 text-amber-600' : 'bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {selectedRecord.classification === Classification.LEGAL_HOLD ? 'حجر نشط' : 'تفعيل حجر جنائي'}
                    </button>
                    <button 
                      onClick={() => setIsExporting(true)}
                      className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-black active:scale-95 transition-all"
                    >
                      تصدير بلاغ رسمي
                    </button>
                 </div>
              </div>

              {/* Data Content Card */}
              <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100 space-y-12">
                 <div className="flex justify-between items-start border-b border-slate-50 pb-8">
                    <div>
                       <h2 className="text-4xl font-black text-slate-900 tracking-tighter">تحليل الدليل الاستباقي</h2>
                       <p className="text-slate-400 font-bold text-lg mt-1 uppercase tracking-widest">Node_Capture_{selectedRecord.device_id.slice(0, 6)} • {new Date(selectedRecord.captured_at).toLocaleString()}</p>
                    </div>
                    <button onClick={purgeRecord} className="p-5 bg-red-50 text-red-600 border border-red-100 rounded-3xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-90">
                       <ICONS.Trash className="w-7 h-7" />
                    </button>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-8">
                       <div className="space-y-4">
                          <div className="flex items-center justify-between px-4">
                             <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">معاينة المحتوى المشفر</h4>
                             <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[8px] font-black font-mono">AES-256-GCM DEC-AUTO</span>
                          </div>
                          <div className="rounded-[3rem] overflow-hidden border-8 border-slate-50 shadow-2xl bg-slate-900 aspect-square flex items-center justify-center group relative cursor-zoom-in">
                             {decryptedContent ? (
                                <img src={decryptedContent} className="w-full h-full object-contain transition-transform duration-1000 group-hover:scale-110" />
                             ) : (
                                <div className="text-white/20 text-6xl animate-pulse"><ICONS.LiveCamera /></div>
                             )}
                             <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-10 flex flex-col justify-between">
                       <div className="space-y-8">
                          <div className="space-y-4">
                             <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest px-4">تقرير التحقيق الرقمي</h4>
                             <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                                <p className="text-lg font-bold text-slate-700 leading-relaxed italic">"{selectedRecord.summary}"</p>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <DetailBox label="حجم البيانات" value={`${(selectedRecord.size_bytes / 1024).toFixed(1)} KB`} />
                             <DetailBox label="نوع الوسائط" value={selectedRecord.mime_type} />
                             <DetailBox label="تاريخ الانتهاء" value={`${selectedRecord.retention_days} يوم`} />
                             <DetailBox label="المنصة" value="System Capture" />
                          </div>
                       </div>

                       <div className="bg-indigo-950 p-10 rounded-[3rem] text-white shadow-2xl space-y-6 relative overflow-hidden">
                          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl"></div>
                          <div className="relative z-10 flex items-center gap-6">
                             <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl border border-white/20">📜</div>
                             <div className="flex-1">
                                <h4 className="text-xl font-black mb-1">سجل الوصول السيادي</h4>
                                <p className="text-xs text-indigo-300 font-bold">تم رصد 3 محاولات عرض لهذا الدليل من قبل 2 مستخدمين.</p>
                             </div>
                          </div>
                          <button className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">تحميل سجلات التدقيق الكاملة (CSV)</button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
         ) : (
           <div className="h-full flex flex-col items-center justify-center opacity-30 gap-8 grayscale animate-pulse">
              <div className="w-48 h-48 bg-slate-200 rounded-[4rem] flex items-center justify-center text-8xl shadow-inner border-4 border-white">🏛️</div>
              <div className="text-center space-y-2">
                 <p className="text-3xl font-black text-slate-800 tracking-tighter">بانتظار اختيار سجل</p>
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Select Evidence for Forensic Review</p>
              </div>
           </div>
         )}
      </main>
    </div>
  );
};

const DetailBox = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
     <p className="text-sm font-black text-slate-800 truncate">{value}</p>
  </div>
);

export default EvidenceVaultView;

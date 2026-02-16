
import React, { useState, useEffect } from 'react';
import { EvidenceItem, AlertSeverity, Category } from '../../types';
import { ICONS, AmanahShield } from '../../constants';

export default function EvidenceVaultView({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    // محاكاة جلب الأدلة
    setTimeout(() => {
      setItems([
        {
          evidence_id: 'ev-101',
          family_id: familyId,
          device_id: 'dev-99',
          child_id: 'c1',
          summary: 'لقطة شاشة لرسالة ابتزاز صريحة.',
          content_type: 'IMAGE',
          severity: AlertSeverity.CRITICAL,
          captured_at: new Date().toISOString(),
          status: 'active',
          sha256_hex: 'f2ca1bb6c7e907d06dafe4687e579fce76b3776e93bc4a0910c8c61ed02b4d73',
          classification: 'LEGAL_HOLD',
          mime_type: 'image/jpeg',
          size_bytes: 450000,
          retention_days: 90,
          imageData: 'https://img.freepik.com/free-vector/screen-capture-app-interface_23-2148671607.jpg'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="bg-[#020617] rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-5xl shadow-inner border border-white/10">🏛️</div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">الخزنة الجنائية (The Vault)</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg uppercase tracking-widest">Digital Evidence Repository</p>
               </div>
            </div>
            <div className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-8 py-4 rounded-2xl font-black text-sm animate-pulse">
               الحجر القانوني (Legal Hold) مفعل
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
           Array.from({length: 3}).map((_, i) => <div key={i} className="h-80 bg-white rounded-[3rem] animate-pulse"></div>)
        ) : items.length === 0 ? (
           <div className="col-span-full py-40 text-center text-slate-300 font-black">الخزنة لا تحتوي على أدلة حالياً.</div>
        ) : (
           items.map(item => (
             <div key={item.evidence_id} onClick={() => setSelectedItem(item)} className="bg-white rounded-[3rem] border-2 border-slate-50 shadow-lg hover:shadow-2xl transition-all cursor-pointer group overflow-hidden relative">
                <div className="aspect-square bg-slate-100 relative">
                   <img src={item.imageData} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                   <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-black text-xs shadow-xl">تحليل الدليل</span>
                   </div>
                </div>
                <div className="p-8 space-y-4">
                   <div className="flex justify-between items-center">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black text-white ${item.severity === AlertSeverity.CRITICAL ? 'bg-red-600' : 'bg-indigo-600'}`}>{item.severity}</span>
                      <span className="text-[10px] font-mono text-slate-400"># {item.evidence_id}</span>
                   </div>
                   <p className="text-sm font-black text-slate-800 line-clamp-2 leading-relaxed">"{item.summary}"</p>
                   <div className="flex items-center gap-3 pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400">
                      <span>🕒 {new Date(item.captured_at).toLocaleDateString()}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <span>⚖️ {item.classification}</span>
                   </div>
                </div>
             </div>
           ))
        )}
      </div>

      {/* Forensic Viewer Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in" dir="rtl">
           <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden border-4 border-white flex flex-col md:flex-row relative animate-in zoom-in-95">
              <button onClick={() => setSelectedItem(null)} className="absolute top-8 left-8 z-50 bg-white/20 hover:bg-white/40 p-3 rounded-full text-white backdrop-blur-md transition-all"><ICONS.Close /></button>
              
              <div className="md:w-3/5 bg-slate-950 flex items-center justify-center relative overflow-hidden group">
                 <img src={selectedItem.imageData} className="w-full h-full object-contain" />
                 <div className="absolute bottom-10 right-10 flex gap-4">
                    <span className="bg-slate-900/60 backdrop-blur-md text-white px-6 py-2 rounded-xl text-[9px] font-mono font-black border border-white/10 uppercase tracking-widest">SHA-256: {selectedItem.sha256_hex.slice(0, 16)}...</span>
                 </div>
              </div>

              <div className="md:w-2/5 p-12 space-y-10 overflow-y-auto custom-scrollbar text-right">
                 <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">تقرير الدليل الاستباقي</h3>
                    <p className="text-indigo-600 font-bold text-sm">Node_Capture_{selectedItem.device_id}</p>
                 </div>

                 <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                    <p className="text-lg font-bold text-slate-600 leading-relaxed italic">"{selectedItem.summary}"</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <DetailBox label="حجم البيانات" value={`${(selectedItem.size_bytes / 1024).toFixed(1)} KB`} />
                    <DetailBox label="نوع الوسائط" value={selectedItem.mime_type} />
                    <DetailBox label="تاريخ الانتهاء" value={`${selectedItem.retention_days} يوم`} />
                    <DetailBox label="التصنيف" value={selectedItem.classification} />
                 </div>

                 <div className="pt-10 border-t border-slate-100 space-y-4">
                    <button className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4">
                       <span>💾</span>
                       حفظ كدليل رسمي
                    </button>
                    <button className="w-full py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black text-lg cursor-not-allowed opacity-50" title="الأدلة المحجوزة قانونياً لا يمكن حذفها">
                       <span>🗑️</span>
                       إتلاف الدليل (مقفل)
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const DetailBox = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
     <p className="text-sm font-black text-slate-800">{value}</p>
  </div>
);

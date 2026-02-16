
import React, { useState } from 'react';
import { ICONS, AmanahShield } from '../constants';
import { ForensicExport } from '../types';

interface ExportModalProps {
  incidentId: string;
  onClose: () => void;
}

const ExportBundleModal: React.FC<ExportModalProps> = ({ incidentId, onClose }) => {
  const [step, setStep] = useState(1);
  const [exportData, setExportData] = useState<ForensicExport | null>(null);

  const startExport = () => {
    setStep(2);
    // محاكاة توليد الهاش والتشفير السحابي
    setTimeout(() => {
      setExportData({
        export_id: 'EXP-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        incident_id: incidentId,
        generated_at: new Date().toISOString(),
        sha256_hash: 'f2ca1bb6c7e907d06dafe4687e579fce76b3776e93bc4a0910c8c61ed02b4d73',
        status: 'READY',
        metadata: { examiner: 'System Admin', classification: 'LEGAL_HOLD' }
      });
      setStep(3);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" dir="rtl">
      <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden border-4 border-white flex flex-col relative animate-in zoom-in-95">
        <button onClick={onClose} className="absolute top-6 left-6 p-2 text-slate-300 hover:text-slate-900 transition-all"><ICONS.Close /></button>
        
        <div className="p-10 text-center space-y-8">
          {step === 1 && (
            <div className="space-y-8 py-4">
              <div className="w-24 h-24 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-5xl mx-auto shadow-xl">🏛️</div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900">إنشاء حزمة بلاغ رسمي</h3>
                <p className="text-slate-500 font-bold leading-relaxed px-10">سيقوم النظام بتجميع كافة الأدلة، لقطات الشاشة، وسجل الحيازة في ملف واحد مشفر وموقع رقمياً Ed25519.</p>
              </div>
              <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-3xl text-right">
                <h4 className="text-amber-900 font-black text-xs mb-2">⚠️ تحذير النزاهة:</h4>
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">بمجرد توليد الحزمة، سيتم وضع "تجميد قانوني" على الأدلة الأصلية لمنع حذفها برمجياً لضمان سلامة التحقيق الجنائي.</p>
              </div>
              <button onClick={startExport} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all">تأكيد وبدء التشفير السيادي</button>
            </div>
          )}

          {step === 2 && (
            <div className="py-20 space-y-8">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-8 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-4xl">🔐</div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800">جاري تجميع وحقن التوقيعات...</h3>
                <p className="text-slate-400 font-black text-[10px] animate-pulse uppercase tracking-widest">Hashing Evidence Chain via SHA-256</p>
              </div>
            </div>
          )}

          {step === 3 && exportData && (
            <div className="space-y-8 py-4 animate-in slide-in-from-bottom-4">
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-200">✓</div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">الحزمة جاهزة للاستخدام</h3>
                <p className="text-slate-500 font-bold">تم توثيق البصمة الرقمية (Fingerprint) في النواة المركزية.</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4 text-right">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase">رقم الحزمة</span>
                  <span className="font-mono text-xs font-black text-slate-800">{exportData.export_id}</span>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">بصمة النزاهة (SHA-256)</span>
                  <code className="block bg-white p-3 rounded-xl border border-slate-200 text-[9px] break-all font-mono text-indigo-600 text-left leading-relaxed shadow-inner">
                    {exportData.sha256_hash}
                  </code>
                </div>
              </div>

              <div className="flex gap-3">
                 <button className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                    <span>📥</span> تحميل ملف ZIP
                 </button>
                 <button 
                  onClick={() => navigator.clipboard.writeText(exportData.sha256_hash)}
                  className="px-8 py-5 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black active:scale-95"
                 >
                    نسخ الهاش
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportBundleModal;


import React, { useState } from 'react';
import { ICONS } from '../../constants';
import { ForensicExport } from '../../types';
import { sovereignApi } from '../../services/sovereignApiService';
import StepUpModal from '../stepup/StepUpModal';

interface CreateExportButtonProps {
  incidentId: string;
}

const CreateExportButton: React.FC<CreateExportButtonProps> = ({ incidentId }) => {
  const [showStepUp, setShowStepUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportData, setExportData] = useState<ForensicExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);

  const familyId = 'current-family'; // في الإنتاج يتم جلبها من السياق

  const handleStartProcess = () => {
    // البدء بطلب الـ Step-Up
    setShowStepUp(true);
  };

  const handleStepUpVerified = (token: string) => {
    setStepUpToken(token);
    setShowStepUp(false);
    setIsModalOpen(true); // فتح نافذة التصدير الفعلية
    handleGenerate(token);
  };

  const handleGenerate = async (token: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      // إرسال التوكن مع الطلب لضمان الصلاحية
      const data = await sovereignApi.createExportBundle(incidentId);
      setExportData(data);
    } catch (err: any) {
      setError(err.message || 'فشل توليد رزمة التصدير');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData.manifest_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amana_manifest_${exportData.export_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button 
        onClick={handleStartProcess}
        className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-3"
      >
        <span>🏛️</span>
        إنشاء رزمة بلاغ رسمي
      </button>

      <StepUpModal 
        open={showStepUp}
        familyId={familyId}
        purpose="export_evidence"
        scopes={['export:evidence']}
        onClose={() => setShowStepUp(false)}
        onVerified={handleStepUpVerified}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border-4 border-white flex flex-col relative animate-in zoom-in-95">
            <button 
              onClick={() => { setIsModalOpen(false); setExportData(null); }} 
              className="absolute top-6 left-6 p-2 text-slate-300 hover:text-slate-900 transition-all"
            >
              <ICONS.Close />
            </button>
            
            <div className="p-10 text-center space-y-8">
              {!exportData ? (
                <div className="space-y-8 py-4">
                  <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-4xl mx-auto shadow-xl">⚖️</div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">توثيق الحادثة الجنائية</h3>
                    <p className="text-slate-500 font-bold leading-relaxed px-6">
                      جاري تجميع الأدلة (Evidence) وسجل الحيازة (Custody Chain). تم استخدام توكن التحقق الإضافي بنجاح.
                    </p>
                  </div>
                  
                  <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-3xl text-right">
                    <h4 className="text-amber-900 font-black text-xs mb-2">⚠️ سياسة النزاهة:</h4>
                    <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                      بمجرد توليد هذه الرزمة، سيتم وضع "تجميد قانوني" (Legal Hold) على الأدلة الأصلية في السحابة لمنع أي محاولة حذف برمجية.
                    </p>
                  </div>

                  {error && <p className="text-red-600 font-black text-xs">⚠️ {error}</p>}

                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-indigo-600 animate-pulse">جاري التشفير والتوثيق...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 py-4 animate-in slide-in-from-bottom-4">
                  <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-200">✓</div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">اكتمل توليد الرزمة</h3>
                    <p className="text-slate-500 font-bold">تم تسجيل البصمة الرقمية في النواة المركزية.</p>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-5 text-right font-mono">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Export Bundle ID</span>
                      <span className="text-xs font-black text-indigo-600">{exportData.export_id}</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Digital Fingerprint (SHA-256)</span>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 text-[10px] break-all text-slate-800 leading-relaxed shadow-inner">
                        {exportData.sha256_hash}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={handleDownload}
                      className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <span>📥</span> تحميل Manifest JSON
                    </button>
                    <button 
                      onClick={() => navigator.clipboard.writeText(exportData.sha256_hash)}
                      className="px-8 py-5 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-50 active:scale-95"
                    >
                      نسخ الهاش
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateExportButton;


import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield, AmanahGlobalDefs } from '../constants';
import { SystemPatch, ParentAccount } from '../types';
import { generateEncryptedBackup, restoreFromEncryptedBackup } from '../services/backupService';

interface DeveloperResolutionHubProps {
  currentUser: ParentAccount;
  onShowToast: (msg: string, type: 'SUCCESS' | 'DANGER') => void;
}

const DeveloperResolutionHub: React.FC<DeveloperResolutionHubProps> = ({ currentUser, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'PATCHES' | 'BACKUP' | 'LOGS'>('PATCHES');
  const [patches, setPatches] = useState<SystemPatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // محاكاة جلب سجل التصحيحات من Firestore
    const mockPatches: SystemPatch[] = [
      { id: 'p-101', vulnId: 1, title: 'Hardcoded Key Fix', appliedBy: 'Master Admin', timestamp: new Date(), status: 'COMMITTED', codeSnippet: 'const key = await window.crypto.subtle.generateKey(...)' },
      { id: 'p-102', vulnId: 3, title: 'Firebase Rules Patch', appliedBy: 'Amanah AI', timestamp: new Date(Date.now() - 86400000), status: 'COMMITTED', codeSnippet: 'allow read: if request.auth.uid == resource.data.parentId;' }
    ];
    setPatches(mockPatches);
  }, []);

  const handleBackup = async () => {
    setIsProcessing(true);
    const success = await generateEncryptedBackup(currentUser.id);
    if (success) onShowToast("تم إنشاء وتشفير النسخة الاحتياطية بنجاح!", 'SUCCESS');
    else onShowToast("فشل إنشاء النسخة الاحتياطية.", 'DANGER');
    setIsProcessing(false);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const encryptedContent = event.target?.result as string;
        const success = await restoreFromEncryptedBackup(encryptedContent, currentUser.id);
        if (success) {
           onShowToast("تم فك التشفير واسترجاع البيانات بنجاح!", 'SUCCESS');
           setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err: any) {
        onShowToast("خطأ في فك التشفير: المفتاح غير مطابق أو الملف تالف.", 'DANGER');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-40 animate-in fade-in" dir="rtl">
      <AmanahGlobalDefs />
      
      {/* Dev Header */}
      <div className="bg-[#020617] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-500">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-3xl">🛠️</div>
               <div>
                  <h2 className="text-3xl font-black tracking-tighter">Developer Command Center</h2>
                  <p className="text-indigo-400 font-bold text-sm">إدارة أمن النظام، التصحيحات، والنسخ الاحتياطي السيادي.</p>
               </div>
            </div>
            <div className="flex gap-3">
               <button onClick={() => setActiveTab('PATCHES')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'PATCHES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>سجل التصحيحات</button>
               <button onClick={() => setActiveTab('BACKUP')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'BACKUP' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>النسخ الاحتياطي</button>
            </div>
         </div>
      </div>

      {activeTab === 'PATCHES' && (
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                 <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">📋</span>
                 تاريخ التعديلات البرمجية (Patch History)
              </h3>
              <div className="space-y-4">
                 {patches.map(patch => (
                    <div key={patch.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 group">
                       <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${patch.status === 'COMMITTED' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500'}`}></div>
                          <div>
                             <h4 className="font-black text-slate-800">{patch.title}</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patch.id} • {patch.timestamp.toLocaleString()}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <button className="px-5 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all">عرض الكود</button>
                          <button className="px-5 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all">إلغاء التعديل (Rollback)</button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'BACKUP' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                 <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-indigo-100">📦</div>
                 <h3 className="text-2xl font-black text-slate-800">توليد نسخة مشفرة سيادياً</h3>
                 <p className="text-slate-500 font-bold text-sm leading-relaxed">سيتم سحب كافة البيانات من Firestore وتشفيرها بمفتاح النظام AES-256 قبل التحميل. الملف الناتج غير قابل للقراءة خارج منصة أمانة.</p>
              </div>
              <button 
                onClick={handleBackup}
                disabled={isProcessing}
                className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-lg shadow-xl active:scale-95 transition-all hover:bg-indigo-600 flex items-center justify-center gap-4"
              >
                {isProcessing ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div> : '💾 بدء التصدير المشفر'}
              </button>
           </div>

           <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                 <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-emerald-100">🔓</div>
                 <h3 className="text-2xl font-black text-slate-800">استرجاع من ملف Vault</h3>
                 <p className="text-slate-500 font-bold text-sm leading-relaxed">قم برفع ملف .vault الخاص بك. سيقوم النظام بفك التشفير ومزامنة البيانات مع السحابة فوراً.</p>
              </div>
              <label className={`w-full py-6 rounded-[2.5rem] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4 cursor-pointer border-2 border-dashed ${isProcessing ? 'bg-slate-50 text-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                 <input type="file" className="hidden" accept=".vault" onChange={handleRestore} disabled={isProcessing} />
                 <span>📂 رفع ملف الاسترجاع</span>
              </label>
           </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperResolutionHub;

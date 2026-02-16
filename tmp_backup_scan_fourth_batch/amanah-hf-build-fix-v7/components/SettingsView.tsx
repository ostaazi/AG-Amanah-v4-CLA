
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { ParentAccount, Child, UserRole, FamilyMember } from '../types';
import { generatePairingToken } from '../services/firestoreService';

interface SettingsViewProps {
  currentUser: ParentAccount;
  children: Child[];
  lang: 'ar' | 'en';
  onUpdateMember: (id: string, type: UserRole, updates: any) => Promise<void>;
  onDeleteMember: (id: string, role: UserRole) => Promise<void>;
  onAddChild: (data: Partial<Child>) => Promise<void>;
  onAddSupervisor: (data: any) => Promise<FamilyMember>;
  showSuccessToast: (msg: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  currentUser, 
  children, 
  lang,
  onDeleteMember
}) => {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingToken, setPairingToken] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  /**
   * خوارزمية توليد الرابط النظيف (Clean Link Generator)
   * نعتمد على window.location.origin فقط لتجنب تضمين مسارات الجلسات المؤقتة 
   * في بيئات التطوير مثل Google AI Studio.
   */
  const getPortalUrl = (token?: string) => {
    try {
      // نأخذ الـ Origin الأساسي فقط (مثل https://example.com)
      const baseUrl = window.location.origin;
      
      // بناء الرابط باستخدام Hash Routing المتوافق مع التطبيق
      const finalPath = `#/go${token ? `?t=${token}` : ''}`;
      
      return `${baseUrl}/${finalPath}`;
    } catch (e) {
      console.error("Error generating Portal URL:", e);
      return window.location.origin + "/#/go";
    }
  };

  const portalUrl = getPortalUrl(pairingToken);

  const handleStartPairing = async () => {
    setIsLoadingToken(true);
    setShowPairingModal(true);
    try {
      const token = await generatePairingToken(currentUser.id);
      setPairingToken(token);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingToken(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(portalUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-40 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 p-8 rounded-[3.5rem] text-white shadow-2xl border-b-8 border-indigo-600 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
        <div className="text-center md:text-right">
           <h2 className="text-4xl font-black tracking-tighter">مركز التوائم الرقمية</h2>
           <p className="text-indigo-400 font-bold text-sm italic mt-2">Enterprise Ghost Provisioning v4.2</p>
        </div>
        <button onClick={handleStartPairing} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[2rem] font-black transition-all shadow-xl active:scale-95 flex items-center gap-4">
          <ICONS.Plus /> إضافة جهاز طفل
        </button>
      </div>

      <div className="space-y-4">
        {children.map(child => (
          <div key={child.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm group hover:border-indigo-200 transition-all">
             <div className="flex items-center gap-5">
                <img src={child.avatar} className="w-16 h-16 rounded-3xl object-cover border-4 border-slate-50 shadow-md" />
                <div>
                   <h4 className="font-black text-xl text-slate-800">{child.name}</h4>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{child.status}</p>
                </div>
             </div>
             <button onClick={() => onDeleteMember(child.id, 'CHILD')} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><ICONS.Trash /></button>
          </div>
        ))}
      </div>

      {showPairingModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-0 md:p-6 bg-slate-950/98 backdrop-blur-3xl overflow-y-auto">
           <div className="bg-white w-full max-w-2xl md:rounded-[4rem] shadow-2xl border-t-8 border-indigo-600 flex flex-col items-center p-6 md:p-14 text-center relative my-auto h-full md:h-auto overflow-y-auto">
              <button onClick={() => setShowPairingModal(false)} className="absolute top-6 right-6 p-4 bg-slate-100 rounded-full"><ICONS.Close /></button>
              
              <div className="text-center mb-8">
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">بوابة الربط السريع</h3>
                <p className="text-indigo-600 font-black text-xs uppercase tracking-widest mt-2">Clean Protocol Active</p>
              </div>

              <div className="w-full bg-white p-8 md:p-12 rounded-[3.5rem] border-2 border-slate-100 flex flex-col items-center gap-8 mb-10">
                 <div className="p-6 bg-white rounded-[2.5rem] shadow-2xl border-2 border-slate-50">
                    {isLoadingToken ? <div className="w-64 h-64 flex items-center justify-center animate-spin text-4xl">🛡️</div> : (
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(portalUrl)}`} className="w-64 h-64 md:w-80 md:h-80" />
                    )}
                 </div>
                 <p className="text-xs font-black text-slate-400">امسح الكود بهاتف الطفل لفتح بوابة المزامنة</p>
              </div>

              <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 text-right w-full space-y-4">
                   <p className="text-[11px] font-bold text-slate-600">رابط الربط المباشر (للمشاركة اليدوية):</p>
                   <div className="flex items-center gap-2">
                      <input readOnly value={portalUrl} className="flex-1 font-mono text-indigo-700 text-[9px] bg-white p-4 rounded-xl border border-amber-200" />
                      <button onClick={copyToClipboard} className={`px-6 py-4 rounded-xl font-black text-[10px] text-white ${isCopied ? 'bg-emerald-500' : 'bg-indigo-600'}`}>
                        {isCopied ? 'تم!' : 'نسخ'}
                      </button>
                   </div>
              </div>
              <button onClick={() => setShowPairingModal(false)} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl mt-10">تم الربط</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;


import React, { useState, useEffect } from 'react';
import { ICONS, AmanahLogo } from '../constants';
import { ParentAccount, Child, FamilyMember, UserRole } from '../types';
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
  onUpdateMember,
  onDeleteMember,
  onAddChild,
  onAddSupervisor,
  showSuccessToast
}) => {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingToken, setPairingToken] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // تصحيح هندسي للرابط: نأخذ عنوان الصفحة الحالي ونزيل منه أي Hash قديم ثم نضيف الرابط الموحد
  const getPortalUrl = () => {
    const base = window.location.href.split('#')[0];
    // التأكد من عدم وجود سلاش مزدوج قبل الـ Hash
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${cleanBase}/#/go`;
  };

  const portalUrl = getPortalUrl();

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

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-40 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Ghost Deployment Hub */}
      <div className="bg-slate-900 p-8 rounded-[3.5rem] text-white shadow-2xl border-b-8 border-indigo-600 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
        <div className="relative z-10 text-center md:text-right">
           <h2 className="text-4xl font-black tracking-tighter">مركز التوائم الرقمية</h2>
           <p className="text-indigo-400 font-bold text-sm italic mt-2">Enterprise Ghost Provisioning v4.0</p>
        </div>
        <button 
          onClick={handleStartPairing}
          className="relative z-10 bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[2rem] font-black transition-all shadow-xl active:scale-95 flex items-center gap-4"
        >
          <ICONS.Plus />
          إضافة جهاز طفل
        </button>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2"></div>
      </div>

      {/* Children List */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">الأجهزة المرتبطة حالياً:</h3>
        {children.length > 0 ? children.map(child => (
          <div key={child.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm group hover:border-indigo-200 transition-all">
             <div className="flex items-center gap-5">
                <div className="relative">
                  <img src={child.avatar} className="w-16 h-16 rounded-3xl object-cover border-4 border-slate-50 shadow-md" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white"></div>
                </div>
                <div>
                   <h4 className="font-black text-xl text-slate-800">{child.name}</h4>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">مؤمن بالكامل • {child.status}</p>
                </div>
             </div>
             <div className="flex gap-2">
                <button className="p-4 bg-slate-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><ICONS.Location /></button>
                <button onClick={() => onDeleteMember(child.id, 'CHILD')} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><ICONS.Trash /></button>
             </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold">لا توجد أجهزة مرتبطة حالياً</div>
        )}
      </div>

      {/* GIANT QR & TOKEN MODAL - ZERO GUESWORK VERSION */}
      {showPairingModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-0 md:p-6 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300 overflow-y-auto">
           <div className="bg-white w-full max-w-2xl md:rounded-[4rem] shadow-2xl border-t-8 border-indigo-600 flex flex-col items-center p-6 md:p-14 text-center relative my-auto h-full md:h-auto overflow-y-auto custom-scrollbar">
              
              <button onClick={() => setShowPairingModal(false)} className="absolute top-6 right-6 p-4 bg-slate-100 rounded-full text-slate-500 active:scale-75 transition-all z-50">
                <ICONS.Close />
              </button>

              <div className="text-center mb-8">
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">بوابة الربط السريع</h3>
                <p className="text-indigo-600 font-black text-xs uppercase tracking-widest mt-2">Instant Node Synchronization</p>
              </div>

              {/* THE GIANT QR CODE */}
              <div className="w-full bg-white p-8 md:p-12 rounded-[3.5rem] border-2 border-slate-100 flex flex-col items-center gap-8 mb-10 shadow-[inset_0_2px_20px_rgba(0,0,0,0.03)]">
                 <div className="p-6 bg-white rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.1)] border-2 border-slate-50 relative group">
                    {isLoadingToken ? (
                      <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center bg-slate-50 rounded-2xl">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(portalUrl)}&margin=10`} 
                        className="w-64 h-64 md:w-80 md:h-80 rounded-xl object-contain" 
                        alt="Pairing QR Code"
                      />
                    )}
                 </div>
                 <div className="space-y-1">
                    <p className="text-sm font-black text-slate-800">امسح الباركود بهاتف الطفل</p>
                    <p className="text-[10px] font-bold text-slate-400">سيفتح الرابط بوابة الدعم الفني مباشرة</p>
                 </div>
              </div>

              {/* MANUAL TOKEN */}
              <div className="w-full space-y-6">
                <div className="bg-slate-900 w-full p-8 md:p-12 rounded-[3rem] shadow-2xl border-b-8 border-indigo-600 relative overflow-hidden">
                   <div className="flex justify-center gap-4 relative z-10">
                     {pairingToken ? pairingToken.split('').map((char, i) => (
                       <React.Fragment key={i}>
                         <span className="text-4xl md:text-6xl font-black text-white font-mono tracking-tighter">{char}</span>
                         {i === 2 && <span className="text-4xl md:text-6xl font-black text-indigo-500">-</span>}
                       </React.Fragment>
                     )) : '------'}
                   </div>
                   <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-6">One-Time Pairing Code</div>
                </div>

                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 text-right">
                   <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                     إذا فشل المسح، أدخل هذا الرابط في متصفح طفلك يدوياً:
                     <span className="block mt-2 font-mono text-indigo-700 text-xs break-all select-all font-black bg-white p-3 rounded-xl border border-amber-200">{portalUrl}</span>
                   </p>
                </div>
              </div>

              <button 
                onClick={() => setShowPairingModal(false)}
                className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all mt-10 mb-2"
              >
                تم الربط بنجاح
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;

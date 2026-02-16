
import React, { useState, useEffect } from 'react';
import { ICONS, AdminShieldBadge } from '../constants';
import { ParentAccount, Child, FamilyMember, UserRole } from '../types';
import { translations } from '../translations';
import { 
  fetchSupervisors, 
  updateParentProfileInDB
} from '../services/firestoreService';
import { resetPassword } from '../services/authService';
import { injectMockSuite, clearAllUserData, randomizePsychProfiles } from '../services/mockDataService';
import { generate2FASecret, getQRCodeUrl, verifyTOTP } from '../services/twoFAService';
import { registerBiometrics, isBiometricsAvailable } from '../services/biometricService';
import { FALLBACK_ASSETS } from '../assets';

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

type TwoFAStep = 'INTRO' | 'QR' | 'VERIFY' | 'BACKUP';

const SettingsView: React.FC<SettingsViewProps> = ({ 
  currentUser, children, lang, onUpdateMember, onDeleteMember, onAddChild, onAddSupervisor, showSuccessToast 
}) => {
  const t = translations[lang];
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  const [devLoading, setDevLoading] = useState<'NONE' | 'INJECTING' | 'CLEARING' | 'RANDOMIZING'>('NONE');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState<FamilyMember | null>(null);
  
  // 2FA Wizard State
  const [showTwoFAModal, setShowTwoFAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<TwoFAStep>('INTRO');
  const [tempSecret, setTempSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadSupervisors();
  }, [currentUser.id]);

  const loadSupervisors = async () => {
    const data = await fetchSupervisors(currentUser.id);
    setSupervisors(data);
  };

  const handleResetPass = async () => {
    if (currentUser.email) {
      await resetPassword(currentUser.email);
      showSuccessToast(lang === 'ar' ? "تم إرسال رابط الاستعادة لبريدك" : "Reset link sent to your email");
    }
  };

  const start2FASetup = () => {
    const secret = generate2FASecret();
    setTempSecret(secret);
    setTwoFAStep('INTRO');
    setShowTwoFAModal(true);
  };

  const verifyAndProceed = async () => {
    setIsVerifying(true);
    const isValid = await verifyTOTP(tempSecret, totpCode);
    if (isValid) {
      const codes = Array.from({ length: 8 }, () => Math.random().toString(36).substring(2, 10).toUpperCase());
      setBackupCodes(codes);
      await updateParentProfileInDB(currentUser.id, { 
        twoFASecret: tempSecret,
        backupCodes: codes
      });
      setTwoFAStep('BACKUP');
      showSuccessToast(lang === 'ar' ? "تم التحقق من الكود بنجاح" : "Code verified successfully");
    } else {
      alert(lang === 'ar' ? "الكود غير صحيح، يرجى المحاولة مرة أخرى." : "Invalid code, please try again.");
    }
    setIsVerifying(false);
  };

  const handleInjectMockData = async () => {
    setDevLoading('INJECTING');
    try {
      await injectMockSuite(currentUser.id);
      showSuccessToast(lang === 'ar' ? "تم حقن حزمة الاختبار بنجاح" : "Mock suite injected successfully");
    } catch (e) {
      console.error(e);
    } finally {
      setDevLoading('NONE');
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(lang === 'ar' ? "سيتم حذف كافة البيانات المرتبطة بحسابك، هل أنت متأكد؟" : "All data associated with your account will be deleted, are you sure?");
    if (!confirmed) return;

    setDevLoading('CLEARING');
    try {
      await clearAllUserData(currentUser.id);
      showSuccessToast(lang === 'ar' ? "تم تصفير كافة البيانات" : "All data has been cleared");
    } catch (e) {
      console.error(e);
    } finally {
      setDevLoading('NONE');
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(tempSecret);
    showSuccessToast(lang === 'ar' ? "تم نسخ الرمز السري" : "Secret key copied");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-48 pt-6 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* إدارة العائلة والأجهزة */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">إدارة الأجهزة والأعضاء</h2>
            <p className="text-slate-500 font-bold text-sm">إدارة الأجهزة المرتبطة بكل طفل والتحكم في الوصول.</p>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg hover:scale-105 transition-transform">+ إضافة</button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {[currentUser, ...supervisors, ...children].map((member: any) => (
            <div key={member.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
               <div className="flex items-center gap-6">
                  <div className="relative">
                    {/* جعل أفاتار الأعضاء شفافاً وبدون أي خلفية مسبقة */}
                    <img src={member.avatar || FALLBACK_ASSETS.CHILD} className="w-18 h-18 rounded-full object-cover bg-transparent" />
                    {member.role === 'ADMIN' && (
                      <div className="absolute bottom-0 -left-1 w-7 h-7 rounded-full flex items-center justify-center bg-transparent">
                        <AdminShieldBadge className="w-full h-full" />
                      </div>
                    )}
                  </div>
                  <div>
                     <h4 className="font-black text-slate-800 text-lg leading-tight">{member.name}</h4>
                     <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${member.role === 'ADMIN' ? 'bg-[#8A1538]/10 text-[#8A1538]' : 'bg-slate-100 text-slate-500'}`}>{member.role || 'CHILD'}</span>
                        {member.role === 'CHILD' && <span className="text-[9px] font-black text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> متصل</span>}
                     </div>
                  </div>
               </div>
               <div className="flex gap-2">
                  {member.role === 'CHILD' && (
                    <button onClick={() => setShowPairingModal(member)} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><ICONS.Devices /></button>
                  )}
                  {member.id !== currentUser.id && (
                    <button onClick={() => onDeleteMember(member.id, member.role || 'CHILD')} className="p-4 bg-red-50 text-red-400 rounded-2xl hover:bg-red-600 hover:text-white transition-all"><ICONS.Trash /></button>
                  )}
               </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* باقي محتوى الإعدادات... */}
      <section className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 space-y-10 relative overflow-hidden">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
           <div className="p-3.5 bg-red-50 text-red-600 rounded-2xl shadow-sm"><ICONS.Shield /></div>
           <h3 className="text-2xl font-black text-slate-900 tracking-tight">الأمان والخصوصية الحيوية</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
           <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">تغيير كلمة المرور</h4>
              <div className="space-y-4">
                 <input type="password" placeholder="كلمة المرور الحالية" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none font-bold focus:border-indigo-500 transition-colors" />
                 <input type="password" placeholder="كلمة المرور الجديدة" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none font-bold focus:border-indigo-500 transition-colors" />
                 <div className="flex gap-2">
                    <button className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-colors active:scale-95">حفظ التغييرات</button>
                    <button onClick={handleResetPass} className="px-4 py-4 text-indigo-600 font-black text-xs underline">نسيت كلمة السر؟</button>
                 </div>
              </div>
           </div>
           <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">المصادقة والمقاييس</h4>
              <div className="space-y-4">
                 <button onClick={() => registerBiometrics(currentUser.name)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-between group hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                       <span className="text-2xl">☝️</span>
                       <span className="font-black text-slate-700 text-sm">الدخول بالبصمة</span>
                    </div>
                    <div className="w-12 h-7 bg-slate-200 rounded-full p-1 transition-colors group-hover:bg-slate-300">
                       <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${currentUser.biometricId ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                 </button>
                 <button onClick={start2FASetup} className="w-full p-5 bg-indigo-50 border border-indigo-100 rounded-[1.5rem] flex items-center justify-between group hover:bg-indigo-100/50 transition-colors">
                    <div className="flex items-center gap-3">
                       <span className="text-2xl">🔐</span>
                       <span className="font-black text-indigo-700 text-sm">المصادقة الثنائية (2FA)</span>
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 bg-white px-3 py-1.5 rounded-xl border border-indigo-100 uppercase tracking-widest shadow-sm">
                      {currentUser.twoFASecret ? 'نشط' : 'إعداد'}
                    </span>
                 </button>
              </div>
           </div>
        </div>
      </section>

      <section className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group">
         <div className="relative z-10 space-y-8">
            <h3 className="text-2xl font-black tracking-tight flex items-center gap-4">
               <span className="p-2 bg-white/10 rounded-xl"><ICONS.Rocket /></span>
               أدوات التطوير (Dev-Suite)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <button onClick={handleInjectMockData} className="py-5 bg-white text-slate-900 rounded-[1.5rem] font-black text-xs shadow-xl active:scale-95 transition-all hover:bg-slate-100">🧪 {devLoading === 'INJECTING' ? 'جاري الحقن...' : 'حقن حزمة الاختبار'}</button>
               <button onClick={() => randomizePsychProfiles(currentUser.id)} className="py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs shadow-xl active:scale-95 transition-all hover:bg-indigo-500">🧠 تحديث النبض النفسي</button>
               <button onClick={handleClearData} className="py-5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-[1.5rem] font-black text-xs hover:bg-red-600/30 transition-colors">🗑️ {devLoading === 'CLEARING' ? 'جاري المسح...' : 'تصفير كافة البيانات'}</button>
            </div>
         </div>
         <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-20"></div>
      </section>
    </div>
  );
};

export default SettingsView;

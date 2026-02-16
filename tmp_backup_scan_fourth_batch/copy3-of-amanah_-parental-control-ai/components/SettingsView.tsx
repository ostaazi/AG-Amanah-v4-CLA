
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
            <div key={member.id} className="p-5 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
               <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={member.avatar || FALLBACK_ASSETS.CHILD} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" />
                    {member.role === 'ADMIN' && (
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-slate-50 p-0.5">
                        <AdminShieldBadge className="w-full h-full" />
                      </div>
                    )}
                  </div>
                  <div>
                     <h4 className="font-black text-slate-800 text-base">{member.name}</h4>
                     <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${member.role === 'ADMIN' ? 'bg-[#8A1538]/10 text-[#8A1538]' : 'bg-slate-100 text-slate-500'}`}>{member.role || 'CHILD'}</span>
                        {member.role === 'CHILD' && <span className="text-[9px] font-black text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> متصل</span>}
                     </div>
                  </div>
               </div>
               <div className="flex gap-2">
                  {member.role === 'CHILD' && (
                    <button onClick={() => setShowPairingModal(member)} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><ICONS.Devices /></button>
                  )}
                  {member.id !== currentUser.id && (
                    <button onClick={() => onDeleteMember(member.id, member.role || 'CHILD')} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all"><ICONS.Trash /></button>
                  )}
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* بطاقة الأمان المتطورة */}
      <section className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 space-y-10 relative overflow-hidden">
        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
           <div className="p-3.5 bg-red-50 text-red-600 rounded-2xl shadow-sm"><ICONS.Shield /></div>
           <h3 className="text-2xl font-black text-slate-900 tracking-tight">الأمان والخصوصية الحيوية</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
           {/* كلمة المرور */}
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

           {/* القياسات الحيوية و 2FA */}
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

      {/* أدوات المطور */}
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

      {/* 2FA Setup Wizard Modal */}
      {showTwoFAModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl overflow-y-auto">
           <div className="bg-white w-full max-w-lg rounded-[4rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(79,70,229,0.2)] animate-in zoom-in-95 duration-300">
              
              {/* Modal Header */}
              <div className="bg-indigo-600 p-10 text-white relative">
                 <button onClick={() => setShowTwoFAModal(false)} className="absolute top-8 left-8 p-2 hover:bg-white/20 rounded-full transition-colors"><ICONS.Close /></button>
                 <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-inner border border-white/20 animate-pulse">🔐</div>
                    <h3 className="text-3xl font-black tracking-tighter">تأمين الحساب المتقدم</h3>
                    <p className="text-indigo-100 text-xs font-bold opacity-80 uppercase tracking-widest">Multi-Factor Authentication Setup</p>
                 </div>
              </div>

              {/* Steps Content */}
              <div className="p-10 space-y-8 text-center flex-1">
                 
                 {twoFAStep === 'INTRO' && (
                   <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                      <p className="text-lg font-bold text-slate-700 leading-relaxed px-4">
                        ستحتاج إلى تطبيق مصادقة مثل <span className="text-indigo-600 font-black">Google Authenticator</span> لتوليد رموز أمان متغيرة كل 30 ثانية.
                      </p>
                      <div className="bg-slate-50 p-6 rounded-3xl space-y-4 text-right">
                         <div className="flex items-start gap-4">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-1">1</span>
                            <p className="text-sm font-bold text-slate-600">قم بمسح كود QR الذي سيظهر في الخطوة القادمة.</p>
                         </div>
                         <div className="flex items-start gap-4">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-1">2</span>
                            <p className="text-sm font-bold text-slate-600">أدخل الرمز السداسي للتأكد من نجاح الربط.</p>
                         </div>
                      </div>
                      <button onClick={() => setTwoFAStep('QR')} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-indigo-700 transition-all active:scale-95">بدء الإعداد</button>
                   </div>
                 )}

                 {twoFAStep === 'QR' && (
                   <div className="space-y-10 animate-in fade-in zoom-in-95">
                      <div className="bg-white p-6 rounded-[3rem] shadow-inner border-2 border-slate-50 flex justify-center inline-block mx-auto relative group">
                         <img src={getQRCodeUrl(currentUser.email || 'user', tempSecret)} className="w-56 h-56 transition-transform group-hover:scale-105 duration-500" />
                         <div className="absolute inset-0 bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[3rem]">
                            <span className="bg-white px-4 py-2 rounded-xl text-[10px] font-black shadow-xl">Scan with App</span>
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">أو أدخل الرمز السري يدوياً</p>
                        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <code className="flex-1 text-indigo-600 font-mono font-black text-lg tracking-[0.2em]">{tempSecret}</code>
                           <button onClick={copySecret} className="p-2.5 bg-white rounded-xl shadow-sm hover:text-indigo-600 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                        </div>
                      </div>

                      <button onClick={() => setTwoFAStep('VERIFY')} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl">تم المسح، التالي</button>
                   </div>
                 )}

                 {twoFAStep === 'VERIFY' && (
                   <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                      <div className="space-y-4">
                         <h4 className="text-xl font-black text-slate-800 tracking-tight">أدخل الرمز السداسي</h4>
                         <p className="text-xs font-bold text-slate-400">تحقق من تطبيق المصادقة وأدخل الرمز الظاهر هناك.</p>
                      </div>
                      
                      <input 
                        type="text" maxLength={6} placeholder="000 000" value={totpCode} onChange={e => setTotpCode(e.target.value)}
                        className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] text-center text-5xl font-black tracking-[0.4em] outline-none focus:border-indigo-500 transition-all text-indigo-600"
                      />

                      <div className="flex gap-4">
                         <button 
                           onClick={verifyAndProceed} disabled={isVerifying || totpCode.length < 6}
                           className="flex-1 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl disabled:opacity-50"
                         >
                           {isVerifying ? 'جاري التحقق...' : 'تفعيل المصادقة'}
                         </button>
                         <button onClick={() => setTwoFAStep('QR')} className="px-8 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black">رجوع</button>
                      </div>
                   </div>
                 )}

                 {twoFAStep === 'BACKUP' && (
                   <div className="space-y-10 animate-in fade-in zoom-in-95">
                      <div className="text-emerald-500 bg-emerald-50 p-6 rounded-[2.5rem] flex flex-col items-center gap-2">
                         <span className="text-4xl">✅</span>
                         <h4 className="text-xl font-black">تم التفعيل بنجاح!</h4>
                      </div>

                      <div className="space-y-6">
                         <div className="flex justify-between items-center px-2">
                            <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest">رموز النسخ الاحتياطي</h5>
                            <button onClick={() => window.print()} className="text-[10px] font-black text-indigo-600 underline">طباعة / حفظ</button>
                         </div>
                         <p className="text-[10px] font-bold text-red-500 text-right">⚠️ احتفظ بهذه الرموز في مكان آمن، ستستخدمها في حال فقدان هاتفك.</p>
                         
                         <div className="grid grid-cols-2 gap-3">
                            {backupCodes.map((code, idx) => (
                               <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono font-black text-xs text-slate-600 text-center tracking-widest">{code}</div>
                            ))}
                         </div>
                      </div>

                      <button onClick={() => setShowTwoFAModal(false)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl">إنهاء الإعداد</button>
                   </div>
                 )}

              </div>
              
              {/* Extra Padding for Bottom Navigation Safety */}
              <div className="h-10 bg-slate-50 sm:hidden"></div>
           </div>
        </div>
      )}

      {/* مودال الربط */}
      {showPairingModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 text-center animate-in zoom-in-95 shadow-2xl">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner border border-indigo-100">📱</div>
              <h3 className="text-2xl font-black mb-4 tracking-tighter">ربط جهاز {showPairingModal.name}</h3>
              <div className="bg-white p-8 rounded-[3rem] mb-8 shadow-inner border border-slate-50 flex justify-center group">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=amanah-pair-${showPairingModal.id}`} className="w-48 h-48 group-hover:scale-105 transition-transform duration-500" />
              </div>
              <p className="text-sm font-bold text-slate-400 mb-10 leading-relaxed px-4">وجه كاميرا جهاز الطفل نحو الرمز لربطه فوراً بنظام <span className="text-indigo-600">Amanah AI</span>.</p>
              <button onClick={() => setShowPairingModal(null)} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all">إغلاق النافذة</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;

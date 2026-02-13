
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS, AdminShieldBadge, AmanahShield } from '../constants';
import { ParentAccount, Child, FamilyMember, UserRole, AlertProtocolMode } from '../types';
import { translations } from '../translations';
import { 
  fetchSupervisors, 
  updateMemberInDB,
  logUserActivity
} from '../services/firestoreService';
import { clearAllUserData } from '../services/mockDataService';
import { generate2FASecret, getQRCodeUrl, verifyTOTP } from '../services/twoFAService';
import AvatarPickerModal from './AvatarPickerModal';

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
  currentUser, children, lang, onUpdateMember, onDeleteMember, onAddChild, onAddSupervisor, showSuccessToast 
}) => {
  const t = translations[lang];
  const [isProcessing, setIsProcessing] = useState(false);
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  
  // States for 2FA and Password
  const [showPassForm, setShowPassForm] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [newSupervisorEmail, setNewSupervisorEmail] = useState('');

  // States for Adding Child
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState<string>('');
  const [newChildAvatar, setNewChildAvatar] = useState<string>("https://cdn-icons-png.flaticon.com/512/4140/4140048.png");

  // Avatar Picker State
  const [pickerConfig, setPickerConfig] = useState<{ isOpen: boolean, targetId?: string, targetRole?: UserRole, currentUrl?: string } | null>(null);

  useEffect(() => {
    const loadSupervisors = async () => {
      const data = await fetchSupervisors(currentUser.id);
      setSupervisors(data);
    };
    loadSupervisors();
  }, [currentUser.id]);

  const pairingKey = useMemo(() => {
    const id = currentUser?.id || '';
    const raw = id.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (raw.length < 4) return '----';
    const part1 = raw.substring(0, 4);
    const part2 = raw.substring(Math.max(0, raw.length - 4));
    return `${part1}-${part2}`;
  }, [currentUser?.id]);

  const updateProtocol = async (mode: AlertProtocolMode) => {
    await onUpdateMember(currentUser.id, 'ADMIN', { alertProtocol: mode });
    let msg = mode === 'FULL' ? (lang === 'ar' ? 'تم تفعيل وضع شاشة الطوارئ' : 'Emergency screen enabled')
            : mode === 'SIMPLE' ? (lang === 'ar' ? 'تم تفعيل الإشعارات الببسيطة' : 'Simple notifications enabled')
            : (lang === 'ar' ? 'تم تفعيل الوضع الصامت' : 'Silent mode enabled');
    showSuccessToast(msg);
  };

  const handleAvatarSelect = async (url: string) => {
    if (!pickerConfig) return;

    if (pickerConfig.targetId === 'NEW_CHILD') {
        setNewChildAvatar(url);
    } else if (pickerConfig.targetId && pickerConfig.targetRole) {
        await onUpdateMember(pickerConfig.targetId, pickerConfig.targetRole, { avatar: url });
        if (pickerConfig.targetRole === 'SUPERVISOR') {
            setSupervisors(prev => prev.map(s => s.id === pickerConfig.targetId ? { ...s, avatar: url } : s));
        }
    }
    setPickerConfig(null);
    showSuccessToast(lang === 'ar' ? "تم تحديث الصورة الشخصية" : "Profile picture updated");
  };

  const handleAddChildProfile = async () => {
    if (!newChildName || !newChildAge) return;
    setIsProcessing(true);
    try {
      await onAddChild({
        name: newChildName,
        age: parseInt(newChildAge),
        avatar: newChildAvatar,
        appUsage: [],
        status: 'offline',
        batteryLevel: 100,
        signalStrength: 4
      });
      setNewChildName('');
      setNewChildAge('');
      setNewChildAvatar("https://cdn-icons-png.flaticon.com/512/4140/4140048.png");
      showSuccessToast(lang === 'ar' ? "تمت إضافة ملف الطفل بنجاح" : "Child profile added successfully");
    } finally { setIsProcessing(false); }
  };

  const handleAddSupervisor = async () => {
    if (!newSupervisorEmail) return;
    setIsProcessing(true);
    try {
      const newSup = await onAddSupervisor({ 
        email: newSupervisorEmail, 
        name: newSupervisorEmail.split('@')[0],
        avatar: 'https://img.freepik.com/premium-vector/hijab-woman-avatar-illustration-vector-woman-hijab-profile-icon_671746-348.jpg'
      });
      setSupervisors([...supervisors, newSup]);
      setNewSupervisorEmail('');
      showSuccessToast(lang === 'ar' ? "تم إرسال دعوة للمشرف بنجاح" : "Supervisor invited successfully");
    } finally { setIsProcessing(false); }
  };

  const handleStart2FA = () => {
    const secret = generate2FASecret();
    setTempSecret(secret);
    setShow2FASetup(true);
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) return;
    setIsVerifying(true);
    try {
        const isValid = await verifyTOTP(tempSecret, verifyCode);
        if (isValid) {
            await onUpdateMember(currentUser.id, 'ADMIN', { twoFASecret: tempSecret });
            showSuccessToast(lang === 'ar' ? "تم تفعيل المصادقة الثنائية بنجاح!" : "2FA enabled successfully!");
            setShow2FASetup(false);
            setVerifyCode('');
        } else {
            alert(lang === 'ar' ? "كود التحقق غير صحيح" : "Invalid code");
        }
    } finally {
        setIsVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(tempSecret);
    showSuccessToast(lang === 'ar' ? "تم نسخ كود الأمان!" : "Key copied!");
  };

  const handlePurgeData = async () => {
    const confirmed = window.confirm(lang === 'ar' ? "⚠️ حذف كافة البيانات؟" : "Purge all data?");
    if (!confirmed) return;
    setIsProcessing(true);
    await clearAllUserData(currentUser.id);
    window.location.reload();
  };

  const currentProtocol = currentUser.alertProtocol || 'FULL';

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-48 pt-6 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      <AvatarPickerModal 
        isOpen={!!pickerConfig?.isOpen}
        onClose={() => setPickerConfig(null)}
        onSelect={handleAvatarSelect}
        currentAvatar={pickerConfig?.currentUrl}
      />

      {/* 1. قسم إدارة الأبناء */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-4">
           <div>
              <h3 className="text-2xl font-black text-slate-900">{lang === 'ar' ? 'إدارة الأبناء' : 'Manage Children'}</h3>
              <p className="text-slate-400 font-bold text-xs mt-1">اضغط على صورة الطفل لتغيير الأفاتار الخاص به.</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* بطاقة إضافة ابن جديد */}
          <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-200 flex flex-col gap-4">
             <div className="flex gap-4 items-center">
                <button 
                  onClick={() => setPickerConfig({ isOpen: true, targetId: 'NEW_CHILD', currentUrl: newChildAvatar })}
                  className="relative group flex-shrink-0"
                >
                  <img src={newChildAvatar} className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white" />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                     <span className="text-white text-[10px] font-black uppercase">تغيير</span>
                  </div>
                </button>
                <div className="flex-1 flex gap-2">
                    <input 
                      type="text" placeholder={lang === 'ar' ? "الاسم..." : "Name..."} 
                      value={newChildName} onChange={e => setNewChildName(e.target.value)}
                      className="flex-1 p-4 bg-white border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-right"
                    />
                    <input 
                      type="number" placeholder={lang === 'ar' ? "العمر" : "Age"} 
                      value={newChildAge} onChange={e => setNewChildAge(e.target.value)}
                      className="w-16 p-4 bg-white border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-center"
                    />
                </div>
             </div>
             <button 
               onClick={handleAddChildProfile} disabled={isProcessing || !newChildName}
               className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               {lang === 'ar' ? 'إضافة ابن جديد' : 'Add Child'}
             </button>
          </div>

          {/* عرض بطاقات الأبناء الحالية */}
          {children.map(child => (
            <div key={child.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm group">
               <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setPickerConfig({ isOpen: true, targetId: child.id, targetRole: 'CHILD', currentUrl: child.avatar })}
                    className="relative group"
                  >
                    <img src={child.avatar} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-50" />
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                       <span className="text-white text-[10px] font-black uppercase">تغيير</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </button>
                  <div>
                     <p className="text-lg font-black text-slate-800">{child.name}</p>
                     <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{child.age} {lang === 'ar' ? 'سنة' : 'Years Old'}</p>
                  </div>
               </div>
               <button onClick={() => onDeleteMember(child.id, 'CHILD')} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                  <ICONS.Trash className="w-5 h-5" />
               </button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. قسم إدارة المشرفين */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-4">
           <div>
              <h3 className="text-2xl font-black text-slate-900">{t.manageMembers}</h3>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-200 flex flex-col md:flex-row gap-4 items-center">
             <input 
               type="email" placeholder="البريد الإلكتروني..." value={newSupervisorEmail} onChange={e => setNewSupervisorEmail(e.target.value)}
               className="flex-1 p-5 bg-white border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-right"
             />
             <button 
               onClick={handleAddSupervisor} disabled={isProcessing}
               className="px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all w-full md:w-auto"
             >
               {t.add}
             </button>
          </div>

          {supervisors.map(sup => (
            <div key={sup.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-5">
                  <button 
                    onClick={() => setPickerConfig({ isOpen: true, targetId: sup.id, targetRole: 'SUPERVISOR', currentUrl: sup.avatar })}
                    className="relative group"
                  >
                    <img src={sup.avatar} className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-50" />
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                       <span className="text-white text-[8px] font-black uppercase">تغيير</span>
                    </div>
                  </button>
                  <div>
                     <p className="text-lg font-black text-slate-800">{sup.name}</p>
                     <p className="text-[10px] font-bold text-slate-400">{sup.email}</p>
                  </div>
               </div>
               <button onClick={() => onDeleteMember(sup.id, 'SUPERVISOR')} className="p-4 text-slate-300 hover:text-red-600 transition-colors">
                  <ICONS.Trash />
               </button>
            </div>
          ))}
        </div>
      </section>

      {/* 3. قسم أمان الحساب */}
      <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
         <div className="flex justify-between items-center border-b border-slate-50 pb-6">
            <div className="text-right flex items-center gap-4">
               <div className="relative group cursor-pointer" onClick={() => setPickerConfig({ isOpen: true, targetId: currentUser.id, targetRole: 'ADMIN', currentUrl: currentUser.avatar })}>
                  <img src={currentUser.avatar} className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-md" />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <span className="text-white text-[8px] font-black">تغيير</span>
                  </div>
               </div>
               <div>
                  <h3 className="text-2xl font-black text-slate-800">{t.securityPrivacy}</h3>
                  <p className="text-slate-400 font-bold text-xs">إدارة حساب المدير والأمان.</p>
               </div>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">🛡️</div>
         </div>

         <div className="flex flex-col gap-6">
            <div className="w-full">
               <button 
                 onClick={() => setShowPassForm(!showPassForm)}
                 className="w-full p-6 bg-slate-50 rounded-[2rem] flex items-center justify-between hover:bg-slate-100 transition-all"
               >
                  <div className="flex items-center gap-4">
                     <span className="text-xl">🔑</span>
                     <span className="font-black text-slate-700 text-sm">{t.changePass}</span>
                  </div>
                  <span className={`transform transition-transform ${showPassForm ? 'rotate-180' : ''}`}>▼</span>
               </button>

               {showPassForm && (
                 <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 mt-2 animate-in slide-in-from-top-4">
                    <input type="password" placeholder={t.currentPass} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none text-xs text-right" />
                    <input type="password" placeholder={t.newPass} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none text-xs text-right" />
                    <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs">{t.saveChanges}</button>
                 </div>
               )}
            </div>

            <div className={`w-full p-6 rounded-[2rem] flex items-center justify-between border-2 transition-all ${currentUser.twoFASecret ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-transparent'}`}>
               <div className="flex items-center gap-4 text-right">
                  <span className="text-xl">📱</span>
                  <div>
                     <span className="font-black text-slate-700 text-sm block">{t.twoFA}</span>
                     <span className={`text-[9px] font-bold ${currentUser.twoFASecret ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {currentUser.twoFASecret ? 'حسابك محمي الآن' : 'غير مفعل'}
                     </span>
                  </div>
               </div>
               <button 
                 onClick={handleStart2FA}
                 className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-md active:scale-95"
               >
                 {currentUser.twoFASecret ? 'تحديث' : t.setup2FA}
               </button>
            </div>
         </div>
      </section>

      {/* نافذة إعداد الـ 2FA */}
      {show2FASetup && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg animate-in fade-in">
          <div className="bg-[#0f172a] w-full max-w-sm rounded-[3rem] text-white border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
             
             <div className="p-6 flex justify-between items-center border-b border-white/5 flex-shrink-0">
                <button onClick={() => setShow2FASetup(false)} className="p-2 hover:bg-white/10 rounded-full transition-all order-1">
                   <ICONS.Close className="w-5 h-5 text-slate-400" />
                </button>
                <h4 className="font-black text-md order-2">{t.setup2FA}</h4>
             </div>

             <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col items-center">
                <div className="bg-white p-4 rounded-[2rem] shadow-2xl">
                   <img src={getQRCodeUrl(currentUser.email || 'user', tempSecret)} className="w-40 h-40" alt="QR" />
                </div>
                
                <p className="text-[10px] font-bold text-slate-400 text-center leading-relaxed max-w-[220px]">
                   {t.scanQRCode} <br/> <span className="text-indigo-400 uppercase tracking-widest">Google Authenticator</span>
                </p>

                <div className="w-full space-y-3">
                   <p className="text-[9px] font-black text-slate-500 text-center uppercase tracking-widest">أو أدخل الكود يدوياً</p>
                   <div className="bg-black/40 rounded-2xl border border-white/10 p-5 space-y-4 relative">
                      <code className="block text-center text-sm font-mono font-black text-[#D1A23D] break-all leading-relaxed px-2">
                        {tempSecret}
                      </code>
                      <button 
                        onClick={copySecret}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                      >
                         <span className="text-xs">📋</span>
                         <span className="text-[10px] font-black uppercase">نسخ المفتاح</span>
                      </button>
                   </div>
                </div>

                <div className="w-full space-y-4 pt-2">
                   <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
                      <input 
                        type="text" maxLength={6} placeholder="000000" value={verifyCode}
                        onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full p-5 bg-transparent text-center font-mono font-black text-3xl outline-none text-white tracking-[0.3em]" 
                      />
                   </div>
                   <button 
                     onClick={handleVerify2FA}
                     disabled={isVerifying || verifyCode.length !== 6}
                     className="w-full h-16 bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center"
                   >
                     {isVerifying ? "..." : t.verify}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* 4. بروتوكول العرض الأمني */}
      <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
         <div className="flex justify-between items-center border-b border-slate-50 pb-6">
            <div className="text-right">
               <h3 className="text-2xl font-black text-slate-800">بروتوكول العرض الأمني</h3>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl">📡</div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
               onClick={() => updateProtocol('FULL')}
               className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${currentProtocol === 'FULL' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}
            >
               <span className="text-3xl">🚨</span>
               <p className="font-black text-[10px]">شاشة طوارئ</p>
            </button>
            <button 
               onClick={() => updateProtocol('SIMPLE')}
               className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${currentProtocol === 'SIMPLE' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}
            >
               <span className="text-3xl">🔔</span>
               <p className="font-black text-[10px]">إشعارات فقط</p>
            </button>
            <button 
               onClick={() => updateProtocol('NONE')}
               className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${currentProtocol === 'NONE' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}
            >
               <span className="text-3xl">🔕</span>
               <p className="font-black text-[10px]">صامت</p>
            </button>
         </div>
      </section>

      {/* 5. مفتاح الربط */}
      <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center gap-6">
           <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">🔑</div>
           <div>
              <h3 className="text-2xl font-black text-[#D1A23D]">مفتاح الربط</h3>
              <p className="text-slate-400 font-bold text-xs mt-1">أدخل الرمز في تطبيق الطفل.</p>
           </div>
           <div className="bg-black/40 p-6 rounded-2xl border border-white/10 flex items-center gap-6">
              <code className="text-4xl font-mono font-black tracking-widest">{pairingKey}</code>
              <button onClick={() => navigator.clipboard.writeText(pairingKey.replace('-',''))} className="p-3 bg-white/5 rounded-xl text-[#D1A23D]"><ICONS.Rocket className="w-6 h-6" /></button>
           </div>
        </div>
      </section>

      {/* 6. عرض الأجهزة */}
      <section className="space-y-4">
        <h3 className="text-xl font-black text-slate-900 px-4">{t.devices}</h3>
        <div className="grid grid-cols-1 gap-4">
          {children.map(child => (
            <div key={child.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm border-r-8 border-emerald-500">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">📱</div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase">{child.name}</p>
                     <p className="text-md font-black text-slate-800">Connected</p>
                  </div>
               </div>
               <button onClick={() => onDeleteMember(child.id, 'CHILD')} className="p-4 text-slate-300 hover:text-red-600 transition-colors">
                  <ICONS.Trash />
               </button>
            </div>
          ))}
        </div>
      </section>

      {/* 7. تنظيف البيانات */}
      <section className="bg-red-50 rounded-[2.5rem] p-8 border-2 border-dashed border-red-200 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-right">
             <h3 className="text-xl font-black text-red-900">تنظيف البيانات</h3>
             <p className="text-red-600 font-bold text-xs">حذف كافة الأجهزة الوهمية تماماً.</p>
          </div>
          <button 
            onClick={handlePurgeData} disabled={isProcessing}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg"
          >
            حذف البيانات
          </button>
      </section>
    </div>
  );
};

export default SettingsView;

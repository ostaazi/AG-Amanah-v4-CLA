
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
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
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

  const handleSaveMemberUpdate = async () => {
    if (!editingMember || isUpdating) return;
    setIsUpdating(true);
    try {
        const role = editingMember.role || 'CHILD';
        const updates: any = {
            name: editingMember.name,
            role: role
        };
        if ((role === 'CHILD' || editingMember.age !== undefined) && editingMember.age !== '') {
            updates.age = Number(editingMember.age);
        }
        
        await onUpdateMember(editingMember.id, role, updates);
        showSuccessToast(lang === 'ar' ? "تم تحديث البيانات بنجاح" : "Member updated successfully");
        setEditingMember(null);
        await loadSupervisors(); 
    } catch (e) {
        alert("Update Failed");
    } finally {
        setIsUpdating(false);
    }
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
               <div className="flex items-center gap-6 flex-1 min-w-0">
                  {/* حاوية الأفاتار مع flex-shrink-0 لمنع أي اجتزاء أو ضغط */}
                  <div className="relative flex-shrink-0">
                    <img src={member.avatar || FALLBACK_ASSETS.CHILD} className="w-20 h-20 rounded-full object-cover shadow-md border-2 border-white/50" />
                    {member.role === 'ADMIN' && (
                      <div className="absolute bottom-0 -left-1 w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 border border-slate-50 shadow-sm">
                        <AdminShieldBadge className="w-full h-full" />
                      </div>
                    )}
                  </div>

                  {/* مجموعة البيانات - تم توحيد المحاذاة الأفقية لكل الأعضاء */}
                  <div className="min-w-0 flex-1">
                     <h4 className="font-black text-slate-800 text-xl leading-tight truncate">{member.name}</h4>
                     
                     <div className="flex flex-wrap items-center gap-3 mt-2">
                        {/* الدور (ADMIN / SUPERVISOR / CHILD) */}
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${
                          member.role === 'ADMIN' ? 'bg-[#8A1538]/10 text-[#8A1538]' : 
                          member.role === 'SUPERVISOR' ? 'bg-indigo-50 text-indigo-600' : 
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {member.role || 'CHILD'}
                        </span>

                        {/* العمر - يظهر للأطفال فقط وبنفس المحاذاة */}
                        {(member.role === 'CHILD' || (member.age && member.role !== 'ADMIN')) && (
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap">
                            {lang === 'ar' ? 'العمر:' : 'Age:'} {member.age || '--'} {lang === 'ar' ? 'سنة' : 'Yrs'}
                          </span>
                        )}

                        {/* حالة الاتصال - تظهر للأطفال فقط */}
                        {member.role === 'CHILD' && (
                          <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            {lang === 'ar' ? 'متصل' : 'Online'}
                          </span>
                        )}
                     </div>
                  </div>
               </div>

               {/* أزرار التحكم - بحجم صغير وأنيق */}
               <div className="flex gap-2.5 items-center mr-2">
                  {member.role === 'CHILD' && (
                    <button onClick={() => setShowPairingModal(member)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group" title="إدارة الأجهزة">
                      <div className="scale-90"><ICONS.Devices /></div>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setEditingMember(member)} 
                    className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm group"
                    title="تعديل العضو"
                  >
                    <div className="scale-90 group-hover:rotate-90 transition-transform duration-500">
                      <ICONS.Settings />
                    </div>
                  </button>

                  {member.id !== currentUser.id && (
                    <button onClick={() => onDeleteMember(member.id, member.role || 'CHILD')} className="p-2.5 bg-red-50 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm group" title="حذف العضو">
                      <div className="scale-90"><ICONS.Trash /></div>
                    </button>
                  )}
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* باقي الأقسام تبقى كما هي... */}
      {editingMember && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border-4 border-white animate-in zoom-in-95">
             <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black tracking-tight">تعديل الملف الشخصي</h3>
                <button onClick={() => setEditingMember(null)} className="text-white/60 hover:text-white"><ICONS.Close /></button>
             </div>
             <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center gap-4">
                   <img src={editingMember.avatar} className="w-24 h-24 rounded-full object-cover bg-slate-50 shadow-inner border-2 border-slate-100" />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تعديل البيانات الأساسية</p>
                </div>
                
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-right block">الاسم المعروض</label>
                   <input 
                     value={editingMember.name} 
                     onChange={(e) => setEditingMember({...editingMember, name: e.target.value})}
                     className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold focus:border-indigo-500 transition-all text-right"
                   />
                </div>

                {(editingMember.role === 'CHILD' || !editingMember.role || editingMember.age !== undefined) && (
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-right block">العمر</label>
                     <input 
                       type="number"
                       value={editingMember.age || ''} 
                       onChange={(e) => setEditingMember({...editingMember, age: e.target.value})}
                       className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold focus:border-indigo-500 transition-all text-right"
                       placeholder="مثال: 12"
                     />
                  </div>
                )}

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-right block">رتبة الوصول (Role)</label>
                   <div className="grid grid-cols-2 gap-3">
                      {['SUPERVISOR', 'CHILD'].map((r) => (
                        <button 
                          key={r}
                          onClick={() => setEditingMember({...editingMember, role: r as UserRole})}
                          className={`py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${editingMember.role === r ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                        >
                          {r}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="pt-4 flex gap-4">
                   <button 
                     onClick={handleSaveMemberUpdate}
                     disabled={isUpdating}
                     className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl disabled:opacity-50"
                   >
                     {isUpdating ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                   </button>
                   <button onClick={() => setEditingMember(null)} className="px-6 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-sm">إلغاء</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;

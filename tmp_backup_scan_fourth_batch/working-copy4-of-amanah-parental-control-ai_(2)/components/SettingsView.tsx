
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS, AdminShieldBadge } from '../constants';
import { ParentAccount, Child, FamilyMember, UserRole } from '../types';
import { translations } from '../translations';
import { 
  fetchSupervisors, 
  updateMemberInDB
} from '../services/firestoreService';
import { clearAllUserData } from '../services/mockDataService';

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
  currentUser, children, lang, onUpdateMember, onDeleteMember, showSuccessToast 
}) => {
  const t = translations[lang];
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);

  useEffect(() => {
    if (currentUser?.id) loadSupervisors();
  }, [currentUser?.id]);

  const loadSupervisors = async () => {
    const data = await fetchSupervisors(currentUser.id);
    setSupervisors(data);
  };

  const handlePurgeData = async () => {
    if (!window.confirm("⚠️ حذف كافة البيانات الوهمية؟")) return;
    setIsProcessing(true);
    await clearAllUserData(currentUser.id);
    window.location.reload();
  };

  // وظيفة خاصة للمطورين لتبديل الأدوار للاختبار
  const toggleRole = async (member: any) => {
    const roles: UserRole[] = ['ADMIN', 'SUPERVISOR', 'DEVELOPER', 'SRE', 'SOC_ANALYST', 'RELEASE_MANAGER', 'PLATFORM_ADMIN'];
    const currentIndex = roles.indexOf(member.role);
    const nextRole = roles[(currentIndex + 1) % roles.length];
    
    setIsProcessing(true);
    await onUpdateMember(member.id, nextRole, { role: nextRole });
    showSuccessToast(`تم تغيير الرتبة إلى: ${nextRole}`);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-48 pt-6 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      <section className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(209,162,61,0.15)_0%,transparent_60%)]"></div>
        <div className="relative z-10 space-y-8 text-center md:text-right">
           <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-[#D1A23D]/10 rounded-3xl flex items-center justify-center text-5xl border border-[#D1A23D]/30 shadow-[0_0_30px_rgba(209,162,61,0.2)]">🔑</div>
              <div className="flex-1">
                 <h3 className="text-3xl font-black tracking-tight text-[#D1A23D]">مفتاح الربط السريع</h3>
                 <p className="text-slate-300 font-bold text-sm mt-1">أدخل الرمز أدناه في تطبيق الطفل لتبدأ الحماية.</p>
              </div>
           </div>
           <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/10 flex justify-center items-center">
              <code className="text-5xl font-mono font-black tracking-widest text-white">{currentUser.pairingKey || '----'}</code>
           </div>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-2xl font-black text-slate-900 px-4">إدارة الهويات والأدوار</h3>
        <div className="grid grid-cols-1 gap-4">
          {[currentUser, ...supervisors].map((member: any) => (
            <div key={member.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm group">
               <div className="flex items-center gap-6">
                  <div className="relative">
                    <img src={member.avatar} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-xl" />
                    {member.role === 'ADMIN' && <div className="absolute -bottom-2 -left-2 w-8 h-8"><AdminShieldBadge /></div>}
                  </div>
                  <div>
                     <h4 className="font-black text-slate-800 text-lg leading-none mb-1">{member.name}</h4>
                     <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-md uppercase tracking-widest ${member.role.includes('ADMIN') ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                           {member.role.replace('_', ' ')}
                        </span>
                        {/* زر تبديل الدور للاختبار - يظهر فقط للمسؤولين */}
                        {(currentUser.role === 'PLATFORM_ADMIN' || currentUser.role === 'DEVELOPER') && (
                          <button onClick={() => toggleRole(member)} className="text-[8px] font-black text-slate-400 hover:text-indigo-600 underline">تبديل الرتبة للاختبار</button>
                        )}
                     </div>
                  </div>
               </div>
               <button onClick={() => setEditingMember(member)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                  <ICONS.Settings />
               </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-red-50 rounded-[3rem] p-10 border-2 border-dashed border-red-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-right">
          <div>
             <h3 className="text-2xl font-black text-red-900">منطقة الصيانة</h3>
             <p className="text-red-600 font-bold text-sm">حذف كافة الأجهزة والبيانات المرتبطة بهذا الحساب.</p>
          </div>
          <button onClick={handlePurgeData} disabled={isProcessing} className="px-10 py-5 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all">
            تفريغ كافة البيانات
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsView;

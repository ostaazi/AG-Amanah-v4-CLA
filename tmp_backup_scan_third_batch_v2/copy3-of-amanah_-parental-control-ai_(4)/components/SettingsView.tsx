
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS, AdminShieldBadge, AmanahShield } from '../constants';
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
  currentUser, children, lang, onUpdateMember, onDeleteMember, onAddChild, onAddSupervisor, showSuccessToast 
}) => {
  const t = translations[lang];
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);

  // توليد مفتاح ربط سريع (8 رموز) مشتق من المعرف الفريد
  const pairingKey = useMemo(() => {
    const raw = currentUser.id.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const part1 = raw.substring(0, 4);
    const part2 = raw.substring(raw.length - 4);
    return `${part1}-${part2}`; // مثال: AM89-X21A (8 رموز مع شرطة)
  }, [currentUser.id]);

  useEffect(() => {
    loadSupervisors();
  }, [currentUser.id]);

  const loadSupervisors = async () => {
    const data = await fetchSupervisors(currentUser.id);
    setSupervisors(data);
  };

  const handlePurgeData = async () => {
    const confirmed = window.confirm(lang === 'ar' 
      ? "⚠️ هل أنت متأكد من حذف كافة الأجهزة والبيانات الوهمية؟ سيتم تنظيف لوحة التحكم تماماً." 
      : "Are you sure you want to delete all mock devices and data? This will clean your dashboard.");
    
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await clearAllUserData(currentUser.id);
      showSuccessToast(lang === 'ar' ? "تم تنظيف النظام بنجاح! اللوحة جاهزة للربط الحقيقي." : "System Purged! Ready for real linking.");
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPairingKey = () => {
    navigator.clipboard.writeText(pairingKey.replace('-', ''));
    showSuccessToast(lang === 'ar' ? "تم نسخ مفتاح الربط! أدخله الآن في هاتف طفلك." : "Pairing Key Copied!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-48 pt-6 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* 🔐 قسم مفتاح الربط السريع (8 رموز) - FAST PAIRING HUB */}
      <section className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(209,162,61,0.15)_0%,transparent_60%)]"></div>
        <div className="relative z-10 space-y-8 text-center md:text-right">
           <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-[#D1A23D]/10 rounded-3xl flex items-center justify-center text-5xl border border-[#D1A23D]/30 shadow-[0_0_30px_rgba(209,162,61,0.2)]">🔑</div>
              <div className="flex-1">
                 <h3 className="text-3xl font-black tracking-tight text-[#D1A23D]">مفتاح الربط السريع</h3>
                 <p className="text-slate-300 font-bold text-sm mt-1">أدخل هذا الرمز المكون من 8 رموز في تطبيق "Amanah Shield" على هاتف طفلك.</p>
              </div>
           </div>

           <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/10 flex flex-col md:flex-row justify-between items-center gap-8 shadow-inner">
              <div className="flex-1">
                 <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 mb-3">PAIRING_TOKEN_8_SYMBOLS</p>
                 <div className="flex items-center justify-center md:justify-start gap-4">
                    <code className="text-5xl font-mono font-black tracking-widest text-white">{pairingKey}</code>
                    <button onClick={copyPairingKey} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-[#D1A23D]">
                       <ICONS.Rocket className="w-8 h-8" />
                    </button>
                 </div>
              </div>
              <div className="bg-white text-slate-900 p-8 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-2xl min-w-[200px]">
                 <p className="text-[10px] font-black uppercase text-slate-400">حالة المفتاح</p>
                 <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="text-xl font-black">نشط الآن</span>
                 </div>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                 <span className="text-xl">1️⃣</span>
                 <p className="text-[10px] font-bold text-slate-400">افتح التطبيق في هاتف طفلك</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                 <span className="text-xl">2️⃣</span>
                 <p className="text-[10px] font-bold text-slate-400">اضغط على "ربط الجهاز"</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                 <span className="text-xl">3️⃣</span>
                 <p className="text-[10px] font-bold text-slate-400">أدخل الرمز أعلاه واضغط تأكيد</p>
              </div>
           </div>
        </div>
      </section>

      {/* 🛡️ إدارة الأجهزة المتصلة - Connected Devices Hub */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-4">
           <div>
              <h3 className="text-2xl font-black text-slate-900">الأجهزة المرتبطة حالياً</h3>
              <p className="text-slate-400 font-bold text-xs mt-1">تتبع حالة العتاد والاتصال للأجهزة النشطة.</p>
           </div>
           <span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black">إجمالي الأجهزة: {children.length}</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {children.length > 0 ? children.map(child => (
            <div key={child.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between shadow-sm hover:shadow-md transition-all border-r-[12px] border-emerald-500 group">
               <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-emerald-100 group-hover:scale-110 transition-transform">
                      📱
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full animate-pulse shadow-lg"></div>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">جهاز {child.name}</p>
                     <p className="text-xl font-black text-slate-800 tracking-tight leading-none mb-2">Android Mobile Sync</p>
                     <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-lg">
                           <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                           <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">نشط الآن</span>
                        </div>
                        <span className="text-slate-200 text-xs">|</span>
                        <div className="flex items-center gap-1.5">
                           <span className="text-xl">🔋</span>
                           <span className="text-xs font-black text-slate-500">{child.batteryLevel}%</span>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="flex gap-3 mt-6 md:mt-0">
                  <button onClick={() => showSuccessToast("جاري فحص حالة الأمان...")} className="p-5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100">
                     <ICONS.Shield className="w-6 h-6" />
                  </button>
                  <button onClick={() => onDeleteMember(child.id, 'CHILD')} className="p-5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all">
                     <ICONS.Trash className="w-6 h-6" />
                  </button>
               </div>
            </div>
          )) : (
            <div className="p-16 text-center bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-200 flex flex-col items-center">
               <div className="text-6xl mb-6 grayscale opacity-30 animate-bounce">📡</div>
               <p className="font-black text-slate-400 text-lg">لا توجد أجهزة مرتبطة حالياً.</p>
               <p className="text-xs font-bold text-slate-300 mt-2 italic">استخدم مفتاح الربط السريع (8 رموز) أعلاه للبدء.</p>
            </div>
          )}
        </div>
      </section>

      {/* ⚠️ منطقة الخطر - Danger Zone (لحذف البيانات الوهمية) */}
      <section className="bg-red-50 rounded-[3rem] p-10 border-2 border-dashed border-red-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-right">
             <h3 className="text-2xl font-black text-red-900">تنظيف البيانات التجريبية</h3>
             <p className="text-red-600 font-bold text-sm">سيتم حذف كافة الأجهزة والرسائل الوهمية لتجهيز اللوحة للعمل الحقيقي.</p>
          </div>
          <button 
            onClick={handlePurgeData}
            disabled={isProcessing}
            className="px-10 py-5 bg-red-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
          >
            {isProcessing ? "جاري التنظيف..." : "حذف الأجهزة الوهمية تماماً"}
          </button>
        </div>
      </section>

      {/* إدارة العائلة (المدير والمشرفين) */}
      <section className="space-y-6">
        <h3 className="text-2xl font-black text-slate-900 px-4">إدارة المشرفين والعائلة</h3>
        <div className="grid grid-cols-1 gap-4">
          {[currentUser, ...supervisors].map((member: any) => (
            <div key={member.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
               <div className="flex items-center gap-6">
                  <div className="relative">
                    <img src={member.avatar} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-xl" />
                    {member.role === 'ADMIN' && (
                      <div className="absolute -bottom-2 -left-2 w-8 h-8">
                        <AdminShieldBadge />
                      </div>
                    )}
                  </div>
                  <div>
                     <h4 className="font-black text-slate-800 text-lg leading-none mb-1">{member.name}</h4>
                     <span className={`text-[9px] font-black px-3 py-1 rounded-md uppercase tracking-widest ${member.role === 'ADMIN' ? 'bg-[#8A1538]/10 text-[#8A1538]' : 'bg-indigo-50 text-indigo-600'}`}>
                        {member.role === 'ADMIN' ? 'المدير الرئيسي' : 'مشرف مراقب'}
                     </span>
                  </div>
               </div>
               <button onClick={() => setEditingMember(member)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600">
                  <ICONS.Settings />
               </button>
            </div>
          ))}
        </div>
      </section>

      {/* نافذة التعديل */}
      {editingMember && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden border-4 border-white text-right">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <button onClick={() => setEditingMember(null)} className="text-white/60 hover:text-white"><ICONS.Close /></button>
                 <h3 className="text-2xl font-black">تعديل الملف</h3>
              </div>
              <div className="p-10 space-y-8">
                 <input 
                   value={editingMember.name} 
                   onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} 
                   className="w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-right text-xl focus:border-indigo-500" 
                 />
                 <button className="w-full py-6 bg-[#8A1538] text-white rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-all">حفظ البيانات</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;

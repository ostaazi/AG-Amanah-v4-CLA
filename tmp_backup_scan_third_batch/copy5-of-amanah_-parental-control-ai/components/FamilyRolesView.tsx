
import React, { useState } from 'react';
import { ParentAccount, UserRole, FamilyMember } from '../types';
import { ICONS, AdminShieldBadge } from '../constants';
import { canPerform } from '../services/rbacService';

const FamilyRolesView: React.FC<{ currentUser: ParentAccount }> = ({ currentUser }) => {
  const [members, setMembers] = useState<FamilyMember[]>([
    { id: 'p1', name: 'أحمد (الوالد)', role: 'FAMILY_OWNER', avatar: 'https://i.pravatar.cc/150?u=father' },
    { id: 'm1', name: 'سارة (الوالدة)', role: 'FAMILY_COADMIN', avatar: 'https://i.pravatar.cc/150?u=mother' },
    { id: 'a1', name: 'د. خالد (المستشار)', role: 'FAMILY_AUDITOR', avatar: 'https://i.pravatar.cc/150?u=doc' }
  ]);

  const roles: { id: UserRole, label: string, desc: string, color: string }[] = [
    { id: 'FAMILY_OWNER', label: 'رب الأسرة (Owner)', desc: 'صلاحيات مطلقة: حذف، تصدير، وتغيير الأذونات.', color: 'bg-red-600' },
    { id: 'FAMILY_COADMIN', label: 'مشرف محدود (Co-Admin)', desc: 'تحكم تشغيلي كامل ما عدا الحذف والتصدير.', color: 'bg-indigo-600' },
    { id: 'FAMILY_AUDITOR', label: 'مراقب (Auditor)', desc: 'للاطلاع فقط على التقارير والأدلة دون تدخل.', color: 'bg-emerald-600' },
    { id: 'EMERGENCY_GUARDIAN', label: 'وصي طوارئ', desc: 'صلاحية محدودة جداً تُفعل عند غياب الوالدين.', color: 'bg-amber-600' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="text-right space-y-2">
         <h2 className="text-4xl font-black text-slate-900 tracking-tighter">إدارة العائلة والأدوار</h2>
         <p className="text-slate-500 font-bold">تحكم في من يشاهد الأدلة ومن يملك سلطة القفل.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-7 space-y-6">
            <h3 className="text-xl font-black text-slate-800 px-4">الأعضاء الحاليين</h3>
            <div className="space-y-4">
               {members.map(member => (
                 <div key={member.id} className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                       <div className="relative">
                          <img src={member.avatar} className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-xl" />
                          {member.role === 'FAMILY_OWNER' && <div className="absolute -bottom-2 -left-2 w-8 h-8"><AdminShieldBadge /></div>}
                       </div>
                       <div>
                          <h4 className="font-black text-slate-800 text-lg">{member.name}</h4>
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full text-white mt-1 inline-block ${roles.find(r => r.id === member.role)?.color || 'bg-slate-400'}`}>
                             {member.role.replace('_', ' ')}
                          </span>
                       </div>
                    </div>
                    {canPerform(currentUser.role, 'member.update_role') && member.role !== 'FAMILY_OWNER' && (
                       <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm group-hover:scale-105 active:scale-95"><ICONS.Settings /></button>
                    )}
                 </div>
               ))}
            </div>
         </div>

         <div className="lg:col-span-5 space-y-8">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl space-y-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl"></div>
               <h3 className="text-2xl font-black relative z-10">مصفوفة الصلاحيات</h3>
               <div className="space-y-6 relative z-10">
                  {roles.map(role => (
                    <div key={role.id} className="space-y-1">
                       <p className="text-sm font-black text-indigo-300">{role.label}</p>
                       <p className="text-[10px] font-bold text-slate-400 leading-relaxed">{role.desc}</p>
                    </div>
                  ))}
               </div>
            </div>

            <button className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4">
               <span>➕</span>
               دعوة عضو جديد
            </button>
         </div>
      </div>
    </div>
  );
};

export default FamilyRolesView;

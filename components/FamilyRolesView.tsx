import React, { useEffect, useMemo, useState } from 'react';
import { Child, FamilyMember, ParentAccount, UserRole } from '../types';
import { fetchSupervisors } from '../services/firestoreService';

interface FamilyRolesViewProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
  children: Child[];
  onUpdateMember: (id: string, role: UserRole, updates: Partial<FamilyMember>) => Promise<void> | void;
}

const childRoleOptions: UserRole[] = ['CHILD', 'SUPERVISOR', 'ADMIN'];
const supervisorRoleOptions: UserRole[] = ['SUPERVISOR', 'ADMIN'];

const labelForRole = (role: UserRole, lang: 'ar' | 'en') => {
  if (lang === 'ar') {
    if (role === 'ADMIN') return 'مدير';
    if (role === 'SUPERVISOR') return 'مشرف';
    if (role === 'CHILD') return 'طفل';
    return role;
  }
  if (role === 'ADMIN') return 'Admin';
  if (role === 'SUPERVISOR') return 'Supervisor';
  if (role === 'CHILD') return 'Child';
  return role;
};

const FamilyRolesView: React.FC<FamilyRolesViewProps> = ({
  lang,
  currentUser,
  children,
  onUpdateMember,
}) => {
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');

  const t = useMemo(
    () => ({
      title: lang === 'ar' ? 'أدوار العائلة' : 'Family Roles',
      subtitle:
        lang === 'ar'
          ? 'تعديل الرتبة أو الوظيفة للأبناء والمشرفين'
          : 'Edit role/function for children and supervisors',
      owner: lang === 'ar' ? 'مالك العائلة' : 'Family Owner',
      children: lang === 'ar' ? 'الأبناء' : 'Children',
      supervisors: lang === 'ar' ? 'المشرفون' : 'Supervisors',
      emptyChildren: lang === 'ar' ? 'لا يوجد أبناء مضافون.' : 'No children added yet.',
      emptySupervisors: lang === 'ar' ? 'لا يوجد مشرفون.' : 'No supervisors found.',
      refresh: lang === 'ar' ? 'تحديث القائمة' : 'Refresh',
      saving: lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...',
    }),
    [lang]
  );

  const loadSupervisors = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSupervisors(currentUser.id);
      setSupervisors(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSupervisors();
  }, [currentUser.id]);

  const updateChildRole = async (childId: string, nextRole: UserRole) => {
    const key = `child-${childId}`;
    setBusyKey(key);
    try {
      await onUpdateMember(childId, 'CHILD', { role: nextRole });
    } finally {
      setBusyKey('');
    }
  };

  const updateSupervisorRole = async (supervisorId: string, nextRole: UserRole) => {
    const key = `sup-${supervisorId}`;
    setBusyKey(key);
    try {
      await onUpdateMember(supervisorId, 'SUPERVISOR', { role: nextRole });
      setSupervisors((prev) =>
        prev.map((member) => (member.id === supervisorId ? { ...member, role: nextRole } : member))
      );
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="bg-slate-900 text-white p-8 rounded-[3rem] border-b-4 border-indigo-500">
        <h2 className="text-3xl font-black tracking-tight">{t.title}</h2>
        <p className="text-indigo-200 font-bold mt-2">{t.subtitle}</p>
      </section>

      <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 space-y-5">
        <article className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <p className="text-sm font-black text-slate-500 mb-2">{t.owner}</p>
          <p className="text-lg font-black text-slate-900">{currentUser.name}</p>
          <p className="text-xs font-bold text-slate-500 mt-1">{labelForRole(currentUser.role, lang)}</p>
        </article>

        <article className="space-y-3">
          <h3 className="text-lg font-black text-slate-800">{t.children}</h3>
          {children.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-slate-400 font-black text-center">
              {t.emptyChildren}
            </div>
          ) : (
            children.map((child) => {
              const key = `child-${child.id}`;
              return (
                <div
                  key={child.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-black text-slate-900">{child.name}</p>
                    <p className="text-xs font-bold text-slate-500">{child.deviceNickname || child.model || '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {childRoleOptions.map((roleOption) => (
                      <button
                        key={roleOption}
                        disabled={busyKey === key}
                        onClick={() => updateChildRole(child.id, roleOption)}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-50 ${
                          (child.role || 'CHILD') === roleOption
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {labelForRole(roleOption, lang)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </article>

        <article className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800">{t.supervisors}</h3>
            <button
              onClick={loadSupervisors}
              className="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 text-slate-600 bg-white"
            >
              {isLoading ? t.saving : t.refresh}
            </button>
          </div>
          {!isLoading && supervisors.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-slate-400 font-black text-center">
              {t.emptySupervisors}
            </div>
          ) : (
            supervisors.map((member) => {
              const key = `sup-${member.id}`;
              return (
                <div
                  key={member.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="font-black text-slate-900">{member.name}</p>
                    <p className="text-xs font-bold text-slate-500">{member.email || '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {supervisorRoleOptions.map((roleOption) => (
                      <button
                        key={roleOption}
                        disabled={busyKey === key}
                        onClick={() => updateSupervisorRole(member.id, roleOption)}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-50 ${
                          (member.role || 'SUPERVISOR') === roleOption
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {labelForRole(roleOption, lang)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </article>
      </section>
    </div>
  );
};

export default FamilyRolesView;

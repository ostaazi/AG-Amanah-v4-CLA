
'use client';

import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUnreadCount } from '../../hooks/useUnreadCount';

type SidebarItem = {
  key: string;
  label: string;
  href: string;
  hint: string;
  icon: string;
};

export default function ParentSidebar({ familyId }: { familyId: string }) {
  const location = useLocation();
  const pathname = location.pathname;
  const unreadCount = useUnreadCount(familyId);

  const items = useMemo<SidebarItem[]>(() => {
    const fid = encodeURIComponent(familyId);
    return [
      { key: 'dashboard', label: 'لوحة التحكم', href: `/`, hint: 'نظرة شاملة', icon: '📊' },
      { key: 'notifs', label: 'مركز الإشعارات', href: `/families/${fid}/notifications`, hint: 'التنبيهات اللحظية', icon: '🔔' },
      { key: 'incidents', label: 'مركز الحوادث', href: `/families/${fid}/incidents`, hint: 'رصد الاستجابة', icon: '🚨' },
      { key: 'exports', label: 'حزم التصدير', href: `/families/${fid}/exports`, hint: 'الأدلة الجنائية', icon: '📜' },
      { key: 'verify', label: 'التحقق من الأدلة', href: `/parent/verify`, hint: 'نزاهة الملفات', icon: '⚖️' },
      { key: 'vault', label: 'الخزنة المركزية', href: `/families/${fid}/vault`, hint: 'أرشيف الوسائط', icon: '🏛️' },
      { key: 'devices', label: 'إدارة الأجهزة', href: `/families/${fid}/devices`, hint: 'التتبع والتحكم', icon: '📱' },
      { key: 'geofence', label: 'المناطق الآمنة', href: `/families/${fid}/geofence`, hint: 'السياج الجغرافي', icon: '📍' },
      { key: 'profiles', label: 'الملفات الذكية', href: `/families/${fid}/profiles`, hint: 'جدولة القيود', icon: '⚡' },
      { key: 'policy', label: 'سياسة الدفاع', href: `/families/${fid}/policy`, hint: 'الاستجابة التلقائية', icon: '🛡️' },
      { key: 'settings', label: 'إعدادات العائلة', href: `/families/${fid}/settings`, hint: 'الأعضاء والأدوار', icon: '⚙️' },
    ];
  }, [familyId]);

  const isActive = (href: string) => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <aside className="sticky top-28 w-72 shrink-0 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden hidden xl:flex flex-col" dir="rtl">
      <div className="p-6 border-b border-slate-50 bg-slate-50/50">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معرف العائلة النشط</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="font-mono text-xs font-black text-indigo-600 truncate">{familyId}</span>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const isNotif = item.key === 'notifs';
          return (
            <Link
              key={item.key}
              to={item.href}
              className={`group flex items-center gap-4 p-4 rounded-2xl transition-all border-2 ${
                active 
                ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-[1.02]' 
                : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-100'
              }`}
            >
              <div className="relative">
                <span className={`text-2xl transition-transform group-hover:scale-110 ${active ? 'grayscale-0' : 'grayscale opacity-70'}`}>
                  {item.icon}
                </span>
                {isNotif && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                    {unreadCount > 9 ? '+9' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col overflow-hidden text-right flex-1">
                <span className={`text-sm font-black leading-none mb-1 ${active ? 'text-white' : 'text-slate-800'}`}>
                  {item.label}
                </span>
                <span className={`text-[9px] font-bold truncate ${active ? 'text-indigo-300' : 'text-slate-400'}`}>
                  {item.hint}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-50">
        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">حالة النزاهة</p>
          <p className="text-[9px] font-bold text-indigo-400 leading-tight">كافة العمليات مسجلة في سجل الحيازة الجنائية الدائم.</p>
        </div>
      </div>
    </aside>
  );
}

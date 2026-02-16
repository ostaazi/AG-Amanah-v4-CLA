
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS, AmanahShield } from '../../constants';

export default function NotificationCenterView({ familyId }: { familyId: string }) {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/notifications/list?severity=${filter === 'all' ? '' : filter}&unread=${unreadOnly ? '1' : '0'}`);
      const data = await res.json();
      if (data.ok) setNotifs(data.items);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifs(); }, [filter, unreadOnly]);

  const markRead = async (id?: string) => {
    await fetch(`/api/families/${familyId}/notifications/mark-read`, {
      method: 'POST',
      body: JSON.stringify(id ? { notif_id: id } : { all: true })
    });
    fetchNotifs();
  };

  const badgeClass = (sev: string) => {
    if (sev === 'critical') return 'bg-red-600 text-white shadow-red-200';
    if (sev === 'warning') return 'bg-amber-500 text-white shadow-amber-200';
    return 'bg-indigo-600 text-white shadow-indigo-200';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <div className="bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-white/10">🔔</div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">مركز التنبيهات السيادي</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg uppercase tracking-widest">Sovereign Notification Hub</p>
               </div>
            </div>
            <button 
              onClick={() => markRead()}
              className="bg-white text-slate-900 px-12 py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all hover:bg-slate-50"
            >
               قراءة الكل
            </button>
         </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
         {[
           { id: 'all', label: 'كافة التنبيهات', icon: '📋' },
           { id: 'critical', label: 'الحرجة فقط', icon: '🚨' },
           { id: 'warning', label: 'تحذيرات', icon: '⚠️' }
         ].map(t => (
           <button 
             key={t.id} onClick={() => setFilter(t.id)}
             className={`px-10 py-5 rounded-[2rem] font-black text-sm whitespace-nowrap transition-all border-2 ${filter === t.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
           >
              <span className="ml-3">{t.icon}</span>
              {t.label}
           </button>
         ))}
         <button 
           onClick={() => setUnreadOnly(!unreadOnly)}
           className={`px-10 py-5 rounded-[2rem] font-black text-sm whitespace-nowrap transition-all border-2 ${unreadOnly ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-500'}`}
         >
            {unreadOnly ? '👁️ عرض الكل' : '🌑 غير المقروء فقط'}
         </button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="p-20 text-center animate-pulse text-slate-300 font-black">جاري سحب التنبيهات من الأرشيف...</div>
        ) : notifs.length === 0 ? (
          <div className="p-20 text-center text-slate-200 font-black border-2 border-dashed border-slate-100 rounded-[3rem]">لا توجد تنبيهات تطابق المعايير.</div>
        ) : (
          notifs.map((n) => (
            <div 
              key={n.notif_id} 
              onClick={() => !n.is_read && markRead(n.notif_id)}
              className={`bg-white p-10 rounded-[3.5rem] border-2 transition-all group cursor-pointer ${n.is_read ? 'border-slate-50 opacity-70' : 'border-indigo-100 shadow-xl shadow-indigo-50'}`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                 <div className="flex items-start gap-8 flex-1">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg shrink-0 ${badgeClass(n.severity)}`}>
                       {n.severity === 'critical' ? '🔥' : n.severity === 'warning' ? '⚡' : 'ℹ️'}
                    </div>
                    <div className="text-right space-y-2">
                       <div className="flex items-center gap-4">
                          <h3 className="text-2xl font-black text-slate-800">{n.title}</h3>
                          {!n.is_read && <span className="w-3 h-3 bg-red-600 rounded-full animate-ping"></span>}
                       </div>
                       <p className="text-lg font-bold text-slate-500 leading-relaxed">{n.body}</p>
                       <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{new Date(n.created_at).toLocaleString()}</span>
                          <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-3 py-1 rounded-lg">ID: {n.notif_id.slice(0, 8)}</span>
                       </div>
                    </div>
                 </div>
                 {!n.is_read && (
                   <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg group-hover:scale-110 transition-all">تحديد كمقروء</button>
                 )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

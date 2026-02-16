
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IncidentReport, AlertSeverity, Category } from '../types';
import { ICONS } from '../constants';

const IncidentsCenterView: React.FC<{ incidents: IncidentReport[] }> = ({ incidents = [] }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const filtered = useMemo(() => {
    return (incidents || []).filter(inc => {
      const matchSearch = (inc.incident_type?.toLowerCase() || '').includes(search.toLowerCase()) || 
                          (inc.childName?.toLowerCase() || '').includes(search.toLowerCase());
      const matchSev = filterSeverity === 'ALL' || inc.severity === filterSeverity;
      return matchSearch && matchSev;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [incidents, search, filterSeverity]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">مركز الحوادث الأمنية</h2>
          <p className="text-slate-500 font-bold mt-2">مراقبة حية للدفاع الآلي وسجل الحوادث الجنائية.</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-3 font-black text-xs outline-none focus:border-indigo-500"
          >
            <option value="ALL">كافة المستويات</option>
            <option value="critical">CRITICAL</option>
            <option value="high">HIGH</option>
            <option value="med">MEDIUM</option>
          </select>
          <div className="relative">
            <input 
              type="text" placeholder="بحث في الحوادث..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-white border-2 border-slate-100 rounded-2xl px-12 py-3 font-bold text-xs outline-none focus:border-indigo-500 w-64"
            />
            <span className="absolute right-4 top-3.5 opacity-30">🔍</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered?.map(inc => (
          <div 
            key={inc.incident_id} 
            onClick={() => navigate(`/incident/${inc.incident_id}`)}
            className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer group"
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6 flex-1">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${inc.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {inc.incident_type === Category.PREDATOR ? '🐺' : inc.incident_type === Category.TAMPER ? '⚙️' : '⚠️'}
                </div>
                <div className="text-right space-y-1">
                  <h4 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{inc.incident_type}</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{inc.childName}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${inc.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-400 text-white'}`}>
                  {inc.severity}
                </span>
                <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600`}>
                  {inc.status}
                </span>
                <div className="p-3 bg-slate-50 text-slate-300 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <ICONS.Dashboard className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {filtered?.length === 0 && (
        <div className="py-20 text-center space-y-4 opacity-30">
          <div className="text-8xl">📜</div>
          <p className="font-black text-xl text-slate-400">لا توجد حوادث نشطة حالياً.</p>
        </div>
      )}
    </div>
  );
};

export default IncidentsCenterView;

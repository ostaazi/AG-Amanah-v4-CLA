
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AmanahShield } from '../constants';
import { Child, MonitoringAlert } from '../types';

interface DashboardViewProps {
  childList: Child[];
  alerts: MonitoringAlert[];
  onTriggerDemo: () => void;
  lang: 'ar' | 'en';
  parentId: string;
}

const QuickActionButton = ({ label, icon, onClick, color }: any) => (
  <button 
    onClick={onClick} 
    className={`${color} text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 shadow-lg active:scale-95 transition-all`}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

const DashboardView: React.FC<DashboardViewProps> = ({ childList = [], alerts = [], onTriggerDemo, lang, parentId }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-10 pb-44 animate-in fade-in duration-700" dir="rtl">
      
      {/* Sovereign Action Bar */}
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[4rem] border border-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-10">
         <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-[#8A1538] rounded-3xl flex items-center justify-center text-3xl shadow-2xl animate-shield-breathing">
               <AmanahShield className="w-14 h-14" />
            </div>
            <div>
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">أمانة سيفر كونسول</h2>
               <p className="text-slate-500 font-bold text-lg">نظام إدارة الأمان العائلي والتحليل الجنائي للأسطول.</p>
            </div>
         </div>
         <div className="flex gap-4">
            <QuickActionButton label="خزنة الأدلة" icon="🏛️" onClick={() => navigate(`/families/current/vault`)} color="bg-slate-950" />
            <QuickActionButton label="غرفة الحوادث" icon="🚨" onClick={() => navigate(`/families/current/incidents`)} color="bg-[#8A1538]" />
            <QuickActionButton label="تتبع حي" icon="📡" onClick={() => navigate('/location')} color="bg-emerald-600" />
         </div>
      </div>

    </div>
  );
};

export default DashboardView;

import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface PlatformSOCViewProps {
  lang: 'ar' | 'en';
}

const PlatformSOCView: React.FC<PlatformSOCViewProps> = ({ lang }) => {
  const data = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, idx) => ({
        day: idx + 1,
        threats: 18 + Math.floor(Math.random() * 50),
        incidents: 4 + Math.floor(Math.random() * 12),
      })),
    []
  );

  return (
    <div
      className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <h4 className="text-xl font-black text-slate-900">
        {lang === 'ar' ? 'لوحة SOC التشغيلية' : 'Platform SOC View'}
      </h4>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="socThreat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="socIncident" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="url(#socThreat)" />
            <Area type="monotone" dataKey="incidents" stroke="#4f46e5" fill="url(#socIncident)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PlatformSOCView;

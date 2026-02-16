import React, { useMemo, useState } from 'react';

interface GeoFenceManagerProps {
  lang: 'ar' | 'en';
}

interface GeoFence {
  id: string;
  name: string;
  radiusMeters: number;
  active: boolean;
}

const GeoFenceManager: React.FC<GeoFenceManagerProps> = ({ lang }) => {
  const [fences, setFences] = useState<GeoFence[]>([
    { id: 'home', name: lang === 'ar' ? 'منطقة المنزل' : 'Home Zone', radiusMeters: 200, active: true },
    { id: 'school', name: lang === 'ar' ? 'منطقة المدرسة' : 'School Zone', radiusMeters: 300, active: true },
  ]);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('250');

  const activeCount = useMemo(() => fences.filter((f) => f.active).length, [fences]);

  const addFence = () => {
    const trimmed = name.trim();
    const r = Number(radius);
    if (!trimmed || !Number.isFinite(r) || r <= 0) return;

    setFences((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        name: trimmed,
        radiusMeters: r,
        active: true,
      },
    ]);
    setName('');
    setRadius('250');
  };

  const toggle = (id: string) => {
    setFences((prev) => prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
  };

  return (
    <div
      className="rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm space-y-4"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-black text-slate-900">
          {lang === 'ar' ? 'إدارة المناطق الآمنة' : 'GeoFence Manager'}
        </h4>
        <span className="text-[11px] font-black text-slate-500">
          {lang === 'ar' ? `نشط: ${activeCount}` : `Active: ${activeCount}`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === 'ar' ? 'اسم المنطقة' : 'Zone Name'}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        />
        <input
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder={lang === 'ar' ? 'نصف القطر بالمتر' : 'Radius (m)'}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        />
        <button onClick={addFence} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black">
          {lang === 'ar' ? 'إضافة منطقة' : 'Add Zone'}
        </button>
      </div>

      <div className="space-y-2">
        {fences.map((fence) => (
          <button
            key={fence.id}
            onClick={() => toggle(fence.id)}
            className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between"
          >
            <span className="text-sm font-black text-slate-800">{fence.name}</span>
            <span className="text-[11px] font-bold text-slate-500">
              {fence.radiusMeters}m • {fence.active ? (lang === 'ar' ? 'مفعّل' : 'Active') : (lang === 'ar' ? 'متوقف' : 'Disabled')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GeoFenceManager;

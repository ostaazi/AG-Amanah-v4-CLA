import React, { useState, useEffect } from 'react';
import { Child, ChildLocation } from '../types';
import { ICONS } from '../constants';
import { analyzeLocationSafety } from '../services/geminiService';

interface MapViewProps {
  children: Child[];
}

const MapView: React.FC<MapViewProps> = ({ children }) => {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find((c) => c.id === selectedChildId) || children[0];
  const [intel, setIntel] = useState<{ text: string; mapsLinks: any[] } | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);

  const getSafetyAnalysis = async () => {
    if (!child.location) return;
    setLoadingIntel(true);
    const result = await analyzeLocationSafety(child.location.lat, child.location.lng);
    setIntel(result);
    setLoadingIntel(false);
  };

  useEffect(() => {
    setIntel(null);
  }, [selectedChildId]);

  return (
    <div
      className="h-[calc(100vh-180px)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-700"
      dir="rtl"
    >
      {/* Sidebar List */}
      <div className="lg:w-80 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
        <h2 className="text-2xl font-black text-slate-800 mb-2 px-2 tracking-tighter">
          تتبع العائلة
        </h2>
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedChildId(c.id)}
            className={`p-5 rounded-[2.5rem] border-2 transition-all text-right flex items-center gap-4 ${
              selectedChildId === c.id
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-100'
                : 'bg-white border-slate-50 text-slate-600 hover:border-slate-200 shadow-sm'
            }`}
          >
            <div className="relative">
              <img
                src={c.avatar}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-white"
              />
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${c.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`}
              ></div>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-black text-sm truncate">{c.name}</p>
              <p
                className={`text-[10px] font-bold ${selectedChildId === c.id ? 'text-indigo-200' : 'text-slate-400'} truncate`}
              >
                {c.location?.address || 'الموقع غير متاح'}
              </p>
            </div>
          </button>
        ))}

        {/* Legend/Info */}
        <div className="mt-auto p-6 bg-slate-900 rounded-[2.5rem] text-white space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
              نظام تحديد المواقع نشط
            </p>
          </div>
          <p className="text-[11px] font-bold leading-relaxed opacity-70">
            يتم تحديث الإحداثيات كل 30 ثانية لضمان الدقة العالية.
          </p>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 bg-white rounded-[3.5rem] shadow-2xl border-4 border-white overflow-hidden relative group">
        {child.location ? (
          <>
            <iframe
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://maps.google.com/maps?q=${child.location.lat},${child.location.lng}&z=16&output=embed`}
              className="grayscale-[0.1] contrast-[1.05]"
            ></iframe>

            {/* Top Overlay Actions */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white pointer-events-auto">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                    📍
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      الموقع الحالي
                    </p>
                    <p className="text-xs font-black text-slate-800">{child.location.address}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={getSafetyAnalysis}
                disabled={loadingIntel}
                className="bg-slate-900 text-white px-8 py-4 rounded-full font-black text-xs shadow-2xl pointer-events-auto active:scale-95 transition-all flex items-center gap-3"
              >
                {loadingIntel ? <span className="animate-spin">⏳</span> : '🧠'}
                تحليل أمان المنطقة
              </button>
            </div>

            {/* AI Insights Panel (Bottom Left) */}
            {intel && (
              <div className="absolute bottom-6 left-6 right-6 lg:right-auto lg:w-96 bg-white/95 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-indigo-100 animate-in slide-in-from-bottom-5 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest">
                    ذكاء المكان (Spatial Intel)
                  </h4>
                  <button
                    onClick={() => setIntel(null)}
                    className="text-slate-300 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-relaxed mb-6">
                  "{intel.text}"
                </p>
                {intel.mapsLinks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase">
                      مناطق آمنة قريبة:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {intel.mapsLinks.slice(0, 3).map((link, idx) => (
                        <a
                          key={idx}
                          href={link.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-[10px] font-black border border-indigo-100 hover:bg-indigo-100 transition-colors"
                        >
                          {link.title} ↗️
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-50 space-y-6">
            <div className="w-32 h-32 bg-white rounded-[3rem] shadow-xl flex items-center justify-center text-6xl opacity-20 animate-pulse">
              🌍
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-400">إحداثيات الموقع غير متوفرة</h3>
              <p className="text-xs font-bold text-slate-300">
                تأكد من تفعيل خدمة المواقع في جهاز {child.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;

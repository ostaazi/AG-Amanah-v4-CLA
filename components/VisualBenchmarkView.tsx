import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { scanImageLocally } from '../services/visualSentinel';

interface VisualBenchmarkViewProps {
  lang: 'ar' | 'en';
}

interface BenchmarkPoint {
  idx: number;
  latency: number;
}

const SAMPLE_DATA_URL = 'https://picsum.photos/320/320';

const VisualBenchmarkView: React.FC<VisualBenchmarkViewProps> = ({ lang }) => {
  const [running, setRunning] = useState(false);
  const [points, setPoints] = useState<BenchmarkPoint[]>([]);
  const [avg, setAvg] = useState(0);

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'مختبر الأداء المرئي',
            start: 'تشغيل الاختبار',
            running: 'جاري الاختبار...',
            avg: 'متوسط زمن الاستجابة',
          }
        : {
            title: 'Visual Benchmark Lab',
            start: 'Run Benchmark',
            running: 'Running benchmark...',
            avg: 'Average latency',
          },
    [lang]
  );

  const run = async () => {
    if (running) return;
    setRunning(true);
    setPoints([]);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = SAMPLE_DATA_URL;
    await new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(true);
    });

    const results: BenchmarkPoint[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await scanImageLocally(img).catch(() => null);
      const latency = performance.now() - start;
      results.push({ idx: i + 1, latency: Number(latency.toFixed(2)) });
      setPoints([...results]);
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    const mean = results.reduce((sum, item) => sum + item.latency, 0) / Math.max(results.length, 1);
    setAvg(Number(mean.toFixed(2)));
    setRunning(false);
  };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rounded-[2.5rem] bg-slate-900 text-white p-8 border-b-8 border-indigo-600 flex items-center justify-between">
        <h2 className="text-3xl font-black">{t.title}</h2>
        <button
          onClick={run}
          disabled={running}
          className="px-5 py-2 rounded-xl bg-indigo-600 font-black disabled:opacity-50"
        >
          {running ? t.running : t.start}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.avg}</p>
          <p className="mt-2 text-3xl font-black text-indigo-700">{avg || 0}ms</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 md:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points}>
                <defs>
                  <linearGradient id="benchFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="idx" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="latency" stroke="#4f46e5" fill="url(#benchFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualBenchmarkView;

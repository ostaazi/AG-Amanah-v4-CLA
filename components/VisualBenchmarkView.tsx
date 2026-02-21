import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Category } from '../types';
import { scanImageLocally } from '../services/visualSentinel';

interface VisualBenchmarkViewProps {
  lang: 'ar' | 'en';
}

interface BenchmarkPoint {
  idx: number;
  latency: number;
}

type SampleLabel = 'safe' | 'adult' | 'violence';

interface BenchmarkSample {
  id: string;
  name: string;
  dataUrl: string;
  expected: SampleLabel;
}

interface BenchmarkRunResult extends BenchmarkPoint {
  sampleId: string;
  expected: SampleLabel;
  predicted: SampleLabel;
  correct: boolean;
}

type GateSetName = 'safe-regression' | 'critical-redteam';

interface QualityGateRunRecord {
  id: string;
  set: GateSetName;
  expected: { critical: boolean };
  observed: { critical: boolean; latencyMs: number };
}

interface QualityGateReport {
  generatedAt: string;
  referenceDevice: string;
  buildVersion: string;
  runs: QualityGateRunRecord[];
}

interface BenchmarkSummary {
  total: number;
  correct: number;
  accuracy: number;
  avgLatency: number;
  p95Latency: number;
  precision: number;
  recall: number;
  f1: number;
}

const DEFAULT_SAMPLE_LABEL: SampleLabel = 'safe';

const mapPredictedLabel = (
  result: Awaited<ReturnType<typeof scanImageLocally>>
): SampleLabel => {
  if (!result?.isDanger) return 'safe';
  if (result.category === Category.VIOLENCE) return 'violence';
  if (result.category === Category.ADULT_CONTENT) return 'adult';
  // Any other danger type is treated as risky for benchmark purposes.
  return 'adult';
};

const percentile = (values: number[], pct: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((pct / 100) * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index];
};

const round2 = (value: number): number => Number(value.toFixed(2));

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });

const buildSyntheticDataUrl = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const grad = ctx.createLinearGradient(0, 0, 320, 320);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 320, 320);
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 28px sans-serif';
  ctx.fillText('Amanah Benchmark', 28, 150);
  ctx.fillStyle = '#475569';
  ctx.fillRect(30, 180, 260, 80);
  return canvas.toDataURL('image/png');
};

const emptySummary = (): BenchmarkSummary => ({
  total: 0,
  correct: 0,
  accuracy: 0,
  avgLatency: 0,
  p95Latency: 0,
  precision: 0,
  recall: 0,
  f1: 0,
});

const VisualBenchmarkView: React.FC<VisualBenchmarkViewProps> = ({ lang }) => {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<BenchmarkSample[]>([]);
  const [points, setPoints] = useState<BenchmarkPoint[]>([]);
  const [runResults, setRunResults] = useState<BenchmarkRunResult[]>([]);
  const [summary, setSummary] = useState<BenchmarkSummary>(emptySummary());
  const [errorMessage, setErrorMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  const t = useMemo(
    () =>
      lang === 'ar'
        ? {
            title: 'مختبر أداء ودقة المحرك البصري',
            start: 'تشغيل القياس',
            running: 'جارٍ القياس...',
            upload: 'رفع صور القياس',
            clear: 'تفريغ',
            addDemo: 'إضافة عينة Demo',
            expected: 'التصنيف المتوقع',
            sampleName: 'العينة',
            avg: 'متوسط زمن التحليل',
            p95: 'زمن 95%',
            accuracy: 'الدقة الكلية',
            precision: 'Precision',
            recall: 'Recall',
            f1: 'F1',
            total: 'إجمالي العينات',
            correct: 'صحيحة',
            results: 'نتائج آخر تشغيل',
            safe: 'آمن',
            adult: 'بالغين',
            violence: 'عنف',
            noSamples:
              'أضف صورًا موسومة ثم شغّل القياس. يمكنك أيضًا استخدام عينة Demo للسرعة فقط.',
            note:
              'هذا القياس يعمل محليًا Offline. الدقة الحقيقية تحتاج عينات موسومة من حالاتكم الفعلية.',
            failed: 'فشل تشغيل القياس. تحقق من الصور وحاول مرة أخرى.',
            export: 'تصدير تقرير بوابة الجودة',
            copyJson: 'نسخ JSON',
            exported: 'تم تنزيل التقرير: latest-summary.json',
            copied: 'تم نسخ JSON إلى الحافظة',
            exportFailed: 'تعذر تصدير التقرير. حاول مرة أخرى.',
          }
        : {
            title: 'Visual Engine Benchmark Lab',
            start: 'Run Benchmark',
            running: 'Running benchmark...',
            upload: 'Upload Benchmark Images',
            clear: 'Clear',
            addDemo: 'Add Demo Sample',
            expected: 'Expected Label',
            sampleName: 'Sample',
            avg: 'Average latency',
            p95: 'P95 latency',
            accuracy: 'Overall accuracy',
            precision: 'Precision',
            recall: 'Recall',
            f1: 'F1 score',
            total: 'Total samples',
            correct: 'Correct',
            results: 'Last Run Results',
            safe: 'Safe',
            adult: 'Adult',
            violence: 'Violence',
            noSamples:
              'Upload labeled images, then run benchmark. You can also add a Demo sample for latency-only checks.',
            note:
              'This benchmark runs locally Offline. Real accuracy needs labeled samples from your real incidents.',
            failed: 'Benchmark run failed. Check sample images and try again.',
            export: 'Export Quality Gate Report',
            copyJson: 'Copy JSON',
            exported: 'Report downloaded: latest-summary.json',
            copied: 'JSON copied to clipboard',
            exportFailed: 'Failed to export report. Try again.',
          },
    [lang]
  );

  const labelName = (label: SampleLabel): string => {
    if (label === 'adult') return t.adult;
    if (label === 'violence') return t.violence;
    return t.safe;
  };

  const updateSampleLabel = (id: string, expected: SampleLabel) => {
    setSamples((prev) => prev.map((sample) => (sample.id === id ? { ...sample, expected } : sample)));
  };

  const addSyntheticSample = () => {
    const dataUrl = buildSyntheticDataUrl();
    if (!dataUrl) return;
    setSamples((prev) => [
      ...prev,
      {
        id: `demo-${Date.now()}`,
        name: 'demo-safe.png',
        dataUrl,
        expected: 'safe',
      },
    ]);
  };

  const onUploadSamples: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setErrorMessage('');

    try {
      const mapped = await Promise.all(
        files.map(async (file, index) => ({
          id: `${Date.now()}-${index}-${file.name}`,
          name: file.name,
          dataUrl: await toDataUrl(file),
          expected: DEFAULT_SAMPLE_LABEL,
        }))
      );
      setSamples((prev) => [...prev, ...mapped]);
    } catch (_e) {
      setErrorMessage(t.failed);
    } finally {
      // Allow re-selecting the same file.
      event.target.value = '';
    }
  };

  const computeSummary = (results: BenchmarkRunResult[]): BenchmarkSummary => {
    if (!results.length) {
      return emptySummary();
    }

    const total = results.length;
    const correct = results.filter((entry) => entry.correct).length;
    const accuracy = (correct / total) * 100;
    const latencies = results.map((entry) => entry.latency);
    const avgLatency = latencies.reduce((acc, current) => acc + current, 0) / latencies.length;
    const p95Latency = percentile(latencies, 95);

    // Binary risky-vs-safe quality metrics.
    const riskyExpected = (label: SampleLabel) => label !== 'safe';
    const riskyPredicted = (label: SampleLabel) => label !== 'safe';
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const item of results) {
      const expectedRisk = riskyExpected(item.expected);
      const predictedRisk = riskyPredicted(item.predicted);
      if (predictedRisk && expectedRisk) tp++;
      if (predictedRisk && !expectedRisk) fp++;
      if (!predictedRisk && expectedRisk) fn++;
    }
    const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
    const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      total,
      correct,
      accuracy: round2(accuracy),
      avgLatency: round2(avgLatency),
      p95Latency: round2(p95Latency),
      precision: round2(precision),
      recall: round2(recall),
      f1: round2(f1),
    };
  };

  const run = async () => {
    if (running) return;
    if (!samples.length) {
      setErrorMessage(t.noSamples);
      return;
    }

    setRunning(true);
    setErrorMessage('');
    setExportMessage('');
    setPoints([]);
    setRunResults([]);

    try {
      const results: BenchmarkRunResult[] = [];
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const img = await loadImage(sample.dataUrl);
        const startedAt = performance.now();
        const predictedRaw = await scanImageLocally(img);
        const latency = round2(performance.now() - startedAt);
        const predicted = mapPredictedLabel(predictedRaw);
        const row: BenchmarkRunResult = {
          idx: i + 1,
          sampleId: sample.id,
          expected: sample.expected,
          predicted,
          correct: predicted === sample.expected,
          latency,
        };
        results.push(row);
        setPoints(results.map((entry) => ({ idx: entry.idx, latency: entry.latency })));
      }

      setRunResults(results);
      setSummary(computeSummary(results));
    } catch (_e) {
      setErrorMessage(t.failed);
      setRunResults([]);
      setSummary(emptySummary());
      setPoints([]);
    } finally {
      setRunning(false);
    }
  };

  const expectedToGateSet = (label: SampleLabel): GateSetName =>
    label === 'safe' ? 'safe-regression' : 'critical-redteam';

  const toQualityGateReport = (): QualityGateReport => {
    const runs: QualityGateRunRecord[] = runResults.map((result) => {
      const sample = samples.find((entry) => entry.id === result.sampleId);
      const expectedCritical = result.expected !== 'safe';
      const observedCritical = result.predicted !== 'safe';
      return {
        id: sample?.name || result.sampleId,
        set: expectedToGateSet(result.expected),
        expected: { critical: expectedCritical },
        observed: { critical: observedCritical, latencyMs: result.latency },
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      referenceDevice: window.navigator.userAgent || 'unknown-device',
      buildVersion: 'manual-benchmark',
      runs,
    };
  };

  const exportQualityGateReport = async (copyOnly: boolean) => {
    try {
      const report = toQualityGateReport();
      const jsonText = `${JSON.stringify(report, null, 2)}\n`;
      if (copyOnly) {
        await navigator.clipboard.writeText(jsonText);
        setExportMessage(t.copied);
        return;
      }

      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'latest-summary.json';
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage(t.exported);
    } catch (_e) {
      setExportMessage(t.exportFailed);
    }
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black cursor-pointer">
            {t.upload}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onUploadSamples}
              className="hidden"
            />
          </label>
          <button
            onClick={addSyntheticSample}
            className="px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-black"
          >
            {t.addDemo}
          </button>
          <button
            onClick={() => {
              setSamples([]);
              setRunResults([]);
              setSummary(emptySummary());
              setPoints([]);
              setErrorMessage('');
            }}
            className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-sm font-black"
          >
            {t.clear}
          </button>
        </div>

        <p className="text-xs font-bold text-slate-500">{t.note}</p>
        {!!errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
            {errorMessage}
          </div>
        )}
        {!!exportMessage && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
            {exportMessage}
          </div>
        )}

        {samples.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs font-bold text-slate-500">
            {t.noSamples}
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="grid grid-cols-1 md:grid-cols-[80px_1fr_180px] gap-3 items-center border border-slate-100 rounded-xl p-2"
              >
                <img
                  src={sample.dataUrl}
                  alt={sample.name}
                  className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700 truncate">
                    {t.sampleName}: {sample.name}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-500 mb-1">{t.expected}</p>
                  <select
                    value={sample.expected}
                    onChange={(e) => updateSampleLabel(sample.id, e.target.value as SampleLabel)}
                    className="w-full px-2 py-2 rounded-lg border border-slate-200 text-sm font-black"
                  >
                    <option value="safe">{t.safe}</option>
                    <option value="adult">{t.adult}</option>
                    <option value="violence">{t.violence}</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.avg}</p>
          <p className="mt-2 text-3xl font-black text-indigo-700">{summary.avgLatency}ms</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.p95}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.p95Latency}ms</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.accuracy}</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{summary.accuracy}%</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.precision}</p>
          <p className="mt-2 text-2xl font-black text-indigo-700">{summary.precision}%</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.recall}</p>
          <p className="mt-2 text-2xl font-black text-rose-700">{summary.recall}%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.f1}</p>
          <p className="mt-2 text-2xl font-black text-violet-700">{summary.f1}%</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.total}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-[11px] font-black text-slate-500">{t.correct}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.correct}</p>
        </div>
      </div>

      {runResults.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-900">{t.results}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportQualityGateReport(true)}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-black"
              >
                {t.copyJson}
              </button>
              <button
                onClick={() => exportQualityGateReport(false)}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-black"
              >
                {t.export}
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {runResults.map((item) => {
              const sample = samples.find((entry) => entry.id === item.sampleId);
              return (
                <div
                  key={`${item.sampleId}-${item.idx}`}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center rounded-lg px-3 py-2 border ${
                    item.correct ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
                  }`}
                >
                  <p className="text-[11px] font-black text-slate-700 truncate">{sample?.name || item.sampleId}</p>
                  <p className="text-[11px] font-black text-slate-600">{labelName(item.expected)}</p>
                  <p className="text-[11px] font-black text-slate-900">{labelName(item.predicted)}</p>
                  <p className="text-[11px] font-black text-slate-500">{item.latency}ms</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualBenchmarkView;

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useRef, useEffect } from 'react';
import { loadVisualSentinelModel, scanImageLocally } from '@/services/visualSentinel';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ICONS } from '@/constants';
const VisualBenchmarkView = ({ lang }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState([]);
    const [avgLatency, setAvgLatency] = useState(0);
    const [peakLatency, setPeakLatency] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isModelReady, setIsModelReady] = useState(false);
    const [imageSize, setImageSize] = useState(320);
    const canvasRef = useRef(null);
    useEffect(() => {
        const init = async () => {
            await loadVisualSentinelModel();
            setIsModelReady(true);
        };
        init();
    }, []);
    const runBenchmark = async () => {
        if (isRunning)
            return;
        setIsRunning(true);
        setResults([]);
        setProgress(0);
        const iterations = 50;
        const tempResults = [];
        // محاكاة صورة للفحص
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `https://picsum.photos/${imageSize}/${imageSize}`;
        await new Promise(r => img.onload = r);
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            await scanImageLocally(img);
            const endTime = performance.now();
            const lat = endTime - startTime;
            tempResults.push({ id: i, latency: lat, label: `Test ${i}` });
            setResults([...tempResults]);
            setProgress(Math.round(((i + 1) / iterations) * 100));
            // السماح للمتصفح بالتنفس لتحديث الواجهة
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        const avg = tempResults.reduce((acc, curr) => acc + curr.latency, 0) / iterations;
        const peak = Math.max(...tempResults.map(r => r.latency));
        setAvgLatency(avg);
        setPeakLatency(peak);
        setIsRunning(false);
    };
    const getEfficiencyColor = () => {
        if (avgLatency < 50)
            return 'text-emerald-500';
        if (avgLatency < 150)
            return 'text-amber-500';
        return 'text-red-500';
    };
    return (_jsxs("div", { className: "max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in", dir: lang === 'ar' ? 'rtl' : 'ltr', children: [_jsxs("div", { className: "bg-[#0f172a] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]" }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-10", children: [_jsxs("div", { className: "flex items-center gap-8", children: [_jsx("div", { className: "w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl", children: _jsx(ICONS.Rocket, { className: "w-12 h-12 text-white" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-4xl font-black tracking-tighter mb-2", children: lang === 'ar' ? 'مختبر أداء المحرك' : 'Engine Benchmark Lab' }), _jsx("p", { className: "text-indigo-200 font-bold opacity-80 text-lg", children: lang === 'ar' ? 'قياس كفاءة الذكاء الاصطناعي المحلي على هذا العتاد' : 'Measure local AI efficiency on this hardware' })] })] }), _jsx("button", { onClick: runBenchmark, disabled: isRunning || !isModelReady, className: `px-12 py-6 rounded-3xl font-black text-xl transition-all shadow-2xl flex items-center gap-4 ${isRunning ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`, children: isRunning ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" }), _jsxs("span", { children: [progress, "%"] })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "\uD83D\uDE80" }), _jsx("span", { children: lang === 'ar' ? 'بدء اختبار الإجهاد' : 'Start Stress Test' })] })) })] })] }), !isModelReady && (_jsx("div", { className: "bg-amber-50 border-2 border-amber-200 p-8 rounded-3xl text-amber-800 font-black text-center animate-pulse", children: "\u062C\u0627\u0631\u064A \u062A\u0647\u064A\u0626\u0629 \u0646\u0645\u0627\u0630\u062C TensorFlow.js \u0627\u0644\u0645\u062D\u0644\u064A\u0629... \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062B\u0648\u0627\u0646\u064A." })), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsx(StatCard, { label: lang === 'ar' ? 'متوسط زمن الاستجابة' : 'Avg Latency', value: `${avgLatency.toFixed(2)}ms`, sub: avgLatency < 100 ? 'مثالي (Edge Optimized)' : 'مقبول (Standard)', color: getEfficiencyColor() }), _jsx(StatCard, { label: lang === 'ar' ? 'أقصى تأخير مرصود' : 'Peak Latency', value: `${peakLatency.toFixed(2)}ms`, sub: "\u062E\u0644\u0627\u0644 50 \u0639\u0645\u0644\u064A\u0629 \u0645\u0639\u0627\u0644\u062C\u0629", color: "text-slate-800" }), _jsx(StatCard, { label: lang === 'ar' ? 'تقييم كفاءة الجهاز' : 'Device Score', value: avgLatency === 0 ? '0%' : `${Math.max(0, 100 - (avgLatency / 5)).toFixed(0)}%`, sub: "\u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0633\u0631\u0639\u0629 \u0627\u0644\u0640 GPU", color: "text-indigo-600" })] }), _jsxs("div", { className: "bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 space-y-8", children: [_jsxs("div", { className: "flex justify-between items-center px-4", children: [_jsx("h3", { className: "text-2xl font-black text-slate-800 tracking-tight", children: lang === 'ar' ? 'التحليل الزمني للاستجابة' : 'Response Time Analysis' }), _jsx("div", { className: "flex gap-2", children: [320, 640, 1280].map(sz => (_jsxs("button", { onClick: () => setImageSize(sz), className: `px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${imageSize === sz ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`, children: [sz, "px"] }, sz))) })] }), _jsx("div", { className: "h-80 w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: results, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "colorLat", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#6366f1", stopOpacity: 0.3 }), _jsx("stop", { offset: "95%", stopColor: "#6366f1", stopOpacity: 0 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: "id", hide: true }), _jsx(YAxis, { unit: "ms", tick: { fontSize: 10, fontWeight: 'bold' } }), _jsx(Tooltip, { contentStyle: { borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }, itemStyle: { color: '#6366f1', fontWeight: '900' } }), _jsx(Area, { type: "monotone", dataKey: "latency", stroke: "#6366f1", strokeWidth: 4, fillOpacity: 1, fill: "url(#colorLat)" })] }) }) })] }), _jsxs("div", { className: "bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center gap-10", children: [_jsx("div", { className: "w-32 h-32 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-center text-5xl", children: "\uD83E\uDDE0" }), _jsxs("div", { className: "flex-1 space-y-4", children: [_jsx("h4", { className: "text-2xl font-black", children: lang === 'ar' ? 'توصية نظام أمانة' : 'Amanah Recommendation' }), _jsx("p", { className: "text-slate-400 font-bold leading-relaxed", children: avgLatency < 100
                                    ? "هذا الجهاز يمتلك قدرة معالجة بصرية ممتازة. يمكن تفعيل كافة بروتوكولات الحماية المباشرة دون التأثير على تجربة الطفل."
                                    : "يُنصح بتقليل جودة المسح البصري (Resolution) في إعدادات هاتف الطفل لضمان استجابة أسرع للتهديدات." })] }), _jsx("button", { className: "px-8 py-4 bg-white/10 rounded-2xl font-black text-sm border border-white/10 hover:bg-white/20 transition-all", children: "\u062A\u0635\u062F\u064A\u0631 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0639\u062A\u0627\u062F (JSON)" })] })] }));
};
const StatCard = ({ label, value, sub, color }) => (_jsxs("div", { className: "bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-2", children: [_jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest", children: label }), _jsx("p", { className: `text-4xl font-black tracking-tighter ${color}`, children: value }), _jsx("p", { className: "text-[10px] font-bold text-slate-300", children: sub })] }));
export default VisualBenchmarkView;

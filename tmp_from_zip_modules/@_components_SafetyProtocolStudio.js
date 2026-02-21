import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useMemo } from 'react';
import { Category, AlertSeverity } from '@/types';
import { AmanahShield } from '@/constants';
const SafetyProtocolStudio = ({ currentUser }) => {
    const [protocols, setProtocols] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Simulator State
    const [simCategory, setSimCategory] = useState(Category.PREDATOR);
    const [simSeverity, setSimSeverity] = useState(AlertSeverity.HIGH);
    const [simResult, setSimResult] = useState(null);
    useEffect(() => {
        // محاكاة جلب البيانات
        setProtocols([
            {
                protocol_id: 'pb-1',
                name: 'دفاع الاستدراج الحرج',
                incident_type: Category.PREDATOR,
                enabled: true,
                min_severity: AlertSeverity.HIGH,
                actions: ['APP_KILL', 'NET_QUARANTINE', 'LOCKSCREEN_BLACKOUT', 'EVIDENCE_CREATE'],
                blackout_message: 'تم قفل الجهاز لدواعي أمنية جنائية.',
                version: 1,
                status: 'PUBLISHED',
                updated_at: new Date().toISOString()
            },
            {
                protocol_id: 'pb-2',
                name: 'درع التنمر المتوسط',
                incident_type: Category.BULLYING,
                enabled: true,
                min_severity: AlertSeverity.MEDIUM,
                actions: ['ALERT_SEND', 'SCREENSHOT_CAPTURE'],
                blackout_message: 'تنبيه: تم رصد محتوى غير لائق.',
                version: 1,
                status: 'DRAFT',
                updated_at: new Date().toISOString()
            }
        ]);
        setIsLoading(false);
    }, []);
    const selectedProtocol = useMemo(() => protocols.find(p => p.protocol_id === selectedId), [protocols, selectedId]);
    const handleSimulate = () => {
        // منطق المحاكاة (Frontend Logic)
        const eligible = protocols.find(p => p.incident_type === simCategory &&
            p.enabled &&
            p.status === 'PUBLISHED'
        // في الواقع نحتاج لمقارنة الرتب، للتبسيط هنا نأخذ أول تطابق
        );
        if (eligible) {
            setSimResult({
                ok: true,
                protocol: eligible.name,
                actions: eligible.actions
            });
        }
        else {
            setSimResult({ ok: false, reason: "لا يوجد بروتوكول مفعل يطابق هذه المعايير." });
        }
    };
    return (_jsxs("div", { className: "max-w-7xl mx-auto space-y-10 pb-40 animate-in fade-in", dir: "rtl", children: [_jsxs("div", { className: "bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]" }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-10", children: [_jsxs("div", { className: "flex items-center gap-8", children: [_jsx("div", { className: "w-20 h-20 bg-[#8A1538] rounded-3xl flex items-center justify-center shadow-2xl animate-shield-breathing", children: _jsx(AmanahShield, { className: "w-12 h-12" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-4xl font-black tracking-tighter mb-1", children: "Safety Protocol Studio" }), _jsx("p", { className: "text-indigo-300 font-bold opacity-80 text-lg", children: "\u062A\u0643\u0648\u064A\u0646 \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644\u0627\u062A \u0627\u0644\u062F\u0641\u0627\u0639 \u0627\u0644\u0622\u0644\u064A (ASE)" })] })] }), _jsx("button", { className: "bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 active:scale-95 transition-all", children: "\u0625\u0636\u0627\u0641\u0629 \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0633\u064A\u0627\u062F\u064A" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-10", children: [_jsxs("div", { className: "lg:col-span-4 bg-white rounded-[4rem] shadow-xl border border-slate-100 p-8 space-y-6", children: [_jsx("h3", { className: "text-xl font-black text-slate-800 border-b pb-4", children: "\u0627\u0644\u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0633\u064A\u0627\u062F\u064A\u0629" }), _jsx("div", { className: "space-y-4", children: protocols.map(p => (_jsxs("div", { onClick: () => setSelectedId(p.protocol_id), className: `p-6 rounded-[2.2rem] border-2 transition-all cursor-pointer ${selectedId === p.protocol_id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`, children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "font-black text-sm", children: p.name }), _jsx("span", { className: `text-[8px] font-black px-2 py-1 rounded-md ${selectedId === p.protocol_id ? 'bg-white/20' : 'bg-slate-200'}`, children: p.status })] }), _jsx("p", { className: `text-[10px] font-bold opacity-60 uppercase`, children: p.incident_type })] }, p.protocol_id))) })] }), _jsxs("div", { className: "lg:col-span-8 space-y-10", children: [selectedProtocol ? (_jsxs("div", { className: "bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 space-y-12", children: [_jsxs("div", { className: "flex justify-between items-center border-b border-slate-50 pb-8", children: [_jsx("h3", { className: "text-3xl font-black text-slate-800 tracking-tight", children: selectedProtocol.name }), _jsxs("div", { className: "flex gap-4", children: [_jsx("button", { className: "px-8 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs", children: "\u062D\u0641\u0638 \u0627\u0644\u0645\u0633\u0648\u062F\u0629" }), _jsx("button", { className: "px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg", children: "\u0646\u0634\u0631 \u0627\u0644\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644" })] })] }), _jsxs("div", { className: "space-y-8", children: [_jsx("h4", { className: "text-lg font-black text-slate-800", children: "\u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A (Actions)" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: selectedProtocol.actions.map(action => (_jsxs("div", { className: "bg-indigo-50/50 p-6 rounded-[1.8rem] border-2 border-indigo-100 flex flex-col items-center text-center gap-3", children: [_jsx("span", { className: "text-2xl", children: "\uD83D\uDEE1\uFE0F" }), _jsx("span", { className: "text-[10px] font-black text-indigo-900 leading-tight", children: action.replace('_', ' ') })] }, action))) })] }), _jsxs("div", { className: "bg-indigo-900 rounded-[3rem] p-10 text-white space-y-6 shadow-2xl relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" }), _jsxs("div", { className: "flex items-center gap-5 relative z-10", children: [_jsx("span", { className: "text-3xl", children: "\uD83C\uDF11" }), _jsx("h4", { className: "text-2xl font-black tracking-tighter", children: "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u062A\u0639\u062A\u064A\u0645 \u0627\u0644\u0646\u0634\u0637" })] }), _jsxs("div", { className: "bg-black/20 p-8 rounded-[2rem] border border-white/10 font-bold text-lg italic relative z-10 shadow-inner", children: ["\"", selectedProtocol.blackout_message, "\""] })] })] })) : (_jsxs("div", { className: "h-full flex flex-col items-center justify-center text-slate-300 opacity-30 gap-6 grayscale", children: [_jsx("div", { className: "text-9xl", children: "\uD83D\uDEE1\uFE0F" }), _jsx("p", { className: "text-2xl font-black", children: "\u0627\u062E\u062A\u0631 \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644\u0627\u064B \u0644\u0644\u0628\u062F\u0621 \u0641\u064A \u062A\u062D\u0631\u064A\u0631 \u0633\u0644\u0648\u0643 \u0627\u0644\u0646\u0638\u0627\u0645." })] })), _jsxs("div", { className: "bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl space-y-10 relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-end gap-10", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-4xl font-black tracking-tighter text-indigo-300", children: "\u0645\u062D\u0627\u0643\u064A \u0627\u0644\u0633\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u0633\u064A\u0627\u062F\u064A" }), _jsx("p", { className: "text-slate-400 font-bold text-lg", children: "\u0627\u062E\u062A\u0628\u0631 \u0631\u062F \u0641\u0639\u0644 \u0627\u0644\u0646\u0638\u0627\u0645 \u0642\u0628\u0644 \u0627\u0644\u062D\u062F\u0648\u062B \u0627\u0644\u0641\u0639\u0644\u064A \u0644\u0644\u062D\u0627\u062F\u062B\u0629." })] }), _jsx("button", { onClick: handleSimulate, className: "px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] active:scale-95 transition-all", children: "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u062D\u0627\u0643\u0627\u0629 \uD83E\uDDEA" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-4", children: "\u0646\u0648\u0639 \u0627\u0644\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u0645\u062D\u0627\u0643\u0627\u0629" }), _jsx("select", { value: simCategory, onChange: (e) => setSimCategory(e.target.value), className: "w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-black text-indigo-100 outline-none focus:border-indigo-500", children: Object.values(Category).map(cat => _jsx("option", { value: cat, children: cat }, cat)) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] px-4", children: "\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u062E\u0637\u0648\u0631\u0629" }), _jsxs("select", { value: simSeverity, onChange: (e) => setSimSeverity(e.target.value), className: "w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-black text-indigo-100 outline-none focus:border-indigo-500", children: [_jsx("option", { value: "low", children: "LOW" }), _jsx("option", { value: "med", children: "MEDIUM" }), _jsx("option", { value: "high", children: "HIGH" }), _jsx("option", { value: "critical", children: "CRITICAL" })] })] })] }), _jsx("div", { className: "bg-white/5 border-2 border-dashed border-white/10 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center", children: simResult ? (simResult.ok ? (_jsxs("div", { className: "space-y-6 animate-in zoom-in", children: [_jsx("div", { className: "w-20 h-20 bg-emerald-500 rounded-full mx-auto flex items-center justify-center text-4xl shadow-lg shadow-emerald-500/20", children: "\u2705" }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1", children: "\u0627\u0644\u0642\u0631\u0627\u0631: \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644" }), _jsx("h4", { className: "text-2xl font-black text-emerald-400", children: simResult.protocol })] }), _jsx("div", { className: "flex flex-wrap justify-center gap-2", children: simResult.actions.map((a) => _jsx("span", { className: "bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black", children: a }, a)) })] })) : (_jsxs("div", { className: "space-y-4 animate-in fade-in", children: [_jsx("div", { className: "w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center text-3xl", children: "\u26A0\uFE0F" }), _jsx("p", { className: "font-bold text-slate-400 leading-relaxed", children: simResult.reason })] }))) : (_jsx("p", { className: "text-slate-600 font-bold italic", children: "\u0623\u062F\u062E\u0644 \u0627\u0644\u0645\u0639\u0627\u064A\u064A\u0631 \u0648\u0627\u0636\u063A\u0637 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u062D\u0627\u0643\u0627\u0629 \u0644\u0631\u0624\u064A\u0629 \u0627\u0644\u0646\u062A\u064A\u062C\u0629." })) })] })] })] })] })] }));
};
export default SafetyProtocolStudio;

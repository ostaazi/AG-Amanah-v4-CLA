import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { Category, AlertSeverity } from '@/types';
import { AmanahShield } from '@/constants';
import { canPerform } from '@/services/rbacService';
const SafetyPlaybookHub = ({ currentUser, onUpdatePlaybooks }) => {
    const [activeCategory, setActiveCategory] = useState(Category.PREDATOR);
    const isAuthorized = canPerform(currentUser.role, 'playbook.write');
    const playbooks = currentUser.playbooks || [];
    // دالة لجلب البروتوكول الحالي أو إنشاء افتراضي
    const getActivePlaybook = () => {
        return playbooks.find(p => p.category === activeCategory) || {
            id: 'pb-' + activeCategory,
            name: `بروتوكول حماية: ${activeCategory}`,
            category: activeCategory,
            minSeverity: AlertSeverity.HIGH,
            enabled: true,
            actions: [
                { id: 'a1', type: 'LOCK_DEVICE', isEnabled: true },
                { id: 'a2', type: 'BLOCK_APP', isEnabled: true },
                { id: 'a3', type: 'NOTIFY_PARENTS', isEnabled: true },
                { id: 'a4', type: 'SIREN', isEnabled: false },
                { id: 'a5', type: 'QUARANTINE_NET', isEnabled: true },
                { id: 'a6', type: 'DISABLE_HARDWARE', isEnabled: true }
            ]
        };
    };
    const activePlaybook = getActivePlaybook();
    const toggleAction = (actionId) => {
        if (!isAuthorized)
            return;
        const updatedActions = activePlaybook.actions.map(a => a.id === actionId ? { ...a, isEnabled: !a.isEnabled } : a);
        const updatedPlaybook = { ...activePlaybook, actions: updatedActions };
        const otherPlaybooks = playbooks.filter(p => p.category !== activeCategory);
        onUpdatePlaybooks([...otherPlaybooks, updatedPlaybook]);
    };
    const setMinSeverity = (sev) => {
        if (!isAuthorized)
            return;
        const updatedPlaybook = { ...activePlaybook, minSeverity: sev };
        const otherPlaybooks = playbooks.filter(p => p.category !== activeCategory);
        onUpdatePlaybooks([...otherPlaybooks, updatedPlaybook]);
    };
    const actionLabels = {
        LOCK_DEVICE: { label: 'إغلاق الشاشة (Lockdown)', icon: '🌑', desc: 'قفل فوري للجهاز لمنع أي تفاعل.' },
        BLOCK_APP: { label: 'قتل التطبيق (Kill Switch)', icon: '✂️', desc: 'إغلاق التطبيق المفتوح فوراً.' },
        NOTIFY_PARENTS: { label: 'تنبيه عالي الأولوية', icon: '🚨', desc: 'دفع إشعار عاجل لكافة المشرفين.' },
        SIREN: { label: 'صافرة ردع صوتية', icon: '🔊', desc: 'إطلاق صوت عالي لجذب الانتباه.' },
        QUARANTINE_NET: { label: 'حجر الشبكة', icon: '📡', desc: 'قطع الإنترنت مؤقتاً لعزل المهاجم.' },
        DISABLE_HARDWARE: { label: 'تعطيل الكاميرا والمايك', icon: '🚫', desc: 'منع التسجيل الاستدراجي فوراً.' }
    };
    return (_jsxs("div", { className: "max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in", dir: "rtl", children: [_jsxs("div", { className: "bg-[#0f172a] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-600", children: [_jsx("div", { className: "absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0%,transparent_60%)]" }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-10", children: [_jsxs("div", { className: "flex items-center gap-8", children: [_jsx("div", { className: "w-24 h-24 bg-[#8A1538] rounded-3xl flex items-center justify-center text-4xl shadow-2xl", children: _jsx(AmanahShield, { className: "w-16 h-16", animate: true }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-4xl font-black tracking-tighter mb-2", children: "\u0645\u062D\u0631\u0643 \u0627\u0644\u062F\u0641\u0627\u0639 \u0627\u0644\u0622\u0644\u064A (ASE)" }), _jsx("p", { className: "text-indigo-200 font-bold opacity-80 text-lg", children: "Autonomous Safety Engine \u2022 \u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629" })] })] }), isAuthorized ? (_jsx("div", { className: "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-8 py-4 rounded-2xl font-black text-sm animate-pulse", children: "\u0648\u0636\u0639 \u0627\u0644\u0633\u064A\u0627\u062F\u0629: \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 Playbooks" })) : (_jsx("div", { className: "bg-amber-600/20 text-amber-400 border border-amber-500/30 px-8 py-4 rounded-2xl font-black text-sm", children: "\u0648\u0636\u0639 \u0627\u0644\u0639\u0631\u0636: \u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062A\u0639\u062F\u064A\u0644" }))] })] }), _jsx("div", { className: "flex gap-3 overflow-x-auto pb-4 custom-scrollbar", children: [Category.PREDATOR, Category.BULLYING, Category.SELF_HARM, Category.BLACKMAIL, Category.ADULT_CONTENT, Category.VIOLENCE].map(cat => (_jsx("button", { onClick: () => setActiveCategory(cat), className: `px-10 py-5 rounded-[1.8rem] font-black text-sm whitespace-nowrap transition-all border-2 ${activeCategory === cat ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`, children: cat }, cat))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-10", children: [_jsx("div", { className: "lg:col-span-8 space-y-8", children: _jsxs("div", { className: "bg-white rounded-[4rem] p-10 shadow-xl border border-slate-100 space-y-10", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-center border-b border-slate-50 pb-8 gap-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-2xl font-black text-slate-800", children: "\u062D\u0633\u0627\u0633\u064A\u0629 \u0627\u0644\u062A\u0641\u0639\u064A\u0644" }), _jsx("p", { className: "text-slate-400 font-bold text-xs mt-1", children: "\u0645\u062A\u0649 \u064A\u0628\u062F\u0623 \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u062A\u0642\u0646\u064A\u0629\u061F" })] }), _jsx("div", { className: "flex bg-slate-100 p-1.5 rounded-2xl", children: [AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL].map(sev => (_jsx("button", { onClick: () => setMinSeverity(sev), className: `px-6 py-3 rounded-xl text-[10px] font-black transition-all ${activePlaybook.minSeverity === sev ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`, children: sev }, sev))) })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: activePlaybook.actions.map(action => {
                                        const info = actionLabels[action.type];
                                        return (_jsxs("button", { onClick: () => toggleAction(action.id), className: `p-8 rounded-[2.5rem] border-2 text-right transition-all flex flex-col justify-between h-52 group ${action.isEnabled ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`, disabled: !isAuthorized, children: [_jsxs("div", { className: "flex justify-between items-start w-full", children: [_jsx("span", { className: "text-4xl", children: info.icon }), _jsx("div", { className: `w-12 h-6 rounded-full p-1 transition-all ${action.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`, children: _jsx("div", { className: `w-4 h-4 bg-white rounded-full shadow-md transition-transform ${action.isEnabled ? '-translate-x-6' : 'translate-x-0'}` }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-black text-slate-800 mb-1", children: info.label }), _jsx("p", { className: "text-[10px] font-bold text-slate-400 leading-tight", children: info.desc })] })] }, action.id));
                                    }) })] }) }), _jsxs("div", { className: "lg:col-span-4 space-y-8", children: [_jsxs("div", { className: "bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 relative overflow-hidden", children: [_jsx("div", { className: "absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl" }), _jsxs("div", { className: "relative z-10 space-y-6", children: [_jsx("div", { className: "w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl", children: "\uD83E\uDDE9" }), _jsx("h3", { className: "text-2xl font-black tracking-tighter leading-tight", children: "\u0642\u0648\u0627\u0639\u062F ABAC \u0627\u0644\u0633\u064A\u0627\u062F\u064A\u0629" }), _jsxs("p", { className: "text-indigo-300 font-bold text-sm leading-relaxed opacity-80", children: ["\u062A\u0639\u062A\u0645\u062F \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0630\u0643\u064A\u0629 \u0639\u0644\u0649 \u0633\u064A\u0627\u0642 \u0627\u0644\u062D\u0627\u062F\u062B\u0629: ", _jsx("br", {}), "- \u062F\u0648\u0631 \u0627\u0644\u0645\u0646\u0641\u0630: ", currentUser.role, " ", _jsx("br", {}), "- \u062D\u0627\u0644\u0629 \u0627\u0644\u0642\u0641\u0644: ", activePlaybook.enabled ? 'مفعلة' : 'معطلة', " ", _jsx("br", {}), "- \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u062A\u0647\u062F\u064A\u062F: > 1"] }), _jsx("div", { className: "pt-6 border-t border-white/10", children: _jsx("button", { className: "w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", children: "\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 (Audit)" }) })] })] }), _jsxs("div", { className: "bg-emerald-600 rounded-[3rem] p-10 text-white shadow-2xl flex flex-col items-center justify-center text-center space-y-4", children: [_jsx("div", { className: "text-5xl animate-bounce", children: "\uD83D\uDEE1\uFE0F" }), _jsx("h3", { className: "text-xl font-black", children: "\u062D\u0645\u0627\u064A\u0629 \u0627\u0633\u062A\u0628\u0627\u0642\u064A\u0629 100%" }), _jsx("p", { className: "text-xs font-bold opacity-80 leading-relaxed", children: "\u0628\u0645\u062C\u0631\u062F \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644\u060C \u0633\u064A\u062A\u062E\u0630 \u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0636\u0639 \"\u0627\u0644\u062D\u062C\u0631 \u0627\u0644\u062C\u0646\u0627\u0626\u064A\" \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0641\u064A \u0623\u0642\u0644 \u0645\u0646 0.05 \u062B\u0627\u0646\u064A\u0629." })] })] })] })] }));
};
export default SafetyPlaybookHub;

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { ICONS, AdminShieldBadge } from '@/constants';
import { translations } from '@/translations';
import { fetchSupervisors } from '@/services/firestoreService';
import { clearAllUserData } from '@/services/mockDataService';
const SettingsView = ({ currentUser, children, lang, onUpdateMember, onDeleteMember, showSuccessToast }) => {
    const t = translations[lang];
    const [supervisors, setSupervisors] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    useEffect(() => {
        if (currentUser?.id)
            loadSupervisors();
    }, [currentUser?.id]);
    const loadSupervisors = async () => {
        const data = await fetchSupervisors(currentUser.id);
        setSupervisors(data);
    };
    const handlePurgeData = async () => {
        if (!window.confirm("⚠️ حذف كافة البيانات الوهمية؟"))
            return;
        setIsProcessing(true);
        await clearAllUserData(currentUser.id);
        window.location.reload();
    };
    // وظيفة خاصة للمطورين لتبديل الأدوار للاختبار
    const toggleRole = async (member) => {
        const roles = ['ADMIN', 'SUPERVISOR', 'DEVELOPER', 'SRE', 'SOC_ANALYST', 'RELEASE_MANAGER', 'PLATFORM_ADMIN'];
        const currentIndex = roles.indexOf(member.role);
        const nextRole = roles[(currentIndex + 1) % roles.length];
        setIsProcessing(true);
        await onUpdateMember(member.id, nextRole, { role: nextRole });
        showSuccessToast(`تم تغيير الرتبة إلى: ${nextRole}`);
        setTimeout(() => window.location.reload(), 1000);
    };
    return (_jsxs("div", { className: "max-w-4xl mx-auto space-y-12 pb-48 pt-6 animate-in fade-in", dir: lang === 'ar' ? 'rtl' : 'ltr', children: [_jsxs("section", { className: "bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]", children: [_jsx("div", { className: "absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(209,162,61,0.15)_0%,transparent_60%)]" }), _jsxs("div", { className: "relative z-10 space-y-8 text-center md:text-right", children: [_jsxs("div", { className: "flex flex-col md:flex-row items-center gap-6", children: [_jsx("div", { className: "w-20 h-20 bg-[#D1A23D]/10 rounded-3xl flex items-center justify-center text-5xl border border-[#D1A23D]/30 shadow-[0_0_30px_rgba(209,162,61,0.2)]", children: "\uD83D\uDD11" }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-3xl font-black tracking-tight text-[#D1A23D]", children: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0633\u0631\u064A\u0639" }), _jsx("p", { className: "text-slate-300 font-bold text-sm mt-1", children: "\u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647 \u0641\u064A \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0637\u0641\u0644 \u0644\u062A\u0628\u062F\u0623 \u0627\u0644\u062D\u0645\u0627\u064A\u0629." })] })] }), _jsx("div", { className: "bg-black/40 p-8 rounded-[2.5rem] border border-white/10 flex justify-center items-center", children: _jsx("code", { className: "text-5xl font-mono font-black tracking-widest text-white", children: currentUser.pairingKey || '----' }) })] })] }), _jsxs("section", { className: "space-y-6", children: [_jsx("h3", { className: "text-2xl font-black text-slate-900 px-4", children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0647\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u0631" }), _jsx("div", { className: "grid grid-cols-1 gap-4", children: [currentUser, ...supervisors].map((member) => (_jsxs("div", { className: "p-6 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm group", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "relative", children: [_jsx("img", { src: member.avatar, className: "w-16 h-16 rounded-full object-cover border-4 border-white shadow-xl" }), member.role === 'ADMIN' && _jsx("div", { className: "absolute -bottom-2 -left-2 w-8 h-8", children: _jsx(AdminShieldBadge, {}) })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-black text-slate-800 text-lg leading-none mb-1", children: member.name }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-[9px] font-black px-3 py-1 rounded-md uppercase tracking-widest ${member.role.includes('ADMIN') ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`, children: member.role.replace('_', ' ') }), (currentUser.role === 'PLATFORM_ADMIN' || currentUser.role === 'DEVELOPER') && (_jsx("button", { onClick: () => toggleRole(member), className: "text-[8px] font-black text-slate-400 hover:text-indigo-600 underline", children: "\u062A\u0628\u062F\u064A\u0644 \u0627\u0644\u0631\u062A\u0628\u0629 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631" }))] })] })] }), _jsx("button", { onClick: () => setEditingMember(member), className: "p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all", children: _jsx(ICONS.Settings, {}) })] }, member.id))) })] }), _jsx("section", { className: "bg-red-50 rounded-[3rem] p-10 border-2 border-dashed border-red-200", children: _jsxs("div", { className: "flex flex-col md:flex-row justify-between items-center gap-8 text-right", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-2xl font-black text-red-900", children: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629" }), _jsx("p", { className: "text-red-600 font-bold text-sm", children: "\u062D\u0630\u0641 \u0643\u0627\u0641\u0629 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628." })] }), _jsx("button", { onClick: handlePurgeData, disabled: isProcessing, className: "px-10 py-5 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all", children: "\u062A\u0641\u0631\u064A\u063A \u0643\u0627\u0641\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" })] }) })] }));
};
export default SettingsView;

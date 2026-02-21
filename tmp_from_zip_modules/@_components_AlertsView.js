import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertSeverity } from '@/types';
import { ICONS } from '@/constants';
const AlertsView = ({ alerts, theme, lang }) => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [unblurredImages, setUnblurredImages] = useState(new Set());
    const isDark = theme === 'dark';
    const filteredAlerts = useMemo(() => {
        let result = alerts;
        if (activeFilter !== 'ALL')
            result = result.filter(a => a.severity === activeFilter);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(a => a.content?.toLowerCase().includes(term) || a.category.toLowerCase().includes(term));
        }
        return result;
    }, [alerts, searchTerm, activeFilter]);
    const toggleBlur = (e, id) => {
        e.stopPropagation(); // منع تداخل الضغط مع فتح الخزنة
        setUnblurredImages(prev => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const handleCardClick = (alertId) => {
        // الانتقال للخزنة مع إرسال ID التنبيه لفتحه تلقائياً
        navigate('/vault', { state: { openAlertId: alertId } });
    };
    return (_jsxs("div", { className: "max-w-5xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700", dir: lang === 'ar' ? 'rtl' : 'ltr', children: [_jsx("div", { className: "flex flex-col md:flex-row justify-between items-end gap-6", children: _jsxs("div", { children: [_jsx("h2", { className: `text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`, children: lang === 'ar' ? 'السجل الأمني الشامل' : 'Comprehensive Security Log' }), _jsx("p", { className: "text-slate-500 font-bold mt-2", children: lang === 'ar' ? 'اضغط على أي تنبيه لفتح ملف الأدلة الجنائية الخاص به.' : 'Click any alert to open its forensic evidence file.' })] }) }), _jsx("div", { className: "space-y-8", children: filteredAlerts.map(alert => (_jsx("div", { onClick: () => handleCardClick(alert.id), className: `${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'} rounded-[3rem] border shadow-xl overflow-hidden group hover:border-indigo-400 cursor-pointer transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] active:scale-100`, children: _jsxs("div", { className: "p-10 flex flex-col lg:flex-row gap-10", children: [_jsxs("div", { className: "flex-1 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: `px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-400 text-white'}`, children: alert.severity }), _jsx("span", { className: `text-[10px] font-black px-4 py-2 rounded-full ${isDark ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`, children: alert.platform })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest", children: new Date(alert.timestamp).toLocaleTimeString() }), _jsx("div", { className: "w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(ICONS.Vault, {}) })] })] }), _jsxs("div", { children: [_jsxs("h3", { className: `text-3xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`, children: [alert.childName, " ", _jsx("span", { className: "text-slate-300 mx-2", children: "\u2022" }), " ", alert.category] }), _jsxs("div", { className: `${isDark ? 'bg-slate-800' : 'bg-slate-50'} p-6 rounded-[2rem] border ${isDark ? 'border-white/5' : 'border-slate-100'} mt-4 italic font-bold text-slate-700`, children: ["\"", alert.content, "\""] })] }), _jsx("div", { className: `${isDark ? 'bg-indigo-950/20' : 'bg-indigo-50/50'} p-8 rounded-[2.5rem] border border-indigo-100 relative overflow-hidden`, children: _jsxs("div", { className: "relative z-10", children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("div", { className: "bg-indigo-600 text-white p-2 rounded-xl", children: _jsx(ICONS.Shield, {}) }), _jsx("h4", { className: `text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-indigo-300' : 'text-slate-800'}`, children: "Amanah AI Analysis" })] }), _jsx("p", { className: `text-sm font-bold leading-relaxed mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`, children: alert.aiAnalysis }), _jsx("div", { className: `flex items-center justify-between p-4 rounded-2xl shadow-sm border ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-indigo-100'}`, children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-3 h-3 bg-red-600 rounded-full animate-pulse" }), _jsxs("span", { className: `text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`, children: [lang === 'ar' ? 'الإجراء' : 'Action', ": ", _jsx("span", { className: "text-red-600 font-black", children: alert.actionTaken })] })] }) })] }) })] }), alert.imageData && (_jsxs("div", { className: "lg:w-80 w-full h-80 relative bg-slate-100 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-2xl flex-shrink-0 group/img", children: [_jsx("img", { src: alert.imageData, className: `w-full h-full object-cover transition-all duration-1000 ${alert.severity === AlertSeverity.CRITICAL && !unblurredImages.has(alert.id) ? 'blur-[40px] scale-110' : 'blur-0 scale-100'}` }), alert.severity === AlertSeverity.CRITICAL && !unblurredImages.has(alert.id) && (_jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-950/20 backdrop-blur-sm", children: [_jsx("div", { className: "bg-white/90 p-4 rounded-3xl shadow-2xl mb-4", children: "\uD83D\uDEE1\uFE0F" }), _jsx("p", { className: "text-[10px] font-black text-white uppercase tracking-widest bg-red-600 px-4 py-2 rounded-full mb-4", children: lang === 'ar' ? 'محتوى حساس محجوب' : 'Sensitive Content Blocked' }), _jsx("button", { onClick: (e) => toggleBlur(e, alert.id), className: "bg-white text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black shadow-2xl hover:bg-slate-100 transition-all active:scale-95", children: lang === 'ar' ? 'عرض الصورة (للمشرف)' : 'Reveal Image (Admin)' })] }))] }))] }) }, alert.id))) })] }));
};
export default AlertsView;

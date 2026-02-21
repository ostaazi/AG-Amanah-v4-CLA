import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { Category } from '@/types';
import { ICONS } from '@/constants';
import { translations } from '@/translations';
import { sendRemoteCommand, subscribeToAlerts } from '@/services/firestoreService';
const LiveMonitorView = ({ children, lang }) => {
    const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
    const child = children.find(c => c.id === selectedChildId) || children[0];
    const [isLockdown, setIsLockdown] = useState(false);
    const [liveScreenshot, setLiveScreenshot] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isSirenActive, setIsSirenActive] = useState(false);
    const t = translations[lang];
    // مراقبة وصول صور جديدة من هاتف الطفل
    useEffect(() => {
        if (!child || !child.parentId)
            return;
        const unsub = subscribeToAlerts(child.parentId, (alerts) => {
            // البحث عن أحدث لقطة شاشة تخص هذا الطفل تم إرسالها للتو (خلال آخر 30 ثانية مثلاً)
            const latestImageAlert = alerts.find(a => a.childName === child.name &&
                a.imageData &&
                (a.content.includes("لقطة شاشة") || a.category === Category.SAFE));
            if (latestImageAlert && latestImageAlert.imageData) {
                setLiveScreenshot(latestImageAlert.imageData);
                setIsCapturing(false);
            }
        });
        return () => unsub();
    }, [child]);
    const requestInstantScreenshot = async () => {
        if (!child)
            return;
        setIsCapturing(true);
        // إرسال الأمر للهاتف
        await sendRemoteCommand(child.id, 'takeScreenshot', true);
        // إذا لم تصل صورة خلال 15 ثانية، نلغي حالة التحميل
        setTimeout(() => setIsCapturing(false), 15000);
    };
    const triggerSiren = async () => {
        if (!child)
            return;
        setIsSirenActive(true);
        await sendRemoteCommand(child.id, 'playSiren', true);
        setTimeout(() => setIsSirenActive(false), 3000);
    };
    const toggleEmergencyLock = async () => {
        if (!child)
            return;
        const newState = !isLockdown;
        setIsLockdown(newState);
        await sendRemoteCommand(child.id, 'lockDevice', newState);
    };
    return (_jsxs("div", { className: "max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700", dir: lang === 'ar' ? 'rtl' : 'ltr', children: [_jsx("div", { className: "flex gap-4 overflow-x-auto pb-4 custom-scrollbar", children: children.map(c => (_jsxs("button", { onClick: () => { setSelectedChildId(c.id); setLiveScreenshot(null); }, className: `flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`, children: [_jsx("img", { src: c.avatar, className: "w-10 h-10 rounded-xl object-cover" }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-black text-sm", children: c.name }), _jsx("p", { className: `text-[8px] font-bold ${c.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}`, children: "Online" })] })] }, c.id))) }), _jsxs("div", { className: "flex flex-col lg:flex-row justify-between items-center gap-10 bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] shadow-xl border border-white", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsx("div", { className: `w-20 h-20 rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl ${isCapturing ? 'bg-amber-500 animate-spin' : 'bg-indigo-600 animate-pulse'}`, children: _jsx(ICONS.LiveCamera, {}) }), _jsxs("div", { children: [_jsx("h2", { className: "text-4xl font-black text-slate-900 tracking-tighter", children: "\u0645\u0631\u0643\u0632 \u0627\u0644\u0631\u0635\u062F \u0627\u0644\u062D\u0642\u064A\u0642\u064A" }), _jsxs("p", { className: "text-slate-500 font-bold text-lg mt-1", children: ["\u0627\u0644\u062A\u062D\u0643\u0645 \u0648\u0627\u0644\u062A\u0642\u0627\u0637 \u0627\u0644\u0634\u0627\u0634\u0629 \u0644\u0640: ", _jsx("span", { className: "text-indigo-600 font-black", children: child?.name || '...' })] })] })] }), _jsxs("div", { className: "flex flex-wrap justify-center gap-5", children: [_jsx("button", { onClick: toggleEmergencyLock, className: `px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl ${isLockdown ? 'bg-red-600 text-white border-b-4 border-red-800' : 'bg-slate-900 text-white'}`, children: isLockdown ? '🔓 إلغاء القفل' : '🔒 قفل الهاتف الآن' }), _jsx("button", { onClick: requestInstantScreenshot, disabled: isCapturing, className: `px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 bg-indigo-600 text-white shadow-xl shadow-indigo-100 disabled:opacity-50`, children: isCapturing ? '📡 جاري جلب اللقطة...' : '📸 التقاط شاشة حية' })] })] }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-12 gap-10", children: [_jsx("div", { className: "xl:col-span-8 space-y-10", children: _jsx("div", { className: "relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl aspect-video border-[12px] border-slate-900 ring-4 ring-indigo-500/10", children: isLockdown ? (_jsxs("div", { className: "absolute inset-0 z-50 bg-red-950/90 flex flex-col items-center justify-center text-white text-center p-10 animate-in fade-in", children: [_jsx("div", { className: "text-8xl mb-6", children: "\uD83D\uDEE1\uFE0F" }), _jsx("h4", { className: "text-5xl font-black tracking-tighter mb-4 uppercase", children: "DEVICE LOCKED" }), _jsx("p", { className: "text-red-200 text-xl font-bold", children: "\u0647\u0627\u062A\u0641 \u0627\u0644\u0637\u0641\u0644 \u0645\u063A\u0644\u0642 \u062A\u0645\u0627\u0645\u0627\u064B \u0627\u0644\u0622\u0646." })] })) : liveScreenshot ? (_jsxs("div", { className: "absolute inset-0 group", children: [_jsx("img", { src: liveScreenshot, className: "w-full h-full object-contain animate-in fade-in duration-500 bg-black", alt: "Live Stream" }), _jsx("div", { className: "absolute top-8 right-8 bg-red-600 text-white px-6 py-2 rounded-full text-[10px] font-black animate-pulse shadow-2xl", children: "\uD83D\uDD34 \u0628\u062B \u062D\u064A" }), _jsx("div", { className: "absolute bottom-8 left-8 bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-mono", children: new Date().toLocaleTimeString() })] })) : (_jsx("div", { className: "absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-8 bg-slate-900", children: isCapturing ? (_jsxs("div", { className: "flex flex-col items-center gap-6", children: [_jsx("div", { className: "w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" }), _jsx("p", { className: "font-black text-indigo-400 animate-pulse tracking-widest uppercase text-xs text-center px-10", children: "Waiting for device handshake and image upload..." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-32 h-32 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-white/10 text-5xl opacity-40", children: "\uD83D\uDC41\uFE0F" }), _jsx("p", { className: "font-black tracking-[0.4em] uppercase text-xs mb-2", children: "\u0627\u0636\u063A\u0637 \u0639\u0644\u0649 \u0632\u0631 \u0627\u0644\u062A\u0642\u0627\u0637 \u0634\u0627\u0634\u0629 \u0644\u0639\u0631\u0636 \u0627\u0644\u0628\u062B" })] })) })) }) }), _jsxs("div", { className: "xl:col-span-4 space-y-10", children: [_jsxs("div", { className: "bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white space-y-8", children: [_jsxs("h3", { className: "text-xl font-black border-b border-white/10 pb-4 flex items-center gap-3", children: [_jsx("span", { className: "w-2 h-2 bg-emerald-500 rounded-full animate-ping" }), "\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0646\u0634\u0637"] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between p-4 bg-white/5 rounded-2xl", children: [_jsx("span", { className: "text-xs font-bold text-slate-400", children: "\u0632\u0645\u0646 \u0627\u0644\u0627\u0633\u062A\u062C\u0627\u0628\u0629" }), _jsx("span", { className: "text-[10px] font-mono text-indigo-400", children: "124ms" })] }), _jsxs("div", { className: "flex items-center justify-between p-4 bg-white/5 rounded-2xl", children: [_jsx("span", { className: "text-xs font-bold text-slate-400", children: "\u062A\u0634\u0641\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A" }), _jsx("span", { className: "text-[10px] font-mono text-emerald-400", children: "AES-256" })] })] })] }), _jsxs("div", { className: "bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 flex flex-col items-center justify-center space-y-8", children: [_jsxs("div", { className: "text-center space-y-3", children: [_jsx("h3", { className: "text-2xl font-black text-slate-900 tracking-tighter", children: "\u0635\u0627\u0641\u0631\u0629 \u0627\u0644\u0637\u0648\u0627\u0631\u0626" }), _jsx("p", { className: "text-xs text-slate-400 font-bold", children: "\u0625\u0631\u0633\u0627\u0644 \u0635\u0648\u062A \u0639\u0627\u0644\u064A \u062C\u062F\u0627\u064B \u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u0637\u0641\u0644" })] }), _jsx("button", { onClick: triggerSiren, disabled: isSirenActive, className: `w-40 h-40 rounded-full border-8 border-white shadow-2xl flex items-center justify-center text-4xl transition-all active:scale-90 group ${isSirenActive ? 'bg-amber-100' : 'bg-red-50 hover:bg-red-100'}`, children: _jsx("span", { className: `${isSirenActive ? 'animate-ping' : 'group-hover:animate-bounce'}`, children: "\uD83D\uDCE2" }) })] })] })] })] }));
};
export default LiveMonitorView;

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { CommandPriority } from '@/types';
import { sendSovereignCommand } from '@/services/firestoreService';
const CommandCenter = ({ child, currentUser }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showReasonInput, setShowReasonInput] = useState(null);
    const [reasonText, setReasonText] = useState('');
    const issueCommand = async (type, priority = CommandPriority.MEDIUM, params = {}) => {
        // التحقق مما إذا كان الأمر يتطلب سبباً (للأوامر الحساسة)
        const sensitiveCommands = ['BLACKOUT_OVERLAY', 'DEVICE_UNLOCK', 'NET_QUARANTINE'];
        if (sensitiveCommands.includes(type) && !reasonText) {
            setShowReasonInput({ type, priority, params });
            return;
        }
        setIsProcessing(true);
        await sendSovereignCommand(currentUser.id, child.id, type, params, priority, reasonText);
        setIsProcessing(false);
        setShowReasonInput(null);
        setReasonText('');
        alert(`تم إرسال أمر ${type} بنجاح للأولوية ${priority}`);
    };
    const commands = [
        { type: 'BLACKOUT_OVERLAY', label: 'تعتيم الشاشة', icon: '🌑', priority: CommandPriority.CRITICAL, color: 'bg-red-600' },
        { type: 'NET_QUARANTINE', label: 'حجر الشبكة', icon: '📡', priority: CommandPriority.HIGH, color: 'bg-indigo-600' },
        { type: 'REQUEST_SCREENSHOT', label: 'لقطة شاشة حية', icon: '📸', priority: CommandPriority.MEDIUM, color: 'bg-slate-900' },
        { type: 'WALKIE_START', label: 'فتح اللاسلكي', icon: '📻', priority: CommandPriority.MEDIUM, color: 'bg-emerald-600' },
        { type: 'CAMERA_BLOCK', label: 'حجب الكاميرا', icon: '📷', priority: CommandPriority.HIGH, color: 'bg-amber-600' },
        { type: 'MIC_BLOCK', label: 'حجب المايك', icon: '🎙️', priority: CommandPriority.HIGH, color: 'bg-amber-600' },
    ];
    return (_jsxs("div", { className: "space-y-8 animate-in fade-in", dir: "rtl", children: [_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-4", children: commands.map(cmd => (_jsxs("button", { onClick: () => issueCommand(cmd.type, cmd.priority), disabled: isProcessing, className: `p-6 rounded-[2.2rem] text-white flex flex-col items-center justify-center gap-3 shadow-xl active:scale-95 transition-all hover:scale-105 relative overflow-hidden ${cmd.color} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("span", { className: "text-3xl relative z-10", children: cmd.icon }), _jsx("span", { className: "font-black text-xs relative z-10", children: cmd.label }), _jsx("div", { className: "absolute top-2 right-2 px-2 py-0.5 bg-white/10 rounded-md text-[7px] font-black uppercase tracking-widest", children: cmd.priority })] }, cmd.type))) }), showReasonInput && (_jsx("div", { className: "fixed inset-0 z-[9500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in", children: _jsxs("div", { className: "bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 space-y-8 text-right border-4 border-white", children: [_jsxs("div", { className: "flex items-center gap-5", children: [_jsx("div", { className: "w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-3xl", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "text-2xl font-black text-slate-800", children: "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0633\u064A\u0627\u062F\u064A" }), _jsx("p", { className: "text-slate-400 font-bold text-xs", children: "\u064A\u062A\u0637\u0644\u0628 \u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631 \u062A\u0633\u062C\u064A\u0644 \u0633\u0628\u0628 \u0644\u0644\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u062C\u0646\u0627\u0626\u064A." })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2", children: "\u0627\u0644\u0633\u0628\u0628 (\u0645\u0637\u0644\u0648\u0628)" }), _jsx("textarea", { value: reasonText, onChange: e => setReasonText(e.target.value), placeholder: "\u0645\u062B\u0627\u0644: \u0631\u0635\u062F \u0645\u062D\u0627\u0648\u0644\u0629 \u0627\u0633\u062A\u062F\u0631\u0627\u062C \u0646\u0634\u0637\u0629...", className: "w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-red-600 transition-all min-h-[120px] text-right" })] }), _jsxs("div", { className: "flex gap-4", children: [_jsx("button", { onClick: () => issueCommand(showReasonInput.type, showReasonInput.priority, showReasonInput.params), className: "flex-1 py-5 bg-red-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all", children: "\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0645\u0648\u062B\u0642" }), _jsx("button", { onClick: () => setShowReasonInput(null), className: "px-8 py-5 bg-slate-50 text-slate-400 rounded-2xl font-black", children: "\u0625\u0644\u063A\u0627\u0621" })] })] }) }))] }));
};
export default CommandCenter;

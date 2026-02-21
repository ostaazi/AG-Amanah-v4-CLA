import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '@/constants';
const LiveMonitorView = ({ children, lang }) => {
    const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
    const child = children.find(c => c.id === selectedChildId) || children[0];
    const [isLive, setIsLive] = useState(false);
    const [isLockdown, setIsLockdown] = useState(false);
    const [isTalking, setIsTalking] = useState(false);
    // خيارات المصادر
    const [videoSource, setVideoSource] = useState('camera');
    const [audioSource, setAudioSource] = useState('mic');
    const videoRef = useRef(null);
    const [waveform, setWaveform] = useState(new Array(30).fill(5));
    useEffect(() => {
        let interval;
        if (isLive || isTalking) {
            interval = setInterval(() => {
                setWaveform(prev => prev.map(() => Math.random() * 40 + 5));
            }, 80);
        }
        else {
            setWaveform(new Array(30).fill(4));
        }
        return () => clearInterval(interval);
    }, [isLive, isTalking]);
    const toggleLive = async () => {
        if (!isLive) {
            try {
                let stream;
                if (videoSource === 'screen') {
                    // بث الشاشة - يتطلب getDisplayMedia
                    stream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                        audio: audioSource === 'system' // طلب صوت النظام مع الشاشة
                    });
                }
                else {
                    // بث الكاميرا - يتطلب getUserMedia
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: audioSource === 'mic'
                    });
                }
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsLive(true);
            }
            catch (err) {
                console.error("Live streaming error:", err);
                const msg = lang === 'ar'
                    ? 'تعذر الوصول للمصدر المختار. يرجى التأكد من منح الصلاحيات اللازمة في المتصفح.'
                    : 'Could not access the selected source. Please check browser permissions.';
                alert(msg);
            }
        }
        else {
            const stream = videoRef.current?.srcObject;
            stream?.getTracks().forEach(track => track.stop());
            if (videoRef.current)
                videoRef.current.srcObject = null;
            setIsLive(false);
        }
    };
    return (_jsxs("div", { className: "max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700", dir: "rtl", children: [_jsx("div", { className: "flex gap-4 overflow-x-auto pb-4 custom-scrollbar", children: children.map(c => (_jsxs("button", { onClick: () => { setSelectedChildId(c.id); setIsLive(false); }, className: `flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`, children: [_jsx("img", { src: c.avatar, className: "w-10 h-10 rounded-xl object-cover border-2 border-white" }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "font-black text-sm", children: c.name }), _jsx("p", { className: `text-[8px] font-bold ${c.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}`, children: c.status === 'online' ? 'متصل' : 'أوفلاين' })] })] }, c.id))) }), _jsxs("div", { className: "flex flex-col lg:flex-row justify-between items-center gap-10 bg-white/70 backdrop-blur-xl p-10 rounded-[3rem] shadow-xl border border-white", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsx("div", { className: "w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl animate-pulse", children: _jsx(ICONS.LiveCamera, {}) }), _jsxs("div", { children: [_jsx("h2", { className: "text-4xl font-black text-slate-900 tracking-tighter", children: "\u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u062D\u0643\u0645 \u0627\u0644\u0645\u0628\u0627\u0634\u0631" }), _jsxs("p", { className: "text-slate-500 font-bold text-lg mt-1", children: ["\u0628\u062B \u0645\u0628\u0627\u0634\u0631 \u0644\u062C\u0647\u0627\u0632: ", _jsx("span", { className: "text-indigo-600 font-black", children: child.name })] })] })] }), _jsxs("div", { className: "flex flex-wrap justify-center gap-5", children: [_jsx("button", { onClick: () => setIsLockdown(!isLockdown), className: `px-10 py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 ${isLockdown ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`, children: isLockdown ? '🔓 إلغاء التعتيم' : '🌑 تعتيم الشاشة' }), _jsx("button", { onClick: toggleLive, className: `px-10 py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 ${isLive ? 'bg-indigo-950 text-white' : 'bg-indigo-600 text-white shadow-indigo-100'}`, children: isLive ? '🔴 إنهاء البث' : '📡 فتح بث مباشر' })] })] }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-12 gap-10", children: [_jsx("div", { className: "xl:col-span-8 space-y-10", children: _jsxs("div", { className: "relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.3)] aspect-video border-[12px] border-slate-900 ring-4 ring-indigo-500/20 group", children: [isLockdown && (_jsxs("div", { className: "absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white text-center p-10 animate-in fade-in", children: [_jsx("div", { className: "text-7xl mb-6", children: "\uD83C\uDF11" }), _jsx("h4", { className: "text-4xl font-black tracking-tighter mb-4 uppercase", children: "\u0648\u0636\u0639 \u0627\u0644\u0642\u0641\u0644 \u0627\u0644\u0646\u0634\u0637" }), _jsxs("p", { className: "text-slate-400 font-bold text-lg max-w-md", children: ["\u0634\u0627\u0634\u0629 ", child.name, " \u0645\u0639\u0637\u0644\u0629 \u062A\u0645\u0627\u0645\u0627\u064B \u0627\u0644\u0622\u0646 \u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u062D\u0645\u0627\u064A\u0629."] })] })), !isLive ? (_jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center text-white/20 space-y-8 bg-slate-900", children: [_jsx("div", { className: "w-32 h-32 bg-white/5 rounded-3xl flex items-center justify-center border-2 border-white/10 text-5xl opacity-40", children: _jsx(ICONS.LiveCamera, {}) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-black tracking-[0.4em] uppercase text-xs mb-2", children: "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0625\u0634\u0627\u0631\u0629 \u0627\u0644\u0628\u062B" }), _jsx("p", { className: "text-[10px] font-bold text-slate-500", children: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u062B\u0645 \u0627\u0628\u062F\u0623 \u0627\u0644\u0628\u062B" })] })] })) : (_jsxs(_Fragment, { children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" }), _jsx("div", { className: "absolute top-8 right-8 flex gap-4", children: _jsxs("div", { className: "bg-red-600 text-white text-[10px] font-black px-8 py-3 rounded-full flex items-center gap-3 shadow-2xl", children: [_jsx("span", { className: "w-2.5 h-2.5 bg-white rounded-full animate-ping" }), "LIVE \u2022 ", videoSource === 'camera' ? 'CAMERA' : 'SCREEN'] }) })] }))] }) }), _jsxs("div", { className: "xl:col-span-4 space-y-10", children: [_jsxs("div", { className: "bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white shadow-xl space-y-8", children: [_jsxs("h3", { className: "text-xl font-black text-slate-800 border-b pb-4 flex items-center gap-3", children: ["\u062A\u0643\u0648\u064A\u0646 \u0627\u0644\u0628\u062B", _jsx("span", { className: "text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black", children: "AI Config" })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest px-2", children: "\u0645\u0635\u062F\u0631 \u0627\u0644\u0641\u064A\u062F\u064A\u0648" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("button", { onClick: () => !isLive && setVideoSource('camera'), className: `p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${videoSource === 'camera' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("span", { className: "text-2xl", children: "\uD83D\uDCF7" }), _jsx("span", { className: "text-[10px] font-black", children: "\u0627\u0644\u0643\u0627\u0645\u064A\u0631\u0627" })] }), _jsxs("button", { onClick: () => !isLive && setVideoSource('screen'), className: `p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${videoSource === 'screen' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("span", { className: "text-2xl", children: "\uD83D\uDCF1" }), _jsx("span", { className: "text-[10px] font-black", children: "\u0634\u0627\u0634\u0629 \u0627\u0644\u062C\u0647\u0627\u0632" })] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest px-2", children: "\u0645\u0635\u062F\u0631 \u0627\u0644\u0635\u0648\u062A" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("button", { onClick: () => !isLive && setAudioSource('mic'), className: `p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${audioSource === 'mic' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("span", { className: "text-2xl", children: "\uD83C\uDF99\uFE0F" }), _jsx("span", { className: "text-[10px] font-black", children: "\u0627\u0644\u0645\u064A\u0643\u0631\u0648\u0641\u0648\u0646" })] }), _jsxs("button", { onClick: () => !isLive && setAudioSource('system'), className: `p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${audioSource === 'system' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'} ${isLive ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("span", { className: "text-2xl", children: "\uD83D\uDD0A" }), _jsx("span", { className: "text-[10px] font-black", children: "\u0635\u0648\u062A \u0627\u0644\u0646\u0638\u0627\u0645" })] })] })] })] }), isLive && (_jsx("div", { className: "p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-pulse", children: _jsx("p", { className: "text-[9px] font-black text-indigo-700 text-center leading-relaxed", children: "\u064A\u062A\u0645 \u0627\u0644\u0622\u0646 \u0627\u0644\u0628\u062B \u0627\u0644\u0645\u0628\u0627\u0634\u0631. \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0645\u0635\u0627\u062F\u0631 \u064A\u062A\u0637\u0644\u0628 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0628\u062B \u0627\u0644\u062D\u0627\u0644\u064A \u0623\u0648\u0644\u0627\u064B." }) }))] }), _jsxs("div", { className: "bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 flex flex-col items-center justify-center space-y-12 relative overflow-hidden group", children: [_jsxs("div", { className: "text-center space-y-3 relative z-10", children: [_jsx("div", { className: "w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner border border-indigo-100 mb-6", children: "\uD83D\uDCFB" }), _jsx("h3", { className: "text-3xl font-black text-slate-900 tracking-tighter", children: "\u062C\u0647\u0627\u0632 \u0644\u0627\u0633\u0644\u0643\u064A" })] }), _jsx("div", { className: "flex items-center justify-center gap-1.5 h-32 w-full px-4 relative z-10", children: waveform.map((h, i) => (_jsx("div", { className: `w-1.5 rounded-full transition-all duration-150 ${isTalking ? 'bg-indigo-600' : 'bg-slate-200'}`, style: { height: `${h}%`, opacity: isTalking ? 1 : 0.4 } }, i))) }), _jsx("div", { className: "relative z-10", children: _jsxs("button", { onMouseDown: () => setIsTalking(true), onMouseUp: () => setIsTalking(false), onTouchStart: () => setIsTalking(true), onTouchEnd: () => setIsTalking(false), className: `w-52 h-52 rounded-full border-[10px] transition-all active:scale-90 shadow-2xl flex flex-col items-center justify-center gap-4 ${isTalking ? 'bg-indigo-600 border-indigo-400 text-white scale-105' : 'bg-slate-50 border-white text-slate-300'}`, children: [_jsx("div", { className: isTalking ? 'animate-bounce' : '', children: _jsx(ICONS.WalkieTalkie, {}) }), _jsx("span", { className: "text-[10px] font-black uppercase tracking-widest", children: isTalking ? 'تحدث الآن' : 'اضغط للتحدث' })] }) })] })] })] })] }));
};
export default LiveMonitorView;

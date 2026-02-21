import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useRef, useEffect } from 'react';
import { localSentinelCheck } from '@/services/securitySentinel';
import { analyzeContent } from '@/services/geminiService';
import { loadVisualSentinelModel, scanImageLocally } from '@/services/visualSentinel';
import { saveAlertToDB } from '@/services/firestoreService';
import { Category, AlertSeverity } from '@/types';
const AR_SCENARIOS = [
    { id: 'blackmail', label: '🕵️‍♂️ ابتزاز مالي', color: 'bg-slate-800 hover:bg-slate-900', text: 'اسمع يا حلو، عندي صورك اللي أرسلتها أمس. إذا ما حولت لي رصيد شحن بـ 500 ريال الحين، راح أنشرها في قروب المدرسة وأرسلها لأبوك. معاك ساعة وحدة بس!' },
    { id: 'bullying', label: '🤬 تنمر وتوكسيك', color: 'bg-slate-800 hover:bg-slate-900', text: 'أنت إنسان فاشل والكل يكرهك. ليش عايش أصلاً؟ لو منك أنتحر وأريح العالم. لا تجي المدرسة بكرة لأننا بنضربك.' },
    { id: 'grooming', label: '🐺 استدراج', color: 'bg-slate-800 hover:bg-slate-900', text: 'ممكن نفتح كاميرا؟ أبي أشوفك. تعال غرفتك وقفل الباب عشان أوريك السكن الجديد. لا تعلم أحد، هذا سر بيننا.' },
];
const EN_SCENARIOS = [
    { id: 'blackmail', label: '🕵️‍♂️ Financial Blackmail', color: 'bg-slate-800 hover:bg-slate-900', text: 'Listen kid, I have the photos you sent yesterday. If you don\'t send me a $100 gift card right now, I will post them in the school group and send them to your dad. You have one hour!' },
    { id: 'bullying', label: '🤬 Bullying & Toxic', color: 'bg-slate-800 hover:bg-slate-900', text: 'You are a loser and everyone hates you. Why are you even alive? Kill yourself and save the world.' },
    { id: 'grooming', label: '🐺 Predator / Grooming', color: 'bg-slate-800 hover:bg-slate-900', text: 'Can we open camera? I want to see you. Go to your room and lock the door so I can show you the new skin.' },
];
const SimulatorView = ({ children, parentId, lang }) => {
    const [text, setText] = useState('');
    const [displayImage, setDisplayImage] = useState(null);
    const [compressedImage, setCompressedImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [engineStatus, setEngineStatus] = useState('IDLE');
    const [latency, setLatency] = useState('');
    const fileInputRef = useRef(null);
    const hiddenImgRef = useRef(null);
    useEffect(() => {
        loadVisualSentinelModel();
    }, []);
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 320;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.5));
                };
            };
        });
    };
    const processImage = async (file) => {
        const reader = new FileReader();
        reader.onload = (e) => setDisplayImage(e.target?.result);
        reader.readAsDataURL(file);
        const compressed = await compressImage(file);
        setCompressedImage(compressed);
        setEngineStatus('IDLE');
    };
    const handleSimulate = async () => {
        if (loading || (!text.trim() && !displayImage))
            return;
        setEngineStatus('SCANNING');
        setLoading(true);
        const child = children[0] || { name: 'أحمد' };
        const startTime = performance.now();
        try {
            let localTextCheck = { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, skeleton: "", latency: "0ms" };
            if (text.trim()) {
                localTextCheck = localSentinelCheck(text);
            }
            if (localTextCheck.isDanger) {
                await finalizeAlert(child, text, localTextCheck.category, localTextCheck.severity, localTextCheck.latency, `[Turbo Text V19] رصد محلي فوري للبصمة النصية.`, `قفل فوري للجهاز وإبلاغ المشرف`);
                setText(''); // تصفير النص لمنع التكرار
                setDisplayImage(null);
                return;
            }
            if (displayImage && hiddenImgRef.current) {
                const visualCheck = await scanImageLocally(hiddenImgRef.current);
                if (visualCheck.isDanger) {
                    await finalizeAlert(child, text || '[صورة مشبوهة]', visualCheck.category, visualCheck.severity, visualCheck.latency, `[Visual Sentinel] رصد بصري محلي (${visualCheck.label})`, `حجب الصورة محلياً وعزل الجهاز`);
                    setText('');
                    setDisplayImage(null);
                    return;
                }
            }
            const aiResult = await analyzeContent(text, child.name, 'Instagram/Direct', compressedImage || undefined);
            const endTime = performance.now();
            const cloudLatency = (endTime - startTime).toFixed(0) + 'ms';
            setLatency(cloudLatency);
            if (aiResult.category !== Category.SAFE) {
                await finalizeAlert(child, text, aiResult.category, aiResult.severity, cloudLatency, aiResult.aiAnalysis || 'تحليل ذكاء اصطناعي عميق.', aiResult.actionTaken || 'تدخل وقائي', aiResult.suspectUsername, aiResult.conversationLog);
                setText('');
                setDisplayImage(null);
            }
            else {
                setEngineStatus('SAFE');
            }
        }
        catch (e) {
            console.error(e);
            setEngineStatus('IDLE');
        }
        finally {
            setLoading(false);
        }
    };
    const finalizeAlert = async (child, content, category, severity, lat, analysis, action, suspect, log) => {
        setLatency(String(lat));
        setEngineStatus('STRUCK');
        const suspectId = String(suspect || 'SUSPECT-' + Math.random().toString(36).substr(2, 6).toUpperCase());
        const alertData = {
            childName: String(child?.name || 'أحمد'),
            platform: 'Instagram',
            content: String(content || '[محتوى صورة]'),
            imageData: displayImage ? String(displayImage) : undefined,
            category: String(category),
            severity: String(severity),
            latency: String(lat),
            suspectId: suspectId,
            suspectUsername: suspectId,
            aiAnalysis: String(analysis),
            actionTaken: String(action),
            conversationLog: log && Array.isArray(log) ? log.map(m => ({
                sender: String(m.sender),
                text: String(m.text),
                time: String(m.time),
                isSuspect: !!m.isSuspect
            })) : [
                { sender: suspectId, text: String(content), time: new Date().toLocaleTimeString(), isSuspect: true },
                { sender: String(child?.name || 'أحمد'), text: "لا أعرفك!", time: new Date().toLocaleTimeString(), isSuspect: false }
            ]
        };
        await saveAlertToDB(parentId, alertData);
    };
    return (_jsxs("div", { className: "max-w-xl mx-auto space-y-8 pb-40 animate-in fade-in", dir: lang === 'ar' ? 'rtl' : 'ltr', children: [displayImage && _jsx("img", { ref: hiddenImgRef, src: displayImage, className: "hidden", crossOrigin: "anonymous", alt: "target" }), _jsxs("div", { className: `text-center p-12 rounded-[4rem] border-4 transition-all duration-500 shadow-2xl relative overflow-hidden ${engineStatus === 'STRUCK' ? 'bg-red-600 border-red-400 text-white shadow-red-200' :
                    engineStatus === 'SAFE' ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-200' :
                        'bg-[#020617] border-indigo-500/20 text-white'}`, children: [_jsx("div", { className: "text-7xl mb-6 drop-shadow-lg relative z-10", children: engineStatus === 'SCANNING' ? '👁️' : engineStatus === 'STRUCK' ? '⚡' : engineStatus === 'SAFE' ? '✅' : '🛡️' }), _jsx("h2", { className: "text-4xl font-black tracking-tighter mb-2 relative z-10", children: "Turbo Vision V2.1" }), _jsxs("div", { className: "flex items-center justify-center gap-4 opacity-60 relative z-10", children: [_jsx("span", { className: "text-[10px] font-black uppercase tracking-[0.3em]", children: "Hybrid Edge/Cloud Engine" }), latency && _jsx("span", { className: "px-3 py-1 rounded-full text-[9px] font-mono font-black bg-white/20", children: latency })] })] }), _jsxs("div", { className: "bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-6", children: [_jsxs("div", { onClick: () => !loading && fileInputRef.current?.click(), className: `relative w-full h-48 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${displayImage ? 'border-indigo-500 bg-slate-900' : 'border-slate-300 bg-slate-50'}`, children: [_jsx("input", { type: "file", ref: fileInputRef, hidden: true, accept: "image/*", onChange: (e) => e.target.files?.[0] && processImage(e.target.files[0]) }), displayImage ? _jsx("img", { src: displayImage, className: "w-full h-full object-cover opacity-60", alt: "preview" }) : _jsxs("div", { className: "text-center", children: [_jsx("span", { className: "text-4xl opacity-50 block", children: "\uD83D\uDDBC\uFE0F" }), _jsx("p", { className: "text-xs font-black text-slate-400", children: "\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0645\u0634\u0628\u0648\u0647\u0629" })] })] }), _jsx("textarea", { rows: 2, value: text, onChange: (e) => setText(e.target.value), placeholder: "\u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629...", className: "w-full p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100 outline-none font-bold text-right", disabled: loading }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: (lang === 'ar' ? AR_SCENARIOS : EN_SCENARIOS).map((s) => (_jsx("button", { onClick: () => setText(s.text), className: `py-3 px-2 rounded-xl text-white text-[10px] font-black shadow-md ${s.color}`, disabled: loading, children: s.label }, s.id))) }), _jsx("button", { onClick: handleSimulate, disabled: loading || (!text.trim() && !displayImage), className: "w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-lg active:scale-95 shadow-xl disabled:bg-slate-400 disabled:shadow-none", children: loading ? 'جاري التحليل...' : 'تشغيل المحاكاة الهجينة' })] })] }));
};
export default SimulatorView;

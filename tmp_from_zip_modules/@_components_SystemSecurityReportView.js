import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield, AmanahGlobalDefs } from '@/constants';
import { runFullSecurityAudit, getPerformanceReport, getQualityMetrics, applySystemPatch, rollbackSystemPatch, getAuditHistory } from '@/services/auditService';
import { auth, db } from '@/services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
const SystemSecurityReportView = () => {
    const [activeTab, setActiveTab] = useState('SECURITY');
    const [vulns, setVulns] = useState([]);
    const [perf, setPerf] = useState(null);
    const [quality, setQuality] = useState([]);
    const [history, setHistory] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(null);
    const currentParentId = auth?.currentUser?.uid || 'guest';
    // التحقق من الرتبة من قاعدة البيانات لضمان عدم التلاعب
    useEffect(() => {
        const checkRole = async () => {
            if (currentParentId === 'guest') {
                setIsAuthorized(false);
                return;
            }
            try {
                const parentDoc = await getDoc(doc(db, "parents", currentParentId));
                if (parentDoc.exists()) {
                    const role = parentDoc.data().role;
                    const staffRoles = ['RELEASE_MANAGER', 'DEVELOPER', 'SOC_ANALYST', 'SRE', 'PLATFORM_ADMIN'];
                    setIsAuthorized(staffRoles.includes(role));
                }
                else {
                    setIsAuthorized(false);
                }
            }
            catch {
                setIsAuthorized(false);
            }
        };
        checkRole();
    }, [currentParentId]);
    const refreshData = async () => {
        if (isAuthorized === false)
            return;
        setIsScanning(true);
        setVulns([]);
        try {
            const [v, p, q, h] = await Promise.all([
                runFullSecurityAudit(),
                getPerformanceReport(),
                getQualityMetrics(),
                getAuditHistory()
            ]);
            setVulns(v);
            setPerf(p);
            setQuality(q);
            setHistory(h);
        }
        catch (e) {
            console.error("Audit Failure", e);
        }
        finally {
            setIsScanning(false);
        }
    };
    useEffect(() => {
        if (isAuthorized)
            refreshData();
    }, [isAuthorized]);
    if (isAuthorized === false) {
        return (_jsxs("div", { className: "min-h-[60vh] flex flex-col items-center justify-center text-center p-10 space-y-6", children: [_jsx("div", { className: "w-32 h-32 bg-red-50 text-red-600 rounded-[3rem] flex items-center justify-center text-6xl shadow-inner animate-pulse", children: "\uD83D\uDEAB" }), _jsx("h2", { className: "text-3xl font-black text-slate-900", children: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u062F\u062E\u0648\u0644" }), _jsx("p", { className: "text-slate-500 font-bold max-w-md", children: "\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0648\u0623\u062F\u0648\u0627\u062A \u0627\u0644\u062D\u0642\u0646 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0642\u0627\u0635\u0631\u0629 \u0641\u0642\u0637 \u0639\u0644\u0649 \u0641\u0631\u0642 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0633\u064A\u0627\u062F\u064A\u0629 (Developers/SOC/SRE). \u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0645\u062D\u0627\u0648\u0644\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u0647\u0630\u0647." })] }));
    }
    if (isAuthorized === null)
        return _jsx("div", { className: "p-20 text-center font-black animate-pulse text-indigo-600", children: "Verifying Security Credentials..." });
    // Patch Wizard States
    const [selectedVuln, setSelectedVuln] = useState(null);
    const [wizardStep, setWizardStep] = useState(0);
    const [sandboxInput, setSandboxInput] = useState('');
    const [testResult, setTestResult] = useState('IDLE');
    const handleStartRemediation = (v) => {
        setSelectedVuln(v);
        setWizardStep(1);
        setTestResult('IDLE');
        setSandboxInput('');
    };
    const runSandboxTest = () => {
        if (!selectedVuln)
            return;
        if (sandboxInput === selectedVuln.testScenario.payload) {
            setTestResult('FAIL');
        }
        else {
            setTestResult('SUCCESS');
        }
    };
    const handleCommitPatch = async () => {
        if (selectedVuln && currentParentId !== 'guest') {
            await applySystemPatch(currentParentId, selectedVuln.id);
            setWizardStep(3);
        }
    };
    const handleUndoPatch = async (id) => {
        if (window.confirm("⚠️ التراجع عن التصحيح السحابي سيعيد الكود للحالة الضعيفة فوراً في جميع الأجهزة. هل تريد المتابعة؟")) {
            await rollbackSystemPatch(currentParentId, id);
            await refreshData();
        }
    };
    return (_jsxs("div", { className: "max-w-7xl mx-auto space-y-10 pb-40 animate-in fade-in", dir: "rtl", children: [_jsx(AmanahGlobalDefs, {}), _jsx("div", { className: "bg-[#020617] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]", children: _jsxs("div", { className: "relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10", children: [_jsxs("div", { className: "flex items-center gap-8", children: [_jsx("div", { className: "w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-inner", children: _jsx(AmanahShield, { className: "w-16 h-16", animate: isScanning }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-4xl font-black tracking-tighter mb-1", children: "Cloud Integrity Hub" }), _jsx("p", { className: "text-indigo-300 font-bold opacity-80 text-lg", children: "\u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0645\u0646 \u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0627\u0644\u0633\u064A\u0627\u062F\u064A\u0629" })] })] }), _jsx("div", { className: "flex gap-4", children: _jsx("button", { onClick: () => { if (!isScanning)
                                    refreshData(); }, disabled: isScanning, className: `bg-[#D1A23D] text-black px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`, children: isScanning ? 'جاري التدقيق السحابي...' : 'إعادة فحص السيادة' }) })] }) }), _jsx("div", { className: "flex gap-4 overflow-x-auto pb-2 custom-scrollbar justify-center", children: [
                    { id: 'SECURITY', label: 'خارطة الثغرات', icon: '🛡️' },
                    { id: 'PERFORMANCE', label: 'كفاءة السحابة', icon: '🚀' },
                    { id: 'QUALITY', label: 'النزاهة السيادية', icon: '💎' },
                    { id: 'HISTORY', label: 'سجل التصحيحات', icon: '📜' }
                ].map(tab => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `px-10 py-5 rounded-2xl font-black text-sm whitespace-nowrap transition-all flex items-center gap-3 border-2 ${activeTab === tab.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`, children: [_jsx("span", { children: tab.icon }), _jsx("span", { children: tab.label })] }, tab.id))) }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-12 gap-10", children: [_jsx("div", { className: "xl:col-span-8 space-y-10", children: activeTab === 'SECURITY' && (_jsxs("div", { className: "bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 space-y-8 animate-in slide-in-from-bottom-4", children: [_jsxs("div", { className: "flex justify-between items-center px-4", children: [_jsx("h3", { className: "text-2xl font-black text-slate-800", children: "\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0643\u0648\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0633\u0629 (Cloud Audit)" }), _jsx("div", { className: "flex gap-3", children: isScanning ? _jsx("span", { className: "text-[10px] bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full font-black animate-pulse", children: "\u062C\u0627\u0631\u064A \u0641\u062D\u0635 \u0627\u0644\u0646\u0632\u0627\u0647\u0629 \u0641\u064A Firestore..." }) : (_jsxs(_Fragment, { children: [_jsxs("span", { className: "text-[10px] bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-black", children: ["\u0646\u0634\u0637\u0629: ", vulns.filter(v => v.status === 'OPEN').length] }), _jsxs("span", { className: "text-[10px] bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-black", children: ["\u0645\u0624\u0645\u0646\u0629: ", vulns.filter(v => v.status === 'PATCHED').length] })] })) })] }), _jsx("div", { className: "space-y-6", children: vulns.map(v => (_jsxs("div", { className: `p-8 rounded-[3rem] border transition-all ${v.status === 'PATCHED' ? 'bg-emerald-50/20 border-emerald-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-xl group'}`, children: [_jsxs("div", { className: "flex justify-between items-start mb-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: `px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${v.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`, children: v.severity }), _jsx("h4", { className: "text-xl font-black text-slate-800", children: v.title })] }), v.status === 'PATCHED' ? (_jsxs("div", { className: "flex flex-col items-end gap-1", children: [_jsx("span", { className: "bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg", children: "CLOUD VERIFIED \u2713" }), _jsx("span", { className: "text-[8px] font-mono font-bold text-emerald-600 opacity-60", children: v.integrityHash })] })) : (_jsxs("div", { className: "flex flex-col items-end gap-1", children: [_jsx("span", { className: "bg-red-500 text-white px-5 py-2 rounded-xl text-[10px] font-black", children: "VULNERABLE \uD83D\uDED1" }), _jsx("span", { className: "text-[8px] font-mono font-bold text-slate-400", children: v.file })] }))] }), _jsxs("p", { className: "text-sm font-bold text-slate-500 mb-6 italic", children: ["\"", v.impact, "\""] }), v.status === 'OPEN' ? (_jsxs("button", { onClick: () => handleStartRemediation(v), className: "w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4", children: [_jsx("span", { children: "\uD83E\uDDEA" }), "\u0641\u062A\u062D \u0645\u0639\u0627\u0644\u062C \u0627\u0644\u062A\u0635\u062D\u064A\u062D \u0627\u0644\u0633\u062D\u0627\u0628\u064A"] })) : (_jsxs("div", { className: "bg-white/50 p-6 rounded-[2.5rem] border border-emerald-100 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl animate-pulse", children: "\uD83D\uDEE1\uFE0F" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-black text-emerald-800", children: "\u0627\u0644\u062D\u0627\u0644\u0629: \u0627\u0644\u062A\u0635\u062D\u064A\u062D \u0646\u0634\u0637 \u0639\u0627\u0644\u0645\u064A\u0627\u064B (Sovereign)" }), _jsxs("p", { className: "text-[9px] font-bold text-emerald-600", children: ["\u062A\u0645 \u062D\u0642\u0646 \u0627\u0644\u0645\u0646\u0637\u0642 \u0641\u064A \u0627\u0644\u0633\u062D\u0627\u0628\u0629 \u0644\u0645\u0644\u0641 ", v.file, "."] })] })] }), _jsx("button", { onClick: () => handleUndoPatch(v.id), className: "px-6 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm", children: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u0642\u0646 \u0627\u0644\u0633\u062D\u0627\u0628\u064A" })] }))] }, v.id))) })] })) }), _jsx("div", { className: "xl:col-span-4 space-y-8", children: _jsxs("div", { className: "bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl border-b-8 border-indigo-600 sticky top-32", children: [_jsxs("div", { className: "flex items-center gap-5 mb-10", children: [_jsx("div", { className: "w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl", children: "\uD83D\uDCB9" }), _jsx("h3", { className: "text-2xl font-black tracking-tighter", children: "\u0646\u0632\u0627\u0647\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u0629" })] }), _jsx("div", { className: "space-y-10", children: _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2", children: "\u062F\u0631\u062C\u0629 \u0627\u0644\u062A\u062D\u0635\u064A\u0646 \u0627\u0644\u0639\u0627\u0644\u0645\u064A" }), _jsxs("div", { className: "relative inline-block", children: [_jsxs("svg", { className: "w-40 h-40 transform -rotate-90", children: [_jsx("circle", { cx: "80", cy: "80", r: "70", stroke: "currentColor", strokeWidth: "15", fill: "transparent", className: "text-white/5" }), _jsx("circle", { cx: "80", cy: "80", r: "70", stroke: "currentColor", strokeWidth: "15", fill: "transparent", strokeDasharray: 440, strokeDashoffset: 440 - (440 * ((perf?.safetyIndex || 70) / 100)), className: "text-indigo-500 transition-all duration-1000", strokeLinecap: "round" })] }), _jsx("div", { className: "absolute inset-0 flex flex-col items-center justify-center", children: _jsxs("span", { className: "text-4xl font-black", children: [perf?.safetyIndex || 70, "%"] }) })] })] }) })] }) })] }), wizardStep > 0 && selectedVuln && (_jsx("div", { className: "fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in", children: _jsxs("div", { className: "bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border-4 border-white animate-in zoom-in-95 max-h-[90vh]", children: [_jsxs("div", { className: "bg-slate-900 p-8 flex justify-between items-center text-white", children: [_jsx("div", { className: "flex gap-4", children: [1, 2, 3].map(s => _jsx("div", { className: `w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${wizardStep >= s ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-white/10 text-white/40'}`, children: s }, s)) }), _jsxs("h3", { className: "text-xl font-black", children: ["\u062D\u0642\u0646 \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0633\u062D\u0627\u0628\u064A: ", selectedVuln.id] }), _jsx("button", { onClick: () => setWizardStep(0), className: "text-white/60 hover:text-white transition-colors", children: _jsx(ICONS.Close, {}) })] }), _jsxs("div", { className: "p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 space-y-10 text-right", children: [wizardStep === 1 && (_jsxs("div", { className: "space-y-8 animate-in slide-in-from-left-5", children: [_jsx("h3", { className: "text-3xl font-black text-slate-800", children: "\u0661. \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0627\u0644\u0645\u0637\u0648\u0631" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-[10px]", dir: "ltr", children: [_jsxs("div", { className: "bg-red-50 p-6 rounded-3xl border border-red-100 shadow-inner", children: [_jsx("p", { className: "text-red-500 mb-2 font-black uppercase text-[8px]", children: "Old (Vulnerable) \uD83D\uDED1" }), _jsx("pre", { className: "text-red-700 opacity-60 line-through whitespace-pre-wrap", children: selectedVuln.vulnerableCode })] }), _jsxs("div", { className: "bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-inner", children: [_jsx("p", { className: "text-emerald-500 mb-2 font-black uppercase text-[8px]", children: "New (Cloud Hardened) \u2705" }), _jsx("pre", { className: "text-emerald-700 whitespace-pre-wrap", children: selectedVuln.remediationCode })] })] }), _jsx("button", { onClick: () => setWizardStep(2), className: "w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all", children: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0644\u0645\u062E\u062A\u0628\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u0629" })] })), wizardStep === 2 && (_jsxs("div", { className: "space-y-8 animate-in slide-in-from-left-5", children: [_jsx("h3", { className: "text-3xl font-black text-slate-800", children: "\u0662. \u0645\u062D\u0627\u0643\u0627\u0629 \u0627\u0644\u0647\u062C\u0648\u0645 \u0627\u0644\u0633\u062D\u0627\u0628\u064A" }), _jsxs("div", { className: "bg-slate-50 p-10 rounded-[3rem] border-2 border-dashed border-slate-200 space-y-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest", children: selectedVuln.testScenario.inputLabel }), _jsxs("div", { className: "flex gap-4", children: [_jsx("input", { value: sandboxInput, onChange: e => setSandboxInput(e.target.value), placeholder: selectedVuln.testScenario.payload, className: "flex-1 p-6 bg-white border border-slate-200 rounded-[2.5rem] outline-none font-black text-right shadow-sm focus:border-indigo-600 transition-all" }), _jsx("button", { onClick: runSandboxTest, className: "px-10 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-lg hover:bg-indigo-700 transition-all", children: "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u062D\u0627\u0643\u064A" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 pt-4", children: [_jsxs("div", { className: `p-8 rounded-[2rem] border-2 transition-all ${testResult === 'FAIL' ? 'bg-red-50 border-red-200 scale-105 shadow-xl' : 'bg-white border-slate-100 opacity-40'}`, children: [_jsx("p", { className: "text-[9px] font-black text-red-500 uppercase mb-4 tracking-widest", children: "\u0633\u0644\u0648\u0643 \u0627\u0644\u0646\u0648\u0627\u0629 \u0627\u0644\u0642\u062F\u064A\u0645\u0629" }), _jsx("p", { className: "font-bold text-red-800 text-lg", children: testResult === 'FAIL' ? selectedVuln.testScenario.failureMsg : '---' })] }), _jsxs("div", { className: `p-8 rounded-[2rem] border-2 transition-all ${testResult === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 scale-105 shadow-xl' : 'bg-white border-slate-100 opacity-40'}`, children: [_jsx("p", { className: "text-[9px] font-black text-emerald-500 uppercase mb-4 tracking-widest", children: "\u0633\u0644\u0648\u0643 \u0627\u0644\u0646\u0648\u0627\u0629 \u0627\u0644\u0645\u062D\u062F\u062B\u0629" }), _jsx("p", { className: "font-bold text-emerald-800 text-lg", children: testResult === 'SUCCESS' ? selectedVuln.testScenario.successMsg : '---' })] })] })] }), _jsx("button", { disabled: testResult !== 'SUCCESS', onClick: handleCommitPatch, className: `w-full py-6 rounded-[2.5rem] font-black text-xl shadow-2xl transition-all active:scale-95 ${testResult === 'SUCCESS' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`, children: "\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u062D\u0642\u0646 \u0627\u0644\u0643\u0648\u062F \u0641\u064A \u0627\u0644\u0633\u062D\u0627\u0628\u0629 (Commit) \uD83C\uDF10" })] })), wizardStep === 3 && (_jsxs("div", { className: "space-y-8 animate-in zoom-in text-center py-10", children: [_jsx("div", { className: "w-32 h-32 bg-emerald-500 text-white rounded-full mx-auto flex items-center justify-center text-6xl shadow-2xl animate-bounce", children: "\uD83C\uDF10" }), _jsx("h3", { className: "text-4xl font-black text-slate-900 tracking-tighter", children: "\u062A\u0645 \u0627\u0644\u062D\u0642\u0646 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0628\u0646\u062C\u0627\u062D!" }), _jsx("p", { className: "text-slate-500 font-bold text-lg max-w-md mx-auto", children: "\u0623\u0635\u0628\u062D \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0646 \u0645\u0624\u0645\u0646\u0627\u064B \u0628\u0634\u0643\u0644 \u062F\u0627\u0626\u0645 \u0648\u0645\u062A\u0627\u062D \u0644\u0644\u0645\u0637\u0648\u0631\u064A\u0646 \u0645\u0646 \u0623\u064A \u0645\u0643\u0627\u0646." }), _jsx("button", { onClick: () => { setWizardStep(0); setSelectedVuln(null); refreshData(); }, className: "w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl shadow-xl active:scale-95 transition-all", children: "\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629" })] }))] })] }) }))] }));
};
export default SystemSecurityReportView;

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { AmanahGlobalDefs } from '@/constants';
import { generateEncryptedBackup, restoreFromEncryptedBackup } from '@/services/backupService';
import { auth, db } from '@/services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
const DeveloperResolutionHub = ({ currentUser, onShowToast }) => {
    const [activeTab, setActiveTab] = useState('PATCHES');
    const [patches, setPatches] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(null);
    const currentParentId = auth?.currentUser?.uid || 'guest';
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
    useEffect(() => {
        if (isAuthorized) {
            // محاكاة جلب سجل التصحيحات من Firestore
            const mockPatches = [
                { id: 'p-101', vulnId: 1, title: 'Hardcoded Key Fix', appliedBy: 'Master Admin', timestamp: new Date(), status: 'COMMITTED', codeSnippet: 'const key = await window.crypto.subtle.generateKey(...)' },
                { id: 'p-102', vulnId: 3, title: 'Firebase Rules Patch', appliedBy: 'Amanah AI', timestamp: new Date(Date.now() - 86400000), status: 'COMMITTED', codeSnippet: 'allow read: if request.auth.uid == resource.data.parentId;' }
            ];
            setPatches(mockPatches);
        }
    }, [isAuthorized]);
    const handleBackup = async () => {
        if (!isAuthorized)
            return;
        setIsProcessing(true);
        const success = await generateEncryptedBackup(currentUser.id);
        if (success)
            onShowToast("تم إنشاء وتشفير النسخة الاحتياطية بنجاح!", 'SUCCESS');
        else
            onShowToast("فشل إنشاء النسخة الاحتياطية.", 'DANGER');
        setIsProcessing(false);
    };
    const handleRestore = async (e) => {
        if (!isAuthorized)
            return;
        const file = e.target.files?.[0];
        if (!file)
            return;
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const encryptedContent = event.target?.result;
                const success = await restoreFromEncryptedBackup(encryptedContent, currentUser.id);
                if (success) {
                    onShowToast("تم فك التشفير واسترجاع البيانات بنجاح!", 'SUCCESS');
                    setTimeout(() => window.location.reload(), 1500);
                }
            }
            catch (err) {
                onShowToast("خطأ في فك التشفير: المفتاح غير مطابق أو الملف تالف.", 'DANGER');
            }
            finally {
                setIsProcessing(false);
            }
        };
        reader.readAsText(file);
    };
    if (isAuthorized === false) {
        return (_jsxs("div", { className: "min-h-[60vh] flex flex-col items-center justify-center text-center p-10 space-y-6", children: [_jsx("div", { className: "w-32 h-32 bg-slate-900 text-white rounded-[3rem] flex items-center justify-center text-6xl shadow-inner border border-white/10", children: "\uD83D\uDEE0\uFE0F" }), _jsx("h2", { className: "text-3xl font-black text-slate-900", children: "\u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u062D\u0643\u0645 \u0645\u0642\u064A\u062F" }), _jsx("p", { className: "text-slate-500 font-bold max-w-md", children: "\u0623\u062F\u0648\u0627\u062A \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0627\u0644\u0633\u064A\u0627\u062F\u064A \u0648\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0646\u0648\u0627\u0629 \u0645\u062E\u0635\u0635\u0629 \u0644\u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u062A\u0642\u0646\u064A \u0641\u0642\u0637. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0640 Infrastructure Lead." })] }));
    }
    if (isAuthorized === null)
        return _jsx("div", { className: "p-20 text-center font-black animate-pulse text-slate-400", children: "Loading Command Center..." });
    return (_jsxs("div", { className: "max-w-6xl mx-auto space-y-8 pb-40 animate-in fade-in", dir: "rtl", children: [_jsx(AmanahGlobalDefs, {}), _jsxs("div", { className: "bg-[#020617] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-indigo-500", children: [_jsx("div", { className: "absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1)_0%,transparent_60%)]" }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-8", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsx("div", { className: "w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-3xl", children: "\uD83D\uDEE0\uFE0F" }), _jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-black tracking-tighter", children: "Developer Command Center" }), _jsx("p", { className: "text-indigo-400 font-bold text-sm", children: "\u0625\u062F\u0627\u0631\u0629 \u0623\u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645\u060C \u0627\u0644\u062A\u0635\u062D\u064A\u062D\u0627\u062A\u060C \u0648\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0627\u0644\u0633\u064A\u0627\u062F\u064A." })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => setActiveTab('PATCHES'), className: `px-6 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'PATCHES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`, children: "\u0633\u062C\u0644 \u0627\u0644\u062A\u0635\u062D\u064A\u062D\u0627\u062A" }), _jsx("button", { onClick: () => setActiveTab('BACKUP'), className: `px-6 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'BACKUP' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`, children: "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A" })] })] })] }), activeTab === 'PATCHES' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100", children: [_jsxs("h3", { className: "text-2xl font-black text-slate-800 mb-6 flex items-center gap-3", children: [_jsx("span", { className: "p-2 bg-indigo-50 text-indigo-600 rounded-lg", children: "\uD83D\uDCCB" }), "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0628\u0631\u0645\u062C\u064A\u0629 (Patch History)"] }), _jsx("div", { className: "space-y-4", children: patches.map(patch => (_jsxs("div", { className: "p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 group", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${patch.status === 'COMMITTED' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500'}` }), _jsxs("div", { children: [_jsx("h4", { className: "font-black text-slate-800", children: patch.title }), _jsxs("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest", children: [patch.id, " \u2022 ", patch.timestamp.toLocaleString()] })] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { className: "px-5 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all", children: "\u0639\u0631\u0636 \u0627\u0644\u0643\u0648\u062F" }), _jsx("button", { className: "px-5 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all", children: "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 (Rollback)" })] })] }, patch.id))) })] }) })), activeTab === 'BACKUP' && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [_jsxs("div", { className: "bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 space-y-6 flex flex-col justify-between", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-indigo-100", children: "\uD83D\uDCE6" }), _jsx("h3", { className: "text-2xl font-black text-slate-800", children: "\u062A\u0648\u0644\u064A\u062F \u0646\u0633\u062E\u0629 \u0645\u0634\u0641\u0631\u0629 \u0633\u064A\u0627\u062F\u064A\u0627\u064B" }), _jsx("p", { className: "text-slate-500 font-bold text-sm leading-relaxed", children: "\u0633\u064A\u062A\u0645 \u0633\u062D\u0628 \u0643\u0627\u0641\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646 Firestore \u0648\u062A\u0634\u0641\u064A\u0631\u0647\u0627 \u0628\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0646\u0638\u0627\u0645 AES-256 \u0642\u0628\u0644 \u0627\u0644\u062A\u062D\u0645\u064A\u0644. \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0646\u0627\u062A\u062C \u063A\u064A\u0631 \u0642\u0627\u0628\u0644 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u062E\u0627\u0631\u062C \u0645\u0646\u0635\u0629 \u0623\u0645\u0627\u0646\u0629." })] }), _jsx("button", { onClick: handleBackup, disabled: isProcessing, className: "w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-lg shadow-xl active:scale-95 transition-all hover:bg-indigo-600 flex items-center justify-center gap-4", children: isProcessing ? _jsx("div", { className: "w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" }) : '💾 بدء التصدير المشفر' })] }), _jsxs("div", { className: "bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 space-y-6 flex flex-col justify-between", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-emerald-100", children: "\uD83D\uDD13" }), _jsx("h3", { className: "text-2xl font-black text-slate-800", children: "\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0645\u0646 \u0645\u0644\u0641 Vault" }), _jsx("p", { className: "text-slate-500 font-bold text-sm leading-relaxed", children: "\u0642\u0645 \u0628\u0631\u0641\u0639 \u0645\u0644\u0641 .vault \u0627\u0644\u062E\u0627\u0635 \u0628\u0643. \u0633\u064A\u0642\u0648\u0645 \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0641\u0643 \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u0648\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0639 \u0627\u0644\u0633\u062D\u0627\u0628\u0629 \u0641\u0648\u0631\u0627\u064B." })] }), _jsxs("label", { className: `w-full py-6 rounded-[2.5rem] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4 cursor-pointer border-2 border-dashed ${isProcessing ? 'bg-slate-50 text-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`, children: [_jsx("input", { type: "file", className: "hidden", accept: ".vault", onChange: handleRestore, disabled: isProcessing }), _jsx("span", { children: "\uD83D\uDCC2 \u0631\u0641\u0639 \u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u0631\u062C\u0627\u0639" })] })] })] }))] }));
};
export default DeveloperResolutionHub;

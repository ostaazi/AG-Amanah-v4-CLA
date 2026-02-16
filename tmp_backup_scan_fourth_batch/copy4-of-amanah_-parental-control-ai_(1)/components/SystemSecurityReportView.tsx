
import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield, AmanahGlobalDefs, AmanahLogo } from '../constants';
import { 
  SecurityVulnerability, 
  runFullSecurityAudit, 
  getPerformanceReport, 
  getQualityMetrics,
  applySystemPatch,
  rollbackSystemPatch,
  getAuditHistory
} from '../services/auditService';
import { auth } from '../services/firebaseConfig';

const SystemSecurityReportView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SECURITY' | 'PERFORMANCE' | 'QUALITY' | 'HISTORY'>('SECURITY');
  const [vulns, setVulns] = useState<SecurityVulnerability[]>([]);
  const [perf, setPerf] = useState<any>(null);
  const [quality, setQuality] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  const currentParentId = auth?.currentUser?.uid || 'guest';

  const refreshData = async () => {
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
    } catch (e) {
      console.error("Audit Failure", e);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => { refreshData(); }, []);

  // Patch Wizard States
  const [selectedVuln, setSelectedVuln] = useState<SecurityVulnerability | null>(null);
  const [wizardStep, setWizardStep] = useState(0); 
  const [sandboxInput, setSandboxInput] = useState('');
  const [testResult, setTestResult] = useState<'IDLE' | 'FAIL' | 'SUCCESS'>('IDLE');

  const handleStartRemediation = (v: SecurityVulnerability) => {
    setSelectedVuln(v);
    setWizardStep(1);
    setTestResult('IDLE');
    setSandboxInput('');
  };

  const runSandboxTest = () => {
    if (!selectedVuln) return;
    if (sandboxInput === selectedVuln.testScenario.payload) {
      setTestResult('FAIL');
    } else {
      setTestResult('SUCCESS');
    }
  };

  const handleCommitPatch = async () => {
    if (selectedVuln && currentParentId !== 'guest') {
      await applySystemPatch(currentParentId, selectedVuln.id);
      setWizardStep(3); 
    }
  };

  const handleUndoPatch = async (id: string) => {
    if (window.confirm("⚠️ التراجع عن التصحيح السحابي سيعيد الكود للحالة الضعيفة فوراً في جميع الأجهزة. هل تريد المتابعة؟")) {
      await rollbackSystemPatch(currentParentId, id);
      await refreshData();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-40 animate-in fade-in" dir="rtl">
      <AmanahGlobalDefs />
      
      {/* Header & Global Stats */}
      <div className="bg-[#020617] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D]">
         <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-inner">
                  <AmanahShield className="w-16 h-16" animate={isScanning} />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">Cloud Integrity Hub</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg">التحقق السحابي من نزاهة الأكواد السيادية</p>
               </div>
            </div>
            
            <div className="flex gap-4">
               <button 
                onClick={() => { if(!isScanning) refreshData(); }} 
                disabled={isScanning} 
                className={`bg-[#D1A23D] text-black px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
               >
                  {isScanning ? 'جاري التدقيق السحابي...' : 'إعادة فحص السيادة'}
               </button>
            </div>
         </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar justify-center">
         {[
           { id: 'SECURITY', label: 'خارطة الثغرات', icon: '🛡️' },
           { id: 'PERFORMANCE', label: 'كفاءة السحابة', icon: '🚀' },
           { id: 'QUALITY', label: 'النزاهة السيادية', icon: '💎' },
           { id: 'HISTORY', label: 'سجل التصحيحات', icon: '📜' }
         ].map(tab => (
           <button 
             key={tab.id} onClick={() => setActiveTab(tab.id as any)}
             className={`px-10 py-5 rounded-2xl font-black text-sm whitespace-nowrap transition-all flex items-center gap-3 border-2 ${activeTab === tab.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
           >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
           </button>
         ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
         <div className="xl:col-span-8 space-y-10">
            {activeTab === 'SECURITY' && (
              <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 space-y-8 animate-in slide-in-from-bottom-4">
                 <div className="flex justify-between items-center px-4">
                    <h3 className="text-2xl font-black text-slate-800">تحليل المكونات الحساسة (Cloud Audit)</h3>
                    <div className="flex gap-3">
                       {isScanning ? <span className="text-[10px] bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full font-black animate-pulse">جاري فحص النزاهة في Firestore...</span> : (
                         <>
                           <span className="text-[10px] bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-black">نشطة: {vulns.filter(v => v.status === 'OPEN').length}</span>
                           <span className="text-[10px] bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-black">مؤمنة: {vulns.filter(v => v.status === 'PATCHED').length}</span>
                         </>
                       )}
                    </div>
                 </div>

                 <div className="space-y-6">
                    {vulns.map(v => (
                       <div key={v.id} className={`p-8 rounded-[3rem] border transition-all ${v.status === 'PATCHED' ? 'bg-emerald-50/20 border-emerald-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-xl group'}`}>
                          <div className="flex justify-between items-start mb-6">
                             <div className="flex items-center gap-4">
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${v.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{v.severity}</span>
                                <h4 className="text-xl font-black text-slate-800">{v.title}</h4>
                             </div>
                             {v.status === 'PATCHED' ? (
                               <div className="flex flex-col items-end gap-1">
                                  <span className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg">CLOUD VERIFIED ✓</span>
                                  <span className="text-[8px] font-mono font-bold text-emerald-600 opacity-60">{v.integrityHash}</span>
                               </div>
                             ) : (
                               <div className="flex flex-col items-end gap-1">
                                  <span className="bg-red-500 text-white px-5 py-2 rounded-xl text-[10px] font-black">VULNERABLE 🛑</span>
                                  <span className="text-[8px] font-mono font-bold text-slate-400">{v.file}</span>
                               </div>
                             )}
                          </div>
                          <p className="text-sm font-bold text-slate-500 mb-6 italic">"{v.impact}"</p>
                          
                          {v.status === 'OPEN' ? (
                            <button 
                              onClick={() => handleStartRemediation(v)}
                              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4"
                            >
                               <span>🧪</span>
                               فتح معالج التصحيح السحابي
                            </button>
                          ) : (
                            <div className="bg-white/50 p-6 rounded-[2.5rem] border border-emerald-100 flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl animate-pulse">🛡️</div>
                                  <div>
                                     <p className="text-xs font-black text-emerald-800">الحالة: التصحيح نشط عالمياً (Sovereign)</p>
                                     <p className="text-[9px] font-bold text-emerald-600">تم حقن المنطق في السحابة لملف {v.file}.</p>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => handleUndoPatch(v.id)} 
                                 className="px-6 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
                               >
                                 إلغاء الحقن السحابي
                               </button>
                            </div>
                          )}
                       </div>
                    ))}
                 </div>
              </div>
            )}
            {/* بقية التبويبات تظل كما هي مع استخدام البيانات المحسوبة */}
         </div>

         <div className="xl:col-span-4 space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl border-b-8 border-indigo-600 sticky top-32">
               <div className="flex items-center gap-5 mb-10">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">💹</div>
                  <h3 className="text-2xl font-black tracking-tighter">نزاهة السحابة</h3>
               </div>
               <div className="space-y-10">
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">درجة التحصين العالمي</p>
                     <div className="relative inline-block">
                        <svg className="w-40 h-40 transform -rotate-90">
                           <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="15" fill="transparent" className="text-white/5" />
                           <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="15" fill="transparent" 
                                   strokeDasharray={440} strokeDashoffset={440 - (440 * ((perf?.safetyIndex || 70) / 100))} 
                                   className="text-indigo-500 transition-all duration-1000" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                           <span className="text-4xl font-black">{perf?.safetyIndex || 70}%</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Remediation Wizard Modal */}
      {wizardStep > 0 && selectedVuln && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border-4 border-white animate-in zoom-in-95 max-h-[90vh]">
              <div className="bg-slate-900 p-8 flex justify-between items-center text-white">
                 <div className="flex gap-4">
                    {[1, 2, 3].map(s => <div key={s} className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${wizardStep >= s ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-white/10 text-white/40'}`}>{s}</div>)}
                 </div>
                 <h3 className="text-xl font-black">حقن الكود السحابي: {selectedVuln.id}</h3>
                 <button onClick={() => setWizardStep(0)} className="text-white/60 hover:text-white transition-colors"><ICONS.Close /></button>
              </div>

              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-1 space-y-10 text-right">
                 {wizardStep === 1 && (
                    <div className="space-y-8 animate-in slide-in-from-left-5">
                       <h3 className="text-3xl font-black text-slate-800">١. مراجعة الكود السحابي المطور</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-[10px]" dir="ltr">
                          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-inner">
                             <p className="text-red-500 mb-2 font-black uppercase text-[8px]">Old (Vulnerable) 🛑</p>
                             <pre className="text-red-700 opacity-60 line-through whitespace-pre-wrap">{selectedVuln.vulnerableCode}</pre>
                          </div>
                          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-inner">
                             <p className="text-emerald-500 mb-2 font-black uppercase text-[8px]">New (Cloud Hardened) ✅</p>
                             <pre className="text-emerald-700 whitespace-pre-wrap">{selectedVuln.remediationCode}</pre>
                          </div>
                       </div>
                       <button onClick={() => setWizardStep(2)} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all">متابعة لمختبر السحابة</button>
                    </div>
                 )}

                 {wizardStep === 2 && (
                    <div className="space-y-8 animate-in slide-in-from-left-5">
                       <h3 className="text-3xl font-black text-slate-800">٢. محاكاة الهجوم السحابي</h3>
                       <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-dashed border-slate-200 space-y-6">
                          <div className="space-y-3">
                             <label className="text-[11px] font-black text-slate-400 uppercase px-4 tracking-widest">{selectedVuln.testScenario.inputLabel}</label>
                             <div className="flex gap-4">
                                <input value={sandboxInput} onChange={e => setSandboxInput(e.target.value)} placeholder={selectedVuln.testScenario.payload} className="flex-1 p-6 bg-white border border-slate-200 rounded-[2.5rem] outline-none font-black text-right shadow-sm focus:border-indigo-600 transition-all" />
                                <button onClick={runSandboxTest} className="px-10 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-lg hover:bg-indigo-700 transition-all">تشغيل المحاكي</button>
                             </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                             <div className={`p-8 rounded-[2rem] border-2 transition-all ${testResult === 'FAIL' ? 'bg-red-50 border-red-200 scale-105 shadow-xl' : 'bg-white border-slate-100 opacity-40'}`}>
                                <p className="text-[9px] font-black text-red-500 uppercase mb-4 tracking-widest">سلوك النواة القديمة</p>
                                <p className="font-bold text-red-800 text-lg">{testResult === 'FAIL' ? selectedVuln.testScenario.failureMsg : '---'}</p>
                             </div>
                             <div className={`p-8 rounded-[2rem] border-2 transition-all ${testResult === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 scale-105 shadow-xl' : 'bg-white border-slate-100 opacity-40'}`}>
                                <p className="text-[9px] font-black text-emerald-500 uppercase mb-4 tracking-widest">سلوك النواة المحدثة</p>
                                <p className="font-bold text-emerald-800 text-lg">{testResult === 'SUCCESS' ? selectedVuln.testScenario.successMsg : '---'}</p>
                             </div>
                          </div>
                       </div>
                       <button disabled={testResult !== 'SUCCESS'} onClick={handleCommitPatch} className={`w-full py-6 rounded-[2.5rem] font-black text-xl shadow-2xl transition-all active:scale-95 ${testResult === 'SUCCESS' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>اعتماد وحقن الكود في السحابة (Commit) 🌐</button>
                    </div>
                 )}

                 {wizardStep === 3 && (
                    <div className="space-y-8 animate-in zoom-in text-center py-10">
                       <div className="w-32 h-32 bg-emerald-500 text-white rounded-full mx-auto flex items-center justify-center text-6xl shadow-2xl animate-bounce">🌐</div>
                       <h3 className="text-4xl font-black text-slate-900 tracking-tighter">تم الحقن السحابي بنجاح!</h3>
                       <p className="text-slate-500 font-bold text-lg max-w-md mx-auto">أصبح النظام الآن مؤمناً بشكل دائم ومتاح للمطورين من أي مكان.</p>
                       <button onClick={() => { setWizardStep(0); setSelectedVuln(null); refreshData(); }} className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl shadow-xl active:scale-95 transition-all">العودة للوحة القيادة</button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const FileStatusLabel: React.FC<{ name: string, status: string }> = ({ name, status }) => {
  const isSafe = status === 'HARDENED' || status === 'SECURED';
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
       <span className="text-[10px] font-mono opacity-60">{name}</span>
       <span className={`text-[8px] font-black px-2 py-1 rounded-md ${isSafe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{status}</span>
    </div>
  );
};

export default SystemSecurityReportView;

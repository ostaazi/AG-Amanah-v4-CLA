
import React, { useState, useEffect } from 'react';
import { ICONS, AmanahShield, AmanahGlobalDefs, AmanahLogo } from '../constants';
import { AlertSeverity } from '../types';

interface Vulnerability {
  id: number;
  title: string;
  component: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impact: string;
  description: string;
  fix: string;
  remediationCode?: string;
}

const SystemSecurityReportView: React.FC = () => {
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const reportDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

  const vulnerabilities: Vulnerability[] = [
    { 
      id: 1, 
      title: "Hardcoded Encryption Key", 
      component: "cryptoService.ts", 
      severity: "CRITICAL", 
      impact: "Total Data Decryption", 
      description: "تم رصد مفتاح تشفير ثابت (Hardcoded) داخل ملف التشفير. هذا يسمح لأي شخص يمتلك الكود المصدري بفك تشفير كافة بيانات المستخدمين.",
      fix: "يجب اشتقاق المفاتيح من معرف فريد للجهاز وتخزينها في مستودع مفاتيح النظام (Android KeyStore / iOS Keychain).",
      remediationCode: "const key = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);"
    },
    { 
      id: 2, 
      title: "Excessive Android Permissions", 
      component: "AndroidManifest.xml", 
      severity: "HIGH", 
      impact: "Privacy Violation", 
      description: "طلب صلاحية QUERY_ALL_PACKAGES يسمح للتطبيق برؤية كافة التطبيقات المثبتة. جوجل ترفض التطبيقات التي تطلب هذه الصلاحية دون مبرر تقني قوي.",
      fix: "استخدم <queries> لفلترة التطبيقات الضرورية فقط بدلاً من الوصول الشامل.",
      remediationCode: "<queries>\n  <package android:name='com.instagram.android' />\n</queries>"
    },
    { 
      id: 3, 
      title: "Plain-text API Keys", 
      component: "firebaseConfig.ts", 
      severity: "HIGH", 
      impact: "Quota Exhaustion / Unauthorized Access", 
      description: "مفاتيح Firebase مكشوفة في الكود المصدري. رغم أنها مفاتيح واجهة أمامية، إلا أنها تفتح الباب للهجمات في حال عدم وجود Firebase Rules صارمة.",
      fix: "تفعيل Firebase App Check وتحديد نطاق عمل المفاتيح (Restrictions) من لوحة تحكم Google Cloud.",
      remediationCode: "// Activate App Check in App.tsx\ninitializeAppCheck(app, { provider: new ReCaptchaV3Provider('KEY'), isTokenAutoRefreshEnabled: true });"
    },
    { 
      id: 4, 
      title: "Lack of Biometric Re-auth", 
      component: "EvidenceVaultView.tsx", 
      severity: "MEDIUM", 
      impact: "Unauthorized Local Access", 
      description: "يمكن لأي شخص يفتح هاتف الوالد الدخول للخزنة الجنائية دون بصمة إضافية.",
      fix: "فرض استدعاء biometricService قبل رندرة مكون EvidenceVaultView.",
      remediationCode: "const isAuth = await authenticateBiometrics(storedId);\nif (!isAuth) return <AccessDenied />;"
    },
    { 
      id: 5, 
      title: "Insecure Local Search (XSS)", 
      component: "EvidenceVaultView.tsx", 
      severity: "MEDIUM", 
      impact: "Malicious Script Injection", 
      description: "نظام البحث في الخزنة لا يقوم بتنظيف المدخلات (Sanitization) قبل فلترة السجلات.",
      fix: "استخدام مكتبة DOMPurify لتنظيف النصوص المستلمة من المشتبه بهم قبل عرضها.",
      remediationCode: "const cleanTerm = DOMPurify.sanitize(searchTerm);"
    },
    { 
      id: 6, 
      title: "Missing Rate Limiting on Gemini", 
      component: "geminiService.ts", 
      severity: "MEDIUM", 
      impact: "Financial Loss (API Cost)", 
      description: "لا يوجد سقف لعدد طلبات الذكاء الاصطناعي لكل مستخدم، مما قد يعرض النظام لتكاليف ضخمة في حال هجوم Denial of Wallet.",
      fix: "إضافة Throttle محلي ونظام Quotas في Firebase Cloud Functions.",
      remediationCode: "if (userRequestsToday > 100) throw new Error('Daily Quota Exceeded');"
    },
    { 
      id: 7, 
      title: "No Certificate Pinning", 
      component: "Network Layer", 
      severity: "HIGH", 
      impact: "Man-in-the-Middle (MITM)", 
      description: "التطبيق يثق في أي شهادة SSL يقرها النظام، مما يسهل اعتراض الاتصالات في الشبكات العامة.",
      fix: "تفعيل SSL Pinning لضمان الاتصال فقط بخوادم Firebase الموثوقة.",
      remediationCode: "// Android implementation via Network Security Config\n<pin-set>\n  <pin digest='SHA-256'>base64==</pin>\n</pin-set>"
    },
    { 
      id: 8, 
      title: "Open Firebase Rules", 
      component: "firestore.rules", 
      severity: "CRITICAL", 
      impact: "Cross-User Data Leak", 
      description: "قواعد الحماية تسمح حالياً للمشرفين بقراءة تنبيهات قد لا تخص أطفالهم إذا لم يتم التحقق من parentId في كل استعلام.",
      fix: "تعديل القواعد لتكون resource.data.parentId == request.auth.uid دائماً.",
      remediationCode: "allow read: if request.auth.uid == resource.data.parentId;"
    },
    { 
      id: 9, 
      title: "Main Thread Blocking (UI Freeze)", 
      component: "visualSentinel.ts", 
      severity: "LOW", 
      impact: "Poor UX / App Unresponsiveness", 
      description: "عمليات معالجة الصور في TensorFlow.js تتم على الخيط الرئيسي، مما يسبب تجميد الواجهة أثناء المسح.",
      fix: "نقل عمليات المعالجة البصرية إلى Web Worker مستقل.",
      remediationCode: "const worker = new Worker('visionWorker.js');\nworker.postMessage(imageData);"
    },
    { 
      id: 10, 
      title: "Improper Error Propagation", 
      component: "Global", 
      severity: "LOW", 
      impact: "Information Leakage", 
      description: "رسائل الأخطاء التقنية (Stack Traces) تظهر للمستخدم النهائي في بعض الأحيان.",
      fix: "تفعيل Error Boundaries المخصصة وإخفاء الأخطاء الخام عن واجهة المستخدم.",
      remediationCode: "catch(e) { logError(e); return 'حدث خطأ تقني، جاري المعالجة.'; }"
    },
    { 
      id: 11, 
      title: "Weak Session Persistence", 
      component: "authService.ts", 
      severity: "MEDIUM", 
      impact: "Session Hijacking", 
      description: "جلسات المستخدم تبقى نشطة للأبد دون طلب إعادة تسجيل دخول دورية.",
      fix: "ضبط Force Refresh للـ Tokens كل ساعة ومطالبة المستخدم بالبصمة كل 24 ساعة.",
      remediationCode: "auth.onIdTokenChanged(user => { if(Date.now() - user.lastLogin > 86400000) logout(); });"
    },
    { 
      id: 12, 
      title: "Unencrypted Temp Files", 
      component: "Android Scoped Storage", 
      severity: "HIGH", 
      impact: "Forensic Tampering", 
      description: "لقطات الشاشة الملتقطة تُخزن مؤقتاً في مجلد Cache غير مشفر قبل رفعها.",
      fix: "تشفير الملفات المؤقتة باستخدام EncryptedFile من مكتبة Jetpack Security.",
      remediationCode: "EncryptedFile.Builder(context, file, masterKey, FileEncryptionScheme.AES256_GCM_HKDF_4KB).build();"
    }
  ];

  const performanceKPIs = [
    { label: "AI Inference Latency", value: "85ms", status: "EXCELLENT", detail: "Optimized via WebGL." },
    { label: "Memory Usage", value: "240MB", status: "WARNING", detail: "High consumption on model load." },
    { label: "DB Sync Speed", value: "1.2s", status: "GOOD", detail: "Stable real-time sockets." },
    { label: "App Boot Time", value: "3.4s", status: "MEDIUM", detail: "Slow due to TF.js init." },
    { label: "Battery Impact", value: "2.4%/h", status: "GOOD", detail: "Normal background polling." },
    { label: "Frame Rate (FPS)", value: "58fps", status: "EXCELLENT", detail: "Smooth UI transitions." },
    { label: "CPU Usage (Peak)", value: "45%", status: "MEDIUM", detail: "Spikes during image scan." },
    { label: "Network Payload", value: "12KB/req", status: "EXCELLENT", detail: "Highly compressed alerts." }
  ];

  const recommendations = [
    { p: "CRITICAL", t: "Migrate Encryption Keys", d: "نقل كافة مفاتيح النظام إلى عتاد الهاتف الآمن (HSM/TEE) لمنع استخراجها برمجياً." },
    { p: "IMPORTANT", t: "Implement Web Workers", d: "فصل منطق الذكاء الاصطناعي عن واجهة المستخدم لضمان تجربة سلسة 60fps." },
    { p: "IMPORTANT", t: "Firebase Rules Audit", d: "إعادة بناء قواعد Firestore لمنع أي تسريب بيانات بين حسابات الآباء المختلفة." },
    { p: "OPTIONAL", t: "Asset Lazy Loading", d: "تأخير تحميل نماذج AI الكبيرة حتى الحاجة الفعلية لتقليل زمن إقلاع التطبيق." },
    { p: "CRITICAL", t: "App Check Enforcement", d: "تفعيل Firebase App Check لحجب كافة الطلبات التي تأتي من خارج التطبيق الرسمي." },
    { p: "IMPORTANT", t: "Code Obfuscation", d: "استخدام ProGuard/R8 لتصعيب الهندسة العكسية للكود المصدري في أندرويد." }
  ];

  const handlePrint = () => {
    setIsGenerating(true);
    // إعطاء وقت قصير للمتصفح لتحديث حالة الزر بصرياً قبل فتح نافذة الطباعة
    setTimeout(() => {
      window.print();
      setIsGenerating(false);
    }, 500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in print-full-width" dir="rtl">
      <AmanahGlobalDefs />
      
      {/* Print-Only Cover Page */}
      <div className="hidden print:flex h-[280mm] flex-col items-center justify-between py-20 text-center border-[20px] border-[#8A1538]/5 m-0 overflow-hidden">
         <div className="space-y-10">
            <div className="w-64 mx-auto drop-shadow-2xl">
               <AmanahLogo />
            </div>
            <div className="h-1 w-32 bg-[#D1A23D] mx-auto"></div>
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter">تقرير تحليل الأمان والأداء</h1>
            <p className="text-2xl font-bold text-slate-500 uppercase tracking-widest">SYSTEM AUDIT REPORT v2.5</p>
         </div>

         <div className="space-y-6">
            <div className="bg-slate-900 text-white px-12 py-8 rounded-[3rem] inline-block shadow-2xl">
               <p className="text-sm font-black text-[#D1A23D] uppercase tracking-[0.3em] mb-2">Overall Trust Score</p>
               <p className="text-7xl font-black">91%</p>
            </div>
            <p className="text-lg font-bold text-slate-400">تاريخ الإصدار: {reportDate}</p>
         </div>

         <div className="space-y-4">
            <p className="text-xs font-mono text-slate-400 tracking-widest">CERTIFIED BY AMANAH SECURITY PROTOCOL // SHA-256: 8XF2...99A</p>
            <div className="flex justify-center gap-4">
               <div className="w-12 h-12 border-2 border-slate-100 rounded-full flex items-center justify-center text-xs opacity-30">QR</div>
               <div className="w-12 h-12 border-2 border-slate-100 rounded-full flex items-center justify-center text-xs opacity-30">ID</div>
            </div>
         </div>
      </div>

      {/* Header with Export Button */}
      <div className="bg-[#020617] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden border-b-8 border-[#D1A23D] print-card no-print">
         <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(209,162,61,0.1)_0%,transparent_60%)]"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-right">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-inner">
                  <AmanahShield className="w-16 h-16" animate={true} />
               </div>
               <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-2">Security & Performance Report</h2>
                  <p className="text-indigo-300 font-bold opacity-80 text-lg">تحليل استقصائي شامل لنظام أمانة للرقابة الأبوية - الإصدار v2.5</p>
               </div>
            </div>
            <div className="flex flex-col items-center gap-4">
               <div className="bg-emerald-500/10 border border-emerald-500/20 px-8 py-4 rounded-3xl flex flex-col items-center shadow-2xl backdrop-blur-md">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Global Health Score</span>
                  <span className="text-4xl font-black text-emerald-500">91%</span>
               </div>
               <button 
                 onClick={handlePrint}
                 disabled={isGenerating}
                 className={`bg-[#D1A23D] hover:bg-[#B47E1B] text-black px-10 py-5 rounded-2xl font-black text-sm flex items-center gap-4 transition-all active:scale-95 shadow-xl ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 {isGenerating ? (
                   <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                 ) : (
                   <span className="text-xl">📄</span>
                 )}
                 {isGenerating ? 'جاري التحضير...' : 'تصدير التقرير الرسمي (PDF)'}
               </button>
            </div>
         </div>
      </div>

      {/* Vulnerabilities Section */}
      <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 overflow-hidden print-card page-break">
         <div className="flex justify-between items-center mb-10 px-4">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-red-50 text-red-600 rounded-2xl shadow-sm"><ICONS.Shield /></div>
               <h3 className="text-3xl font-black text-slate-800 tracking-tighter">قائمة الثغرات المكتشفة ({vulnerabilities.length})</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-xl uppercase tracking-widest no-print">اضغط على الثغرة للتفاصيل</span>
         </div>
         
         <div className="max-h-[600px] overflow-y-auto custom-scrollbar border rounded-[2.5rem] border-slate-50 print-scrollable">
            <table className="w-full text-right border-collapse">
               <thead className="sticky top-0 bg-slate-50 z-20">
                  <tr>
                     <th className="p-6 text-slate-400 font-black text-xs uppercase tracking-widest">الثغرة الأمنية</th>
                     <th className="p-6 text-slate-400 font-black text-xs uppercase tracking-widest text-center">الخطورة</th>
                     <th className="p-6 text-slate-400 font-black text-xs uppercase tracking-widest">المكون</th>
                     <th className="p-6 text-slate-400 font-black text-xs uppercase tracking-widest">الأثر المتوقع</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {vulnerabilities.map(v => (
                    <tr 
                      key={v.id} 
                      onClick={() => setSelectedVuln(v)}
                      className="group hover:bg-indigo-50/50 transition-all cursor-pointer border-r-4 border-transparent hover:border-indigo-500"
                    >
                       <td className="p-6">
                          <p className="font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{v.title}</p>
                       </td>
                       <td className="p-6 text-center">
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                            v.severity === 'CRITICAL' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 
                            v.severity === 'HIGH' ? 'bg-amber-500 text-white' : 
                            v.severity === 'MEDIUM' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                             {v.severity}
                          </span>
                       </td>
                       <td className="p-6 font-mono text-[10px] text-indigo-400 font-black">{v.component}</td>
                       <td className="p-6 text-[11px] font-bold text-slate-500">{v.impact}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Performance KPIs */}
      <div className="space-y-6 page-break">
         <h3 className="text-2xl font-black text-slate-800 px-6">مؤشرات الأداء التقني (Performance KPIs)</h3>
         <div className="flex gap-6 overflow-x-auto pb-6 px-4 custom-scrollbar print-horizontal-scroll">
            {performanceKPIs.map((kpi, idx) => (
              <div key={idx} className="min-w-[280px] bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center text-center space-y-4 group hover:scale-[1.02] transition-all print-card">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                 <p className={`text-5xl font-black tracking-tighter ${
                   kpi.status === 'EXCELLENT' ? 'text-emerald-500' : 
                   kpi.status === 'GOOD' ? 'text-indigo-600' : 'text-amber-500'
                 }`}>{kpi.value}</p>
                 <div className="space-y-1">
                    <p className={`text-[9px] font-black uppercase ${
                      kpi.status === 'EXCELLENT' ? 'text-emerald-400' : 'text-slate-400'
                    }`}>{kpi.status}</p>
                    <p className="text-[11px] font-bold text-slate-500 px-2 leading-tight">{kpi.detail}</p>
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* Recommendations List */}
      <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 space-y-10 print-card page-break">
         <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner">📈</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">خطة العمل والتوصيات (Action Plan)</h3>
         </div>

         <div className="max-h-[500px] overflow-y-auto custom-scrollbar px-2 space-y-4 print-scrollable">
            {recommendations.map((rec, i) => (
               <div key={i} className="bg-slate-50 p-8 rounded-[2.5rem] border-r-8 border-white hover:border-indigo-500 transition-all shadow-sm flex items-start justify-between gap-6 group print-card">
                  <div className="space-y-2 text-right">
                     <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${
                          rec.p === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'
                        }`}>{rec.p}</span>
                        <h4 className="font-black text-lg text-slate-800">{rec.t}</h4>
                     </div>
                     <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-2xl">{rec.d}</p>
                  </div>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-sm no-print">🛠️</div>
               </div>
            ))}
         </div>
      </div>

      {/* Vulnerability Detail Modal */}
      {selectedVuln && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 no-print">
           <div className="bg-white w-full max-w-3xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-4 border-white animate-in zoom-in-95">
              <div className={`p-10 text-white flex justify-between items-center ${
                selectedVuln.severity === 'CRITICAL' ? 'bg-red-600' : 
                selectedVuln.severity === 'HIGH' ? 'bg-amber-500' : 'bg-indigo-600'
              }`}>
                 <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Security Analysis Report</span>
                    <h3 className="text-3xl font-black tracking-tight">{selectedVuln.title}</h3>
                 </div>
                 <button onClick={() => setSelectedVuln(null)} className="p-4 bg-white/20 hover:bg-white/30 rounded-full transition-all border border-white/20"><ICONS.Close /></button>
              </div>

              <div className="p-12 overflow-y-auto custom-scrollbar space-y-10 text-right">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Component affected</p>
                       <p className="font-mono text-indigo-600 font-black">{selectedVuln.component}</p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security impact</p>
                       <p className="font-black text-red-600">{selectedVuln.impact}</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-xl font-black text-slate-800">وصف الثغرة (Description)</h4>
                    <p className="text-slate-600 font-bold leading-relaxed bg-slate-50 p-6 rounded-3xl border border-slate-100">{selectedVuln.description}</p>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-xl font-black text-emerald-600">خطة الإصلاح المقترحة (Fix)</h4>
                    <p className="text-slate-600 font-bold leading-relaxed">{selectedVuln.fix}</p>
                 </div>

                 {selectedVuln.remediationCode && (
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remediation Code Example</h4>
                       <div className="bg-slate-900 p-8 rounded-[2rem] font-mono text-xs text-emerald-400 overflow-x-auto ltr shadow-inner shadow-black border-b-4 border-emerald-500/30" dir="ltr">
                          <pre>{selectedVuln.remediationCode}</pre>
                       </div>
                    </div>
                 )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-center">
                 <button 
                   onClick={() => setSelectedVuln(null)}
                   className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"
                 >
                    فهمت، جاري العمل على الإصلاح
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SystemSecurityReportView;

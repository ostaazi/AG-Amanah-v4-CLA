
import React, { useState } from 'react';
import { Child, CustomMode } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RadarComponent } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';

interface PsychologicalInsightViewProps {
  theme: 'light' | 'dark';
  child: Child;
  onAcceptPlan: (plan: Partial<CustomMode>) => void;
}

const PsychologicalInsightView: React.FC<PsychologicalInsightViewProps> = ({ theme, child, onAcceptPlan }) => {
  const profile = child.psychProfile;
  const navigate = useNavigate();
  const [showFullDialogues, setShowFullDialogues] = useState(false);

  const dialogueModels = [
    {
      title: "عند اكتشاف محاولة استدراج (Grooming)",
      opener: "حبيبي، لاحظت إن في شخص غريب يحاول يكلمك. أنا مو زعلان منك، أنا فخور إننا اكتشفنا هذا الشخص مع بعض لأننا فريق واحد، والناس السيئين دائماً يحاولون يخدعون الأذكياء مثلك.",
      advice: "أكد للطفل أنه 'بطل' لأنه لم يقع في الفخ، ولا تلمه على الفضول."
    },
    {
      title: "عند رصد بوادر تنمر (Bullying)",
      opener: "أحمد، شفت تعليقات ضايقتك اليوم. تدري إن الشخص اللي يتنمر هو شخص ضعيف في الحقيقة؟ رأي الغرباء فيك ما يغير حقيقة إنك مبدع ومميز عندنا.",
      advice: "عزز تقديره لذاته بعيداً عن العالم الافتراضي."
    },
    {
      title: "عند ملاحظة عزلة رقمية",
      opener: "واضح إن الجوال صاير ممتع بزيادة اليوم! وش رأيك نقفله الحين ونروح نسوي نشاط مع بعض؟ عقلك يحتاج راحة عشان يقدر يبدع بكره.",
      advice: "قدم بديلاً ممتعاً فورياً بدلاً من مجرد المنع."
    }
  ];

  const handleApplyEmergencyPlan = () => {
    const suggested: Partial<CustomMode> = {
      name: `وضع التعافي لـ ${child.name}`,
      icon: '🧘',
      color: 'bg-indigo-900',
      allowedApps: ['WhatsApp', 'School App'],
      blacklistedUrls: ['discord.com', 'roblox.com', 'tiktok.com'],
      isInternetCut: false,
      isDeviceLocked: false,
      isScreenDimmed: true
    };
    navigate('/modes', { state: { suggestedMode: suggested } });
  };

  if (!profile) return <div className="p-20 text-center font-black">جاري تحليل النبض النفسي...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-40 animate-in fade-in" dir="rtl">
      
      {/* الترويسة الفاخرة */}
      <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-8 border-indigo-600">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="text-right">
               <h2 className="text-5xl font-black tracking-tighter mb-2">Amanah Pulse Pro</h2>
               <p className="text-indigo-300 font-bold text-lg opacity-80">تحليل الاستقرار الرقمي والنبض العاطفي لـ {child.name}</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 p-6 rounded-[2.5rem] border border-white/10 text-center backdrop-blur-md">
                 <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">مؤشر السعادة</p>
                 <p className="text-3xl font-black">{profile.moodScore}%</p>
              </div>
              <div className="bg-red-500/10 p-6 rounded-[2.5rem] border border-red-500/20 text-center backdrop-blur-md">
                 <p className="text-[10px] font-black uppercase text-red-400 mb-1">مستوى القلق</p>
                 <p className="text-3xl font-black text-red-500">{profile.anxietyLevel}%</p>
              </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         {/* رادار المشاعر */}
         <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 h-full">
            <h3 className="text-2xl font-black text-slate-800 mb-8 border-b pb-4 flex items-center gap-3">
               <span className="text-indigo-600">📊</span> بصمة الحالة النفسية
            </h3>
            <div className="w-full h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                    { subject: 'قلق', A: profile.anxietyLevel },
                    { subject: 'عزلة', A: profile.isolationRisk },
                    { subject: 'ثقة', A: profile.moodScore },
                    { subject: 'تركيز', A: 70 },
                    { subject: 'أمان', A: 40 }
                  ]}>
                     <PolarGrid stroke="#e2e8f0" />
                     <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                     <RadarComponent dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.6} />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* بروتوكول التدخل */}
         <div className="bg-indigo-50 rounded-[4rem] p-10 shadow-2xl border border-indigo-100 flex flex-col justify-between">
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-lg">🧠</div>
                  <h3 className="text-2xl font-black text-slate-800">بروتوكول الرد المقترح</h3>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed shadow-sm">
                  "{profile.recommendation}"
               </div>
               <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">أهم الكلمات المرصودة مؤخراً:</p>
                  <div className="flex flex-wrap gap-2 px-4">
                    {profile.recentKeywords?.map(kw => (
                      <span key={kw} className="bg-white px-4 py-2 rounded-full text-[10px] font-black border border-slate-100 text-slate-600">{kw}</span>
                    ))}
                  </div>
               </div>
            </div>
            <button 
               onClick={handleApplyEmergencyPlan}
               className="mt-8 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-4"
            >
               <span>🛡️</span>
               تفعيل وضع الحماية المتوازن
            </button>
         </div>
      </div>

      {/* مدرب الحوار التربوي */}
      <div className="bg-indigo-600 rounded-[4rem] p-12 text-white shadow-2xl space-y-10 relative overflow-hidden">
         <div className="flex justify-between items-center relative z-10">
            <h3 className="text-3xl font-black tracking-tighter">مدرب الحوار والوقاية</h3>
            <button 
              onClick={() => setShowFullDialogues(!showFullDialogues)}
              className="bg-white/20 px-8 py-3 rounded-full font-black text-xs border border-white/20 hover:bg-white/30 transition-all"
            >
              {showFullDialogues ? 'إخفاء' : 'عرض كافة النماذج'}
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {dialogueModels.slice(0, showFullDialogues ? 3 : 1).map((m, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md p-8 rounded-[3rem] border border-white/10 space-y-6 hover:bg-white/20 transition-all animate-in slide-in-from-right-4">
                 <div className="flex justify-between items-start">
                    <h4 className="text-lg font-black text-indigo-100">{m.title}</h4>
                    <span className="text-2xl">💬</span>
                 </div>
                 <p className="text-sm font-bold italic border-r-4 border-indigo-300 pr-4 leading-relaxed">"{m.opener}"</p>
                 <div className="bg-indigo-900/40 p-5 rounded-2xl">
                    <p className="text-[10px] font-black text-indigo-200 uppercase mb-1">نصيحة تربوية:</p>
                    <p className="text-xs font-bold opacity-80">{m.advice}</p>
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* مختبر الوعي الرقمي */}
      <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 space-y-8">
         <div className="flex items-center gap-5 border-b pb-6">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl">🛡️</div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter">مختبر الوعي: تكتيكات الجناة</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-4 hover:shadow-xl transition-all group">
               <div className="flex items-center gap-4">
                  <span className="text-4xl group-hover:rotate-12 transition-transform">🎁</span>
                  <h4 className="text-lg font-black text-slate-800">فخ الـ Skins والجوائز</h4>
               </div>
               <p className="text-xs font-bold text-slate-500 leading-relaxed">يتم إغراء الأطفال بهدايا في Roblox أو Fortnite مقابل "مكالمة كاميرا" أو "فتح رابط خارجي".</p>
               <div className="bg-white p-5 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">كيفية الوقاية:</p>
                  <p className="text-[11px] font-bold text-slate-700">علم طفلك: لا يوجد شيء مجاني في الإنترنت، الجوائز تطلب فقط من المواقع الرسمية.</p>
               </div>
            </div>
            <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-4 hover:shadow-xl transition-all group">
               <div className="flex items-center gap-4">
                  <span className="text-4xl group-hover:rotate-12 transition-transform">🎭</span>
                  <h4 className="text-lg font-black text-slate-800">انتحال الشخصية (Persona)</h4>
               </div>
               <p className="text-xs font-bold text-slate-500 leading-relaxed">يستخدم الجناة صور أطفال آخرين مشهورين لكسب ثقة الطفل وبناء علاقة سرية بعيدة عن الأهل.</p>
               <div className="bg-white p-5 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">كيفية الوقاية:</p>
                  <p className="text-[11px] font-bold text-slate-700">قاعدة ذهبية: "لا تصدق الصور"، وتأكد من أن طفلك لا يضيف من لا يعرفه في الواقع.</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default PsychologicalInsightView;

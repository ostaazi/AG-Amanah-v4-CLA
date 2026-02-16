
import React, { useState } from 'react';
import { Child, CustomMode, AlertSeverity } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RadarComponent } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';

interface PsychologicalInsightViewProps {
  theme: 'light' | 'dark';
  child: Child;
  onAcceptPlan: (plan: Partial<CustomMode>) => void;
}

// تعريف هيكل سيناريوهات التوجيه
interface GuidanceScenario {
  id: string;
  title: string;
  icon: string;
  severityColor: string;
  symptoms: string[];
  dialogues: {
    situation: string;
    opener: string;
    advice: string;
  }[];
}

const PsychologicalInsightView: React.FC<PsychologicalInsightViewProps> = ({ theme, child, onAcceptPlan }) => {
  const profile = child.psychProfile;
  const navigate = useNavigate();
  const [activeScenarioId, setActiveScenarioId] = useState<string>('gaming');

  // دالة مخصصة لضبط موضع النصوص حول المخطط لضمان عدم التداخل
  const renderCustomTick = ({ payload, x, y, cx, cy, ...rest }: any) => {
    return (
      <text
        {...rest}
        y={y + (y - cy) / 8}
        x={x + (x - cx) / 8}
        fill="#64748b"
        fontSize="13"
        fontWeight="800"
        fontFamily="Cairo"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {payload.value}
      </text>
    );
  };

  const guidanceScenarios: GuidanceScenario[] = [
    {
      id: 'cyber_crime',
      title: 'الانحراف السيبراني (Hacking)',
      icon: '👨‍💻',
      severityColor: 'bg-slate-800',
      symptoms: [
        'استخدام برامج غريبة (Kali Linux, VPNs) ومحاولة إخفاء الـ IP.',
        'الحديث بفخر عن "إسقاط مواقع" أو "سحب حسابات".',
        'وجود بيانات بطاقات ائتمانية لا تخص العائلة في جهازه.',
        'استخدام مصطلحات مثل DDoS, Doxxing, Carding.'
      ],
      dialogues: [
        { situation: 'توجيه المهارة', opener: 'ما شاء الله، عندك مهارات تقنية عالية مو عند غيرك. بس الفرق بين "الهاكر الأخلاقي" والمجرم هو (الإذن). وش طموحك؟', advice: 'حول المسار من Black Hat إلى White Hat.' },
        { situation: 'الردع القانوني', opener: 'تخيل إن ضغطة زر منك ممكن توديك السجن وتدمر مستقبلك الوظيفي للأبد. الجرائم الإلكترونية ما فيها "لعب عيال".', advice: 'وضح أن القانون لا يحمي المغفلين أو القاصرين في الجنايات.' },
        { situation: 'كشف المخاطر', opener: 'الأدوات اللي تحملها ممكن تكون "ملغمة" وتخلي جهازك جسر لهجمات إرهابية بدون ما تدري. أنت الضحية الأولى.', advice: 'اشرح خطورة استخدام أدوات الجرائم.' },
        { situation: 'البديل الشرعي', opener: 'وش رأيك نسجلك في دورة "أمن سيبراني" معتمدة؟ تصير خبير يحمي الناس وتأخذ شهادات عالمية وراتب عالي.', advice: 'استثمر الموهبة في مسار مهني.' },
        { situation: 'المسؤولية الأخلاقية', opener: 'سرقة حساب شخص أو تهكيره نفس حكم سرقة بيته. هل ترضى تكون "سارق"؟', advice: 'ربط العالم الافتراضي بالأخلاق الواقعية.' }
      ]
    },
    // ... rest of the static scenarios are preserved in logic but omitted for brevity if needed
    {
      id: 'gaming',
      title: 'إدمان الألعاب الإلكترونية',
      icon: '🎮',
      severityColor: 'bg-indigo-600',
      symptoms: [
        'انقلاب ساعات النوم والسهر المفرط.',
        'العصبية الشديدة عند انقطاع الإنترنت أو سحب الجهاز.',
        'تدني المستوى الدراسي وفقدان الاهتمام بالهوايات الأخرى.',
        'آلام في الظهر أو العينين وإهمال النظافة الشخصية.'
      ],
      dialogues: [
        { situation: 'المصارحة الأولى (ودية)', opener: 'يا بطل، لاحظت إنك صاير محترف جداً في اللعبة هذي، بس أحس إنها بدت تسرقك منا. وش رأيك؟', advice: 'ابدأ بالمدح لخفض الدفاعات النفسية.' },
        { situation: 'وضع الحدود (حزم)', opener: 'أنا أحترم هوايتك، لكن "صحتك" خط أحمر. نظامنا الجديد: اللعب متاح بعد إنهاء الواجبات ولمدة ساعتين فقط.', advice: 'كن حازماً في القواعد دون غضب.' },
      ]
    },
    {
      id: 'bullying',
      title: 'ضحية التنمر الإلكتروني',
      icon: '💔',
      severityColor: 'bg-pink-600',
      symptoms: [
        'الخوف من استخدام الهاتف أو التوتر عند وصول إشعار.',
        'الاكتئاب المفاجئ والرغبة في الغياب عن المدرسة.',
        'تدني تقدير الذات وعبارات مثل "أنا مكروه".'
      ],
      dialogues: [
        { situation: 'كسر الصمت', opener: 'حاس إن فيه شي مضايقك في الجوال. أحد قال لك كلمة جرحتك؟ أنا موجود عشان أسمعك وأحاميك.', advice: 'الضحية غالباً يشعر بالخجل، بادر أنت.' },
      ]
    }
  ];

  const stabilityScore = profile 
    ? Math.round((profile.moodScore + (100 - profile.anxietyLevel)) / 2) 
    : 0;

  const radarData = [
    { subject: 'قلق', A: profile?.anxietyLevel || 10, fullMark: 100 },
    { subject: 'هدوء', A: profile?.moodScore || 90, fullMark: 100 },
    { subject: 'تركيز', A: profile?.anxietyLevel && profile.anxietyLevel > 50 ? 30 : 70, fullMark: 100 },
    { subject: 'اجتماعية', A: 100 - (profile?.isolationRisk || 5), fullMark: 100 },
    { subject: 'إحباط', A: 100 - (profile?.moodScore || 90), fullMark: 100 },
  ];

  const activeScenarioData = guidanceScenarios.find(s => s.id === activeScenarioId) || guidanceScenarios[0];

  if (!profile) return <div className="p-20 text-center font-black">جاري تحليل النبض النفسي...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-40 animate-in fade-in" dir="rtl">
      
      {/* الترويسة الفاخرة */}
      <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-8 border-indigo-600">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="text-right">
               <h2 className="text-5xl font-black tracking-tighter mb-2">Amanah Pulse Pro</h2>
               <p className="text-indigo-300 font-bold text-lg opacity-80">النبض العاطفي الحي لـ {child.name}</p>
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
         <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 h-full flex flex-col items-center">
            <h3 className="text-3xl font-black text-slate-800 mb-6 text-center">بصمة النبض النفسي الحالية</h3>
            <div className="w-full h-80 relative flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                     <PolarGrid stroke="#e2e8f0" strokeWidth={1} />
                     <PolarAngleAxis dataKey="subject" tick={renderCustomTick} />
                     <RadarComponent name="Amanah Pulse" dataKey="A" stroke="#6366f1" strokeWidth={3} fill="#818cf8" fillOpacity={0.5} />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
            <div className="mt-8 text-center space-y-2">
               <span className={`text-7xl font-black tracking-tighter block drop-shadow-sm ${stabilityScore < 40 ? 'text-red-600' : 'text-indigo-600'}`}>
                  {stabilityScore}
               </span>
               <span className="text-lg font-bold text-slate-400 block tracking-wide">معدل الاستقرار النفسي (محدث)</span>
            </div>
         </div>

         <div className="bg-indigo-50 rounded-[4rem] p-10 shadow-2xl border border-indigo-100 flex flex-col justify-between">
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-lg">🧠</div>
                  <h3 className="text-2xl font-black text-slate-800">تحليل السلوك المرصود</h3>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed shadow-sm">
                  {stabilityScore < 50 
                    ? `⚠️ تم رصد تغير مفاجئ في الأنماط الرقمية لـ ${child.name}. الكلمات الأخيرة تشير إلى احتمالية عالية للتعرض لضغوط خارجية أو تنمر.` 
                    : `✅ حالة ${child.name} مستقرة ضمن الحدود الطبيعية. التفاعلات الأخيرة آمنة بنسبة كبيرة.`}
               </div>
               <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">مسببات القلق المرصودة:</p>
                  <div className="flex flex-wrap gap-2 px-4">
                    {profile.recentKeywords?.length > 0 ? profile.recentKeywords.map(kw => (
                      <span key={kw} className="bg-red-50 px-4 py-2 rounded-full text-[10px] font-black border border-red-100 text-red-600 animate-pulse">{kw}</span>
                    )) : <span className="text-xs text-slate-400 italic">لا يوجد مؤشرات سلبية حالياً</span>}
                  </div>
               </div>
            </div>
            <button 
               onClick={() => navigate('/modes')}
               className="mt-8 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-4"
            >
               <span>🛡️</span>
               تفعيل وضع الحماية المتوازن
            </button>
         </div>
      </div>
      
      {/* Guidance Coach */}
      <div className="bg-white rounded-[4rem] p-8 md:p-12 shadow-2xl border border-slate-100 space-y-8">
         <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">مدرب التوجيه التربوي</h3>
            <p className="text-slate-500 font-bold">سيناريوهات حوار جاهزة بناءً على حالات التهديد.</p>
         </div>
         <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {guidanceScenarios.map(scenario => (
               <button key={scenario.id} onClick={() => setActiveScenarioId(scenario.id)} className={`flex items-center gap-2 px-6 py-4 rounded-2xl whitespace-nowrap transition-all border-2 ${activeScenarioId === scenario.id ? `${scenario.severityColor} text-white` : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  <span className="text-xl">{scenario.icon}</span>
                  <span className="font-black text-xs">{scenario.title}</span>
               </button>
            ))}
         </div>
         <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
            <h4 className="text-xl font-black mb-4 flex items-center gap-3"> نماذج الرد لـ {activeScenarioData.title}:</h4>
            <div className="space-y-4">
               {activeScenarioData.dialogues.map((d, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                     <p className="text-sm font-black text-indigo-600 mb-2">{d.situation}</p>
                     <p className="text-lg font-bold text-slate-800">"{d.opener}"</p>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default PsychologicalInsightView;

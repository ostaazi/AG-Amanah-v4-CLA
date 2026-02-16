
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

const PsychologicalInsightView: React.FC<PsychologicalInsightViewProps> = ({ child }) => {
  const profile = child.psychProfile;
  const navigate = useNavigate();
  const [activeScenarioId, setActiveScenarioId] = useState<string>('gaming');

  // قاعدة بيانات السيناريوهات التربوية الشاملة
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
    {
      id: 'crypto_scams',
      title: 'الهوس المالي المشبوه (Crypto)',
      icon: '💸',
      severityColor: 'bg-yellow-600',
      symptoms: [
        'الهوس بتطبيقات العملات الرقمية والربح السريع.',
        'طلب وثائق الهوية (للتوثيق في منصات مشبوهة).',
        'التورط في "التسويق الشبكي" وإقناع الأقارب بالاستثمار.',
        'امتلاك أموال مجهولة المصدر أو خسارة مبالغ كبيرة فجأة.'
      ],
      dialogues: [
        { situation: 'الوعي المالي', opener: 'يا ولدي، ما فيه شيء اسمه "ربح مضمون وسريع". أي أحد يعدك بفلوس سهلة هو غالباً يبي يسرقك.', advice: 'تحطيم وهم الثراء السريع.' },
        { situation: 'خطر التورط (Money Mule)', opener: 'أحياناً المجرمين يستخدمون حسابات الشباب عشان يحولون فلوس مسروقة. لا تصير طرف في "غسيل أموال" وأنت ما تدري.', advice: 'حذره من استغلال حسابه البنكي.' },
        { situation: 'التسويق الهرمي', opener: 'المشروع اللي يطلب منك تجيب ناس عشان تربح هو "نصب هرمي". أنت قاعد تبيع وهم لأصحابك وتخسر سمعتك.', advice: 'اشرح آلية الاحتيال الهرمي.' },
        { situation: 'الرقابة المالية', opener: 'أي عملية استثمار لازم تمر علي أول. أنا أبي مصلحتك وما أبيك تبدأ حياتك بديون أو مشاكل قانونية.', advice: 'فرض رقابة على المعاملات المالية.' },
        { situation: 'التعليم الحقيقي', opener: 'تبي تتعلم تجارة؟ خلنا نفتح محفظة تجريبية في سوق الأسهم الرسمي ونتعلم التحليل المالي الصح.', advice: 'وجهه للقنوات الاستثمارية الرسمية.' }
      ]
    },
    {
      id: 'gaming',
      title: 'إدمان الألعاب الإلكترونية',
      icon: '🎮',
      severityColor: 'bg-indigo-600',
      symptoms: [
        'انقلاب ساعات النوم والسهر المفرط.',
        'العصبية الشديدة عند انقطاع الإنترنت أو سحب الجهاز.',
        'تدني المستوى الدراسي وفقدان الاهتمام بالهوايات الأخرى.'
      ],
      dialogues: [
        { situation: 'المصارحة الأولى', opener: 'يا بطل، لاحظت إنك صاير محترف جداً في اللعبة هذي، بس أحس إنها بدت تسرقك منا.', advice: 'ابدأ بالمدح لخفض الدفاعات النفسية.' },
        { situation: 'وضع الحدود', opener: 'أنا أحترم هوايتك، لكن "صحتك" خط أحمر.', advice: 'كن حازماً في القواعد دون غضب.' }
      ]
    }
  ];

  const stabilityScore = profile 
    ? Math.round((profile.moodScore + (100 - profile.anxietyLevel)) / 2) 
    : 0;

  const handleApplyEmergencyPlan = () => {
    const suggested: Partial<CustomMode> = {
      name: `وضع التعافي لـ ${child.name}`,
      icon: '🧘',
      color: 'bg-indigo-900',
      isInternetCut: false,
      isDeviceLocked: false,
      isScreenDimmed: true
    };
    navigate('/modes', { state: { suggestedMode: suggested } });
  };

  const activeScenarioData = guidanceScenarios.find(s => s.id === activeScenarioId) || guidanceScenarios[0];

  if (!profile) return <div className="p-20 text-center font-black">جاري تحليل النبض النفسي...</div>;

  const radarData = [
    { subject: 'قلق', A: profile.anxietyLevel, fullMark: 100 },
    { subject: 'هدوء', A: profile.moodScore, fullMark: 100 },
    { subject: 'تركيز', A: 65, fullMark: 100 },
    { subject: 'اجتماعية', A: 100 - profile.isolationRisk, fullMark: 100 },
    { subject: 'إحباط', A: 100 - profile.moodScore, fullMark: 100 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-72 animate-in fade-in" dir="rtl">
      
      <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-8 border-indigo-600">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="text-right">
               <h2 className="text-5xl font-black tracking-tighter mb-2">Amanah Pulse Pro</h2>
               <p className="text-indigo-300 font-bold text-lg opacity-80">تحليل الاستقرار الرقمي والنبض العاطفي لـ {child.name}</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 h-full flex flex-col items-center">
            <h3 className="text-3xl font-black text-slate-800 mb-6 text-center">بصمة النبض النفسي</h3>
            <div className="w-full h-80 relative flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                     <PolarGrid stroke="#e2e8f0" strokeWidth={1} />
                     <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 14, fontWeight: '800', fontFamily: 'Cairo' }} />
                     <RadarComponent name="Amanah Pulse" dataKey="A" stroke="#6366f1" strokeWidth={3} fill="#818cf8" fillOpacity={0.5} />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
            <div className="mt-8 text-center">
               <span className="text-7xl font-black text-indigo-600 block">{stabilityScore}</span>
               <span className="text-lg font-bold text-slate-400">معدل الاستقرار النفسي</span>
            </div>
         </div>

         <div className="bg-indigo-50 rounded-[4rem] p-10 shadow-2xl border border-indigo-100 flex flex-col justify-between">
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-lg">🧠</div>
                  <h3 className="text-2xl font-black text-slate-800">بروتوكول الرد المقترح</h3>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed shadow-sm">
                  "{profile.recommendation}"
               </div>
            </div>
            <button 
               onClick={handleApplyEmergencyPlan}
               className="mt-8 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
            >
               <span>🛡️</span>
               تفعيل وضع الحماية المتوازن
            </button>
         </div>
      </div>

      <div className="bg-white rounded-[4rem] p-8 md:p-12 shadow-2xl border border-slate-100 space-y-8 overflow-hidden relative">
         <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">مدرب الحوار التربوي الشامل</h3>
            <p className="text-slate-500 font-bold">اختر الحالة لعرض الأعراض ونصوص الحوار المقترحة من الخبراء.</p>
         </div>

         <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {guidanceScenarios.map(scenario => (
               <button key={scenario.id} onClick={() => setActiveScenarioId(scenario.id)} className={`flex items-center gap-2 px-6 py-4 rounded-2xl whitespace-nowrap transition-all border-2 ${activeScenarioId === scenario.id ? `${scenario.severityColor} border-transparent text-white shadow-lg` : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}>
                  <span className="text-xl">{scenario.icon}</span>
                  <span className="font-black text-xs">{scenario.title}</span>
               </button>
            ))}
         </div>

         <div className="bg-slate-50/50 p-6 rounded-[3rem] border border-slate-100">
            <div className="p-8 rounded-[2.5rem] text-white shadow-xl bg-slate-800">
               <h4 className="text-2xl font-black mb-4">{activeScenarioData.title}</h4>
               <ul className="space-y-3">
                  {activeScenarioData.symptoms.map((sym, idx) => (
                     <li key={idx} className="flex items-start gap-3 text-xs font-bold leading-relaxed">
                        <span className="mt-1 w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
                        {sym}
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      </div>
    </div>
  );
};

export default PsychologicalInsightView;

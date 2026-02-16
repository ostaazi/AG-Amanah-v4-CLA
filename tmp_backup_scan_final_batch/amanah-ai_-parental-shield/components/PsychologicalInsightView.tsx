
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

interface GuidanceScenario {
  id: string;
  title: string;
  icon: React.ReactNode;
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
      title: 'الانحراف السيبراني',
      icon: <ICONS.Settings />,
      severityColor: 'bg-slate-800',
      symptoms: [
        'استخدام برامج غريبة ومحاولة إخفاء الهوية الرقمية.',
        'الاهتمام الملح بتجاوز البروتوكولات الأمنية.',
        'استخدام مصطلحات تقنية هجومية متقدمة.'
      ],
      dialogues: [
        { situation: 'توجيه المهارة', opener: 'تم رصد مهارات تقنية استثنائية. من الضروري توجيه هذا الذكاء نحو الأمن السيبراني الدفاعي.', advice: 'حول المسار إلى التحصيل العلمي المعتمد.' }
      ]
    },
    {
      id: 'gaming',
      title: 'الإفراط في الاستخدام الرقمي',
      icon: <ICONS.Activity />,
      severityColor: 'bg-indigo-600',
      symptoms: [
        'انقلاب ساعات النوم والسهر المفرط.',
        'ردود فعل عصبية عند تقييد الاستخدام.',
        'تدني المستوى الدراسي وفقدان الاهتمام بالأنشطة البدنية.'
      ],
      dialogues: [
        { situation: 'التفاوض البناء', opener: 'لاحظ النظام زيادة مطردة في ساعات الاستخدام. التوازن بين النشاط الرقمي والبدني ضروري للصحة العقلية.', advice: 'تطبيق جدولة آلية فورية.' }
      ]
    },
    {
      id: 'bullying',
      title: 'مخاطر التنمر الإلكتروني',
      icon: <ICONS.Shield />,
      severityColor: 'bg-red-600',
      symptoms: [
        'تجنب استخدام الجهاز بشكل مفاجئ.',
        'علامات توتر واضحة عند استلام الإشعارات.',
        'تدني تقدير الذات في المحادثات المرصودة.'
      ],
      dialogues: [
        { situation: 'الدعم النفسي', opener: 'تم رصد أنماط لغوية تشير إلى ضغوط اجتماعية رقمية. الدعم الأسري هو خط الدفاع الأول.', advice: 'فتح قنوات اتصال مباشرة للمصارحة.' }
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
      
      <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-8 border-indigo-600">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="text-right">
               <h2 className="text-5xl font-black tracking-tighter mb-2">Behavioral Analysis Pro</h2>
               <p className="text-indigo-300 font-bold text-lg opacity-80">التحليل النفسي المتقدم لـ {child.name}</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 p-6 rounded-[2.5rem] border border-white/10 text-center backdrop-blur-md">
                 <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">مؤشر الاستقرار</p>
                 <p className="text-3xl font-black">{profile.moodScore}%</p>
              </div>
              <div className="bg-red-500/10 p-6 rounded-[2.5rem] border border-red-500/20 text-center backdrop-blur-md">
                 <p className="text-[10px] font-black uppercase text-red-400 mb-1">مستوى الإجهاد</p>
                 <p className="text-3xl font-black text-red-500">{profile.anxietyLevel}%</p>
              </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <div className="bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 h-full flex flex-col items-center">
            <h3 className="text-3xl font-black text-slate-800 mb-6 text-center">بصمة التوازن النفسي</h3>
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
               <span className="text-lg font-bold text-slate-400 block tracking-wide">مؤشر التوافق السلوكي</span>
            </div>
         </div>

         <div className="bg-indigo-50 rounded-[4rem] p-10 shadow-2xl border border-indigo-100 flex flex-col justify-between">
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-lg"><ICONS.Activity /></div>
                  <h3 className="text-2xl font-black text-slate-800">الاستنتاج التحليلي</h3>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed shadow-sm">
                  {stabilityScore < 50 
                    ? `تنبيه: تشير البيانات الحالية إلى تغير نوعي في الأنماط السلوكية لـ ${child.name}. المحتوى المرصود يتطلب تدخل توجيهي مباشر لمواجهة ضغوط محتملة.` 
                    : `الحالة السلوكية لـ ${child.name} تقع ضمن نطاق الأمان المعتمد. التفاعلات الرقمية تعكس استقراراً في المحيط الاجتماعي.`}
               </div>
               <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">الكلمات المفتاحية المرصودة:</p>
                  <div className="flex flex-wrap gap-2 px-4">
                    {profile.recentKeywords?.length > 0 ? profile.recentKeywords.map(kw => (
                      <span key={kw} className="bg-white px-4 py-2 rounded-full text-[10px] font-black border border-indigo-100 text-indigo-600 shadow-sm">{kw}</span>
                    )) : <span className="text-xs text-slate-400 italic">لا توجد مؤشرات لغوية سلبية</span>}
                  </div>
               </div>
            </div>
            <button 
               onClick={() => navigate('/modes')}
               className="mt-8 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-4"
            >
               <ICONS.Shield />
               تفعيل بروتوكول الحماية
            </button>
         </div>
      </div>
      
      <div className="bg-white rounded-[4rem] p-8 md:p-12 shadow-2xl border border-slate-100 space-y-8">
         <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">مركز الإرشاد السلوكي</h3>
            <p className="text-slate-500 font-bold">سيناريوهات الحوار المعتمدة بناءً على التحليل الرقمي.</p>
         </div>
         <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {guidanceScenarios.map(scenario => (
               <button key={scenario.id} onClick={() => setActiveScenarioId(scenario.id)} className={`flex items-center gap-2 px-6 py-4 rounded-2xl whitespace-nowrap transition-all border-2 ${activeScenarioId === scenario.id ? `${scenario.severityColor} text-white` : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  <span className="w-5 h-5">{scenario.icon}</span>
                  <span className="font-black text-xs">{scenario.title}</span>
               </button>
            ))}
         </div>
         <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
            <h4 className="text-xl font-black mb-4 flex items-center gap-3"> نماذج التدخل التوجيهي:</h4>
            <div className="space-y-4">
               {activeScenarioData.dialogues.map((d, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                     <p className="text-[10px] font-black text-indigo-600 mb-2 uppercase tracking-widest">{d.situation}</p>
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

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RadarComponent } from 'recharts';
import { useNavigate } from 'react-router-dom';
const PsychologicalInsightView = ({ child }) => {
    const profile = child.psychProfile;
    const navigate = useNavigate();
    const [activeScenarioId, setActiveScenarioId] = useState('gaming');
    // قاعدة بيانات السيناريوهات التربوية الشاملة
    const guidanceScenarios = [
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
        const suggested = {
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
    if (!profile)
        return _jsx("div", { className: "p-20 text-center font-black", children: "\u062C\u0627\u0631\u064A \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0646\u0628\u0636 \u0627\u0644\u0646\u0641\u0633\u064A..." });
    const radarData = [
        { subject: 'قلق', A: profile.anxietyLevel, fullMark: 100 },
        { subject: 'هدوء', A: profile.moodScore, fullMark: 100 },
        { subject: 'تركيز', A: 65, fullMark: 100 },
        { subject: 'اجتماعية', A: 100 - profile.isolationRisk, fullMark: 100 },
        { subject: 'إحباط', A: 100 - profile.moodScore, fullMark: 100 },
    ];
    return (_jsxs("div", { className: "max-w-6xl mx-auto space-y-12 pb-72 animate-in fade-in", dir: "rtl", children: [_jsx("div", { className: "bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-8 border-indigo-600", children: _jsx("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-10", children: _jsxs("div", { className: "text-right", children: [_jsx("h2", { className: "text-5xl font-black tracking-tighter mb-2", children: "Amanah Pulse Pro" }), _jsxs("p", { className: "text-indigo-300 font-bold text-lg opacity-80", children: ["\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0627\u0633\u062A\u0642\u0631\u0627\u0631 \u0627\u0644\u0631\u0642\u0645\u064A \u0648\u0627\u0644\u0646\u0628\u0636 \u0627\u0644\u0639\u0627\u0637\u0641\u064A \u0644\u0640 ", child.name] })] }) }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-10", children: [_jsxs("div", { className: "bg-white rounded-[4rem] p-10 shadow-2xl border border-slate-100 h-full flex flex-col items-center", children: [_jsx("h3", { className: "text-3xl font-black text-slate-800 mb-6 text-center", children: "\u0628\u0635\u0645\u0629 \u0627\u0644\u0646\u0628\u0636 \u0627\u0644\u0646\u0641\u0633\u064A" }), _jsx("div", { className: "w-full h-80 relative flex items-center justify-center", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(RadarChart, { cx: "50%", cy: "50%", outerRadius: "75%", data: radarData, children: [_jsx(PolarGrid, { stroke: "#e2e8f0", strokeWidth: 1 }), _jsx(PolarAngleAxis, { dataKey: "subject", tick: { fill: '#64748b', fontSize: 14, fontWeight: '800', fontFamily: 'Cairo' } }), _jsx(RadarComponent, { name: "Amanah Pulse", dataKey: "A", stroke: "#6366f1", strokeWidth: 3, fill: "#818cf8", fillOpacity: 0.5 })] }) }) }), _jsxs("div", { className: "mt-8 text-center", children: [_jsx("span", { className: "text-7xl font-black text-indigo-600 block", children: stabilityScore }), _jsx("span", { className: "text-lg font-bold text-slate-400", children: "\u0645\u0639\u062F\u0644 \u0627\u0644\u0627\u0633\u062A\u0642\u0631\u0627\u0631 \u0627\u0644\u0646\u0641\u0633\u064A" })] })] }), _jsxs("div", { className: "bg-indigo-50 rounded-[4rem] p-10 shadow-2xl border border-indigo-100 flex flex-col justify-between", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl shadow-lg", children: "\uD83E\uDDE0" }), _jsx("h3", { className: "text-2xl font-black text-slate-800", children: "\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u0631\u062F \u0627\u0644\u0645\u0642\u062A\u0631\u062D" })] }), _jsxs("div", { className: "bg-white p-8 rounded-[2.5rem] border border-indigo-100 italic font-bold text-indigo-900 leading-relaxed shadow-sm", children: ["\"", profile.recommendation, "\""] })] }), _jsxs("button", { onClick: handleApplyEmergencyPlan, className: "mt-8 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4", children: [_jsx("span", { children: "\uD83D\uDEE1\uFE0F" }), "\u062A\u0641\u0639\u064A\u0644 \u0648\u0636\u0639 \u0627\u0644\u062D\u0645\u0627\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0627\u0632\u0646"] })] })] }), _jsxs("div", { className: "bg-white rounded-[4rem] p-8 md:p-12 shadow-2xl border border-slate-100 space-y-8 overflow-hidden relative", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-3xl font-black text-slate-900 tracking-tighter mb-2", children: "\u0645\u062F\u0631\u0628 \u0627\u0644\u062D\u0648\u0627\u0631 \u0627\u0644\u062A\u0631\u0628\u0648\u064A \u0627\u0644\u0634\u0627\u0645\u0644" }), _jsx("p", { className: "text-slate-500 font-bold", children: "\u0627\u062E\u062A\u0631 \u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u0639\u0631\u0636 \u0627\u0644\u0623\u0639\u0631\u0627\u0636 \u0648\u0646\u0635\u0648\u0635 \u0627\u0644\u062D\u0648\u0627\u0631 \u0627\u0644\u0645\u0642\u062A\u0631\u062D\u0629 \u0645\u0646 \u0627\u0644\u062E\u0628\u0631\u0627\u0621." })] }), _jsx("div", { className: "flex gap-3 overflow-x-auto pb-4 custom-scrollbar", children: guidanceScenarios.map(scenario => (_jsxs("button", { onClick: () => setActiveScenarioId(scenario.id), className: `flex items-center gap-2 px-6 py-4 rounded-2xl whitespace-nowrap transition-all border-2 ${activeScenarioId === scenario.id ? `${scenario.severityColor} border-transparent text-white shadow-lg` : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`, children: [_jsx("span", { className: "text-xl", children: scenario.icon }), _jsx("span", { className: "font-black text-xs", children: scenario.title })] }, scenario.id))) }), _jsx("div", { className: "bg-slate-50/50 p-6 rounded-[3rem] border border-slate-100", children: _jsxs("div", { className: "p-8 rounded-[2.5rem] text-white shadow-xl bg-slate-800", children: [_jsx("h4", { className: "text-2xl font-black mb-4", children: activeScenarioData.title }), _jsx("ul", { className: "space-y-3", children: activeScenarioData.symptoms.map((sym, idx) => (_jsxs("li", { className: "flex items-start gap-3 text-xs font-bold leading-relaxed", children: [_jsx("span", { className: "mt-1 w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" }), sym] }, idx))) })] }) })] })] }));
};
export default PsychologicalInsightView;

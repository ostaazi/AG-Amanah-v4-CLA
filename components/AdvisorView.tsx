import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Child, MonitoringAlert } from '../types';
import { diagnosePsychScenarioFromAlerts } from '../services/psychDiagnosticService';

interface AdvisorViewProps {
  lang: 'ar' | 'en';
  children: Child[];
  alerts: MonitoringAlert[];
}

const scenarioLabel = (scenarioId: string, lang: 'ar' | 'en') => {
  const mapAr: Record<string, string> = {
    bullying: 'Cyber Bullying',
    threat_exposure: 'Threat/Blackmail',
    gaming: 'Gaming Addiction',
    inappropriate_content: 'Inappropriate Content',
    cyber_crime: 'Cyber Crime Risk',
    crypto_scams: 'Financial/Crypto Scams',
    phishing_links: 'Phishing Links',
    self_harm: 'Self Harm',
    sexual_exploitation: 'Sexual Exploitation',
    account_theft_fraud: 'Account Theft/Fraud',
    gambling_betting: 'Gambling/Betting',
    privacy_tracking: 'Privacy/Tracking',
    harmful_challenges: 'Harmful Challenges',
  };
  const mapEn: Record<string, string> = {
    bullying: 'Cyber Bullying',
    threat_exposure: 'Threat/Blackmail',
    gaming: 'Gaming Addiction',
    inappropriate_content: 'Inappropriate Content',
    cyber_crime: 'Cyber Crime Risk',
    crypto_scams: 'Financial/Crypto Scams',
    phishing_links: 'Phishing/Malicious Links',
    self_harm: 'Self Harm',
    sexual_exploitation: 'Sexual Exploitation',
    account_theft_fraud: 'Account Theft/Fraud',
    gambling_betting: 'Gambling/Betting',
    privacy_tracking: 'Privacy/Tracking',
    harmful_challenges: 'Harmful Challenges',
  };
  return lang === 'ar' ? mapAr[scenarioId] || scenarioId : mapEn[scenarioId] || scenarioId;
};

const AdvisorView: React.FC<AdvisorViewProps> = ({ lang, children, alerts }) => {
  const navigate = useNavigate();
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || children[0],
    [children, selectedChildId]
  );

  const diagnosis = useMemo(() => {
    if (!selectedChild) return null;
    return diagnosePsychScenarioFromAlerts(selectedChild.name, alerts);
  }, [selectedChild, alerts]);

  const t = {
    title: 'Parental Advisor',
    subtitle: 'Actionable guidance based on alerts and psychological pulse',
    noChild: 'Add or pair a child device to get recommendations.',
    confidence: 'Diagnosis Confidence',
    scenario: 'Likely Scenario',
    quickPlan: 'Quick 24h Plan',
    reasons: 'Why this was selected',
    openPulse: 'Open Psych Pulse',
    openModes: 'Open Smart Modes',
    noDiagnosis: 'Not enough alerts for diagnosis. Keep monitoring.',
  };

  if (!selectedChild) {
    return (
      <div className="p-10 bg-white rounded-[2.5rem] border border-slate-100 text-center text-slate-500 font-bold">
        {t.noChild}
      </div>
    );
  }

  const quickPlan = diagnosis
    ? [
        `Have a calm, non-blaming conversation with ${selectedChild.name} today.`,
        'Review privacy and blocking settings in frequently used apps.',
        'Enable a temporary smart mode to reduce risk for the rest of today.',
      ]
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="ltr">
      <section className="bg-slate-900 text-white p-8 rounded-[3rem] border-b-4 border-indigo-500">
        <h2 className="text-3xl font-black tracking-tight">{t.title}</h2>
        <p className="text-indigo-200 font-bold mt-2">{t.subtitle}</p>
      </section>

      <section className="bg-white rounded-[2.5rem] border border-slate-100 p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-4 py-2 rounded-xl text-sm font-black border transition-all ${
                selectedChild.id === child.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>

        {!diagnosis ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-500 font-black">
            {t.noDiagnosis}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <article className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                <p className="text-xs font-black text-slate-500">{t.scenario}</p>
                <p className="text-xl font-black text-slate-900">
                  {scenarioLabel(diagnosis.scenarioId, lang)}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                <p className="text-xs font-black text-slate-500">{t.confidence}</p>
                <p className="text-xl font-black text-indigo-700">{diagnosis.confidence}%</p>
              </article>
            </div>

            <article className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3">
              <h3 className="text-base font-black text-slate-800">{t.quickPlan}</h3>
              <ul className="space-y-2 text-sm font-bold text-slate-700">
                {quickPlan.map((step, index) => (
                  <li key={`${step}-${index}`}>{index + 1}. {step}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3">
              <h3 className="text-base font-black text-slate-800">{t.reasons}</h3>
              <ul className="space-y-2 text-sm font-bold text-slate-700">
                {diagnosis.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{index + 1}. {reason}</li>
                ))}
              </ul>
            </article>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/pulse')}
            className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm"
          >
            {t.openPulse}
          </button>
          <button
            onClick={() => navigate('/modes')}
            className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-sm"
          >
            {t.openModes}
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdvisorView;


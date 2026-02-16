import React, { useState } from 'react';

interface HashVerifierProps {
  lang: 'ar' | 'en';
}

const HashVerifier: React.FC<HashVerifierProps> = ({ lang }) => {
  const [input, setInput] = useState('');
  const [reference, setReference] = useState('');
  const same = input && reference && input.trim().toLowerCase() === reference.trim().toLowerCase();

  return (
    <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <h4 className="text-lg font-black text-slate-900">
        {lang === 'ar' ? 'مدقق البصمة' : 'Hash Verifier'}
      </h4>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={lang === 'ar' ? 'البصمة المدخلة' : 'Input hash'}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono"
      />
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder={lang === 'ar' ? 'البصمة المرجعية' : 'Reference hash'}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono"
      />
      <div className={`rounded-xl border p-3 text-sm font-black ${same ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        {same
          ? lang === 'ar'
            ? 'تطابق كامل ✅'
            : 'Hash match ✅'
          : lang === 'ar'
            ? 'لا يوجد تطابق'
            : 'No match'}
      </div>
    </div>
  );
};

export default HashVerifier;

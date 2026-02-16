import React, { useMemo, useState } from 'react';
import { Child } from '../../types';

interface DeviceCommandControlProps {
  lang: 'ar' | 'en';
  children: Child[];
  onSendCommand: (childId: string, command: string, payload?: any) => Promise<void>;
}

const DeviceCommandControl: React.FC<DeviceCommandControlProps> = ({ lang, children, onSendCommand }) => {
  const [childId, setChildId] = useState(children[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [blackoutMessage, setBlackoutMessage] = useState(
    lang === 'ar'
      ? 'تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين.'
      : 'Device locked for safety. Please contact a parent.'
  );
  const current = useMemo(() => children.find((c) => c.id === childId) || children[0], [children, childId]);

  const run = async (command: string, payload: any = true) => {
    if (!current) return;
    setBusy(true);
    try {
      await onSendCommand(current.id, command, payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <h4 className="text-lg font-black text-slate-900">
        {lang === 'ar' ? 'التحكم المباشر بالأوامر' : 'Direct Device Commands'}
      </h4>
      <select
        value={current?.id || ''}
        onChange={(e) => setChildId(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
      >
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => run('lockDevice', true)} disabled={busy} className="py-2 rounded-xl bg-slate-900 text-white text-sm font-black disabled:opacity-50">
          {lang === 'ar' ? 'قفل الجهاز' : 'Lock Device'}
        </button>
        <button onClick={() => run('takeScreenshot', true)} disabled={busy} className="py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50">
          {lang === 'ar' ? 'لقطة شاشة' : 'Screenshot'}
        </button>
        <button onClick={() => run('playSiren', true)} disabled={busy} className="py-2 rounded-xl bg-rose-600 text-white text-sm font-black disabled:opacity-50">
          {lang === 'ar' ? 'صافرة طوارئ' : 'Siren'}
        </button>
        <button
          onClick={() => run('startLiveStream', { videoSource: 'screen', audioSource: 'mic' })}
          disabled={busy}
          className="py-2 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50"
        >
          {lang === 'ar' ? 'بدء البث' : 'Start Stream'}
        </button>
        <button
          onClick={() =>
            run('lockscreenBlackout', {
              enabled: true,
              message: blackoutMessage,
              source: 'parent_ops_manual',
            })
          }
          disabled={busy}
          className="py-2 rounded-xl bg-violet-600 text-white text-sm font-black disabled:opacity-50"
        >
          {lang === 'ar' ? 'شاشة حجب سوداء' : 'Blackout Screen'}
        </button>
        <button
          onClick={() =>
            run('walkieTalkieEnable', {
              enabled: true,
              source: 'mic',
              sourceTag: 'parent_ops_manual',
            })
          }
          disabled={busy}
          className="py-2 rounded-xl bg-amber-600 text-white text-sm font-black disabled:opacity-50"
        >
          {lang === 'ar' ? 'تفعيل Walkie-Talkie' : 'Enable Walkie-Talkie'}
        </button>
      </div>
      <input
        value={blackoutMessage}
        onChange={(e) => setBlackoutMessage(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
        placeholder={lang === 'ar' ? 'رسالة شاشة الحجب...' : 'Blackout message...'}
      />
    </div>
  );
};

export default DeviceCommandControl;

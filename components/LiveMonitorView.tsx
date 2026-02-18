import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Child, MonitoringAlert } from '../types';
import { ICONS } from '../constants';
import { translations } from '../translations';
import { sendRemoteCommand, subscribeToAlerts } from '../services/firestoreService';

type VideoSource = 'camera_front' | 'camera_back' | 'screen';
type AudioSource = 'mic' | 'system';
type VoiceTone = 'calm' | 'agitated' | 'aggressive';

interface LiveMonitorViewProps {
  children: Child[];
  lang: 'ar' | 'en';
  allLocksDisabled?: boolean;
  lockDisableMode?: 'none' | 'temporary' | 'permanent';
  lockDisableUntilTs?: number;
}

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
  tone: VoiceTone;
}

interface RiskInsight {
  title: string;
  symptoms: string[];
  advisorTip: string;
  tone: VoiceTone;
}

const RISK_LIBRARY: Record<string, RiskInsight> = {
  bullying: {
    title: 'مؤشرات تنمر إلكتروني',
    symptoms: [
      'تغير مفاجئ في المزاج بعد استخدام الهاتف',
      'انسحاب اجتماعي أو رفض الحديث عن المحادثات',
      'انخفاض الثقة بالنفس وردود فعل حادة',
    ],
    advisorTip:
      'ابدأ حوارًا هادئًا بدون لوم، وثّق الرسائل المسيئة، ونسق مع المدرسة أو الجهة المختصة بسرعة.',
    tone: 'agitated',
  },
  threat: {
    title: 'مؤشرات تهديد مباشر',
    symptoms: [
      'خوف واضح من فتح تطبيقات أو رسائل محددة',
      'طلب حذف محادثات بشكل متكرر',
      'قلق شديد عند وصول إشعارات من حساب معين',
    ],
    advisorTip:
      'فعّل الحماية الفورية، احتفظ بالأدلة، وأبلغ ولي الأمر/الجهات المختصة عند وجود تهديد صريح.',
    tone: 'aggressive',
  },
  grooming: {
    title: 'مؤشرات استدراج',
    symptoms: [
      'طلب صور خاصة أو فتح الكاميرا في محادثات فردية',
      'إلحاح على السرية وعدم إخبار الأهل',
      'محاولات نقل الحديث لتطبيقات خاصة بسرعة',
    ],
    advisorTip:
      'أوقف التواصل فورًا، احفظ الأدلة، وقدم توعية مباشرة للطفل حول حدود الخصوصية الرقمية.',
    tone: 'aggressive',
  },
};

const detectRiskType = (content: string): keyof typeof RISK_LIBRARY | null => {
  const text = String(content || '').toLowerCase();

  const bullying = ['تنمر', 'سخر', 'اهانة', 'loser', 'hate', 'bully'];
  const threat = ['تهديد', 'اقتلك', 'kill', 'threat', 'ابتزاز', 'blackmail', 'افضح'];
  const grooming = ['صور', 'كاميرا', 'غرفتك', 'open camera', 'send pic', 'lock the door', 'استدراج'];

  if (bullying.some((k) => text.includes(k))) return 'bullying';
  if (threat.some((k) => text.includes(k))) return 'threat';
  if (grooming.some((k) => text.includes(k))) return 'grooming';
  return null;
};

const toneScore = (tone: VoiceTone): number => {
  if (tone === 'aggressive') return 90;
  if (tone === 'agitated') return 64;
  return 22;
};

const toneLabel = (tone: VoiceTone, t: any) => {
  if (tone === 'aggressive') return t.aggressive;
  if (tone === 'agitated') return t.agitated;
  return t.calm;
};

const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({
  children,
  lang,
  allLocksDisabled = false,
  lockDisableMode = 'none',
  lockDisableUntilTs,
}) => {
  const t = translations[lang];
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '');
  const child = children.find((c) => c.id === selectedChildId) || children[0];

  const [isLockdown, setIsLockdown] = useState(false);
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const [blackoutMessage, setBlackoutMessage] = useState(
    lang === 'ar'
      ? 'تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين.'
      : 'Device locked for safety. Please contact a parent.'
  );
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);

  const [videoSource, setVideoSource] = useState<VideoSource>('screen');
  const [audioSource, setAudioSource] = useState<AudioSource>('mic');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isWalkieChannelEnabled, setIsWalkieChannelEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const pushHoldRequestedRef = useRef(false);

  const [voiceTone, setVoiceTone] = useState<VoiceTone>('calm');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [riskInsight, setRiskInsight] = useState<RiskInsight | null>(null);

  const videoOptions = useMemo(
    () => [
      {
        value: 'camera_front' as VideoSource,
        label: lang === 'ar' ? `${t.camera} (أمامية)` : `${t.camera} (Front)`,
      },
      {
        value: 'camera_back' as VideoSource,
        label: lang === 'ar' ? `${t.camera} (خلفية)` : `${t.camera} (Back)`,
      },
      { value: 'screen' as VideoSource, label: t.screen },
    ],
    [lang, t.camera, t.screen]
  );

  const audioOptions = useMemo(
    () => [
      { value: 'mic' as AudioSource, label: t.mic },
      { value: 'system' as AudioSource, label: t.systemAudio },
    ],
    [t.mic, t.systemAudio]
  );

  useEffect(() => {
    if (!child) return;
    setSelectedChildId(child.id);
    setIsLockdown(false);
    setIsBlackoutActive(false);
    setIsWalkieChannelEnabled(false);
    setIsPushToTalk(false);
  }, [child?.id]);

  useEffect(() => {
    if (!allLocksDisabled) return;
    setIsLockdown(false);
    setIsBlackoutActive(false);
  }, [allLocksDisabled]);

  useEffect(() => {
    if (!child || !child.parentId) return;

    const unsub = subscribeToAlerts(child.parentId, (alerts) => {
      const childAlerts = alerts.filter((a) => a.childName === child.name);

      const latestImage = childAlerts.find(
        (a) =>
          a.imageData &&
          (String(a.content || '').includes('لقطة شاشة') ||
            String(a.content || '').toLowerCase().includes('screenshot'))
      );

      if (latestImage?.imageData) {
        setLiveScreenshot(latestImage.imageData);
        setIsCapturing(false);
      }

      const latestEntries = childAlerts
        .filter((a) => String(a.content || '').trim() && String((a as any).platform || '') !== 'Live Stream')
        .slice(0, 6)
        .map((a) => {
          const riskType = detectRiskType(a.content || '');
          const tone: VoiceTone = riskType ? RISK_LIBRARY[riskType].tone : 'calm';
          return {
            id: a.id,
            text: String(a.content || ''),
            timestamp: new Date(a.timestamp || Date.now()),
            tone,
          };
        });

      setTranscript(latestEntries);

      const risky = childAlerts.find((a) => detectRiskType(a.content || ''));
      if (risky) {
        const detected = detectRiskType(risky.content || '');
        if (detected) {
          setRiskInsight(RISK_LIBRARY[detected]);
          setVoiceTone(RISK_LIBRARY[detected].tone);
          return;
        }
      }

      setRiskInsight(null);
      setVoiceTone('calm');
    });

    return () => unsub();
  }, [child]);

  const requestInstantScreenshot = async () => {
    if (!child) return;
    setIsCapturing(true);
    await sendRemoteCommand(child.id, 'takeScreenshot', true);
    setTimeout(() => setIsCapturing(false), 15000);
  };

  const triggerSiren = async () => {
    if (!child) return;
    setIsSirenActive(true);
    await sendRemoteCommand(child.id, 'playSiren', true);
    setTimeout(() => setIsSirenActive(false), 3000);
  };

  const toggleEmergencyLock = async () => {
    if (!child) return;
    if (allLocksDisabled) return;
    const next = !isLockdown;
    setIsLockdown(next);
    if (next) {
      setIsBlackoutActive(true);
    }
    await sendRemoteCommand(child.id, 'lockDevice', next);
    await sendRemoteCommand(child.id, 'lockscreenBlackout', {
      enabled: next,
      message: next ? blackoutMessage : '',
    });
  };

  const startStream = async () => {
    if (!child) return;
    await sendRemoteCommand(child.id, 'startLiveStream', {
      videoSource,
      audioSource,
    });
    setIsStreaming(true);
  };

  const stopStream = async () => {
    if (!child) return;
    await sendRemoteCommand(child.id, 'stopLiveStream', true);
    setIsStreaming(false);
  };

  const changeVideoSource = async (value: VideoSource) => {
    setVideoSource(value);
    if (!child || !isStreaming) return;
    await sendRemoteCommand(child.id, 'setVideoSource', value);
  };

  const changeAudioSource = async (value: AudioSource) => {
    setAudioSource(value);
    if (!child) return;
    if (isStreaming) {
      await sendRemoteCommand(child.id, 'setAudioSource', value);
    }
    if (isWalkieChannelEnabled) {
      await sendRemoteCommand(child.id, 'walkieTalkieEnable', {
        enabled: true,
        source: value,
        sourceTag: 'live_monitor',
      });
    }
  };

  const startPushToTalk = async () => {
    if (!child || isPushToTalk) return;
    pushHoldRequestedRef.current = true;
    // Best-effort voice note: record short mic audio while the button is held, then send to child on release.
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        console.warn('pushToTalk unavailable: getUserMedia is not supported in this browser/context.');
        pushHoldRequestedRef.current = false;
        return;
      }
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!pushHoldRequestedRef.current) return;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
      const mimeType = preferredTypes.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';

      const recorder = new MediaRecorder(micStreamRef.current, mimeType ? { mimeType } : undefined);
      mediaChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          mediaChunksRef.current = [];

          // Keep it short/small by limiting to first ~12s worth of chunks if needed (browser dependent).
          if (blob.size <= 0) {
            await sendRemoteCommand(child.id, 'pushToTalk', { active: false, source: audioSource });
            return;
          }
          if (blob.size > 650_000) {
            await sendRemoteCommand(child.id, 'pushToTalk', {
              active: false,
              source: audioSource,
              note: 'Audio too large, please try a shorter message.',
            });
            return;
          }

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Audio encode failed'));
            reader.readAsDataURL(blob);
          });

          await sendRemoteCommand(child.id, 'pushToTalk', {
            active: false,
            source: audioSource,
            audioData: dataUrl,
            mimeType: blob.type || recorder.mimeType || 'audio/webm',
          });
        } catch (e) {
          console.warn('pushToTalk voice-note failed:', e);
          try {
            await sendRemoteCommand(child.id, 'pushToTalk', { active: false, source: audioSource });
          } catch {
            // ignore
          }
        }
      };

      mediaRecorderRef.current = recorder;
      setIsPushToTalk(true);
      await sendRemoteCommand(child.id, 'pushToTalk', { active: true, source: audioSource });
      recorder.start(250);
    } catch (e) {
      console.warn('pushToTalk mic start failed:', e);
      setIsPushToTalk(false);
      pushHoldRequestedRef.current = false;
      try {
        await sendRemoteCommand(child.id, 'pushToTalk', {
          active: false,
          source: audioSource,
          note: 'Microphone permission is missing on parent console.',
        });
      } catch {
        // ignore
      }
    }
  };

  const stopPushToTalk = async () => {
    pushHoldRequestedRef.current = false;
    if (!child || !isPushToTalk) return;
    setIsPushToTalk(false);
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
        return;
      } catch (e) {
        console.warn('pushToTalk mic stop failed:', e);
      }
    }
    await sendRemoteCommand(child.id, 'pushToTalk', { active: false, source: audioSource });
  };

  const toggleBlackoutScreen = async () => {
    if (!child) return;
    if (allLocksDisabled) return;
    const next = !isBlackoutActive;
    setIsBlackoutActive(next);
    await sendRemoteCommand(child.id, 'lockscreenBlackout', {
      enabled: next,
      message: blackoutMessage,
      source: 'live_monitor',
    });
  };

  const toggleWalkieChannel = async () => {
    if (!child) return;
    const next = !isWalkieChannelEnabled;
    setIsWalkieChannelEnabled(next);
    await sendRemoteCommand(child.id, 'walkieTalkieEnable', {
      enabled: next,
      source: audioSource,
      sourceTag: 'live_monitor',
    });
  };

  if (!child) {
    return <div className="p-10 text-center font-black">لا يوجد أطفال مضافين حاليًا.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-32 animate-in fade-in duration-700" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedChildId(c.id);
              setLiveScreenshot(null);
              setTranscript([]);
              setRiskInsight(null);
              setVoiceTone('calm');
            }}
            className={`flex items-center gap-3 px-8 py-4 rounded-full border-2 transition-all whitespace-nowrap ${selectedChildId === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-500'}`}
          >
            <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover" />
            <div className="text-right">
              <p className="font-black text-sm">{c.name}</p>
              <p className={`text-[8px] font-bold ${c.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {c.status}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-xl border border-white space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl text-2xl">
              <ICONS.LiveCamera />
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t.liveControl}</h2>
              <p className="text-sm text-slate-500 font-bold">
                {t.liveStreamFor} <span className="text-indigo-600">{child.name}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleEmergencyLock}
              disabled={allLocksDisabled}
              className={`px-6 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${isLockdown ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}
            >
              {isLockdown ? 'إلغاء القفل' : 'قفل الجهاز الآن'}
            </button>
            <button
              onClick={requestInstantScreenshot}
              disabled={isCapturing}
              className="px-6 py-3 rounded-2xl font-black text-sm bg-indigo-600 text-white shadow disabled:opacity-60"
            >
              {isCapturing ? 'جارٍ الالتقاط...' : 'التقاط شاشة حية'}
            </button>
            <button
              onClick={isStreaming ? stopStream : startStream}
              className={`px-6 py-3 rounded-2xl font-black text-sm ${isStreaming ? 'bg-red-50 text-red-700' : 'bg-emerald-600 text-white'}`}
            >
              {isStreaming ? t.endStream : t.startStream}
            </button>
            <button
              onClick={toggleBlackoutScreen}
              disabled={allLocksDisabled}
              className={`px-6 py-3 rounded-2xl font-black text-sm ${isBlackoutActive ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700'}`}
            >
              {lang === 'ar'
                ? isBlackoutActive
                  ? 'إلغاء شاشة الحجب'
                  : 'تفعيل شاشة الحجب'
                : isBlackoutActive
                  ? 'Disable Blackout'
                  : 'Enable Blackout'}
            </button>
            <button
              onClick={toggleWalkieChannel}
              className={`px-6 py-3 rounded-2xl font-black text-sm ${isWalkieChannelEnabled ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'}`}
            >
              {lang === 'ar'
                ? isWalkieChannelEnabled
                  ? 'إيقاف قناة Walkie'
                  : 'تفعيل قناة Walkie'
                : isWalkieChannelEnabled
                  ? 'Disable Walkie'
                  : 'Enable Walkie'}
            </button>
          </div>
        </div>

        {allLocksDisabled && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-700">
            {lang === 'ar'
              ? lockDisableMode === 'permanent'
                ? 'تم تعطيل جميع الأقفال بشكل دائم من الإعدادات.'
                : `تم تعطيل جميع الأقفال مؤقتًا${lockDisableUntilTs ? ` حتى ${new Date(lockDisableUntilTs).toLocaleString('ar-EG')}` : ''}.`
              : lockDisableMode === 'permanent'
                ? 'All locks are disabled permanently from settings.'
                : `All locks are disabled temporarily${lockDisableUntilTs ? ` until ${new Date(lockDisableUntilTs).toLocaleString('en-US')}` : ''}.`}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-black text-slate-500">{t.videoSource}</p>
            <div className="flex flex-wrap gap-2">
              {videoOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => changeVideoSource(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${videoSource === opt.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-black text-slate-500">{t.audioSource}</p>
            <div className="flex flex-wrap gap-2">
              {audioOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => changeAudioSource(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${audioSource === opt.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-black text-slate-500">
            {lang === 'ar' ? 'رسالة شاشة الحجب' : 'Blackout Message'}
          </p>
          <input
            value={blackoutMessage}
            onChange={(e) => setBlackoutMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
            placeholder={
              lang === 'ar'
                ? 'تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين.'
                : 'Device locked for safety. Please contact a parent.'
            }
          />
        </div>

        {isStreaming && <p className="text-[11px] text-slate-500 font-bold">{t.streamingNow}</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <div className="relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl aspect-video border-[10px] border-slate-900 ring-2 ring-indigo-500/20">
            {isLockdown || isBlackoutActive ? (
              <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-white text-center p-10">
                <div className="text-7xl mb-6">🛡️</div>
                <h4 className="text-4xl font-black tracking-tight mb-3">
                  {lang === 'ar' ? 'الجهاز في وضع الحماية' : 'Protection Mode Active'}
                </h4>
                <p className="text-lg font-bold text-slate-200">
                  {isBlackoutActive ? blackoutMessage : lang === 'ar' ? 'هذا الجهاز مقفل مؤقتًا لحمايتك.' : 'This device is temporarily locked for your safety.'}
                </p>
              </div>
            ) : liveScreenshot ? (
              <div className="absolute inset-0">
                <img src={liveScreenshot} className="w-full h-full object-contain bg-black" alt="Live Stream" />
                <div className="absolute top-6 right-6 bg-red-600 text-white px-4 py-2 rounded-full text-[10px] font-black animate-pulse">
                  LIVE
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 space-y-6 bg-slate-900">
                <div className="text-5xl">👁️</div>
                <p className="font-black text-xs tracking-widest uppercase text-center px-10">
                  {isStreaming ? 'Streaming in progress. Waiting for first frame...' : 'Start stream or request screenshot'}
                </p>
              </div>
            )}
          </div>

          {riskInsight && (
            <div className="bg-red-50 border border-red-100 rounded-[2rem] p-6 space-y-4">
              <h3 className="text-xl font-black text-red-700">{riskInsight.title}</h3>
              <ul className="space-y-2">
                {riskInsight.symptoms.map((item, idx) => (
                  <li key={idx} className="text-sm font-bold text-slate-700 flex items-start gap-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <p className="text-xs font-black text-red-700 mb-1">نصيحة المستشار التربوي</p>
                <p className="text-sm font-bold text-slate-700">{riskInsight.advisorTip}</p>
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-4 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ICONS.WalkieTalkie className="w-5 h-5 text-indigo-600" />
              {t.walkieTalkie}
            </h3>
            <button
              type="button"
              onMouseDown={startPushToTalk}
              onMouseUp={stopPushToTalk}
              onMouseLeave={stopPushToTalk}
              onTouchStart={startPushToTalk}
              onTouchEnd={stopPushToTalk}
              onTouchCancel={stopPushToTalk}
              style={{ touchAction: 'none' }}
              disabled={!isWalkieChannelEnabled}
              className={`w-full h-24 rounded-2xl font-black text-lg transition-all disabled:opacity-50 ${isPushToTalk ? 'bg-emerald-600 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}
            >
              {isPushToTalk ? t.talking : t.pushToTalk}
            </button>
            <p className="text-[11px] text-slate-500 font-bold">
              {isWalkieChannelEnabled
                ? lang === 'ar'
                  ? 'اضغط مطولًا لإرسال صوت مباشر إلى جهاز الطفل.'
                  : 'Hold to send a live voice message to the child device.'
                : lang === 'ar'
                  ? 'فعّل قناة Walkie أولاً ثم استخدم زر التحدث.'
                  : 'Enable walkie channel first, then use push-to-talk.'}
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white space-y-4">
            <h3 className="text-lg font-black">{t.audioAnalysis}</h3>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex justify-between text-[11px] font-black mb-2">
                <span>{t.voiceStress}</span>
                <span>{toneLabel(voiceTone, t)}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${voiceTone === 'aggressive' ? 'bg-red-500' : voiceTone === 'agitated' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${toneScore(voiceTone)}%` }}
                ></div>
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-300">{t.detectingAudio}</p>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-900">{t.liveTranscript}</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {transcript.length === 0 && (
                <p className="text-xs font-bold text-slate-400">
                  {lang === 'ar' ? 'لا توجد رسائل مرصودة بعد.' : 'No monitored messages yet.'}
                </p>
              )}
              {transcript.map((entry) => (
                <div key={entry.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-[10px] font-black ${entry.tone === 'aggressive' ? 'text-red-600' : entry.tone === 'agitated' ? 'text-amber-600' : 'text-emerald-600'}`}
                    >
                      {toneLabel(entry.tone, t)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{entry.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center space-y-4">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">صافرة الطوارئ</h3>
            <button
              onClick={triggerSiren}
              disabled={isSirenActive}
              className={`w-28 h-28 rounded-full border-8 border-white shadow-xl text-4xl transition-all ${isSirenActive ? 'bg-amber-100' : 'bg-red-50 hover:bg-red-100'}`}
            >
              📢
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitorView;

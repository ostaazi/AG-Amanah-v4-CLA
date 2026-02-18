import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EvidenceRecord, AlertSeverity, ParentAccount, Category } from '../types';
import { ICONS, AmanahLogo, AmanahGlobalDefs, AmanahShield } from '../constants';
import Skeleton from './Skeleton';
import { deleteAlertFromDB, sendRemoteCommand, updateAlertStatus } from '../services/firestoreService';
import { useStepUpGuard } from './auth/StepUpGuard';

interface EvidenceVaultViewProps {
  records: EvidenceRecord[];
  currentUser: ParentAccount;
  lang?: 'ar' | 'en';
  onModalToggle?: (isOpen: boolean) => void;
  onRequestToast: (alert: any) => void;
  isLoading?: boolean;
}

const VAULT_FILTERS_STORAGE_KEY = 'amanah_vault_filters_v1';

const normalizeHandle = (value: string): string => {
  const trimmed = String(value || '').trim().replace(/^@+/, '');
  if (!trimmed) return 'unknown_user';
  return trimmed.replace(/\s+/g, '_').toLowerCase();
};

const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({
  records,
  currentUser,
  lang = 'ar',
  onModalToggle,
  onRequestToast,
  isLoading = false,
}) => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [recordKindFilter, setRecordKindFilter] = useState<'all' | 'pulse' | 'security'>('all');
  const [selectedDayKey, setSelectedDayKey] = useState<'all' | string>('all');
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRequestingScreenshot, setIsRequestingScreenshot] = useState(false);
  const [screenshotRequestError, setScreenshotRequestError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(VAULT_FILTERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        searchTerm?: string;
        recordKindFilter?: 'all' | 'pulse' | 'security';
        selectedDayKey?: string;
      };
      if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
      if (
        parsed.recordKindFilter === 'all' ||
        parsed.recordKindFilter === 'pulse' ||
        parsed.recordKindFilter === 'security'
      ) {
        setRecordKindFilter(parsed.recordKindFilter);
      }
      if (typeof parsed.selectedDayKey === 'string' && parsed.selectedDayKey.length > 0) {
        setSelectedDayKey(parsed.selectedDayKey);
      }
    } catch (error) {
      console.warn('Failed to restore vault filters from storage', error);
    }
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).openAlertId) {
      const alertId = (location.state as any).openAlertId;
      const record = records.find((r) => r.id === alertId);
      if (record) {
        setSelectedRecord(record);
      }
    }
    if (location.state && (location.state as any).presetFilter) {
      const presetFilter = String((location.state as any).presetFilter).toLowerCase();
      if (presetFilter === 'pulse' || presetFilter === 'security' || presetFilter === 'all') {
        setRecordKindFilter(presetFilter as 'all' | 'pulse' | 'security');
      }
    }
  }, [location.state, records]);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(!!selectedRecord);
    }
  }, [selectedRecord, onModalToggle]);

  useEffect(() => {
    setIsRequestingScreenshot(false);
    setScreenshotRequestError('');
  }, [selectedRecord?.id]);

  const isPulseExecutionRecord = (record: EvidenceRecord) =>
    String((record as any).type || '')
      .toUpperCase()
      .trim() === 'PULSE_EXECUTION';

  const getRecordDayKey = (timestamp: any) => {
    const date = new Date(timestamp as any);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  };

  const filteredRecords = useMemo(() => {
    let result = [...records].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (recordKindFilter === 'pulse') {
      result = result.filter((r) => isPulseExecutionRecord(r));
    } else if (recordKindFilter === 'security') {
      result = result.filter((r) => !isPulseExecutionRecord(r));
    }

    if (selectedDayKey !== 'all') {
      result = result.filter((r) => getRecordDayKey(r.timestamp) === selectedDayKey);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          (r.suspectUsername || '').toLowerCase().includes(term) ||
          (r.childName || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [records, recordKindFilter, searchTerm, selectedDayKey]);

  const vaultMetrics = useMemo(() => {
    let pulseCount = 0;
    let latestRecord: EvidenceRecord | null = null;

    for (const record of records) {
      const isPulse =
        String((record as any).type || '')
          .toUpperCase()
          .trim() === 'PULSE_EXECUTION';
      if (isPulse) pulseCount += 1;

      if (!latestRecord) {
        latestRecord = record;
        continue;
      }

      const latestTs = new Date(latestRecord.timestamp as any).getTime();
      const currentTs = new Date(record.timestamp as any).getTime();
      if (currentTs > latestTs) {
        latestRecord = record;
      }
    }

    const latestTimestamp = latestRecord?.timestamp;
    const latestDate = latestTimestamp ? new Date(latestTimestamp as any) : null;
    const latestSavedAt =
      latestDate && !Number.isNaN(latestDate.getTime())
        ? latestDate.toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '--';

    return {
      total: records.length,
      pulse: pulseCount,
      security: Math.max(0, records.length - pulseCount),
      visible: filteredRecords.length,
      latestSavedAt,
    };
  }, [filteredRecords.length, records]);

  const weeklyTrend = useMemo(() => {
    const days: Array<{
      date: Date;
      key: string;
      label: string;
      total: number;
      pulse: number;
      security: number;
    }> = [];
    const byKey = new Map<string, number>();
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(base);
      date.setDate(base.getDate() - i);
      const key = getRecordDayKey(date);
      byKey.set(key, days.length);
      days.push({
        date,
        key,
        label: new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(date),
        total: 0,
        pulse: 0,
        security: 0,
      });
    }

    for (const record of records) {
      const ts = new Date(record.timestamp as any);
      if (Number.isNaN(ts.getTime())) continue;
      const key = getRecordDayKey(ts);
      const idx = byKey.get(key);
      if (idx === undefined) continue;
      const point = days[idx];
      point.total += 1;
      const isPulse =
        String((record as any).type || '')
          .toUpperCase()
          .trim() === 'PULSE_EXECUTION';
      if (isPulse) point.pulse += 1;
      else point.security += 1;
    }

    const maxTotal = Math.max(1, ...days.map((d) => d.total));
    return { points: days, maxTotal };
  }, [records]);

  const selectedDayLabel = useMemo(() => {
    if (selectedDayKey === 'all') return null;
    const point = weeklyTrend.points.find((d) => d.key === selectedDayKey);
    if (!point) return selectedDayKey;
    return point.date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, [selectedDayKey, weeklyTrend.points]);

  useEffect(() => {
    if (selectedDayKey === 'all') return;
    const existsInRange = weeklyTrend.points.some((point) => point.key === selectedDayKey);
    if (!existsInRange) {
      setSelectedDayKey('all');
    }
  }, [selectedDayKey, weeklyTrend.points]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        VAULT_FILTERS_STORAGE_KEY,
        JSON.stringify({
          searchTerm,
          recordKindFilter,
          selectedDayKey,
        })
      );
    } catch (error) {
      console.warn('Failed to persist vault filters to storage', error);
    }
  }, [searchTerm, recordKindFilter, selectedDayKey]);

  const displayLog = useMemo(() => {
    if (!selectedRecord) return [];
    if (selectedRecord.conversationLog && selectedRecord.conversationLog.length > 0) {
      return selectedRecord.conversationLog;
    }
    const platform = String(selectedRecord.platform || '').toLowerCase();
    const capturedText = String(selectedRecord.content || '').trim();
    const analysisText = String(selectedRecord.aiAnalysis || '').trim();
    const isOperationalLiveFrame =
      platform === 'live stream' &&
      capturedText.toLowerCase().includes('live screenshot frame');
    const eventTime = new Date(selectedRecord.timestamp as any).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return [
      {
        sender: isOperationalLiveFrame
          ? 'AMANAH_SYSTEM'
          : String(selectedRecord.suspectUsername || 'مجهول'),
        text: capturedText || '[لا يوجد نص محادثة محفوظ، تم تسجيل المحتوى المرصود فقط]',
        time: eventTime,
        isSuspect: !isOperationalLiveFrame,
      },
      ...(analysisText
        ? [
            {
              sender: 'AMANAH_AI',
              text: analysisText,
              time: eventTime,
              isSuspect: false,
            },
          ]
        : []),
    ];
  }, [selectedRecord]);

  const selectedRecordTimestampLabel = useMemo(() => {
    if (!selectedRecord) return '--';
    const date = new Date(selectedRecord.timestamp as any);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [selectedRecord]);

  const selectedRecordDetails = useMemo(() => {
    if (!selectedRecord) {
      return {
        observedContent: '--',
        detectionReason: '--',
        sourceApp: '--',
        sourceLocation: '--',
        targetHandle: '@unknown_user',
      };
    }

    const observedContent = String(selectedRecord.content || '').trim() || '--';
    const detectionReason = String(selectedRecord.aiAnalysis || '').trim() || '--';
    const sourceApp = String(selectedRecord.platform || '').trim() || '--';
    const rawLocation =
      (selectedRecord as any)?.location?.address ||
      (selectedRecord as any)?.locationAddress ||
      (selectedRecord as any)?.geoAddress ||
      (selectedRecord as any)?.sourceLocation ||
      '';
    const sourceLocation = String(rawLocation || '').trim() || '--';
    const targetHandle = `@${normalizeHandle(String(selectedRecord.childName || 'unknown_user'))}`;

    return {
      observedContent,
      detectionReason,
      sourceApp,
      sourceLocation,
      targetHandle,
    };
  }, [selectedRecord]);

  const selectedRecordChildId = String((selectedRecord as any)?.childId || '').trim();

  const handleRequestEvidenceScreenshot = async () => {
    if (!selectedRecord || isRequestingScreenshot) return;
    if (!selectedRecordChildId) {
      setScreenshotRequestError(
        lang === 'ar'
          ? 'لا يمكن طلب لقطة شاشة لهذا السجل لأن معرف الطفل غير موجود في بيانات الإنذار.'
          : 'Cannot request a screenshot for this record because child ID is missing.'
      );
      return;
    }

    setIsRequestingScreenshot(true);
    setScreenshotRequestError('');
    try {
      await sendRemoteCommand(selectedRecordChildId, 'takeScreenshot', true);
      onRequestToast({
        id: `vault-screenshot-${Date.now()}`,
        childName: selectedRecord.childName,
        content:
          lang === 'ar'
            ? 'تم إرسال طلب لقطة شاشة جديدة إلى جهاز الطفل.'
            : 'A new screenshot request was sent to the child device.',
        aiAnalysis:
          lang === 'ar'
            ? 'انتظر بضع ثوانٍ حتى يظهر الدليل المرئي في هذا السجل.'
            : 'Wait a few seconds for visual evidence to appear in this record.',
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
      });
    } catch (error: any) {
      setScreenshotRequestError(
        lang === 'ar'
          ? `فشل طلب لقطة الشاشة: ${String(error?.message || 'خطأ غير معروف')}`
          : `Screenshot request failed: ${String(error?.message || 'Unknown error')}`
      );
    } finally {
      setIsRequestingScreenshot(false);
    }
  };

  const handleExport = async () => {
    if (!selectedRecord) return;
    onRequestToast({
      id: 'export-' + Date.now(),
      childName: 'Amanah AI',
      aiAnalysis: 'تم توليد ملف PDF الجنائي وجاري التحميل للبلاغ الرسمي.',
      category: Category.SAFE,
      severity: AlertSeverity.LOW,
    });
    setTimeout(() => {
      window.print();
    }, 1000);
  };

  const handleSave = async () => {
    if (!selectedRecord || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateAlertStatus(selectedRecord.id, 'SECURED');
      onRequestToast({
        id: 'save-' + Date.now(),
        childName: 'Amanah AI',
        aiAnalysis: 'تم تأمين السجل وحفظه في الأرشيف الجنائي بنجاح.',
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord || isProcessing) return;
    setIsProcessing(true);
    try {
      await deleteAlertFromDB(selectedRecord.id);
      onRequestToast({
        id: 'delete-' + Date.now(),
        childName: 'Amanah AI',
        aiAnalysis: 'تم إتلاف السجل نهائيًا.',
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
      });
      setSelectedRecord(null);
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasActiveFilters =
    searchTerm.trim().length > 0 || recordKindFilter !== 'all' || selectedDayKey !== 'all';
  const activeFiltersCount =
    (searchTerm.trim().length > 0 ? 1 : 0) +
    (recordKindFilter !== 'all' ? 1 : 0) +
    (selectedDayKey !== 'all' ? 1 : 0);
  const activeFilterChips: Array<{ id: string; label: string; onClear: () => void }> = [];

  if (searchTerm.trim().length > 0) {
    activeFilterChips.push({
      id: 'search',
      label: `بحث: ${searchTerm.trim()}`,
      onClear: () => setSearchTerm(''),
    });
  }

  if (recordKindFilter !== 'all') {
    const kindLabel = recordKindFilter === 'pulse' ? 'النوع: نبض نفسي' : 'النوع: أمني';
    activeFilterChips.push({
      id: 'kind',
      label: kindLabel,
      onClear: () => setRecordKindFilter('all'),
    });
  }

  if (selectedDayKey !== 'all') {
    activeFilterChips.push({
      id: 'day',
      label: `اليوم: ${selectedDayLabel || selectedDayKey}`,
      onClear: () => setSelectedDayKey('all'),
    });
  }

  const clearAllFilters = () => {
    setSearchTerm('');
    setRecordKindFilter('all');
    setSelectedDayKey('all');
  };
  const { requireStepUp, modal: stepUpModal } = useStepUpGuard({
    lang,
    currentUser,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-40 animate-in fade-in no-print" dir="rtl">
      <div className="bg-[#0f172a] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-8 border-[#8A1538]">
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner border border-white/10">
            🏛️
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter mb-2">الأرشيف الجنائي</h2>
            <p className="text-indigo-300 font-bold opacity-80 text-lg">
              سجلات الأدلة المؤمنة بنظام التشفير العسكري.
            </p>
          </div>
        </div>
        <div className="relative z-10 w-full md:w-80">
          <input
            type="text"
            placeholder="بحث في السجلات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-[1.5rem] px-8 py-5 text-white placeholder:text-white/40 font-bold outline-none focus:ring-4 focus:ring-[#8A1538]/30 transition-all"
          />
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <button
            onClick={() => setRecordKindFilter('all')}
            className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${
              recordKindFilter === 'all'
                ? 'bg-white text-slate-900 border-white'
                : 'bg-white/10 text-white border-white/20'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setRecordKindFilter('pulse')}
            className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${
              recordKindFilter === 'pulse'
                ? 'bg-emerald-400 text-slate-900 border-emerald-300'
                : 'bg-white/10 text-white border-white/20'
            }`}
          >
            نبض نفسي
          </button>
          <button
            onClick={() => setRecordKindFilter('security')}
            className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${
              recordKindFilter === 'security'
                ? 'bg-indigo-300 text-slate-900 border-indigo-200'
                : 'bg-white/10 text-white border-white/20'
            }`}
          >
            أمني
          </button>
          <button
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            className="px-4 py-2 rounded-xl text-[11px] font-black border bg-red-500/90 text-white border-red-300 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {hasActiveFilters ? `مسح الفلاتر (${activeFiltersCount})` : 'مسح الفلاتر'}
          </button>
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <section className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm -mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-black text-slate-500 ml-1">الفلاتر النشطة:</p>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onClear}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-black hover:bg-slate-200 transition-all"
                title="إزالة هذا الفلتر"
              >
                <span>{chip.label}</span>
                <span className="text-slate-500">×</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <article className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-black text-slate-500 mb-2">إجمالي السجلات</p>
          <p className="text-3xl font-black text-slate-900 leading-none">{vaultMetrics.total}</p>
        </article>
        <article className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-black text-emerald-700 mb-2">نبض نفسي</p>
          <p className="text-3xl font-black text-emerald-700 leading-none">{vaultMetrics.pulse}</p>
        </article>
        <article className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-black text-indigo-700 mb-2">أمني</p>
          <p className="text-3xl font-black text-indigo-700 leading-none">{vaultMetrics.security}</p>
        </article>
        <article className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-black text-slate-500 mb-2">آخر حفظ</p>
          <p className="text-sm font-black text-slate-800 leading-tight">{vaultMetrics.latestSavedAt}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-2">الظاهر حسب الفلتر: {vaultMetrics.visible}</p>
        </article>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-900">اتجاه الأدلة آخر 7 أيام</h3>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-black text-slate-500">نبض نفسي مقابل أمني</p>
            {selectedDayLabel && (
              <button
                onClick={() => setSelectedDayKey('all')}
                className="px-3 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-white"
              >
                إعادة ضبط ({selectedDayLabel})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 items-end">
          {weeklyTrend.points.map((point) => {
            const totalHeight =
              point.total === 0
                ? 6
                : Math.max(14, Math.round((point.total / weeklyTrend.maxTotal) * 92));
            const pulseHeight =
              point.total === 0 ? 0 : Math.round((point.pulse / point.total) * totalHeight);
            const securityHeight = Math.max(0, totalHeight - pulseHeight);
            return (
              <button
                key={point.key}
                type="button"
                onClick={() => setSelectedDayKey((prev) => (prev === point.key ? 'all' : point.key))}
                className={`flex flex-col items-center gap-2 rounded-xl py-1 transition-all ${
                  selectedDayKey === point.key ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="h-28 flex items-end">
                  <div
                    className="w-8 rounded-t-xl bg-slate-100 overflow-hidden border border-slate-200"
                    style={{ height: `${totalHeight}px` }}
                  >
                    {securityHeight > 0 && (
                      <div className="w-full bg-indigo-300" style={{ height: `${securityHeight}px` }} />
                    )}
                    {pulseHeight > 0 && (
                      <div className="w-full bg-emerald-400" style={{ height: `${pulseHeight}px` }} />
                    )}
                  </div>
                </div>
                <p className="text-[10px] font-black text-slate-500">{point.label}</p>
                <p className="text-[11px] font-black text-slate-800">{point.total}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-[11px] font-black">
          <div className="flex items-center gap-2 text-emerald-700">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <span>نبض نفسي</span>
          </div>
          <div className="flex items-center gap-2 text-indigo-700">
            <span className="w-3 h-3 rounded-full bg-indigo-300" />
            <span>أمني</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4 px-2 animate-in">
        {isLoading
          ? [1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[3rem] border border-slate-100 shadow-lg p-8 space-y-6"
            >
              <div className="flex justify-between">
                <Skeleton className="w-16 h-6 rounded-xl" />
                <Skeleton variant="text" className="w-20" />
              </div>
              <div className="flex items-center gap-5">
                <Skeleton variant="circle" className="w-14 h-14" />
                <div className="flex-1 space-y-3">
                  <Skeleton variant="text" className="w-full h-6" />
                  <Skeleton variant="text" className="w-2/3 h-4" />
                </div>
              </div>
            </div>
          ))
          : filteredRecords.map((record) => (
            <div
              key={record.id}
              onClick={() => setSelectedRecord(record)}
              className={`bg-white rounded-[3rem] border shadow-lg p-8 cursor-pointer hover:border-indigo-600 transition-all duration-300 hover:scale-[1.02] group ${selectedRecord?.id === record.id ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-2xl' : 'border-slate-100'}`}
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase ${record.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}
                    >
                      {record.severity}
                    </span>
                    {isPulseExecutionRecord(record) && (
                      <span className="px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                        PULSE
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 font-black">
                    ID: {record.id.substring(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-slate-50 rounded-[1.2rem] flex items-center justify-center text-3xl shadow-inner border border-slate-100">
                    👤
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 font-mono tracking-tighter">
                      @{(record.suspectUsername || '').replace('@', '')}
                    </h3>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      {record.platform} • {record.childName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-0 md:p-6 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300 print:relative print:inset-auto print:bg-white overflow-y-auto custom-scrollbar">
          <AmanahGlobalDefs />
          <div className="bg-white w-full max-w-2xl h-full md:h-auto md:max-h-[96vh] md:rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col animate-in zoom-in-95 print:shadow-none print:rounded-none">
            <div className="bg-[#050510] px-8 pt-24 pb-8 flex justify-between items-center flex-shrink-0 z-[8100] border-b border-white/5 relative shadow-xl">
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-white hover:text-red-500 transition-colors p-3 bg-white/10 rounded-full border border-white/20 shadow-inner"
              >
                <ICONS.Close className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4 text-center flex-row-reverse">
                <h2 className="text-2xl font-black text-white tracking-tighter">
                  تفريغ السجل الكامل
                </h2>
                <span className="hidden sm:inline-block text-[10px] font-mono font-black text-slate-500 tracking-widest uppercase opacity-70">
                  FORENSIC ID: {selectedRecord.id.substring(0, 8)}
                </span>
              </div>
              <div className="w-12 h-12 flex items-center justify-center bg-red-600/10 rounded-2xl border border-red-600/20 shadow-lg">
                <AmanahShield />
              </div>
            </div>

            <div className="flex-1 bg-white print:overflow-visible relative pt-2">
              <div className="pt-10 px-12 flex justify-center">
                <div className="w-28 opacity-90 drop-shadow-md">
                  <AmanahLogo />
                </div>
              </div>

              <div className="px-12 grid grid-cols-2 gap-x-12 pt-10">
                <div className="text-right space-y-4 border-r-4 border-slate-50 pr-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    المشتبه به
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-[#dc2626] font-mono tracking-tighter">
                    @{(selectedRecord.suspectUsername || '').replace('@', '')}
                  </p>
                  <div className="pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      الهدف (الطفل الضحية)
                    </p>
                    <div className="flex items-center justify-end gap-3">
                      <p className="text-2xl sm:text-3xl font-black text-slate-900">
                        {selectedRecord.childName}
                      </p>
                      <span className="bg-indigo-50 text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-black font-mono">
                        {selectedRecordDetails.targetHandle}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center md:text-left flex flex-col items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      المنصة
                    </p>
                    <p className="text-3xl sm:text-4xl font-black text-[#4f46e5] tracking-tighter">
                      {selectedRecord.platform}
                    </p>
                    {isPulseExecutionRecord(selectedRecord) && (
                      <p className="mt-2">
                        <span className="px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                          PULSE_EXECUTION
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      حالة التهديد
                    </p>
                    <span
                      className={`px-8 py-3 rounded-2xl text-[12px] font-black tracking-widest uppercase shadow-xl ${selectedRecord.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}
                    >
                      {selectedRecord.severity}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-12 mt-12 mb-10">
                <div className="bg-slate-50/80 rounded-[2.5rem] py-6 px-8 flex items-center justify-center gap-4 text-center shadow-inner border border-slate-100">
                  <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
                    توقيت الرصد الاستباقي للواقعة :
                  </span>
                  <span
                    className="text-sm font-black text-slate-600 font-mono tracking-widest"
                    dir="ltr"
                  >
                    {selectedRecordTimestampLabel}
                  </span>
                </div>
              </div>

              <div className="px-12 mb-8">
                <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      المحتوى الذي تم رصده
                    </p>
                    <p className="text-sm font-black text-slate-800 leading-relaxed">
                      {selectedRecordDetails.observedContent}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      سبب التصنيف غير اللائق
                    </p>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedRecordDetails.detectionReason}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white border border-slate-100 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المصدر</p>
                      <p className="text-sm font-black text-slate-800">{selectedRecordDetails.sourceApp}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-100 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المكان</p>
                      <p className="text-sm font-black text-slate-800">{selectedRecordDetails.sourceLocation}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-100 px-4 py-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      لقطة الشاشة الدليلية
                    </p>
                    {selectedRecord.imageData ? (
                      <img
                        src={selectedRecord.imageData}
                        alt="Evidence screenshot"
                        className="w-full max-h-80 object-contain rounded-xl border border-slate-200 bg-slate-100"
                      />
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500">
                          لا توجد لقطة شاشة مرفقة لهذا السجل حتى الآن.
                        </p>
                        <button
                          onClick={handleRequestEvidenceScreenshot}
                          disabled={isRequestingScreenshot || !selectedRecordChildId}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-50"
                        >
                          {isRequestingScreenshot ? 'جارٍ طلب اللقطة...' : 'طلب لقطة شاشة الآن'}
                        </button>
                        {!selectedRecordChildId && (
                          <p className="text-[11px] font-bold text-amber-600">
                            هذا سجل قديم بدون `childId`، يلزم إنذار جديد لالتقاط لقطة تلقائيًا.
                          </p>
                        )}
                        {!!screenshotRequestError && (
                          <p className="text-[11px] font-bold text-rose-600">{screenshotRequestError}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-12 space-y-6 mb-12">
                {displayLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className="relative bg-white border border-slate-100 shadow-sm rounded-[2.5rem] p-8 flex flex-col w-full group transition-all hover:shadow-md border-b-4 border-b-slate-50"
                  >
                    <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                      <span
                        className={`text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-lg border ${msg.isSuspect ? 'text-red-600 bg-red-50 border-red-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}
                      >
                        {msg.isSuspect ? 'SUSPECT' : 'TARGET'}
                      </span>
                      <span
                        className="text-[10px] text-slate-300 font-black font-mono tracking-widest"
                        dir="ltr"
                      >
                        {String(msg.time || selectedRecordTimestampLabel)}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-slate-800 leading-snug text-right dir-rtl">
                      "{msg.text}"
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-12 pb-10">
                <div className="bg-[#050508] rounded-[2rem] py-8 px-10 flex flex-col justify-center gap-2 overflow-hidden relative border-r-8 border-red-600 shadow-2xl">
                  <div className="flex flex-col gap-1.5 relative z-10">
                    <span className="font-mono text-[11px] text-slate-400 font-black tracking-[0.2em] uppercase opacity-80">
                      AUTHENTICATED_FORENSIC_STREAM
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 font-bold tracking-[0.2em] uppercase">
                      STATUS: TAMPER_PROOF_VERIFIED
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 pb-20 md:pb-8 bg-white border-t border-slate-100 flex items-center justify-center gap-4 flex-shrink-0 z-[8200] print:hidden">
              <button
                onClick={() => {
                  void requireStepUp('EXPORT_EVIDENCE', handleExport);
                }}
                className="flex-1 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl hover:bg-zinc-900"
              >
                <div className="bg-[#dc2626] text-white text-[9px] px-2 py-0.5 rounded-md font-black tracking-widest leading-none">
                  PDF
                </div>
                <span className="text-lg font-black tracking-tight">تصدير للبلاغ</span>
              </button>

              <button
                onClick={() => {
                  void requireStepUp('SENSITIVE_SETTINGS', handleSave);
                }}
                className="flex-1 h-16 bg-[#10a173] text-white rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-lg shadow-emerald-50 hover:bg-[#0d8f66]"
              >
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/20">
                  <AmanahShield className="w-5 h-5 opacity-90" />
                </div>
                <span className="text-lg font-black tracking-tight">حفظ كدليل</span>
              </button>

              <button
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="flex-1 h-16 bg-[#fff3f4] text-[#b22c2c] rounded-[1.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 border border-red-50 hover:bg-[#ffeaea]"
              >
                <span className="text-xl">🗑️</span>
                <span className="text-lg font-black tracking-tight">إتلاف السجل</span>
              </button>
            </div>
            {isDeleteConfirmOpen && (
              <div className="px-6 pb-8 print:hidden">
                <InlineDangerConfirm
                  message="حذف نهائي لهذا السجل؟"
                  onConfirm={() => {
                    void requireStepUp('DELETE_EVIDENCE', handleDelete);
                  }}
                  onCancel={() => setIsDeleteConfirmOpen(false)}
                  disabled={isProcessing}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {stepUpModal}
    </div>
  );
};

export default EvidenceVaultView;

const InlineDangerConfirm: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}> = ({ message, onConfirm, onCancel, disabled = false }) => (
  <div className="bg-red-600 rounded-[2.5rem] p-6 border border-red-500 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in">
    <p className="text-white font-black text-xl md:text-3xl tracking-tight text-right">{message}</p>
    <div className="flex items-center gap-3 shrink-0">
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="px-8 py-3 bg-white text-red-700 rounded-2xl font-black text-lg shadow-lg disabled:opacity-50"
      >
        نعم، احذف
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="px-8 py-3 bg-red-700 text-white rounded-2xl font-black text-lg disabled:opacity-50"
      >
        إلغاء
      </button>
    </div>
  </div>
);




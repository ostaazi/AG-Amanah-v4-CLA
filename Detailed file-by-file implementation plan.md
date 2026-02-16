# Detailed File-by-File Implementation Plan

## Execution Progress Log (Updated 2026-02-14)

- Completed: `step-up-security`
  - Backup: `phase_backups/step-up-security_20260214-181642.zip`
- Completed: `upgrade-simplified-files`
  - Backup: `phase_backups/upgrade-simplified-files_20260214-182102.zip`
- Completed: `hardening-rules-indexes`
  - Backup: `phase_backups/hardening-rules-indexes_20260214-182329.zip`
- Completed: `qa-regression-tests`
  - Backup: `phase_backups/qa-regression-tests_20260214-225316.zip`
- Completed: `workers-backlog-integration`
  - Backup: `phase_backups/workers-backlog-integration_20260214-230828.zip`
- Completed: `parent-ops-worker-binding`
  - Backups:
    - `phase_backups/parent-ops-worker-binding_20260214-232220.zip`
    - `phase_backups/parent-ops-stepup-guard_20260214-232347.zip`
- Completed: `exports-package-download`
  - Backup: `phase_backups/exports-package-download_20260214-232959.zip`
- Completed: `digital-balance-deep-actions`
  - Backup: `phase_backups/digital-balance-deep-actions_20260214-233939.zip`
- Completed: `deep-actions-qa-regression`
  - Backup: `phase_backups/deep-actions-qa-regression_20260214-234058.zip`
- Completed: `playbook-action-control`
  - Backup: `phase_backups/playbook-action-control_20260214-234218.zip`
- Completed: `parent-device-deep-commands`
  - Backup: `phase_backups/parent-device-deep-commands_20260214-234500.zip`
- Completed: `live-monitor-deep-control-hardening`
  - Backup: `phase_backups/live-monitor-deep-control-hardening_20260215-044453.zip`
- Completed: `proactive-defense-playbook-sync`
  - Backup: `phase_backups/proactive-defense-playbook-sync_20260215-044624.zip`
- Completed: `pulse-playbook-auto-step-sync`
  - Backup: `phase_backups/pulse-playbook-auto-step-sync_20260215-045008.zip`

- Completed: `phase5-part51-pulse-evidence-hardening`
  - Backup: `phase_backups/phase5-part51-pulse-evidence-hardening-20260215-060254.zip`
- Completed: `phase5-part52-playbook-permission-fallback`
  - Backup: `phase_backups/phase5-part52-playbook-permission-fallback-20260215-060553.zip`
- Completed: `phase5-part53-playbook-arabic-encoding-cleanup`
  - Backup: `phase_backups/phase5-part53-playbook-arabic-encoding-cleanup-20260215-060916.zip`
- Completed: `phase5-part56-command-and-resolution-hubs`
  - Backup: `phase_backups/phase5-part56-command-and-resolution-hubs-20260215-144246.zip`
- Completed: `phase5-part57-plan-progress-sync`
  - Backup: `phase_backups/phase5-part57-plan-progress-sync-20260215-144326.zip`
- Completed: `phase5-part58-hub-regression-tests`
  - Backup: `phase_backups/phase5-part58-hub-regression-tests-20260215-144534.zip`
- Completed: `phase6-part61-release-prep-checklist`
  - Backup: `phase_backups/phase6-part61-release-prep-checklist-20260215-144656.zip`
- Completed: `phase6-part62-rbac-hardening-hubs`
  - Backup: `phase_backups/phase6-part62-rbac-hardening-hubs-20260215-144835.zip`
- Completed: `phase6-part63-plan-log-sync`
  - Backup: `phase_backups/phase6-part63-plan-log-sync-20260215-144906.zip`
- Completed: `phase6-part64-backup-index-refresh`
  - Backup: `phase_backups/phase6-part64-backup-index-refresh-20260215-144944.zip`
- Completed: `phase6-part65-plan-log-sync`
  - Backup: `phase_backups/phase6-part65-plan-log-sync-20260215-145012.zip`
- Completed: `phase6-part66-route-smoke-report`
  - Backup: `phase_backups/phase6-part66-route-smoke-report-20260215-145105.zip`
- Completed: `phase6-part67-plan-log-sync`
  - Backup: `phase_backups/phase6-part67-plan-log-sync-20260215-145128.zip`
- Completed: `phase6-part68-family-response-encoding-fix`
  - Backup: `phase_backups/phase6-part68-family-response-encoding-fix-20260215-145304.zip`
- Completed: `phase6-part69-scenarios-audit-backlog`
  - Backup: `phase_backups/phase6-part69-scenarios-audit-backlog-20260215-165250.zip`
- Completed: `phase6-part72-phishing-scenario-expansion`
  - Backup: `phase_backups/phase6-part72-phishing-scenario-expansion-20260215-172028.zip`
- Completed: `phase6-part73-plan-log-sync`
  - Backup: `phase_backups/phase6-part73-plan-log-sync-20260215-172110.zip`
- Completed: `phase6-part74-plan-log-sync-final`
  - Backup: `phase_backups/phase6-part74-plan-log-sync-final-20260215-172133.zip`
- Completed: `phase6-part75-inappropriate-content-track-split`
  - Backup: `phase_backups/phase6-part75-inappropriate-content-track-split-20260215-172608.zip`
- Completed: `phase6-part76-plan-log-sync`
  - Backup: `phase_backups/phase6-part76-plan-log-sync-20260215-172640.zip`
- Completed: `phase6-part77-cybercrime-risk-ladder`
  - Backup: `phase_backups/phase6-part77-cybercrime-risk-ladder-20260215-172901.zip`
- Completed: `phase6-part78-plan-log-sync`
  - Backup: `phase_backups/phase6-part78-plan-log-sync-20260215-172935.zip`

- Current focus: Phase 6 P0 execution continuation (auto-playbook/audit linkage hardening + evidence trace completeness).

## 1) الهدف
هذه الخطة تترجم الرؤية العامة إلى ترتيب تنفيذي عملي يوضح:
1. الملفات التي سنعدلها أو ننشئها.
2. الوظائف/المميزات المتأثرة داخل كل ملف.
3. ما هو التعديل بالضبط.
4. سبب التعديل.
5. الترتيب المنطقي الصحيح للتنفيذ.

---

## 2) قرار معماري قبل التنفيذ
النسخة الحالية تعمل على `Vite + React SPA` ولا تحتوي بنية `Next.js app routes` في الجذر (`app/`, `lib/`, `prisma/` غير موجودة).
لذلك:
1. نستعيد مميزات الواجهة والخدمات القابلة للدمج مباشرة داخل SPA.
2. أي ملفات API من النسخ القديمة (`app/api/*`) تُحوَّل إلى:
- دوال Service في `services/*` (المرحلة الحالية).
- أو Backlog لباك-إند منفصل (مرحلة لاحقة).
3. السبب: منع كسر البنية الحالية وضمان تسليم تدريجي قابل للاختبار.

---

## 3) الترتيب المنطقي السليم (Execution Order)

1. **Foundation Contract Layer**
- `types.ts`
- `translations.ts`
- `config/featureFlags.ts`
- `constants.tsx`

2. **Core Orchestration Layer**
- `App.tsx`
- `services/firestoreService.ts`
- `services/mockDataService.ts`
- `services/ruleEngineService.ts`

3. **Stabilization of Existing Critical Views**
- `components/PsychologicalInsightView.tsx`
- `components/LiveMonitorView.tsx`
- `components/ModesView.tsx`
- `components/EvidenceVaultView.tsx`
- `components/SettingsView.tsx`

4. **Recover Missing Security/Forensics Services**
- `services/forensicsService.ts` (new)
- `services/rbacService.ts` (new)
- `services/auditService.ts` (new)
- `services/backupService.ts` (new)

5. **Recover Missing Incident/Forensics UI (Wave UI-1)**
- `components/IncidentWarRoom.tsx` (new)
- `components/ChainOfCustodyView.tsx` (new)
- `components/FamilyIncidentResponseView.tsx` (new)
- `components/ExportBundleModal.tsx` (new)
- `components/SystemSecurityReportView.tsx` (new)
- `components/VisualBenchmarkView.tsx` (new)

6. **Recover Missing Defense/Playbook UI (Wave UI-2)**
- `components/SafetyPlaybookHub.tsx` (new)
- `components/SafetyProtocolStudio.tsx` (new)
- `components/PlatformSOCView.tsx` (new)
- `components/parent/DefenseRulesView.tsx` (new)
- `components/parent/DefensePolicyView.tsx` (new)
- `components/parent/GeoFenceManager.tsx` (new)

7. **Recover Parent Ops UI (Wave UI-3)**
- `components/parent/DeviceCommandsDashboard.tsx` (new)
- `components/parent/DeviceCommandControl.tsx` (new)
- `components/parent/CommandsStatusTable.tsx` (new)
- `components/parent/IncidentsTable.tsx` (new)
- `components/parent/IncidentDetailsTabs.tsx` (new)
- `components/parent/NotificationCenterView.tsx` (new)
- `components/parent/EvidenceVaultTable.tsx` (new)
- `components/parent/EvidenceList.tsx` (new)
- `components/parent/ExportsTable.tsx` (new)
- `components/parent/CreateExportButton.tsx` (new)
- `components/parent/HashVerifier.tsx` (new)
- `components/parent/CustodyTimeline.tsx` (new)
- `components/parent/ParentSidebar.tsx` (new)
- `components/parent/EvidenceVaultView.tsx` (new)
- `components/parent/SafetyPlaybookHub.tsx` (new)

8. **Step-Up / Sensitive Actions Layer**
- `components/stepup/StepUpModal.tsx` (new)
- `components/auth/StepUpGuard.tsx` (new)
- ربطها داخل `App.tsx` و `components/SettingsView.tsx` و `components/EvidenceVaultView.tsx`

9. **Upgrade Simplified Files**
- `services/MapView.tsx` (ترقية/إزالة deprecated stub)
- `components/ChildAppView.tsx` (رفع من نسخة مبسطة إلى flow أشمل)

10. **Background Workers and Backend Backlog**
- `workers/evidencePackageWorker.ts` (new, backlog integration)
- `workers/evidencePurgeWorker.ts` (new, backlog integration)
- ملفات `app/api/*` تبقى Backlog حتى اعتماد واجهة باك-إند.

11. **QA + Hardening + Release**
- `firestore.rules`
- `firestore.indexes.json`
- `tests/*`
- Build + Regression + smoke

---

## 4) تفاصيل التعديلات ملفًا بملف (What + Why)

## A) ملفات موجودة وسيتم تعديلها

| الملف | الوظائف/المميزات المتأثرة | التعديل المطلوب | سبب التعديل |
|---|---|---|---|
| `types.ts` | نماذج الحوادث، سلسلة الحيازة، playbooks، الأوامر | إضافة/توحيد الأنواع الناقصة: `SafetyPlaybook`, `EvidenceCustody`, `CommandAudit`, `IncidentExportMeta` | منع التضارب بين ملفات مستعادة وضمان Type Safety |
| `translations.ts` | مفاتيح الواجهة الجديدة | إضافة مفاتيح ترجمة للميزات المستعادة (Step-Up, War Room, Custody, Playbooks, Ops Console) | توحيد اللغة ومنع hardcoded strings |
| `config/featureFlags.ts` | تمكين تدريجي للميزات | إضافة flags جديدة مثل: `stepUp`, `incidentWarRoom`, `playbookHub`, `parentOpsConsole`, `forensics` | تفعيل آمن تدريجي دون كسر النسخة الحالية |
| `constants.tsx` | عناصر التنقل/الأيقونات/الخرائط | توسيع تعريفات الواجهات والقوائم لتضم الشاشات المستعادة وربط أيقوناتها | إدماج الميزات في UX بشكل منظم |
| `App.tsx` | Orchestration + navigation + handlers | ربط الشاشات المستعادة عبر navigation داخلي وربط الـ feature flags، وربط handlers بالأقسام الجديدة | جعل الميزات الجديدة قابلة للوصول بدون كسر التدفق الحالي |
| `services/firestoreService.ts` | CRUD للميزات الأمنية | إضافة وظائف لجلب/حفظ playbooks، أحداث custody، سجلات audit، أوامر الأجهزة الموسعة | توحيد طبقة البيانات بدل التشتت داخل UI |
| `services/mockDataService.ts` | بيانات الاختبار | توسيع نطاق حقن/حذف البيانات الوهمية لتشمل الوحدات الجديدة (incidents, playbooks, custody, commands) | دعم QA سريع بدون انتظار بيانات حقيقية |
| `services/ruleEngineService.ts` | التنفيذ التلقائي | ربط القواعد المستعادة (Defense Rules/Policy) مع Auto Execution الحالي | دمج الذكاء التشخيصي مع الاستجابة الآلية |
| `components/PsychologicalInsightView.tsx` | `buildSuggestedPlan`, `runAutoExecutionPlan`, `saveExecutionTimelineToVault` | توسيع المخرجات لتغذية playbooks والدفاع الاستباقي + تحسين السجل الزمني والتوافق مع custody/audit | جعل النبض النفسي بوابة القرار العليا لباقي الأنظمة |
| `components/LiveMonitorView.tsx` | `startStream`, `changeVideoSource`, `changeAudioSource`, `startPushToTalk`, `toggleEmergencyLock` | ربط أقوى مع أوامر الأمن (siren/lockdown/stream source) وتوحيد تسجيل الأدلة | استعادة عمق ميزة البث المباشر والتحكم الفوري |
| `components/ModesView.tsx` | `handleSaveMode` + advanced mode fields | توسيع حقول الوضع الذكي (مصادر بث، حظر، إجراءات فورية) وربطها بالـ playbooks | توحيد تعريف الوضع بين النبض النفسي والتنفيذ |
| `components/EvidenceVaultView.tsx` | `handleExport`, `handleSave`, `handleDelete`, filters | توسيع العرض ليشمل custody metadata وincident linkage وعمليات التحقق | ترسيخ الأدلة كسجل موثوق قابل للتدقيق |
| `components/SettingsView.tsx` | `handleInjectMockData`, `handleClearMockData`, child/device editing | دعم نطاقات mock الجديدة + إعدادات flags الحساسة + ربط Step-Up للعمليات الحرجة | منع تغييرات حساسة بدون تحقق إضافي |
| `components/DevicesView.tsx` | أوامر الجهاز وحالة الربط | توسيع واجهة الأوامر وربطها بخدمات audit/rbac الجديدة | زيادة الاعتمادية التشغيلية |
| `components/IncidentsCenterView.tsx` | إدارة الحوادث | ربطه مع War Room وCustody Timeline وتصفية حسب الشدة/الحالة | تحويل قائمة الحوادث إلى مركز عمليات فعلي |
| `components/MapView.tsx` | تتبع الموقع + geo intelligence | التأكد من توافقه مع نسخة الخدمات/الخرائط الجديدة | استقرار ميزة تتبع الموقع مع استرجاع الدفاع الجغرافي |
| `firestore.rules` | صلاحيات الوصول | إضافة قواعد لوحدات جديدة: custody, playbooks, audits, exports | أمان البيانات ومنع permission regressions |
| `firestore.indexes.json` | استعلامات مركبة | إضافة الفهارس المطلوبة لاستعلامات incidents/custody/exports | منع أخطاء index في وقت التشغيل |

## B) ملفات جديدة سيتم إنشاؤها/استعادتها

| الملف الجديد | الميزة | ماذا سنفعل | سبب الإضافة |
|---|---|---|---|
| `services/forensicsService.ts` | تحقق integrity وسلسلة الحيازة | استعادة وظائف التحقق والربط مع Evidence Vault | توثيق جنائي موثوق |
| `services/rbacService.ts` | التحكم بالصلاحيات | استعادة طبقة Role/Permission checks | عزل الصلاحيات حسب الدور |
| `services/auditService.ts` | سجلات تدقيق | استعادة write/read logs للعمليات الحساسة | تتبع ومساءلة |
| `services/backupService.ts` | دعم النسخ الاحتياطي/استرجاع الحالات | استعادة وظائف النسخ للحالات الحرجة والبيانات | تحسين الاستمرارية |
| `components/IncidentWarRoom.tsx` | إدارة حادث مركزي | استعادة الشاشة وربطها بالحوادث الحالية | استجابة أسرع ودقيقة |
| `components/ChainOfCustodyView.tsx` | عرض سلسلة الحيازة | استعادة timeline integrity | توثيق الأدلة قانونيًا |
| `components/FamilyIncidentResponseView.tsx` | تنسيق استجابة الأسرة | استعادة واجهة التدخل الأسري | تحسين آلية التدخل |
| `components/ExportBundleModal.tsx` | تصدير حزمة الأدلة | استعادة modal التصدير والتحقق | مشاركة أدلة منظمة |
| `components/SystemSecurityReportView.tsx` | تقارير أمن النظام | استعادة صفحة التقرير وربطها بالمؤشرات | رؤية أمنية عليا |
| `components/VisualBenchmarkView.tsx` | قياس الأداء المرئي | استعادة القياسات والتحسينات | تشخيص جودة الرصد |
| `components/SafetyPlaybookHub.tsx` | إدارة playbooks | استعادة واجهة playbooks العامة | قرار أمني قابل للتخصيص |
| `components/SafetyProtocolStudio.tsx` | تصميم البروتوكولات | استعادة studio لتكوين التدخلات | مرونة أعلى في السياسات |
| `components/PlatformSOCView.tsx` | لوحة SOC | استعادة مراقبة التهديدات العامة | مراقبة تشغيلية شاملة |
| `components/DeveloperResolutionHub.tsx` | دعم التطوير والتحليل | استعادة شاشة التشخيص الداخلي | تسريع حل الأعطال |
| `components/stepup/StepUpModal.tsx` | تحقق إضافي | استعادة واجهة المصادقة الحساسة | أمان العمليات الحرجة |
| `components/auth/StepUpGuard.tsx` | حماية الدخول للعمليات | استعادة guard قابل لإعادة الاستخدام | تقليل مخاطر إساءة الاستخدام |
| `components/parent/DeviceCommandsDashboard.tsx` | لوحة أوامر الأجهزة | استعادة dashboard الأوامر | إدارة مركزية للأجهزة |
| `components/parent/DeviceCommandControl.tsx` | التحكم المباشر | استعادة أدوات command dispatch | تشغيل أسرع للأوامر |
| `components/parent/CommandsStatusTable.tsx` | تتبع الأوامر | استعادة عرض الحالات والتقدم | شفافية تنفيذية |
| `components/parent/IncidentsTable.tsx` | جدول الحوادث | استعادة عرض شامل للحوادث | فلترة وتحليل أفضل |
| `components/parent/IncidentDetailsTabs.tsx` | تفاصيل حادث | استعادة tabs شاملة | تقليل تبديل الشاشات |
| `components/parent/NotificationCenterView.tsx` | مركز التنبيهات | استعادة مركز الإشعارات الموسع | تحسين الاستجابة |
| `components/parent/EvidenceVaultTable.tsx` | جداول الأدلة | استعادة table تفصيلي | بحث وتصفية أدق |
| `components/parent/EvidenceList.tsx` | قائمة الأدلة | استعادة list مخصص | واجهة أسرع للمراجعة |
| `components/parent/ExportsTable.tsx` | سجلات التصدير | استعادة history للتصدير | تتبع الاستهلاك والتحقق |
| `components/parent/CreateExportButton.tsx` | إنشاء تصدير | استعادة زر وflow مستقل | تبسيط إجراء التصدير |
| `components/parent/HashVerifier.tsx` | تحقق hash | استعادة واجهة التحقق | مصداقية الدليل |
| `components/parent/CustodyTimeline.tsx` | timeline custody | استعادة عرض زمني متكامل | متابعة السلسلة بسهولة |
| `components/parent/GeoFenceManager.tsx` | إدارة السياج الجغرافي | استعادة إعدادات geofence | حماية مكانية أعمق |
| `components/parent/DefenseRulesView.tsx` | قواعد الدفاع | استعادة إدارة rule sets | أتمتة أدق للردود |
| `components/parent/DefensePolicyView.tsx` | سياسات الدفاع | استعادة policy control | توحيد تنفيذ الإجراءات |
| `components/parent/ParentSidebar.tsx` | تنقل parent console | استعادة الشريط الجانبي | تجربة تشغيلية متماسكة |
| `components/parent/EvidenceVaultView.tsx` | عرض أدلة مخصص للوالد | استعادة نسخة موجهة للعمليات | سير عمل أسرع |
| `components/parent/SafetyPlaybookHub.tsx` | playbooks للوالد | استعادة تخصيص playbooks لكل عائلة | مواءمة الاستجابة حسب الحالة |
| `components/CommandCenter.tsx` | مركز قيادة عام | استعادة واجهة قيادة موحدة | نقطة تحكم واحدة |

## C) ملفات مبسطة تحتاج ترقية

| الملف | الوضع الحالي | الترقية المطلوبة | السبب |
|---|---|---|---|
| `services/MapView.tsx` | Deprecated stub يرجع `null` | إما إزالة تامة مع تنظيف الاستدعاءات أو استعادة التنفيذ الكامل من النسخ المرجعية | تجنب ملف ميت وإرجاع ميزة الخرائط المساندة |
| `components/ChildAppView.tsx` | نسخة مختصرة | استعادة flow أشمل: pairing token + onboarding + optional calculator shell mode + unlock flow | استرجاع عمق مسار تطبيق الطفل |

---

## 5) الوظائف (Functions) التي سيتم تعديلها مباشرة

1. `App.tsx`
- `handleApplyMode`
- `handleSaveExecutionEvidence`
- `handleUpdateDeviceControls`
- `handleToggleDeviceLock`
- السبب: ربط المحرك الحالي مع الوحدات المستعادة.

2. `components/PsychologicalInsightView.tsx`
- `buildSuggestedPlan`
- `runAutoExecutionPlan`
- `saveExecutionTimelineToVault`
- السبب: جعل خطة النبض النفسي تنتج إجراءات متوافقة مع playbooks/custody/audit.

3. `components/LiveMonitorView.tsx`
- `startStream`
- `changeVideoSource`
- `changeAudioSource`
- `startPushToTalk`
- `stopPushToTalk`
- `toggleEmergencyLock`
- السبب: استعادة التحكم العميق المباشر من جهاز الطفل.

4. `components/ModesView.tsx`
- `handleSaveMode`
- السبب: توحيد نموذج الأوضاع مع الحقول المتقدمة المستعادة.

5. `components/SettingsView.tsx`
- `handleInjectMockData`
- `handleClearMockData`
- `handleSaveDeviceLink`
- السبب: دعم اختبار وحدات جديدة وربط الأجهزة/العمليات الحساسة.

6. `components/EvidenceVaultView.tsx`
- `handleExport`
- `handleSave`
- `handleDelete`
- `clearAllFilters`
- السبب: رفع الخزنة من عرض بسيط إلى منظومة تتبع/تصدير/تحقق.

---

## 6) ترتيب التعديل التفصيلي على مستوى الكوميتات

1. **Commit 1: Contracts + Flags**
- تعديل: `types.ts`, `translations.ts`, `config/featureFlags.ts`, `constants.tsx`
- السبب: تجهيز الأرضية قبل استعادة أي شاشة.

2. **Commit 2: Data Services Baseline**
- تعديل: `services/firestoreService.ts`, `services/mockDataService.ts`, `services/ruleEngineService.ts`
- إضافة: `services/forensicsService.ts`, `services/rbacService.ts`, `services/auditService.ts`, `services/backupService.ts`
- السبب: أي UI مستعاد يحتاج data contracts وخدمات جاهزة.

3. **Commit 3: App Integration Skeleton**
- تعديل: `App.tsx`
- إضافة placeholders للشاشات المستعادة خلف feature flags
- السبب: ربط متحكم مركزي قبل ضخ واجهات كثيرة.

4. **Commit 4: Incident/Forensics UI Wave**
- إضافة: `components/IncidentWarRoom.tsx`, `components/ChainOfCustodyView.tsx`, `components/FamilyIncidentResponseView.tsx`, `components/ExportBundleModal.tsx`, `components/SystemSecurityReportView.tsx`, `components/VisualBenchmarkView.tsx`
- السبب: استرجاع أعمق جزء عملي في إدارة الحوادث والأدلة.

5. **Commit 5: Defense/Playbook UI Wave**
- إضافة: `components/SafetyPlaybookHub.tsx`, `components/SafetyProtocolStudio.tsx`, `components/PlatformSOCView.tsx`, `components/parent/DefenseRulesView.tsx`, `components/parent/DefensePolicyView.tsx`, `components/parent/GeoFenceManager.tsx`
- السبب: إكمال طبقة القرار الوقائي التلقائي.

6. **Commit 6: Parent Ops Console Wave**
- إضافة: بقية ملفات `components/parent/*` المذكورة في القسم 4
- السبب: تقديم كونسول تشغيلي متكامل بدل شاشات متفرقة.

7. **Commit 7: Step-Up Security Wave**
- إضافة: `components/stepup/StepUpModal.tsx`, `components/auth/StepUpGuard.tsx`
- تعديل: `App.tsx`, `components/SettingsView.tsx`, `components/EvidenceVaultView.tsx`
- السبب: حماية العمليات الحساسة قبل التفعيل العام.

8. **Commit 8: Upgrade Simplified Files**
- تعديل: `services/MapView.tsx`, `components/ChildAppView.tsx`
- السبب: إزالة/ترقية نقاط الضعف الوظيفي.

9. **Commit 9: Hardening + Rules + Indexes**
- تعديل: `firestore.rules`, `firestore.indexes.json`
- السبب: منع أخطاء الصلاحيات والاستعلامات بعد الاستعادة.

10. **Commit 10: QA + Regression**
- تعديل/إضافة: `tests/*`
- تشغيل: `npm run build`, `npm run test:run`
- السبب: إغلاق المخاطر قبل الانتقال للمرحلة التالية.

---

## 7) الأولوية العملية الآن (الـ Next 3 تنفيذًا)
1. تنفيذ Commit 1.
2. تنفيذ Commit 2.
3. تنفيذ Commit 3.

بعد هذه الثلاثة سنكون جاهزين لبدء استعادة الواجهات الثقيلة بدون إعادة عمل.

---

## 8) تدقيق السيناريوهات الرئيسية قبل التحويل إلى Backlog

| السيناريو المطلوب | الحالة الحالية | الفجوة | ملفات المرجع |
|---|---|---|---|
| التنمر الإلكتروني | موجود كتَبويب مستقل (`bullying`) مع إرشاد وتنفيذ أولي | يحتاج تفريع مسارات تنفيذ أدق حسب شدة الحالة | `components/PsychologicalInsightView.tsx`, `components/AdvisorView.tsx`, `services/psychDiagnosticService.ts` |
| التهديد والابتزاز | موجود كتَبويب مستقل (`threat_exposure`) ويستوعب الابتزاز | يحتاج فصل `التهديد المباشر` عن `الابتزاز المالي/الجنسي` كمسارات فرعية واضحة | `components/PsychologicalInsightView.tsx`, `services/psychDiagnosticService.ts`, `types.ts` |
| إدمان الألعاب | موجود كتَبويب مستقل (`gaming`) | يحتاج نموذج خطة سلوكية زمنية (Baseline + Follow-up) وربطه بالتنبيهات | `components/PsychologicalInsightView.tsx`, `components/ModesView.tsx`, `services/ruleEngineService.ts` |
| المحتوى غير المناسب | موجود كتَبويب مستقل (`inappropriate_content`) | يحتاج فصل الحالات (`إباحي` / `عنيف`) وخطة تدخل مختلفة لكل نوع | `components/PsychologicalInsightView.tsx`, `services/psychDiagnosticService.ts` |
| الانحراف السيبراني | موجود كتَبويب مستقل (`cyber_crime`) | يحتاج تحويله إلى سُلّم مخاطر تدريجي (استكشاف -> أدوات -> تنفيذ) | `components/PsychologicalInsightView.tsx`, `services/ruleEngineService.ts`, `components/SafetyPlaybookHub.tsx` |

### سيناريوهات/فئات رئيسية إضافية موجودة جزئياً وليست Tabs مستقلة
1. `SELF_HARM` (إيذاء النفس) - مدمج حالياً تحت `threat_exposure`.
2. `PREDATOR` (تواصل مشبوه/استدراج) - مدمج حالياً بين `threat_exposure` و`inappropriate_content`.
3. `BLACKMAIL` (ابتزاز) - مدمج تحت `threat_exposure`.
4. `SEXUAL_EXPLOITATION` (استغلال جنسي) - مدمج بين `threat_exposure` و`inappropriate_content`.
5. `PHISHING_LINK` (تصيد وروابط خبيثة) - مدمج بين `crypto_scams` و`cyber_crime`.
6. `VIOLENCE` (تحريض/محتوى عنيف) - مدمج بين `threat_exposure` و`cyber_crime`.
7. `TAMPER` (تلاعب بالنظام) - معرف في `types.ts` لكنه غير ممثل كسيناريو تشغيلي واضح في واجهة النبض.

---

## 9) Backlog تنفيذي مرتب بالأولوية (P0/P1/P2) - مع استبعاد مكتبة الأفاتار

### قيد معماري إلزامي
1. ممنوع إضافة/حذف/تعديل أي جزء مرتبط بمكتبة الأفاتار الحالية.
2. يشمل المنع ملفات مثل: `components/AvatarPickerModal.tsx`, `services/storageService.ts`, وأي حقول `avatar` أو مصادر صور مرتبطة بها.

### P0 (حرج - يبدأ فوراً)
| الأولوية | العنصر التنفيذي | التعديل المطلوب | ملفات التنفيذ المقترحة |
|---|---|---|---|
| P0 | تفريع سيناريو التهديد والابتزاز | **Done (2026-02-15 / phase6-part71):** تم فصل المسارات الفرعية داخل `threat_exposure` إلى: `direct_threat` / `financial_blackmail` / `sexual_blackmail` وربطها بخطط تنفيذ مستقلة | `components/PsychologicalInsightView.tsx`, `services/psychDiagnosticService.ts`, `services/ruleEngineService.ts` |
| P0 | تحويل التصيد والروابط الخبيثة إلى سيناريو تشغيلي واضح | **Done (2026-02-15 / phase6-part72):** تمت إضافة Scenario/Tab مستقلة لـ `phishing_links` وربطها بـ `PHISHING_LINK` في التشخيص والتنفيذ | `components/PsychologicalInsightView.tsx`, `components/AdvisorView.tsx`, `services/psychDiagnosticService.ts`, `types.ts`, `services/mockDataService.ts` |
| P0 | تفصيل المحتوى غير المناسب حسب النوع | **Done (2026-02-15 / phase6-part75):** تم فصل المسار إلى `sexual_content` و`violent_content` مع سياسات تدخل وتنفيذ تلقائي مختلفة | `components/PsychologicalInsightView.tsx`, `services/psychDiagnosticService.ts`, `services/ruleEngineService.ts`, `tests/services/psychDiagnosticService.test.ts` |
| P0 | ربط السيناريوهات مع Playbook تلقائي قابل للتدقيق | كل سيناريو يولد Steps تنفيذية موثقة داخل الأدلة وسجل التدقيق | `components/PsychologicalInsightView.tsx`, `components/SafetyPlaybookHub.tsx`, `components/EvidenceVaultView.tsx`, `services/auditService.ts`, `services/forensicsService.ts` |
| P0 | معالجة الثغرات التشغيلية لسيناريو الانحراف السيبراني | **Done (2026-02-15 / phase6-part77):** تطبيق سُلّم خطر ديناميكي (`Observation`/`Warning`/`Containment`) وربطه تلقائياً بالتصنيف التنفيذي (`SAFE`/`PREDATOR`/`TAMPER`) | `components/PsychologicalInsightView.tsx`, `services/ruleEngineService.ts`, `tests/services/ruleEngineService.test.ts` |

### P1 (مهم - بعد تثبيت P0)
| الأولوية | العنصر التنفيذي | التعديل المطلوب | ملفات التنفيذ المقترحة |
|---|---|---|---|
| P1 | تحويل `SELF_HARM` إلى مسار تدخل مستقل | إتاحة خطة تدخل تربوي/وقائي منفصلة بدل الدمج داخل `threat_exposure` | `types.ts`, `services/psychDiagnosticService.ts`, `components/PsychologicalInsightView.tsx`, `translations.ts` |
| P1 | تحويل `PREDATOR/SEXUAL_EXPLOITATION` إلى مسار حماية مستقل | خطة حماية فورية + توجيه الأدلة + رفع مستوى الاستجابة | `services/psychDiagnosticService.ts`, `components/PsychologicalInsightView.tsx`, `components/IncidentsCenterView.tsx`, `components/FamilyIncidentResponseView.tsx` |
| P1 | تطوير سيناريو إدمان الألعاب بخطة زمنية علاجية | برنامج تدريجي (أسبوعي) مع قياس التقدم والانتكاس | `components/PsychologicalInsightView.tsx`, `components/ModesView.tsx`, `components/AlertsView.tsx`, `services/ruleEngineService.ts` |
| P1 | توسيع "مدرب الحوار التربوي" ليصبح مشهد سيناريو كامل | لكل سيناريو: أعراض + نصح فوري + عبارات حوار مقترحة + تنبيه ما بعد الحوار | `components/AdvisorView.tsx`, `translations.ts`, `components/PsychologicalInsightView.tsx` |
| P1 | توحيد خرائط السيناريو بين التحليل والواجهة | منع أي اختلاف بين IDs في التشخيص وIDs في UI | `services/psychDiagnosticService.ts`, `components/PsychologicalInsightView.tsx`, `components/AdvisorView.tsx`, `types.ts` |

### P2 (تحسينات توسعية)
| الأولوية | العنصر التنفيذي | التعديل المطلوب | ملفات التنفيذ المقترحة |
|---|---|---|---|
| P2 | إضافة سيناريو "عزلة/انسحاب اجتماعي رقمي" | مسار مستقل لقياس الانسحاب الاجتماعي وتأثيره على الاستقرار النفسي | `services/psychDiagnosticService.ts`, `components/PsychologicalInsightView.tsx`, `translations.ts`, `types.ts` |
| P2 | إضافة سيناريو "تلاعب بالنظام TAMPER" | تحويل `TAMPER` من تعريف نوع فقط إلى سيناريو تشغيل فعلي | `types.ts`, `services/psychDiagnosticService.ts`, `components/PsychologicalInsightView.tsx`, `components/DevicesView.tsx` |
| P2 | مؤشرات مقارنة قبل/بعد لكل سيناريو | بطاقات KPI لقياس فعالية التدخل (قبل التنفيذ وبعده) | `components/PsychologicalInsightView.tsx`, `components/SystemSecurityReportView.tsx`, `components/VisualBenchmarkView.tsx` |
| P2 | تقارير تصدير خاصة بكل سيناريو | تصدير حزمة أدلة + Timeline خاص بالسيناريو المحدد | `components/ExportBundleModal.tsx`, `components/EvidenceVaultView.tsx`, `services/forensicsService.ts` |



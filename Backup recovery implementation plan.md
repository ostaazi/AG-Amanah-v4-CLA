# Backup Recovery Implementation Plan

## 1) الهدف
هذه الخطة مكملة لـ `Expanded implementation plan.md` وتركز فقط على:
1. الملفات غير الموجودة في النسخة الحالية.
2. الملفات الموجودة لكن بصورة مبسطة أو أقل من النسخ الاحتياطية.
3. إعادة دمج القدرات المتقدمة بشكل آمن ومرحلي دون كسر المسار الحالي.

---

## 2) النسخ المرجعية المعتمدة
النسخة الأكثر ثراءً وظيفيًا للاستعادة:
1. `tmp_backup_scan_third_batch_v2/copy5-of-amanah_-parental-control-ai`
2. `tmp_backup_scan_fourth_batch/copy5-of-amanah_-parental-control-ai`

نسخ دعم/تثبيت إضافية:
1. `tmp_backup_scan_fourth_batch/working-copy4-of-amanah-parental-control-ai_(2)`
2. `tmp_backup_scan_fourth_batch/copy4-of-amanah_-parental-control-ai_(1)`
3. `tmp_backup_scan_second_batch/amanah_-parental-control-ai_(9)`

---

## 3) مصفوفة الفجوات في النسخة الحالية

## A) ملفات مفقودة بالكامل (غير موجودة حاليًا)

### A.1 Components مفقودة (31)
1. `components/CommandCenter.tsx`
2. `components/IncidentWarRoom.tsx`
3. `components/FamilyIncidentResponseView.tsx`
4. `components/ChainOfCustodyView.tsx`
5. `components/ExportBundleModal.tsx`
6. `components/SafetyPlaybookHub.tsx`
7. `components/SafetyProtocolStudio.tsx`
8. `components/PlatformSOCView.tsx`
9. `components/SystemSecurityReportView.tsx`
10. `components/VisualBenchmarkView.tsx`
11. `components/DeveloperResolutionHub.tsx`
12. `components/auth/StepUpGuard.tsx`
13. `components/stepup/StepUpModal.tsx`
14. `components/parent/DeviceCommandsDashboard.tsx`
15. `components/parent/DeviceCommandControl.tsx`
16. `components/parent/DefenseRulesView.tsx`
17. `components/parent/DefensePolicyView.tsx`
18. `components/parent/GeoFenceManager.tsx`
19. `components/parent/CustodyTimeline.tsx`
20. `components/parent/IncidentsTable.tsx`
21. `components/parent/IncidentDetailsTabs.tsx`
22. `components/parent/NotificationCenterView.tsx`
23. `components/parent/EvidenceVaultTable.tsx`
24. `components/parent/EvidenceList.tsx`
25. `components/parent/ExportsTable.tsx`
26. `components/parent/CreateExportButton.tsx`
27. `components/parent/CommandsStatusTable.tsx`
28. `components/parent/HashVerifier.tsx`
29. `components/parent/SafetyPlaybookHub.tsx`
30. `components/parent/ParentSidebar.tsx`
31. `components/parent/EvidenceVaultView.tsx`

### A.2 Services مفقودة (4)
1. `services/forensicsService.ts`
2. `services/rbacService.ts`
3. `services/auditService.ts`
4. `services/backupService.ts`

### A.3 Workers مفقودة (2)
1. `workers/evidencePackageWorker.ts`
2. `workers/evidencePurgeWorker.ts`

### A.4 Backend/App Routes مفقودة (55+)
أهم الحزم المفقودة:
1. `app/api/agent/*` (heartbeat, poll, report-incident)
2. `app/api/auth/step-up/*`
3. `app/api/devices/[id]/lockdown` و `commands/ack`
4. `app/api/families/[familyId]/devices/[deviceId]/modes/apply`
5. `app/api/families/[familyId]/incidents/[incidentId]/custody`
6. `app/api/families/[familyId]/incidents/[incidentId]/export`
7. `app/api/families/[familyId]/notifications/*`
8. `app/api/evidence/*` و `app/api/exports/*`
9. صفحات Parent في `app/(parent)/families/[familyId]/*`

---

## B) ملفات موجودة لكنها مبسطة/أقل من النسخ القديمة
1. `services/MapView.tsx`:
الملف الحالي مجرد Deprecated Stub.
النسخ المرجعية تحتوي تنفيذ فعلي (قائمة أطفال + خريطة + تحليل أمان + روابط مناطق آمنة).

2. `components/ChildAppView.tsx`:
النسخة الحالية مبسطة (حوالي 65 سطر).
النسخ القديمة كانت أعمق (حوالي 130 سطر) وتشمل:
- onboarding وربط token
- مراحل تهيئة
- وضع calculator shell
- منطق unlock/lock local

---

## 4) استراتيجية الدمج (Implementation Strategy)
مبدأ التنفيذ: استعادة "وظيفية تدريجية" بدل نسخ شامل أعمى.

## Wave 1 - Foundations (Core Recovery Scaffold)
1. إنشاء مجلدات ناقصة في النسخة الحالية:
- `components/parent`
- `components/auth`
- `components/stepup`
- `workers`
- `services` (استكمال الملفات المفقودة)
2. إضافة Feature Flags لكل ميزة مستعادة قبل تفعيلها.
3. تعريف عقود Types الناقصة في `types.ts`:
- custody models
- playbooks models
- command/audit models

**Exit**
1. البنية الجديدة موجودة دون كسر build.
2. الميزات الجديدة معطلة افتراضيًا عبر flags.

---

## Wave 2 - Incident + Forensics UI Recovery
استعادة واجهات التحكم المتقدمة أولًا:
1. `IncidentWarRoom.tsx`
2. `ChainOfCustodyView.tsx`
3. `FamilyIncidentResponseView.tsx`
4. `ExportBundleModal.tsx`
5. `SystemSecurityReportView.tsx`
6. `VisualBenchmarkView.tsx`

**Integration**
1. ربطها بـ `App.tsx` عبر views/routes داخلية.
2. تغذية أولية من mock data قبل ربط backend الكامل.

**Exit**
1. الواجهات تشتغل end-to-end على بيانات تجريبية.
2. لا أخطاء runtime.

---

## Wave 3 - Policy/Playbook/Defense Recovery
1. استعادة:
- `SafetyPlaybookHub.tsx`
- `SafetyProtocolStudio.tsx`
- `parent/DefenseRulesView.tsx`
- `parent/DefensePolicyView.tsx`
- `parent/GeoFenceManager.tsx`
2. استكمال محرك القواعد عبر:
- `services/ruleEngineService.ts` (موجود)
- `services/rbacService.ts` (يستعاد)
- `services/auditService.ts` (يستعاد)

**Exit**
1. يمكن إنشاء/تعديل playbooks.
2. يمكن ربط playbook بخطوات تنفيذ تلقائي في النبض النفسي.

---

## Wave 4 - Step-Up + Sensitive Actions
1. استعادة:
- `components/stepup/StepUpModal.tsx`
- `components/auth/StepUpGuard.tsx`
2. استعادة API:
- `app/api/auth/step-up/verify/route.ts`
- `app/api/devices/[id]/lockdown/route.ts`
3. فرض Step-Up قبل:
- قفل الجهاز الكامل
- حذف الأدلة/التصدير
- تنفيذ أوامر حرجة

**Exit**
1. أي إجراء حرج يطلب تحقق إضافي.
2. تسجيل تدقيق audit لكل عملية حساسة.

---

## Wave 5 - Evidence Backend Recovery
1. استعادة مسارات:
- `app/api/evidence/*`
- `app/api/families/[familyId]/incidents/*`
- `app/api/exports/*`
2. استعادة:
- `workers/evidencePackageWorker.ts`
- `workers/evidencePurgeWorker.ts`
3. استكمال:
- hash manifest
- custody chain export
- package zip

**Exit**
1. تصدير evidence package يعمل.
2. سلسلة الحيازة قابلة للتحقق.

---

## Wave 6 - Parent Ops Console (Advanced)
1. استعادة عناصر parent console:
- `DeviceCommandsDashboard`
- `DeviceCommandControl`
- `CommandsStatusTable`
- `IncidentsTable`
- `IncidentDetailsTabs`
- `NotificationCenterView`
- `EvidenceVaultTable`
- `EvidenceList`
- `ExportsTable`
- `HashVerifier`
- `ParentSidebar`
2. ربطها بالقسم الحالي تدريجيًا دون كسر التنقل الأساسي.

**Exit**
1. لوحة عمليات متقدمة تعمل ببيانات حقيقية/تجريبية.
2. فلترة ومتابعة الحوادث والأوامر متاحة من شاشة واحدة.

---

## Wave 7 - رفع الملفات المبسطة
1. استبدال `services/MapView.tsx`:
- إما إزالة نهائية مع تنظيف الاستدعاءات.
- أو استعادة التنفيذ الكامل من النسخ المرجعية.
2. ترقية `components/ChildAppView.tsx`:
- إعادة مسار pairing + onboarding
- إعادة وضع calculator shell كـ optional mode تحت Feature Flag

**Exit**
1. لا stubs غير مبررة في المسارات الحرجة.
2. child app flow أشمل مع الحفاظ على أمان التفعيل.

---

## 5) ترتيب التنفيذ الإلزامي
1. Wave 1
2. Wave 2
3. Wave 3
4. Wave 4
5. Wave 5
6. Wave 6
7. Wave 7

---

## 6) قواعد الدمج من النسخ الاحتياطية
1. لا نسخ مباشر لملف كامل قبل مقارنة API contracts مع النسخة الحالية.
2. كل ملف مستعاد يمر عبر:
- Encoding check (UTF-8)
- Type check
- Security check
- RTL/UI consistency check
3. أي ميزة جديدة لا تظهر للمستخدم النهائي إلا بعد:
- feature flag
- smoke test
- logging + evidence trace (للأوامر الحساسة)

---

## 7) Definition of Done لهذه الخطة
1. جميع الملفات المفقودة الحرجة تمت استعادتها ودمجها.
2. الملفات المبسطة تمت ترقيتها أو إزالتها مع بديل واضح.
3. مسار الأوامر الحساسة محمي بـ Step-Up + Audit.
4. مسارات الأدلة والتصدير وسلسلة الحيازة تعمل بنجاح.
5. لا regressions في:
- Pulse
- Modes
- Live Monitor
- Evidence Vault

---

## 8) الخطوة التالية المباشرة
تنفيذ `Wave 1` فورًا:
1. إنشاء الهيكل الناقص للملفات.
2. استعادة `services/forensicsService.ts`, `services/rbacService.ts`, `services/auditService.ts`, `services/backupService.ts`.
3. إضافة flags في `config/featureFlags.ts` لعزل الميزات المستعادة قبل تفعيلها.

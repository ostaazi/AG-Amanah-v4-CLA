# Amanah Execution Plan (P0/P1/P2) with Current Status

> Source baseline: `docs/project-ideas-from-ai-studio-conversation.md`  
> Status labels: `مكتمل` = implemented in current codebase, `جزئي` = implemented but needs hardening/validation, `غير مبدوء` = not implemented yet.
> Execution checklist for current sprint: `docs/p0-sprint-checklist.md`

## Zero Standards (Release Blockers)

- `Zero Latency`: detection path must stay local/offline and within performance budget.
- `Zero False Positive` (Operational): no critical auto-action on safe benchmark corpus.
- `Zero False Negative` (Operational): no misses on critical red-team corpus.
- Any regression in the above blocks release regardless of feature completion.

## P0 (Critical Now)

1. **منع self-positive الذي يسبب قفل الجهاز عند رؤية واجهات Amanah**
- الحالة: `جزئي`
- لماذا: يوجد منطق ignore للمحتوى الذاتي، لكن السلوك ما زال يحتاج ضبط ميداني.
- دلائل: `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt:562`, `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt:563`
- المطلوب لإغلاق البند: توسيع whitelist + اختبار regression على لقطات Amanah/SystemUI + سجلات detector دقيقة.

2. **رفع دقة الرصد Offline للصور (عنف/إصابات/NSFW)**
- الحالة: `جزئي`
- لماذا: يوجد محرك محلي (legacy visual sentinel + injury heuristic) لكن لا يزال يحتاج calibration أقوى.
- دلائل: `services/visualSentinel.ts:132`, `android-child/app/src/main/java/com/amanah/child/utils/SecurityCortex.kt:1527`, `android-child/app/src/main/java/com/amanah/child/utils/SecurityCortex.kt:1939`
- المطلوب لإغلاق البند: إعادة ضبط العتبات + اختبار dataset محلي + منع التفسير الثابت.

3. **ضمان إرسال evidence كامل لكل trigger (screenshot + raw + normalized + bilingual reason)**
- الحالة: `جزئي`
- لماذا: الإرسال موجود لكن هناك حالات تسقط فيها الحزمة.
- دلائل: `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt:474`, `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt:507`, `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt:510`
- المطلوب لإغلاق البند: retry queue للأدلة + telemetry لفشل upload + ACK end-to-end.

4. **استقرار Firestore Production (indexes/rules/permission-denied)**
- الحالة: `جزئي`
- لماذا: قواعد وفهارس موجودة لكن ظهرت أخطاء تشغيلية متكررة في السجل.
- دلائل: `firestore.rules:2`, `firestore.indexes.json:2`, `services/firestoreService.ts:791`
- المطلوب لإغلاق البند: مراجعة نهائية لقواعد الإنتاج + نشر indexes المطلوبة + smoke tests صلاحيات.

5. **معالجة مشاكل الترميز (mojibake) في الواجهات والرسائل**
- الحالة: `جزئي`
- لماذا: ما زالت هناك نصوص مشوهة في بعض الملفات.
- دلائل: `services/visualSentinel.ts:54`, `services/firestoreService.ts:172`
- المطلوب لإغلاق البند: توحيد UTF-8 بدون BOM + تدقيق نصوص عربية في parent/child.

6. **موثوقية أوامر الوالد الفورية (lock/screenshot/siren)**
- الحالة: `جزئي`
- لماذا: البنية موجودة لكن ظهرت حالات عدم تنفيذ في الواقع.
- دلائل: `services/ruleEngineService.ts:89`, `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt:447`, `components/EvidenceVaultView.tsx:357`
- المطلوب لإغلاق البند: command ACK status + timeout policy + إعادة المحاولة عند offline/online transitions.

## P1 (High Priority)

1. **مختبر عتبات النموذج البصري + زر الرجوع للقيم الأصلية**
- الحالة: `مكتمل`
- دلائل: `components/VisualThresholdsLabCard.tsx:67`, `components/VisualThresholdsLabCard.tsx:296`, `services/modelThresholdDefaults.ts:60`

2. **مختبر عتبات محرك النص rule-engine + default reset**
- الحالة: `مكتمل`
- دلائل: `components/TextRuleThresholdsLabCard.tsx:59`, `components/TextRuleThresholdsLabCard.tsx:274`, `services/modelThresholdDefaults.ts:74`

3. **تشغيل DNS-level filtering والتحكم من الوالد**
- الحالة: `مكتمل`
- دلائل: `android-child/app/src/main/java/com/amanah/child/services/DnsFilterVpnService.kt:24`, `components/parent/DeviceCommandControl.tsx:321`, `services/validationService.ts:157`

4. **Offline emergency unlock (provision + TOTP/backup)**
- الحالة: `مكتمل`
- دلائل: `services/offlineUnlockService.ts:129`, `components/parent/DeviceCommandControl.tsx:239`, `android-child/app/src/main/java/com/amanah/child/utils/OfflineUnlockManager.kt:101`

5. **منع القفل عند تفعيل policy bypass (per-child/global)**
- الحالة: `مكتمل`
- دلائل: `services/firestoreService.ts:927`, `services/firestoreService.ts:931`, `services/lockCommandPolicy.ts:25`

6. **حالة البطارية الحقيقية + الموقع الجغرافي + صحة الجهاز**
- الحالة: `مكتمل`
- دلائل: `android-child/app/src/main/java/com/amanah/child/services/DeviceHealthReporterService.kt:174`, `android-child/app/src/main/java/com/amanah/child/services/DeviceHealthReporterService.kt:250`, `services/systemHealthService.ts:293`

7. **حجب التطبيقات (full + partial scopes)**
- الحالة: `مكتمل`
- دلائل: `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt:395`, `android-child/app/src/main/java/com/amanah/child/services/AmanahAccessibilityService.kt:117`, `services/validationService.ts:109`

8. **فحص الثغرات على الوالد/الطفل + History + Undo**
- الحالة: `مكتمل`
- دلائل: `components/parent/VulnerabilityCenterView.tsx:121`, `components/parent/VulnerabilityCenterView.tsx:146`, `android-child/app/src/main/java/com/amanah/child/services/VulnerabilityScannerService.kt:26`

9. **لوحات الأدلة الجنائية (custody/hash/export)**
- الحالة: `جزئي`
- لماذا: hash/custody/export موجود، لكن Enterprise signing/queue/legal hold غير مكتمل.
- دلائل: `services/forensicsService.ts:14`, `components/parent/ParentOpsConsoleView.tsx:297`, `workers/evidencePackageWorker.ts:1`

10. **منظومة Developer Controls + mock data inject/cleanup**
- الحالة: `مكتمل`
- دلائل: `components/DeveloperResolutionHub.tsx:87`, `components/SettingsView.tsx:2367`, `services/mockDataService.ts:414`

11. **اسم تطبيق الطفل باللغة الإنجليزية**
- الحالة: `مكتمل`
- دلائل: `android-child/app/src/main/res/values/strings.xml:2`

12. **Pairing security flow (key/requests/approval)**
- الحالة: `جزئي`
- لماذا: flow موجود على Firestore، لكن نموذج backend session/otp signed QR المؤسسي غير مكتمل.
- دلائل: `services/firestoreService.ts:82`, `services/firestoreService.ts:983`, `firestore.rules:41`

## P2 (Next Phase / Strategic)

1. **Enterprise Evidence Pipeline (BullMQ/Redis + signed manifest Ed25519 + Legal Hold + S3/R2 + SIEM)**
- الحالة: `غير مبدوء` (كحل مؤسسي كامل)
- ملاحظة: يوجد worker manifest hash أساسي لكنه ليس pipeline المؤسسي المطلوب.
- دلائل: `workers/evidencePackageWorker.ts:1`

2. **عزل أجزاء داخل التطبيقات/الألعاب (messaging private rooms/groups/comments) بخوارزميات أدق**
- الحالة: `جزئي`
- ملاحظة: توجد scoped block (`messaging/private_chat/rooms/groups/comments`) على مستوى command validation، لكن العزل السلوكي المتقدم داخل التطبيقات لم يكتمل.
- دلائل: `services/validationService.ts:133`, `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt:400`

3. **تحسين مستمر للنماذج (MLOps-lite: dataset, regression benchmarks, threshold presets)**
- الحالة: `جزئي`
- دلائل: `docs/visual_model_continuous_improvement_plan.md:1`, `components/VisualBenchmarkView.tsx:12`

4. **مراقبة أمن سيبراني مستمرة (0-day/CVE feed live + actionable playbooks)**
- الحالة: `جزئي`
- ملاحظة: يوجد مركز vulnerabilities وقواعد risk، لكن feed عالمي آلي كامل غير ظاهر.
- دلائل: `services/vulnerabilityIntelService.ts:74`, `components/parent/VulnerabilityCenterView.tsx:161`

5. **Download verification page للمخرجات الجنائية**
- الحالة: `غير مبدوء`

## Acceptance Gates Before Next APK Build

1. إغلاق كل بنود `P0` باختبارات موثقة على جهازين حقيقيين (طفل + والد).
2. Smoke tests إلزامية: pairing, lock/unlock online+offline, screenshot, siren, DNS mode changes.
3. Test matrix للرصد: self-screen, NSFW, injury, obfuscated text, benign false-positive set.
4. Firestore production check: rules + indexes + permission traces + auth fallback.

## Suggested Immediate Sprint (Order)

1. P0-1 + P0-2 + P0-3 (دقة الرصد + self-positive + evidence reliability).
2. P0-4 + P0-5 (Firestore production hardening + encoding fixes).
3. P0-6 (command reliability + ACK state flow).
4. بعد الإغلاق: build APKs للتجربة الشاملة.

6. **Remove temporary Gemini location diagnostics banner from Devices screen**
- Status: `not_started`
- Note: This is intentionally temporary while Gemini API key rollout is being stabilized across environments.
- Evidence: `components/DevicesView.tsx:319`, `services/geminiService.ts:196`
# Expanded Implementation Plan

## 1) Vision
بناء منصة رقابة أبوية ذكية (Amanah) تجمع بين:
- التحكم التشغيلي المباشر بالأجهزة.
- التحليل النفسي السلوكي.
- الاستجابة التلقائية للحوادث.
- التوثيق الجنائي داخل خزنة الأدلة.

---

## 2) Current Stage Snapshot
- المرحلة 1: مكتملة (مع مراجعات شكلية بسيطة فقط).
- المرحلة 2: شبه مكتملة (يتبقى تنظيف نصوص/ترميز في بعض الملفات).
- المرحلة 3: شبه مكتملة جدًا (المسار الوظيفي الأساسي يعمل، يتبقى إغلاق نهائي + QA).
- المرحلة 4+: لم تبدأ كتنفيذ كامل بعد.

---

## 3) Full Roadmap (Start to End)

## Phase 0 - Baseline and Stabilization
**Goal:** تثبيت نسخة عمل مستقرة قبل التوسع.

**Tasks**
1. مراجعة الملفات المركزية: `App.tsx`, `components/PsychologicalInsightView.tsx`, `components/EvidenceVaultView.tsx`, `components/ModesView.tsx`.
2. إزالة أي نصوص مشوهة (Encoding cleanup) وتوحيد UTF-8.
3. حصر الأعطال المتبقية في Console.
4. تثبيت قائمة Known Issues الحالية.

**Exit Criteria**
1. `npm run build` ناجح.
2. لا نصوص عربية مشوهة في الشاشات الأساسية.
3. لا أخطاء runtime حرجة.

---

## Phase 1 - Core Controls and RTL Foundation
**Status:** Completed

**Scope**
1. تحويل واجهات البطاقات الرئيسية إلى RTL متسق.
2. إعادة ترتيب صفوف الميزات: أيقونة يمين، اسم في الوسط، Toggle يسار.
3. تحسين قابلية قراءة النص (أحجام الخطوط والتباعد).
4. تحسين كروت إدارة الطفل/الأجهزة/الأدوار.

**Validation**
1. اتساق RTL في الهاتف والمتصفح.
2. لا تداخل عناصر/نصوص في الكروت.

---

## Phase 2 - Psychological Pulse Upgrade
**Status:** Mostly Completed

**Scope**
1. جعل بطاقة النبض النفسي أول عنصر أعلى الصفحة مع تركيز تلقائي عند الفتح.
2. إصلاح مخطط Radar (أبعاد، تموضع labels، دعم العربية/RTL).
3. توسيع سيناريوهات التحليل (تنمر/تهديد/إدمان/احتيال...).
4. إضافة "نصيحة المستشار" وخطة تدخل أسبوعية وخطة 10 دقائق.
5. تجهيز مسار انتقال من التشخيص إلى خطة تنفيذ.

**Remaining**
1. تنظيف نصوص عربية مشوهة متبقية داخل `components/PsychologicalInsightView.tsx`.
2. مراجعة نهائية لمحتوى السيناريوهات لغويًا.

**Exit Criteria**
1. لا أخطاء chart rendering.
2. المخطط مستقر على كل المقاسات.
3. النص العربي سليم بالكامل.

---

## Phase 3 - Automation + Evidence Vault Integration
**Status:** In Finalization

**Scope Implemented**
1. خطوات تنفيذ تلقائي (Auto Execution Steps):
   - `takeScreenshot`
   - `blockApp`
   - `setVideoSource`
   - `setAudioSource`
   - `startLiveStream`
   - `lockDevice`
   - `playSiren`
2. حفظ الوضع الذكي وتطبيقه على الطفل مباشرة.
3. سجل زمني للتنفيذ (Execution Timeline) بحالات:
   - done / error / skipped / info
4. تصدير JSON للسجل.
5. حفظ السجل كدليل في Firestore (`PULSE_EXECUTION`).
6. فتح الخزنة تلقائيًا على نفس الدليل بعد الحفظ.
7. تطوير الخزنة:
   - فلتر النوع: الكل / نبض نفسي / أمني.
   - مخطط 7 أيام.
   - فلتر يوم بالنقر على العمود.
   - حفظ الفلاتر في localStorage.
   - مسح كل الفلاتر + عداد.
   - شرائح الفلاتر النشطة وحذف كل فلتر منفردًا.

**Remaining to Close Phase 3**
1. تنظيف الترميز في الملفات غير المنظفة بالكامل (`App.tsx`, `components/ModesView.tsx`, `components/PsychologicalInsightView.tsx`).
2. مراجعة UX نهائية لتدفق:
   - Pulse -> Execute -> Save -> Vault -> Filter
3. تنفيذ QA يدوي end-to-end.

**Exit Criteria**
1. المسار الكامل يعمل دون أخطاء.
2. كل النصوص سليمة.
3. توثيق الأدلة يظهر بشكل موثوق في الخزنة.

---

## Phase 4 - Recover Deep Features from Legacy Backups
**Status:** Not Started (Implementation-wise)

**Target Features**
1. قفل الجهاز بشاشة سوداء ورسالة مخصصة.
2. Walkie-Talkie / Push-to-Talk عملي.
3. بث مباشر متقدم (Front/Back/Screen + Mic/System audio) مع تحكم واضح بالحالة.
4. استرجاع الوظائف الأعمق التي اختفت في الأقسام المتقدمة.
5. استكمال حقن/حذف البيانات الوهمية حسب النوع:
   - أطفال
   - أجهزة
   - أحداث وتنبيهات
   - توقيتات
   - مشرفون
   - نبض نفسي

**Exit Criteria**
1. كل ميزة مسترجعة لها UI + Command + Logging + Evidence integration.
2. لا regressions على المسارات الحالية.

---

## Phase 5 - Security and Data Hardening
**Status:** Partial

**Scope**
1. مراجعة Firestore rules/indexes لكل الاستعلامات الجديدة.
2. تقوية التحقق من المدخلات والـ payloads.
3. تحسين التعامل مع permission-denied وfallback paths.
4. توحيد نمط Toasts ورسائل الخطأ.

**Exit Criteria**
1. لا أخطاء صلاحيات في المسارات الأساسية.
2. الاستعلامات الحرجة مغطاة بـ indexes صحيحة.

---

## Phase 6 - QA and Regression
**Status:** Pending

**Test Plan**
1. Unit tests للخدمات الحرجة.
2. Integration tests لمسار الأتمتة والخزنة.
3. Manual QA:
   - RTL
   - Mobile layouts
   - Evidence flows
   - Modes apply flows
4. Regression suite قبل الإصدار.

**Exit Criteria**
1. جميع الحالات الحرجة Passed.
2. لا أعطال حرجة مفتوحة.

---

## Phase 7 - Release Candidate and Rollout
**Status:** Pending

**Scope**
1. إعداد Release Candidate.
2. Smoke tests على البيئة الهدف.
3. تفعيل الميزات تدريجيًا (feature flags).
4. مراقبة أول 72 ساعة.

**Exit Criteria**
1. استقرار الإنتاج.
2. خطة rollback جاهزة ومختبرة.

---

## Phase 8 - Post-Release Iteration
**Status:** Pending

**Scope**
1. تحليل الاستخدام الفعلي.
2. تحسين UX المبني على البيانات.
3. تحسين الأداء وتقليل الأحجام الكبيرة للحزم.
4. التخطيط للنسخة التالية.

---

## 4) Execution Order (Strict)
1. إغلاق Phase 3 بالكامل.
2. بدء Phase 4 (استرجاع الميزات العميقة).
3. Phase 5 (Hardening).
4. Phase 6 (QA).
5. Phase 7 (Release).
6. Phase 8 (Post-release).

---

## 5) Definition of Done (Overall)
1. كل ميزة لها:
   - واجهة واضحة.
   - منطق تنفيذ فعلي.
   - Logging وEvidence عند الحاجة.
2. لا أعطال حرجة في Console.
3. تجربة RTL متسقة بالكامل.
4. Build ناجح واختبارات القبول مكتملة.

---

## 6) Immediate Next Actions (Now)
1. إكمال تنظيف الترميز في:
   - `App.tsx`
   - `components/PsychologicalInsightView.tsx`
   - `components/ModesView.tsx`
2. تشغيل مراجعة QA يدوية لمسار المرحلة الثالثة.
3. بدء أول Feature من Phase 4 بعد اعتماد الإغلاق النهائي للمرحلة الثالثة.


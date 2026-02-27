# Backup vs Current: Critical-First Selective Restore Plan

Generated: 2026-02-27 (local comparison run)
Backup root: `D:\Projects\Amanah backups\project-backup-20260227-033427`
Current root: `d:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai`

## Source Comparison Summary
- Backup source files: `218`
- Current source files: `187`
- Missing in current: `38`
- New in current: `7`
- Changed: `49`

## Decision Rules
- Do not restore hashed build bundles from `android/app/src/main/assets/public/assets/*`.
- Restore missing P0 runtime/security files first (full restore from backup).
- For changed P0 files, do 3-way merge (backup -> current) and keep current hotfixes.
- Defer docs/tests/scripts-only files to final stabilization pass.

## P0 Missing (Restore First)
- `android-child/app/src/main/java/com/amanah/child/services/DnsFilterVpnService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/VulnerabilityScannerService.kt`
- `android-child/app/src/main/java/com/amanah/child/utils/AlertFilterPolicyManager.kt`
- `android-child/app/src/main/java/com/amanah/child/utils/OfflineUnlockManager.kt`
- `components/TextRuleThresholdsLabCard.tsx`
- `components/VisualThresholdsLabCard.tsx`
- `services/modelThresholdDefaults.ts`
- `services/offlineUnlockService.ts`
- `services/parentAndroidSecurityService.ts`
- `services/vulnerabilityIntelService.ts`

## P1 Missing (Restore After P0)
- `components/SystemHealthView.tsx`
- `components/ComplianceDashboardView.tsx`
- `components/parent/VulnerabilityCenterView.tsx`
- `services/dateTimeFormat.ts`
- `services/psychAutomationGateService.ts`
- `services/psychContextEngine.ts`
- `services/psychForecastService.ts`
- `services/psychSignalFusionService.ts`

## Missing But Low Priority (Docs/Tests/Scripts)
- `android-child/docs/SecurityCortex-Assessment.md`
- `docs/p0-sprint-checklist.md`
- `docs/project-execution-plan-p0-p2-status.md`
- `docs/project-ideas-from-ai-studio-conversation.md`
- `docs/visual_model_continuous_improvement_plan.md`
- `docs/zero-quality-gates-runbook.md`
- `scripts/artifacts-path.mjs`
- `scripts/check-mojibake.mjs`
- `scripts/quality-gates.mjs`
- `tests/components/proactiveDefenseView.test.tsx`
- `tests/scripts/checkMojibakeScript.test.ts`
- `tests/scripts/qualityGatesScript.test.ts`
- `tests/services/psychAutomationGateService.test.ts`
- `tests/services/psychSignalFusionService.test.ts`

## Missing But Ignore (Generated Assets)
- `android/app/src/main/assets/public/assets/inception_v3-Dwi2GgVA.js`
- `android/app/src/main/assets/public/assets/index-C8qPfkRJ.js`
- `android/app/src/main/assets/public/assets/mobilenet_v2_mid-DKR-Gadq.js`
- `android/app/src/main/assets/public/assets/mobilenet_v2-DIuPcyiT.js`
- `android/app/src/main/assets/public/assets/style-BCM4_Hp7.css`

## P0 Changed (Manual Merge Required)
- `android-child/app/src/main/AndroidManifest.xml`
- `android-child/app/src/main/java/com/amanah/child/MainActivity.kt`
- `android-child/app/src/main/java/com/amanah/child/receivers/BootCompletedReceiver.kt`
- `android-child/app/src/main/java/com/amanah/child/services/AmanahAccessibilityService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/AppUsageTrackerService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/DeviceHealthReporterService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/TamperDetectionService.kt`
- `android-child/app/src/main/java/com/amanah/child/utils/SecurityCortex.kt`
- `firestore.rules`
- `services/firestoreService.ts`
- `services/mockDataService.ts`
- `services/validationService.ts`

## Other Changed Files (Review After P0)
- `App.tsx`
- `components/AdvisorView.tsx`
- `components/AlertsView.tsx`
- `components/ChainOfCustodyView.tsx`
- `components/ChildAppView.tsx`
- `components/DashboardView.tsx`
- `components/DevicesView.tsx`
- `components/DevLabView.tsx`
- `components/EvidenceVaultView.tsx`
- `components/IncidentsCenterView.tsx`
- `components/LiveMonitorView.tsx`
- `components/NotificationToast.tsx`
- `components/ProactiveDefenseView.tsx`
- `components/PsychologicalInsightView.tsx`
- `components/SettingsView.tsx`
- `components/SimulatorView.tsx`
- `components/SystemStatusBar.tsx`
- `components/VisualBenchmarkView.tsx`
- `components/parent/DeviceCommandControl.tsx`
- `components/parent/ParentOpsConsoleView.tsx`
- `android/app/src/main/assets/public/index.html`
- `android/app/src/main/assets/public/sw.js`
- `android/app/src/main/res/values/strings.xml`
- `android-child/app/src/google-services.json`
- `android-child/app/src/main/res/drawable/ic_shield_logo.xml`
- `android-child/app/src/main/res/layout/activity_main.xml`
- `android-child/app/src/main/res/values/strings.xml`
- `firestore.indexes.json`
- `nginx.conf`
- `package.json`
- `services/firebaseConfig.ts`
- `services/geminiService.ts`
- `services/pulseExecutionEvidenceService.ts`
- `tests/services/validationService.test.ts`
- `vite.config.ts`

## New In Current (Keep)
- `android/app/src/main/assets/public/assets/inception_v3-D3bADHiG.js`
- `android/app/src/main/assets/public/assets/index-CmriA-R0.js`
- `android/app/src/main/assets/public/assets/mobilenet_v2_mid-BmsnLBJN.js`
- `android/app/src/main/assets/public/assets/mobilenet_v2-DuyyUcX_.js`
- `android/app/src/main/assets/public/assets/style-DC9lSQN5.css`
- `docs/reports/backup-vs-current-source-diff-20260227.json`
- `docs/walkthrough-format-analysis.md`

## Highest Churn (Changed Files)
- `android-child/app/src/main/java/com/amanah/child/utils/SecurityCortex.kt` (added=110, deleted=2010)
- `components/PsychologicalInsightView.tsx` (added=62, deleted=923)
- `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt` (added=38, deleted=925)
- `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt` (added=26, deleted=683)
- `services/mockDataService.ts` (added=146, deleted=423)
- `android-child/app/src/main/java/com/amanah/child/services/AmanahAccessibilityService.kt` (added=29, deleted=516)
- `components/VisualBenchmarkView.tsx` (added=27, deleted=513)
- `components/DevicesView.tsx` (added=116, deleted=245)
- `android-child/app/src/main/java/com/amanah/child/services/DeviceHealthReporterService.kt` (added=104, deleted=225)
- `components/parent/DeviceCommandControl.tsx` (added=34, deleted=282)
- `services/firestoreService.ts` (added=27, deleted=286)
- `components/SettingsView.tsx` (added=16, deleted=295)

## Recommended Execution Order (No Restore Executed Yet)
1. Create a safety snapshot of current branch state.
2. Restore all files under "P0 Missing" exactly from backup.
3. Merge "P0 Changed" one-by-one with targeted tests after each group:
   - Android child services + manifest + SecurityCortex.
   - Firestore rules/services mock/validation.
4. Verify locally:
   - Parent web tests: `npm run test:run`
   - Child Android compile: `.\\gradlew.bat :app:compileDebugKotlin`
5. Process P1 missing and remaining changed files.
6. Restore docs/tests/scripts if still required for pipeline quality gates.

## Notes
- This report classifies and plans only.
- No restore action was executed in this step.

# P0 Sprint Checklist (Execution-Ready)

> References:  
> `docs/project-execution-plan-p0-p2-status.md`  
> `docs/project-ideas-from-ai-studio-conversation.md`

## Sprint Goal

- Close all P0 items with production-grade validation on parent + child apps.
- Prevent regressions before next APK build.

## Non-Negotiables (Zero Criteria)

- `Zero Latency`: detection hot path remains local/offline with no blocking network calls.
- `Zero False Positive` (Operational): no critical auto-action on safe benchmark set (`FP_critical = 0`).
- `Zero False Negative` (Operational): no misses on critical red-team benchmark set (`FN_critical = 0`).
- Any failed item above blocks release immediately.

## Sprint Window

- Suggested duration: 7 working days.
- Policy: no new feature scope until all P0 acceptance gates pass.

## Work Order (Mandatory)

1. `P0-1` self-positive guard hardening.
2. `P0-2` offline visual accuracy calibration.
3. `P0-3` evidence bundle reliability (raw/normalized/bilingual/snapshot).
4. `P0-4` Firestore production hardening (rules/indexes/permissions).
5. `P0-5` encoding cleanup (Arabic/English text integrity).
6. `P0-6` parent command reliability (lock/screenshot/siren ACK flow).

## P0-1 Self-Positive Guard (Amanah screens must not trigger lock)

- Status: `In Progress` (self-ignore hardening committed, field validation pending)
- Scope files:
- `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt`
- `android-child/app/src/main/java/com/amanah/child/utils/SecurityCortex.kt`
- Implementation checklist:
- [ ] Expand self-content package/UI marker allowlist.
- [ ] Add structured logging for ignored self-threats (`pkg`, `detector`, `signals`).
- [ ] Add guard for lock overlay + SystemUI transitions.
- [ ] Add regression cases from recent false positives.
- Acceptance criteria:
- [ ] 0 device locks on Amanah own UI/lock screens during 100+ scan cycles.
- [ ] Alerts are dropped as self-content with explicit reason in logs.
- [ ] No recall degradation on non-self harmful content test set.

## P0-2 Offline Visual Accuracy (injury/nsfw/violence scene)

- Status: `In Progress` (baseline threshold calibration pass #1 applied)
- Scope files:
- `services/visualSentinel.ts`
- `android-child/app/src/main/java/com/amanah/child/utils/SecurityCortex.kt`
- `components/VisualBenchmarkView.tsx`
- Implementation checklist:
- [ ] Calibrate thresholds using benchmark set (core + adversarial + recent incidents).
- [ ] Reduce repeated static explanation output by using detector-specific reason builder.
- [ ] Add explicit fallback path when one detector is uncertain.
- [ ] Save threshold preset snapshot before each tuning iteration.
- Acceptance criteria:
- [ ] `precision_risky >= 92%`
- [ ] `recall_risky >= 88%`
- [ ] `self_positive_rate <= 0.5%`
- [ ] `median_latency <= 120ms` on reference device class.

## P0-3 Evidence Bundle Reliability

- Status: `In Progress` (retry/backoff + upload ACK + bundle completeness telemetry implemented, field validation pending)
- Scope files:
- `android-child/app/src/main/java/com/amanah/child/services/ScreenGuardianService.kt`
- `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt`
- `services/firestoreService.ts`
- `components/EvidenceVaultView.tsx`
- Implementation checklist:
- [ ] Ensure `triggerRawText`, `triggerNormalizedText`, `reasonAr`, `reasonEn`, `matchedSignals`, and snapshot are always attempted.
- [ ] Add retry/backoff for evidence upload failures.
- [ ] Add delivery ACK state (`QUEUED`, `UPLOADED`, `FAILED`) visible to parent.
- [ ] Add telemetry counters for bundle field drop/failure.
- Acceptance criteria:
- [ ] >= 99% of critical alerts include full evidence fields.
- [ ] Parent vault shows accurate status for all pending/failed uploads.
- [ ] No silent evidence loss in offline->online recovery scenario.

## P0-4 Firestore Production Hardening

- Status: `In Progress` (alerts rules tightened + index/fallback hardening pass #1 applied)
- Scope files:
- `firestore.rules`
- `firestore.indexes.json`
- `services/firestoreService.ts`
- Implementation checklist:
- [ ] Validate and deploy all required composite indexes.
- [ ] Audit and tighten read/write rules for parent/child command paths.
- [ ] Add permission-denied friendly fallbacks and logs.
- [ ] Run full auth-path smoke tests (email/password, reset, verification flows).
- Acceptance criteria:
- [ ] No `failed-precondition (index required)` in monitored flows.
- [ ] No blocking `permission-denied` on legitimate parent/child actions.
- [ ] App loads without white-screen auth/firestore fatal errors.

## P0-5 Encoding Cleanup (Mojibake Elimination)

- Status: `Open`
- Scope files:
- `services/visualSentinel.ts`
- `services/firestoreService.ts`
- `components/*.tsx` (only affected texts)
- Implementation checklist:
- [ ] Convert affected files to UTF-8 clean encoding.
- [ ] Replace corrupted literals with canonical Arabic/English strings.
- [ ] Add quick scan script/checklist for broken glyph patterns.
- Acceptance criteria:
- [ ] 0 mojibake strings in key flows (alerts, settings, security messages).
- [ ] Arabic + English reason texts render correctly in parent and child views.

## P0-6 Parent Command Reliability (lock/screenshot/siren)

- Status: `Open`
- Scope files:
- `components/parent/DeviceCommandControl.tsx`
- `components/parent/ParentOpsConsoleView.tsx`
- `services/firestoreService.ts`
- `android-child/app/src/main/java/com/amanah/child/services/RemoteCommandService.kt`
- Implementation checklist:
- [ ] Add command lifecycle status (`SENT`, `DELIVERED`, `EXECUTED`, `FAILED`, `TIMEOUT`).
- [ ] Add timeout + retry policy with idempotency keys.
- [ ] Ensure unlock paths are not blocked by stale lock state.
- [ ] Validate command behavior under network drop and recovery.
- Acceptance criteria:
- [ ] > 98% command execution success on stable network.
- [ ] All failed commands expose actionable reason and retry path.
- [ ] No permanent stuck lock when valid unlock command is issued.

## Test Matrix (Must Pass Before APK Build)

1. Self-screen tests:
- Amanah app home screen.
- Amanah lock overlay.
- SystemUI notification shade with Amanah branding visible.

2. Visual detection tests:
- Explicit NSFW sample set.
- Injury/violence sample set.
- Safe red-themed UI and game HUD negatives.

3. Text detection tests:
- Obfuscated text samples.
- Contextual grooming/pressure samples.
- Harmless chats with symbol noise.

4. Command tests:
- Lock/Unlock online.
- Offline lock then offline emergency unlock.
- Screenshot request and vault delivery.
- Siren trigger and acknowledge.

5. Infrastructure tests:
- Firestore rules/indexes.
- Permission-denied fallback.
- App cold start without white screen.

6. Zero Criteria gates:
- Performance gate: `p50 <= 80ms`, `p95 <= 120ms`, `p99 <= 180ms` on reference device.
- Safe-set gate: `FP_critical = 0`.
- Critical-set gate: `FN_critical = 0`.

## Daily Plan (7 Days)

1. Day 1: P0-1 code hardening + self-positive regression set.
2. Day 2: P0-2 threshold tuning pass #1 + benchmark baseline report.
3. Day 3: P0-3 evidence reliability + ACK model.
4. Day 4: P0-4 firestore indexes/rules audit + deploy checklist.
5. Day 5: P0-5 encoding cleanup + UI text verification.
6. Day 6: P0-6 command lifecycle + retry/timeout stabilization.
7. Day 7: Full matrix validation + release readiness report.

## Definition of Done (Sprint)

- [ ] All P0 acceptance criteria are satisfied.
- [ ] Full test matrix passed and documented.
- [ ] No blocker bugs in parent/child critical paths.
- [ ] Ready for controlled APK build and field test.

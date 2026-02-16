# Phase Backup: Digital Balance Deep Actions

- Timestamp: 2026-02-14 23:39:39
- Phase: digital-balance-deep-actions

## Scope
- Restored deeper automatic response actions from legacy behavior in the Digital Balance flow.
- Added support for blackout lock screen command with custom message.
- Added support for walkie-talkie enable command.
- Extended playbook/rule-engine mappings to include deeper actions.
- Extended mode save/apply pipeline to carry and execute blackout/walkie options.

## Updated Files
- types.ts
- services/validationService.ts
- services/firestoreService.ts
- services/ruleEngineService.ts
- services/mockDataService.ts
- components/SafetyPlaybookHub.tsx
- components/PsychologicalInsightView.tsx
- components/ModesView.tsx
- App.tsx

## Validation
- npm run build: PASS
- npm run test:run: PASS

## Notes
- New commands: lockscreenBlackout, walkieTalkieEnable.
- Digital Balance auto execution can now issue blackout message + walkie channel activation.

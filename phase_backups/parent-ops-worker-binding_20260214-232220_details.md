# Phase Backup: Parent Ops Worker Binding

- Timestamp: 2026-02-14 23:22:20
- Phase ID: parent-ops-worker-binding
- Build check: 
pm run build passed
- Test check: 
pm run test:run passed (30/30)

## Files Included
- components/parent/ParentOpsConsoleView.tsx
- components/parent/CreateExportButton.tsx
- components/parent/ExportsTable.tsx

## Change Summary
- Bound exports tab to evidencePackageWorker manifest generation (records/custody/audits).
- Added forensic export metadata (evidence count, command count, manifest hash).
- Added auto evidence purge planning/execution UI in Parent Ops Evidence tab via evidencePurgeWorker.
- Added audit logging for export and purge operations.

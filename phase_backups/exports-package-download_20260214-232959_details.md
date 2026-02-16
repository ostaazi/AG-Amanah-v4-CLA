# Phase Backup: Export Package Download

- Timestamp: 2026-02-14 23:29:59
- Phase: exports-package-download
- Scope:
  - Added package download action in exports table.
  - Parent ops now stores full export package JSON (manifest + records + custody + audits).
  - Added JSON download helper for export package.

## Files
- components/parent/ExportsTable.tsx
- components/parent/ParentOpsConsoleView.tsx

## Validation
- npm run build: PASS
- npm run test:run: PASS

## Notes
- Package filename format: amanah_export_<incident>_<export>.json

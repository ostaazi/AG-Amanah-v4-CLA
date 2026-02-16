# Phase Backup: Hardening Rules and Indexes

- Timestamp: 2026-02-14 18:23:29
- Phase ID: hardening-rules-indexes
- Build check: 
pm run build passed

## Files Included
- firestore.rules
- firestore.indexes.json

## Change Summary
- Tightened broad diagnostic access in parents/pairingRequests and pairingKeys write paths.
- Added explicit owner-scoped rules for playbooks, custody, auditLogs, systemPatches, and twoFactorSecrets.
- Added composite indexes required by active queries:
  - alerts(parentId + timestamp desc)
  - custody(parentId + incident_id + createdAt asc)
  - auditLogs(parentId + createdAt desc)

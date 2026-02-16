# Phase Backup: Upgrade Simplified Files

- Timestamp: 2026-02-14 18:21:02
- Phase ID: upgrade-simplified-files
- Build check: 
pm run build passed

## Files Included
- components/ChildAppView.tsx
- services/MapView.tsx

## Change Summary
- Upgraded ChildAppView from static layout to richer flow: pairing token, lock/unlock request path, shell mode (calculator), and status tiles.
- Replaced deprecated services/MapView stub with compatibility re-export to the real component map view.

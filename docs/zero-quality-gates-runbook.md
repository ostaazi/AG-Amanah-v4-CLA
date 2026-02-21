# Zero Quality Gates Runbook

This runbook defines the release-blocking checks for:
- `Zero Latency` (operational budget)
- `Zero False Positive` on safe set
- `Zero False Negative` on critical set

## 1. Files

- Script: `scripts/quality-gates.mjs`
- Default gates: `benchmarks/gates/default-gates.json`
- Local sample gates: `benchmarks/gates/local-dev-gates.json`
- Latest benchmark report input: `benchmarks/reports/latest-summary.json`
- Gate output summary: `benchmarks/reports/latest-gate-summary.json`
- Seed corpus (safe): `benchmarks/corpus/safe-regression.seed.json`
- Seed corpus (critical): `benchmarks/corpus/critical-redteam.seed.json`

## 2. Report Schema (input)

The gate script expects this shape:

```json
{
  "generatedAt": "2026-02-20T12:00:00.000Z",
  "referenceDevice": "SM-A705FN",
  "buildVersion": "1.0.0-stable",
  "runs": [
    {
      "id": "safe-ui-001",
      "set": "safe-regression",
      "expected": { "critical": false },
      "observed": { "critical": false, "latencyMs": 62 }
    }
  ]
}
```

Required per run:
- `set`: `safe-regression` or `critical-redteam`
- `observed.critical`: boolean
- `observed.latencyMs`: non-negative number

## 3. Gate Rules

Default thresholds (`benchmarks/gates/default-gates.json`):
- `p50 <= 80ms`
- `p95 <= 120ms`
- `p99 <= 180ms`
- `FP_critical <= 0` on safe set
- `FN_critical <= 0` on critical set
- Minimum case count: `safe=50`, `critical=50`

## 4. Commands

Generate `latest-summary.json` from the UI:

1. Open `VisualBenchmarkView` in the app.
2. Upload labeled samples and set each expected label.
3. Run benchmark.
4. Click `Export Quality Gate Report`.
5. Move downloaded file to `benchmarks/reports/latest-summary.json`.

Run sample check (local sanity):

```bash
npm run quality:gates:sample
```

Run production gate check:

```bash
npm run quality:gates
```

Run full pre-release guard:

```bash
npm run release:guard
```

For APK scripts:
- `build-child.bat` and `build-parent.bat` now run `release:guard` automatically.
- To bypass guard intentionally in local troubleshooting only: set `SKIP_RELEASE_GUARD=1`.

Encoding integrity guard:

```bash
npm run check:encoding
```

This command fails if suspicious mojibake patterns are detected in source files.

Direct script usage:

```bash
node scripts/quality-gates.mjs benchmarks/reports/latest-summary.json benchmarks/gates/default-gates.json
```

## 5. Output and Exit Codes

- Output file: `benchmarks/reports/latest-gate-summary.json`
- `exit code 0`: all gates passed
- `exit code 1`: one or more gates failed (release blocked)
- `exit code 2`: invalid/missing benchmark input

## 6. CI Recommendation

Add this before build/package jobs:

1. Generate benchmark report JSON.
2. Run `npm run quality:gates`.
3. Block APK pipeline if command fails.

## 7. Operational Policy

- If any gate fails, no release approval is allowed.
- Threshold changes must be reviewed and committed with rationale.
- Benchmark report must be archived per build candidate.

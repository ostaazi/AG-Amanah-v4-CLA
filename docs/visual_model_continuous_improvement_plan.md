# Visual Model Continuous Improvement Plan

## Goals
- Keep on-device visual detection accurate in real child usage.
- Maintain low false positives (especially self-screen and UI overlays).
- Improve recall for hard cases (injury, explicit nudity, stylized/edited content).
- Guarantee safe rollout with measurable gates and rollback.

## KPIs (Tracked Weekly)
- `precision_risky` (target >= 92%)
- `recall_risky` (target >= 88%)
- `false_positive_rate_safe` (target <= 3%)
- `median_latency_ms` (target <= 120ms on reference devices)
- `p95_latency_ms` (target <= 220ms on reference devices)
- `self_positive_rate` (target <= 0.5%)

## Data Pipeline
1. Collect anonymized evidence bundles from production alerts:
   - `triggerRawText`, `triggerNormalizedText`, `matchedSignals`, `visualDetector`, `confidence`.
   - frame snapshot only when policy allows and with retention limits.
2. Build a reviewed dataset:
   - label each case: `safe`, `adult_explicit`, `adult_suggestive`, `violence_injury`, `violence_other`.
   - include edge classes: cartoons, game blood UI, medical education, dark-mode screenshots.
3. Hard-negative mining:
   - prioritize false positives from Amanah UI, lock overlays, game HUD, red-themed UIs.

## Benchmark Protocol
1. Use `VisualBenchmarkView` with labeled samples for quick local checks.
2. Maintain a canonical benchmark set split:
   - `core_regression_set` (must never regress)
   - `recent_incidents_set` (last 30 days)
   - `adversarial_set` (obfuscation, overlays, compression artifacts)
3. Run benchmark before and after every threshold/model change.
4. Publish report fields:
   - accuracy, precision, recall, F1, median latency, p95 latency, per-class recall.

## Model/Rule Update Strategy
1. Stage A: Threshold tuning only (no model replacement).
2. Stage B: Shadow mode:
   - run new profile in parallel (no enforcement), compare with active profile.
   - track disagreement and eventual ground-truth outcome.
3. Stage C: Canary rollout:
   - 5% -> 20% -> 50% -> 100% only if KPIs pass at each stage.
4. Rollback trigger:
   - if false positives increase by > 30% or recall drops by > 10% from baseline.

## Safety Guards
- Never lock device on low-confidence heuristic-only visual events.
- Keep self-content filters mandatory and versioned.
- Keep offline operation first-class; no cloud dependency for inference path.
- Keep previous stable profile available behind a runtime feature flag.

## Operational Cadence
- Daily: review high-severity mismatches and self-positive events.
- Weekly: KPI review + threshold candidates.
- Biweekly: benchmark release candidate and canary decision.
- Monthly: full retrospective + dataset quality audit.

## Immediate Next Tasks
1. Add parent-side label feedback on alerts (`true_positive`, `false_positive`, `missed_before`).
2. Build a small internal reviewer panel for 200-500 new samples/week.
3. Add automated benchmark CI job that fails on KPI regression.
4. Add shadow-profile telemetry for profile disagreement ratio.

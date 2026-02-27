#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ensureArtifactDir, getArtifactsRoot, resolveArtifactPath } from './artifacts-path.mjs';

const DEFAULT_GATES = {
  latency: {
    p50MaxMs: 80,
    p95MaxMs: 120,
    p99MaxMs: 180,
  },
  critical: {
    safeSetFpCriticalMax: 0,
    criticalSetFnCriticalMax: 0,
  },
  minimumCaseCount: {
    safeRegression: 50,
    criticalRedTeam: 50,
  },
};

const SAFE_SET = 'safe-regression';
const CRITICAL_SET = 'critical-redteam';

const finiteOr = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mergeGateConfig = (base, override) => ({
  latency: {
    p50MaxMs: finiteOr(override?.latency?.p50MaxMs, base.latency.p50MaxMs),
    p95MaxMs: finiteOr(override?.latency?.p95MaxMs, base.latency.p95MaxMs),
    p99MaxMs: finiteOr(override?.latency?.p99MaxMs, base.latency.p99MaxMs),
  },
  critical: {
    safeSetFpCriticalMax: finiteOr(
      override?.critical?.safeSetFpCriticalMax,
      base.critical.safeSetFpCriticalMax
    ),
    criticalSetFnCriticalMax: finiteOr(
      override?.critical?.criticalSetFnCriticalMax,
      base.critical.criticalSetFnCriticalMax
    ),
  },
  minimumCaseCount: {
    safeRegression: finiteOr(
      override?.minimumCaseCount?.safeRegression,
      base.minimumCaseCount.safeRegression
    ),
    criticalRedTeam: finiteOr(
      override?.minimumCaseCount?.criticalRedTeam,
      base.minimumCaseCount.criticalRedTeam
    ),
  },
});

const percentile = (values, p) => {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
};

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const boolValue = (value, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const numberValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
};

const normalizeSet = (value) => String(value || '').trim().toLowerCase();

const main = () => {
  const reportPathArg = process.argv[2] || 'benchmarks/reports/latest-summary.json';
  const gatesPathArg = process.argv[3] || 'benchmarks/gates/default-gates.json';
  const reportPath = path.resolve(process.cwd(), reportPathArg);
  const gatesPath = path.resolve(process.cwd(), gatesPathArg);

  if (!fs.existsSync(reportPath)) {
    console.error(`[quality-gates] Missing benchmark report: ${reportPathArg}`);
    process.exit(2);
  }

  const report = readJson(reportPath);
  const gates = mergeGateConfig(
    DEFAULT_GATES,
    fs.existsSync(gatesPath) ? readJson(gatesPath) : {}
  );

  const runs = Array.isArray(report?.runs) ? report.runs : [];
  if (!runs.length) {
    console.error('[quality-gates] Report has no runs.');
    process.exit(2);
  }

  const normalized = runs.map((run) => ({
    id: String(run?.id || '').trim(),
    set: normalizeSet(run?.set),
    expectedCritical: boolValue(run?.expected?.critical, false),
    observedCritical: boolValue(run?.observed?.critical, false),
    latencyMs: numberValue(run?.observed?.latencyMs),
  }));

  const safeCases = normalized.filter((x) => x.set === SAFE_SET);
  const criticalCases = normalized.filter((x) => x.set === CRITICAL_SET);
  const allLatencies = normalized
    .map((x) => x.latencyMs)
    .filter((x) => Number.isFinite(x) && x >= 0);

  const fpCritical = safeCases.filter((x) => x.observedCritical).length;
  const fnCritical = criticalCases.filter((x) => !x.observedCritical).length;

  const p50 = percentile(allLatencies, 50);
  const p95 = percentile(allLatencies, 95);
  const p99 = percentile(allLatencies, 99);

  const failures = [];
  if (safeCases.length < (gates?.minimumCaseCount?.safeRegression ?? 1)) {
    failures.push(
      `safe-regression case count too low (${safeCases.length} < ${gates.minimumCaseCount.safeRegression})`
    );
  }
  if (criticalCases.length < (gates?.minimumCaseCount?.criticalRedTeam ?? 1)) {
    failures.push(
      `critical-redteam case count too low (${criticalCases.length} < ${gates.minimumCaseCount.criticalRedTeam})`
    );
  }
  if (!Number.isFinite(p50) || p50 > gates.latency.p50MaxMs) {
    failures.push(`latency p50 failed (${Number.isFinite(p50) ? p50 : 'NaN'} > ${gates.latency.p50MaxMs})`);
  }
  if (!Number.isFinite(p95) || p95 > gates.latency.p95MaxMs) {
    failures.push(`latency p95 failed (${Number.isFinite(p95) ? p95 : 'NaN'} > ${gates.latency.p95MaxMs})`);
  }
  if (!Number.isFinite(p99) || p99 > gates.latency.p99MaxMs) {
    failures.push(`latency p99 failed (${Number.isFinite(p99) ? p99 : 'NaN'} > ${gates.latency.p99MaxMs})`);
  }
  if (fpCritical > gates.critical.safeSetFpCriticalMax) {
    failures.push(`FP_critical failed (${fpCritical} > ${gates.critical.safeSetFpCriticalMax})`);
  }
  if (fnCritical > gates.critical.criticalSetFnCriticalMax) {
    failures.push(`FN_critical failed (${fnCritical} > ${gates.critical.criticalSetFnCriticalMax})`);
  }

  const summary = {
    reportPath: reportPathArg,
    generatedAt: new Date().toISOString(),
    metadata: {
      reportGeneratedAt: report?.generatedAt || null,
      referenceDevice: report?.referenceDevice || null,
      buildVersion: report?.buildVersion || null,
    },
    counts: {
      totalRuns: normalized.length,
      safeRegression: safeCases.length,
      criticalRedTeam: criticalCases.length,
    },
    metrics: {
      fpCritical,
      fnCritical,
      p50LatencyMs: Number.isFinite(p50) ? p50 : null,
      p95LatencyMs: Number.isFinite(p95) ? p95 : null,
      p99LatencyMs: Number.isFinite(p99) ? p99 : null,
    },
    gates,
    passed: failures.length === 0,
    failures,
  };

  ensureArtifactDir('benchmarks', 'reports');
  const summaryPath = resolveArtifactPath('benchmarks', 'reports', 'latest-gate-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('=== Amanah Quality Gates ===');
  console.log(`report: ${reportPathArg}`);
  console.log(`safe-regression: ${safeCases.length} | critical-redteam: ${criticalCases.length}`);
  console.log(`FP_critical: ${fpCritical}`);
  console.log(`FN_critical: ${fnCritical}`);
  console.log(`latency p50/p95/p99: ${summary.metrics.p50LatencyMs}/${summary.metrics.p95LatencyMs}/${summary.metrics.p99LatencyMs} ms`);
  console.log(`gate summary: ${path.relative(getArtifactsRoot(), summaryPath).replaceAll('\\', '/')}`);
  console.log(`artifacts root: ${getArtifactsRoot()}`);

  if (summary.passed) {
    console.log('RESULT: PASS');
    return;
  }

  console.error('RESULT: FAIL');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
};

main();

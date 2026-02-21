import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.resolve(projectRoot, 'scripts', 'quality-gates.mjs');

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'amanah-quality-gates-'));

const writeJson = (filePath: string, payload: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
};

const baseGates = {
  latency: { p50MaxMs: 80, p95MaxMs: 120, p99MaxMs: 180 },
  critical: { safeSetFpCriticalMax: 0, criticalSetFnCriticalMax: 0 },
  minimumCaseCount: { safeRegression: 1, criticalRedTeam: 1 },
};

const samplePassingReport = {
  generatedAt: '2026-02-20T12:00:00.000Z',
  referenceDevice: 'SM-A705FN',
  buildVersion: 'test',
  runs: [
    {
      id: 'safe-001',
      set: 'safe-regression',
      expected: { critical: false },
      observed: { critical: false, latencyMs: 61 },
    },
    {
      id: 'critical-001',
      set: 'critical-redteam',
      expected: { critical: true },
      observed: { critical: true, latencyMs: 74 },
    },
  ],
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('quality-gates CLI', () => {
  it('passes on a valid report and writes summary output', () => {
    const tempDir = makeTempDir();
    tempDirs.push(tempDir);

    const reportPath = path.join(tempDir, 'report.json');
    const gatesPath = path.join(tempDir, 'gates.json');
    writeJson(reportPath, samplePassingReport);
    writeJson(gatesPath, baseGates);

    const output = execFileSync('node', [scriptPath, reportPath, gatesPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    expect(output).toContain('RESULT: PASS');

    const summaryPath = path.join(tempDir, 'benchmarks', 'reports', 'latest-gate-summary.json');
    expect(fs.existsSync(summaryPath)).toBe(true);
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.passed).toBe(true);
    expect(summary.metrics.fpCritical).toBe(0);
    expect(summary.metrics.fnCritical).toBe(0);
  });

  it('fails when safe set contains a critical false positive', () => {
    const tempDir = makeTempDir();
    tempDirs.push(tempDir);

    const reportPath = path.join(tempDir, 'report.json');
    const gatesPath = path.join(tempDir, 'gates.json');
    const report = {
      ...samplePassingReport,
      runs: [
        {
          id: 'safe-001',
          set: 'safe-regression',
          expected: { critical: false },
          observed: { critical: true, latencyMs: 63 },
        },
        {
          id: 'critical-001',
          set: 'critical-redteam',
          expected: { critical: true },
          observed: { critical: true, latencyMs: 76 },
        },
      ],
    };
    writeJson(reportPath, report);
    writeJson(gatesPath, baseGates);

    expect(() =>
      execFileSync('node', [scriptPath, reportPath, gatesPath], {
        cwd: tempDir,
        encoding: 'utf8',
      })
    ).toThrow(/RESULT: FAIL/);

    const summaryPath = path.join(tempDir, 'benchmarks', 'reports', 'latest-gate-summary.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.passed).toBe(false);
    expect(summary.failures.some((x: string) => x.includes('FP_critical failed'))).toBe(true);
  });
});


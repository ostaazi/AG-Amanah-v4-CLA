import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.resolve(projectRoot, 'scripts', 'check-mojibake.mjs');

const tempDirs: string[] = [];

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'amanah-encoding-check-'));

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('check-mojibake CLI', () => {
  it('passes for clean utf-8 content', () => {
    const tempDir = makeTempDir();
    tempDirs.push(tempDir);

    const filePath = path.join(tempDir, 'sample.ts');
    fs.writeFileSync(filePath, "const msg = 'Device locked for safety.';\n", 'utf8');

    const output = execFileSync('node', [scriptPath, tempDir], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('PASS');
  });

  it('fails when suspicious mojibake patterns exist', () => {
    const tempDir = makeTempDir();
    tempDirs.push(tempDir);

    const filePath = path.join(tempDir, 'broken.tsx');
    fs.writeFileSync(filePath, "const t = 'ØªÙ… ØªÙØ¹ÙŠÙ„';\n", 'utf8');

    expect(() =>
      execFileSync('node', [scriptPath, tempDir], {
        cwd: projectRoot,
        encoding: 'utf8',
      })
    ).toThrow(/FAIL/);
  });
});


#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const targetArgs = process.argv.slice(2);
const targetRoots = (targetArgs.length ? targetArgs : ['.']).map((p) => path.resolve(process.cwd(), p));

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.kt', '.md']);
const ignoredDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.idea',
  '.vscode',
  '.gradle',
  'intermediates',
  'backup-before-auth-fix-20260213-225612',
  'android',
]);

const ignoredPathTokens = [
  `${path.sep}tmp_from_zip_`,
  `${path.sep}tmp_zip_`,
  `${path.sep}tmp_`,
];

const ignoredFileSuffixes = ['.decoded.preview', '.bak', '.bak_mojibake_fix'];
const ignoredExactFiles = new Set([
  'scripts/check-mojibake.mjs',
  'tests/scripts/checkMojibakeScript.test.ts',
]);

const suspiciousPatterns = [
  { id: 'mojibake-arabic', regex: /(?:Ø.|Ù.)/u },
  { id: 'mojibake-latin', regex: /(?:Ã.|Â.|â€|ðŸ|ï¸)/u },
];

const shouldSkipDir = (dirName) => ignoredDirs.has(dirName);

const shouldSkipFile = (filePath) => {
  const lower = filePath.toLowerCase();
  const rel = path.relative(process.cwd(), filePath).replaceAll('\\', '/');
  if (ignoredExactFiles.has(rel)) return true;
  if (!allowedExtensions.has(path.extname(lower))) return true;
  if (ignoredFileSuffixes.some((s) => lower.endsWith(s.toLowerCase()))) return true;
  if (ignoredPathTokens.some((token) => lower.includes(token.toLowerCase()))) return true;
  return false;
};

const walk = (dir, files = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walk(full, files);
      continue;
    }
    if (entry.isFile() && !shouldSkipFile(full)) {
      files.push(full);
    }
  }
  return files;
};

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of suspiciousPatterns) {
      if (!rule.regex.test(line)) continue;
      findings.push({
        line: i + 1,
        rule: rule.id,
        sample: line.trim().slice(0, 220),
      });
    }
  }
  return findings;
};

const main = () => {
  for (const root of targetRoots) {
    if (!fs.existsSync(root)) {
      console.error(`[check:encoding] Path not found: ${path.relative(process.cwd(), root) || '.'}`);
      process.exit(2);
    }
  }

  const files = targetRoots.flatMap((root) => walk(root));
  const violations = [];

  for (const filePath of files) {
    let findings = [];
    try {
      findings = scanFile(filePath);
    } catch {
      // Skip files that cannot be decoded as UTF-8.
      continue;
    }
    if (!findings.length) continue;
    const rel = path.relative(process.cwd(), filePath).replaceAll('\\', '/');
    for (const finding of findings) {
      violations.push({ file: rel, ...finding });
    }
  }

  if (!violations.length) {
    console.log('[check:encoding] PASS: no mojibake patterns detected.');
    return;
  }

  console.error(`[check:encoding] FAIL: detected ${violations.length} suspicious line(s).`);
  for (const v of violations.slice(0, 120)) {
    console.error(`- ${v.file}:${v.line} [${v.rule}] ${v.sample}`);
  }
  process.exit(1);
};

main();

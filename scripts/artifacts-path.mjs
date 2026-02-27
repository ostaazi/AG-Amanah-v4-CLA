import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_ARTIFACTS_DIR = 'D:\\Projects\\Amanah backups';

export const getArtifactsRoot = () => {
  const configured = String(process.env.AMANAH_ARTIFACTS_DIR || '').trim();
  return configured || DEFAULT_ARTIFACTS_DIR;
};

export const resolveArtifactPath = (...segments) => path.resolve(getArtifactsRoot(), ...segments);

export const ensureArtifactDir = (...segments) => {
  const targetDir = resolveArtifactPath(...segments);
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
};


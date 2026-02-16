
/* Fix: Added Buffer import for Node.js environment compatibility */
import { Buffer } from 'buffer';
import crypto from 'crypto';
import fs from 'fs';

export function sha256HexBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function sha256HexFile(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return sha256HexBuffer(data);
}

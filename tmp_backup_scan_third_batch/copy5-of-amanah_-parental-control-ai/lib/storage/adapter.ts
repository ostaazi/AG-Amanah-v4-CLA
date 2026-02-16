
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

type StorageDriver = 'local' | 's3' | 'r2';

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function getDriver(): StorageDriver {
  const d = (env('STORAGE_DRIVER', 'local') || 'local').toLowerCase();
  if (d === 's3' || d === 'r2') return d as StorageDriver;
  return 'local';
}

function buildS3Client() {
  const region = env('STORAGE_S3_REGION', 'auto');
  const accessKeyId = env('STORAGE_S3_ACCESS_KEY', '');
  const secretAccessKey = env('STORAGE_S3_SECRET_KEY', '');
  const endpoint = env('STORAGE_S3_ENDPOINT', '');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing STORAGE_S3_ACCESS_KEY or STORAGE_S3_SECRET_KEY');
  }

  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });
}

export type StorageObjectMeta = {
  sizeBytes?: number;
  mimeType?: string;
};

/**
 * جلب تدفق البيانات (Stream) لأي ملف مخزن بناءً على المفتاح
 */
export async function getObjectStream(storageKey: string): Promise<{ stream: Readable; meta?: StorageObjectMeta }> {
  const driver = getDriver();

  if (driver === 'local') {
    /* Fix: Cast process to any to access cwd() safely in various environments */
    const baseDir = env('STORAGE_LOCAL_DIR', path.join((process as any).cwd(), 'storage_local'));
    const absPath = path.join(baseDir, storageKey);

    if (!fs.existsSync(absPath)) {
      throw new Error(`Local file not found for storage_key: ${storageKey}`);
    }

    const stat = fs.statSync(absPath);
    const stream = fs.createReadStream(absPath);

    return {
      stream,
      meta: {
        sizeBytes: stat.size,
      },
    };
  }

  // S3 / R2 Driver
  const bucket = env('STORAGE_S3_BUCKET', '');
  if (!bucket) throw new Error('Missing STORAGE_S3_BUCKET');

  const client = buildS3Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );

  const body = out.Body as any;
  // Normalize stream to Node.js Readable
  const stream = body instanceof Readable ? body : Readable.from(body);

  return {
    stream,
    meta: {
      sizeBytes: out.ContentLength ?? undefined,
      mimeType: out.ContentType ?? undefined,
    },
  };
}

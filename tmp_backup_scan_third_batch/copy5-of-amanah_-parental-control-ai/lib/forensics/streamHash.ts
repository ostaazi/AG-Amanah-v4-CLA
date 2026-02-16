
import crypto from 'crypto';
import { Readable, PassThrough } from 'stream';
import { Buffer } from 'buffer';

/**
 * يقوم بنسخ التدفق (Tee) وحساب الهاش والحجم تزامناً مع القراءة
 */
export async function teeAndHashStream(input: Readable): Promise<{
  streamForArchive: Readable;
  sha256hexPromise: Promise<string>;
  sizeBytesPromise: Promise<number>;
}> {
  const hash = crypto.createHash('sha256');
  const pass = new PassThrough();

  let total = 0;

  const sha256hexPromise = new Promise<string>((resolve, reject) => {
    input.on('data', (chunk: Buffer) => {
      total += chunk.length;
      hash.update(chunk);
      pass.write(chunk);
    });

    input.on('end', () => {
      pass.end();
      resolve(hash.digest('hex'));
    });

    input.on('error', (err) => {
      pass.destroy(err);
      reject(err);
    });
  });

  // حجم الملف النهائي سيتم تحديده عند اكتمال التدفق
  const sizeBytesPromise = sha256hexPromise.then(() => total);

  return {
    streamForArchive: pass,
    sha256hexPromise,
    sizeBytesPromise,
  };
}

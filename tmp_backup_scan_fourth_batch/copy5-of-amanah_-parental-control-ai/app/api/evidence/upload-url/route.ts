
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, HttpError } from '../../../lib/auth';
import { createSignedUploadUrl } from '../../../lib/storage';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    // في بيئة المؤسسة، يتم التحقق من توكن الجهاز (x-device-token)
    const principal = getPrincipal(req);
    const body = await req.json().catch(() => ({}));

    const { evidence_type, mime_type, size_bytes } = body;

    if (!evidence_type || !mime_type || !size_bytes) {
      throw new HttpError(400, 'Missing evidence metadata');
    }

    // قيود الأمان: الحد الأقصى للأدلة 50 ميجا
    if (size_bytes > 50 * 1024 * 1024) {
      throw new HttpError(400, 'Evidence payload exceeds enterprise limits');
    }

    const bucket = process.env.S3_BUCKET_NAME || 'amanah-forensics';
    const nonce = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const key = `family/${principal.family_id}/evidence/${timestamp}_${nonce}.${mime_type.split('/')[1]}`;

    const upload_url = await createSignedUploadUrl({
      bucket,
      key,
      contentType: mime_type,
      expiresIn: 300, // صالح لمدة 5 دقائق فقط
    });

    return NextResponse.json({
      ok: true,
      upload_url,
      storage_key: key,
      expires_in_sec: 300
    });
  } catch (e: any) {
    return jsonError(e?.status ?? 500, e?.message ?? 'Internal Authorization Failure');
  }
}

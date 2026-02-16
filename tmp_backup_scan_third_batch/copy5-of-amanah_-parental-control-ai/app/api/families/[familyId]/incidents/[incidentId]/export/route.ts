import { NextRequest } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { getPrincipal, requireFamilyAccess, requireFatherRole, HttpError } from '../../../../../../lib/auth';
import archiver from 'archiver';
import { canonicalJson, signManifest } from '../../../../../../lib/forensics/crypto';
import { sha256HexBuffer } from '../../../../../../lib/forensics/hash';
import { getObjectStream } from '../../../../../../lib/storage/adapter';
import { teeAndHashStream } from '../../../../../../lib/forensics/streamHash';
import { consumeStepUpToken } from '../../../../../../lib/stepup/stepup';
import mime from 'mime-types';
import { Buffer } from 'buffer';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function env(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function jsonResponse(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isoSafeFilename(s: string) {
  return s.replace(/:/g, '-').replace(/\./g, '-');
}

export async function GET(req: NextRequest, { params }: { params: { familyId: string; incidentId: string } }) {
  try {
    const principal = getPrincipal(req);
    const familyId = params.familyId;
    const incidentId = params.incidentId;

    if (!requireFamilyAccess(principal, familyId)) throw new HttpError(403, 'Forbidden');
    requireFatherRole(principal, familyId);

    const stepupToken = req.headers.get('x-stepup-token') || '';
    if (!stepupToken) {
      throw new HttpError(401, 'Step-Up token required for forensic export');
    }

    await consumeStepUpToken({
      token: stepupToken,
      familyId,
      userId: principal.user_id!,
      requiredScope: 'export:evidence',
    });

    const privateKeyB64 = env('ED25519_PRIVATE_KEY_BASE64', '');
    if (!privateKeyB64) throw new HttpError(500, 'Missing ED25519_PRIVATE_KEY_BASE64');

    const incident = await prisma.incident.findUnique({
      where: { incident_id: incidentId },
    });

    if (!incident) throw new HttpError(404, 'Incident not found');
    if (incident.family_id !== familyId) throw new HttpError(403, 'Forbidden');

    const evidenceItems = await prisma.evidenceItem.findMany({
      where: {
        family_id: familyId,
        incident_id: incidentId,
        deleted_at: null,
      },
      orderBy: { captured_at: 'asc' },
      take: 2000,
    });

    const policy = await prisma.familyPolicy.findUnique({ where: { family_id: familyId } });
    const custody = await prisma.custodyEvent.findMany({
      where: { family_id: familyId, incident_id: incidentId },
      orderBy: { event_at: 'asc' },
      take: 8000,
    });

    const incidentJson = Buffer.from(JSON.stringify(incident, null, 2), 'utf-8');
    const policyJson = Buffer.from(JSON.stringify(policy || {}, null, 2), 'utf-8');
    const custodyJson = Buffer.from(JSON.stringify(custody || [], null, 2), 'utf-8');

    const incidentHash = sha256HexBuffer(incidentJson);
    const policyHash = sha256HexBuffer(policyJson);
    const custodyHash = sha256HexBuffer(custodyJson);

    const now = isoSafeFilename(new Date().toISOString());
    const zipName = `evidence_package_${familyId}_${incidentId}_${now}.zip`;

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Bridge to web stream
    const webStream = (Readable as any).toWeb(archive);

    (async () => {
      try {
        archive.append(incidentJson, { name: 'meta/incident.json' });
        archive.append(policyJson, { name: 'meta/family_policy_snapshot.json' });
        archive.append(custodyJson, { name: 'meta/custody_chain.json' });

        const readme = `Evidence Package (Forensic)
- Evidence files are located in /evidence
- manifest.json contains SHA-256 for each file
- manifest.sig is Ed25519 signature (Base64) over canonical manifest.json
This export was authorized via Step-Up verification.`;
        archive.append(readme, { name: 'README.txt' });

        const manifestFiles: any[] = [];
        for (let idx = 0; idx < evidenceItems.length; idx++) {
          const e: any = evidenceItems[idx];
          const ext = (mime.extension(e.mime_type || '') || 'bin').toString();
          const zipPath = `evidence/${String(idx + 1).padStart(4, '0')}_${String(e.evidence_type).replace(/[^a-z0-9]/gi, '_')}.${ext}`;

          try {
            const { stream } = await getObjectStream(e.storage_key);
            const { streamForArchive, sha256hexPromise } = await teeAndHashStream(stream);
            archive.append(streamForArchive, { name: zipPath, date: e.captured_at ? new Date(e.captured_at) : new Date() });
            const actualSha256 = (await sha256hexPromise).toLowerCase();
            manifestFiles.push({ path: zipPath, sha256_hex: actualSha256, size_bytes: Number(e.size_bytes || 0), mime_type: e.mime_type });
          } catch (err) {
            archive.append(`ERROR: Missing file ${e.storage_key}`, { name: `${zipPath}.error.txt` });
          }
        }

        const manifestObj = {
          schema_version: '1.0',
          generated_at: new Date().toISOString(),
          family_id: familyId,
          incident_id: incidentId,
          files: manifestFiles,
          meta: { incident_json_sha256_hex: incidentHash, policy_snapshot_sha256_hex: policyHash, custody_chain_sha256_hex: custodyHash },
        };

        const { manifestJson, signatureBase64 } = signManifest(manifestObj, privateKeyB64);
        archive.append(manifestJson, { name: 'manifest.json' });
        archive.append(Buffer.from(signatureBase64, 'utf-8'), { name: 'manifest.sig' });
        await archive.finalize();
      } catch (err) {
        archive.destroy(err as Error);
      }
    })();

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return jsonResponse(status, { error: { status, message: e?.message ?? 'Unexpected error' } });
  }
}

import { Worker } from 'bullmq';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { redisConnection } from '../lib/queue/bull';
import { signManifestJson } from '../lib/crypto/manifestSign';
import { Buffer } from 'buffer';

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeDateISO(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function extFromMime(mime: string) {
  const m = (mime || '').toLowerCase();
  if (m.includes('jpeg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('mpeg')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('json')) return 'json';
  if (m.includes('text')) return 'txt';
  return 'bin';
}

async function readLocalBuffer(storage_key: string) {
  /* Fix: Cast process to any for cwd() access */
  const baseDir = getEnv('STORAGE_LOCAL_DIR', path.join((process as any).cwd(), 'storage_local'));
  const abs = path.join(baseDir, storage_key);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return fs.readFileSync(abs);
}

async function buildCustodyPdf(familyId: string, rows: any[]) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const buffers: Buffer[] = [];

    doc.on('data', (d: any) => buffers.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    doc.fontSize(18).text('AMANA Evidence Custody Report', { align: 'left' });
    doc.moveDown(0.6);

    doc.fontSize(10).fillColor('#444').text(`Family ID: ${familyId}`);
    doc.text(`Generated at: ${new Date().toISOString()}`);
    doc.moveDown(1);

    doc.fillColor('#000').fontSize(12).text('Custody Events (Latest First)');
    doc.moveDown(0.5);

    rows.forEach((r, idx) => {
      doc.fontSize(10).fillColor('#000').text(`#${idx + 1}  ${r.event_key}`);
      doc.fillColor('#444').text(`Time: ${new Date(r.event_at).toISOString()}`);
      doc.text(`Actor: ${r.actor}`);
      if (r.incident_id) doc.text(`Incident: ${r.incident_id}`);
      doc.text(`Hash: ${r.hash_hex}`);
      if (r.prev_hash_hex) doc.text(`Prev: ${r.prev_hash_hex}`);
      doc.moveDown(0.6);
    });

    doc.end();
  });
}

async function writeZipFile(outPath: string, manifest: any, custodyPdf: Buffer, evidenceRows: any[]) {
  return new Promise<void>(async (resolve, reject) => {
    ensureDir(path.dirname(outPath));
    const output = fs.createWriteStream(outPath);
    const zip = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    zip.on('error', (err: any) => reject(err));

    zip.pipe(output);

    const signed = signManifestJson(manifest);

    const manifestWithSig = {
      ...manifest,
      signature: {
        alg: signed.alg,
        signatureBase64: signed.signatureBase64,
      },
    };

    zip.append(JSON.stringify(manifestWithSig, null, 2), { name: 'manifest.json' });
    zip.append(custodyPdf, { name: 'custody_report.pdf' });

    for (const e of evidenceRows) {
      try {
        const buf = await readLocalBuffer(e.object_uri || '');
        const ext = extFromMime(e.mime_type);
        const safeName = `evidence/${e.evidence_id}_${e.content_type}.${ext}`;
        zip.append(buf, { name: safeName });
      } catch (err) {
        zip.append(
          `Missing file: ${e.evidence_id} storage_key=${e.object_uri}\n`,
          { name: `errors/missing_${e.evidence_id}.txt` }
        );
      }
    }

    await zip.finalize();
  });
}

function buildDownloadUrl(jobId: string) {
  return `/api/jobs/evidence-package/${jobId}/download`;
}

new Worker(
  'evidence_package',
  async (job) => {
    const { familyId, filters, requestedByUserId } = job.data as any;

    await job.updateProgress(5);

    const type = (filters?.type || '').trim() || null;
    const device_id = (filters?.device_id || '').trim() || null;
    const incident_id = (filters?.incident_id || '').trim() || null;
    const from = safeDateISO(filters?.from || null);
    const to = safeDateISO(filters?.to || null);

    const where: any = {
      family_id: familyId,
      ...(type ? { content_type: type } : {}),
      ...(incident_id ? { incident_id } : {}),
      ...(device_id ? { device_id } : {}),
      ...(from || to
        ? {
            created_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const evidence = await prisma.evidence.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 1000,
    });

    await job.updateProgress(25);

    const custody = await prisma.custodyEvent.findMany({
      where: { family_id: familyId },
      orderBy: { event_at: 'desc' },
      take: 1000,
    });

    await job.updateProgress(40);

    const created_at = new Date();
    const last = await prisma.custodyEvent.findFirst({
      where: { family_id: familyId },
      orderBy: { event_at: 'desc' },
      select: { hash_hex: true },
    });

    const prev_hash_hex = last?.hash_hex ?? null;

    const pkg_json = {
      evidence_count: evidence.length,
      filters: { type, device_id, incident_id, from: from?.toISOString() || null, to: to?.toISOString() || null },
      requested_by_user_id: requestedByUserId || null,
      job_id: job.id,
    };

    const hash_payload = JSON.stringify({
      family_id: familyId,
      incident_id: null,
      actor: 'PARENT_CONSOLE',
      event_key: 'EVIDENCE_PACKAGE_GENERATED',
      event_at: created_at.toISOString(),
      prev_hash_hex,
      event_json: pkg_json,
    });

    const pkg_hash_hex = sha256Hex(hash_payload);

    await prisma.custodyEvent.create({
      data: {
        family_id: familyId,
        actor: 'PARENT_CONSOLE',
        event_key: 'EVIDENCE_PACKAGE_GENERATED',
        event_at: created_at,
        event_json: pkg_json,
        prev_hash_hex,
        hash_hex: pkg_hash_hex,
      },
    });

    await job.updateProgress(55);

    const manifest = {
      family_id: familyId,
      generated_at: created_at.toISOString(),
      package_hash_hex: pkg_hash_hex,
      filters: pkg_json.filters,
      evidence: evidence.map((e) => ({
        evidence_id: e.evidence_id,
        incident_id: e.incident_id,
        content_type: e.content_type,
        mime_type: e.mime_type,
        size_bytes: e.size_bytes,
        sha256: e.sha256,
        captured_at: e.created_at.toISOString(),
        object_uri: e.object_uri,
      })),
    };

    const custodyPdf = await buildCustodyPdf(familyId, custody);

    await job.updateProgress(70);

    /* Fix: Cast process to any for cwd() access */
    const packagesDir = getEnv('EVIDENCE_PACKAGES_DIR', path.join((process as any).cwd(), 'evidence_packages'));
    ensureDir(packagesDir);

    const fileKey = `${job.id}.zip`;
    const outPath = path.join(packagesDir, fileKey);

    await writeZipFile(outPath, manifest, custodyPdf, evidence);

    await job.updateProgress(95);

    return {
      fileKey,
      filename: `AMANA_EVIDENCE_PACKAGE_${familyId}_${Date.now()}.zip`,
      downloadUrl: buildDownloadUrl(String(job.id)),
      manifestSignature: 'embedded_in_manifest.json',
    };
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

console.log('Evidence Package Worker running...');

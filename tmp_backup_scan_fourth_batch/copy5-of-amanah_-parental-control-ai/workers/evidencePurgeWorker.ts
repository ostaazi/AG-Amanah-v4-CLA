
import { Worker } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { redisConnection } from '../lib/queue/bull';

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

async function deleteLocal(storage_key: string) {
  const baseDir = getEnv('STORAGE_LOCAL_DIR', path.join((process as any).cwd(), 'storage_local'));
  const abs = path.join(baseDir, storage_key);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

new Worker(
  'evidence_purge',
  async (job) => {
    const familyId = String(job.data?.familyId || '');
    if (!familyId) throw new Error('Missing familyId');

    // Load policy
    const policy = await prisma.familyPolicy.findUnique({ where: { family_id: familyId } });
    const retention_days = policy?.retention_days ?? 90;

    // Only purge items that are soft deleted AND not purged yet
    const candidates = await prisma.evidenceItem.findMany({
      where: {
        family_id: familyId,
        deleted_at: { not: null },
        purged_at: null,
      },
      orderBy: { deleted_at: 'asc' },
      take: 200,
      select: {
        evidence_id: true,
        incident_id: true,
        storage_key: true,
        captured_at: true,
        deleted_at: true,
      },
    });

    let purgedCount = 0;

    for (const e of candidates) {
      // Legal hold blocks purge
      const hold = await prisma.legalHold.findFirst({
        where: {
          family_id: familyId,
          released_at: null,
          OR: [{ incident_id: null }, { incident_id: e.incident_id }],
        },
        select: { hold_id: true },
      });
      if (hold) continue;

      // Must respect retention based on captured_at (stronger rule)
      const ageDays = daysBetween(new Date(), new Date(e.captured_at));
      if (ageDays < retention_days) continue;

      try {
        await deleteLocal(e.storage_key);

        await prisma.evidenceItem.update({
          where: { evidence_id: e.evidence_id },
          data: { purged_at: new Date() },
        });

        // Integrity log
        await prisma.custodyLog.create({
          data: {
            evidence_id: e.evidence_id,
            actor_user_id: undefined,
            action: 'RELEASE',
            reason: 'EVIDENCE_PERMANENTLY_PURGED',
          } as any,
        });

        purgedCount++;
      } catch (err) {
        // Log error and continue
        console.error(`Purge failed for ${e.evidence_id}:`, err);
      }
    }

    return { ok: true, purgedCount };
  },
  { connection: redisConnection, concurrency: 1 }
);

console.log('Evidence Purge Worker running...');

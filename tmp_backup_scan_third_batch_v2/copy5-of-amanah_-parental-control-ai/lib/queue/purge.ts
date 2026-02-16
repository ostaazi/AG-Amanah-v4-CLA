
import { Queue } from 'bullmq';
import { redisConnection } from '../queue/bull';

export const evidencePurgeQueue = new Queue('evidence_purge', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 2000 },
    removeOnFail: { age: 3600 * 6, count: 2000 },
  },
});

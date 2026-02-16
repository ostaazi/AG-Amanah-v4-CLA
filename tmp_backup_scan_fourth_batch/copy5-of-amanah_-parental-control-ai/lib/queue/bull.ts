
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

function getEnv(name: string, fallback = '') {
  return process.env[name] || fallback;
}

export const redisConnection = new IORedis(getEnv('QUEUE_REDIS_URL', 'redis://localhost:6379'), {
  maxRetriesPerRequest: null,
});

export const evidencePackageQueue = new Queue('evidence_package', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 2000 }, // keep 1h
    removeOnFail: { age: 3600 * 6, count: 2000 },
  },
});

export const evidencePackageQueueEvents = new QueueEvents('evidence_package', {
  connection: redisConnection,
});

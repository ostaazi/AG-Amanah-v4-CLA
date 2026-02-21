import { PrismaClient } from '@prisma/client';
export const prisma = 
// Fix: Use globalThis instead of the Node.js-specific 'global' to fix the 'Cannot find name global' error and ensure compatibility across environments.
globalThis.__prisma__ ||
    new PrismaClient({
        log: ['error', 'warn'],
    });
// Fix: Use globalThis instead of the Node.js-specific 'global' to fix the 'Cannot find name global' error.
if (process.env.NODE_ENV !== 'production')
    globalThis.__prisma__ = prisma;

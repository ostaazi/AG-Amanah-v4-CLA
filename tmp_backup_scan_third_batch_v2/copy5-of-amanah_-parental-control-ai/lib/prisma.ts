
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma__: PrismaClient | undefined;
}

// Fix: Use globalThis instead of global to handle non-Node.js environments correctly
export const prisma =
  (globalThis as any).__prisma__ ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

// Fix: Use globalThis instead of global to fix the 'Cannot find name global' error
if (process.env.NODE_ENV !== 'production') (globalThis as any).__prisma__ = prisma;

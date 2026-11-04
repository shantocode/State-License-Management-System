import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient();
// Reuse the pool across server bundles in the same warm Node.js process too.
globalDb.prisma = db;

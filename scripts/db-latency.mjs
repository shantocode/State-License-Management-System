// Read-only: run from the application host to measure its database path.
// node --env-file=.env scripts/db-latency.mjs
import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";

const db = new PrismaClient();
const samples = [];
try {
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    await db.$queryRaw`SELECT 1`;
    const ms = Math.round(performance.now() - start);
    samples.push(ms);
    console.log(`${i === 0 ? "Cold connection + query" : "Warm SELECT 1"}: ${ms} ms`);
  }
  const warm = samples.slice(1).sort((a, b) => a - b);
  console.log(`Warm median: ${warm[2]} ms; region: ${process.env.VERCEL_REGION || "local/unknown"}`);
} catch (error) {
  // Do not print connection strings or database errors containing credentials.
  console.error(`Database diagnostic failed (${error.code || error.name}).`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

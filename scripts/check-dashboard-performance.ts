// Read-only comparison against the configured database; never prints user data.
// node --env-file=.env --import tsx scripts/check-dashboard-performance.ts
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { applicationSummary, monthlyRevenue } from "../src/lib/dashboard";

async function main() {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  for (const code of ["ADMIN", "LAWYER", "REVIEWER"] as const) {
    const user = await db.user.findFirst({ where: { role: { code } }, select: { id: true } });
    if (!user) { console.log(`${code}: no account to compare`); continue; }
    const scope = code === "LAWYER" ? { lawyerId: user.id } : {};
    const reviewedScope = code === "REVIEWER" ? { reviewerId: user.id } : {};
    const oldTimes: number[] = [], newTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const [total, pending, approved, rejected, reviewed]: number[] = await Promise.all([
        db.licenseApplication.count({ where: scope }),
        db.licenseApplication.count({ where: { ...scope, status: "PENDING" } }),
        db.licenseApplication.count({ where: { ...scope, ...reviewedScope, status: "APPROVED" } }),
        db.licenseApplication.count({ where: { ...scope, ...reviewedScope, status: "REJECTED" } }),
        db.licenseApplication.count({ where: { reviewerId: user.id } }),
      ]);
      oldTimes.push(performance.now() - start);
      const next = performance.now();
      const result = await applicationSummary(code, user.id);
      newTimes.push(performance.now() - next);
      assert.equal(result.pending, pending);
      assert.equal(result.approved, approved);
      assert.equal(result.rejected, rejected);
      if (code === "REVIEWER") assert.equal(result.reviewed, reviewed);
      else assert.equal(result.total, total);
    }
    const original = code === "ADMIN"
      ? await db.revenueDistribution.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, totalCents: true } })
      : await db.earnings.findMany({ where: { userId: user.id, createdAt: { gte: since } }, select: { createdAt: true, amountCents: true } });
    const buckets = new Map<string, number>();
    for (const row of original) {
      const key = row.createdAt.toISOString().slice(0, 7);
      buckets.set(key, (buckets.get(key) || 0) + ("totalCents" in row ? row.totalCents : row.amountCents));
    }
    const optimized = await monthlyRevenue(since, code === "ADMIN" ? null : user.id);
    assert.deepEqual(new Map(optimized.map((r) => [r.month, r.cents])), buckets);
    const median = (values: number[]) => Math.round(values.sort((a, b) => a - b)[1]);
    console.log(`${code}: results match; count-query median ${median(oldTimes)} -> ${median(newTimes)} ms; payment rows transferred ${original.length} -> ${optimized.length}`);
  }
}
main().catch((error) => {
  console.error(`Dashboard comparison failed (${error.code || error.name}).`);
  process.exitCode = 1;
}).finally(() => db.$disconnect());

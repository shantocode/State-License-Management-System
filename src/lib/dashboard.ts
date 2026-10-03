import { Prisma } from "@prisma/client";
import { db } from "./db";
import type { RoleCode } from "./policy";

export async function applicationSummary(role: RoleCode, userId: string) {
  const reviewer = role !== "ADMIN" && role !== "LAWYER";
  const [counts, pendingQueue] = await Promise.all([
    db.licenseApplication.groupBy({
      by: ["status"],
      where: role === "LAWYER" ? { lawyerId: userId } : reviewer ? { reviewerId: userId } : {},
      _count: { _all: true },
    }),
    reviewer ? db.licenseApplication.count({ where: { status: "PENDING" } }) : 0,
  ]);
  const count = (status: string) => counts.find((row) => row.status === status)?._count._all || 0;
  const total = counts.reduce((sum, row) => sum + row._count._all, 0);
  return {
    total,
    pending: reviewer ? pendingQueue : count("PENDING"),
    approved: count("APPROVED"),
    rejected: count("REJECTED"),
    reviewed: reviewer ? total : 0,
  };
}

// Aggregate on the database: return monthly buckets, not every payment.
export async function monthlyRevenue(since: Date, userId: string | null) {
  const rows = await db.$queryRaw<{ month: string; cents: Prisma.Decimal }[]>(
    userId === null
      ? Prisma.sql`SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, SUM(totalCents) AS cents
          FROM RevenueDistribution WHERE createdAt >= ${since} GROUP BY month`
      : Prisma.sql`SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, SUM(amountCents) AS cents
          FROM Earnings WHERE userId = ${userId} AND createdAt >= ${since} GROUP BY month`,
  );
  return rows.map((row) => ({ month: row.month, cents: Number(row.cents) }));
}

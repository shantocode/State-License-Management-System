import { db } from "./db";
import { date, effectiveStatus, money } from "./policy";
export const reportTypes = [
  "revenue",
  "active",
  "expired",
  "lawyers",
  "reviewers",
] as const;
export type ReportType = (typeof reportTypes)[number];
export function reportPeriod(from: string | null, to: string | null) {
  const start = from ? new Date(`${from}T00:00:00Z`) : undefined,
    end = to ? new Date(`${to}T00:00:00Z`) : undefined;
  if (
    (start && isNaN(start.getTime())) ||
    (end && isNaN(end.getTime())) ||
    (start && end && start > end)
  )
    throw new Error("Select a valid date range.");
  if (end) end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}
export async function reportData(
  type: ReportType,
  from: string | null,
  to: string | null,
) {
  const period = reportPeriod(from, to),
    limit = 10000,
    now = new Date();
  if (type === "revenue") {
    const rows = await db.revenueDistribution.findMany({
      where: { createdAt: period },
      include: {
        application: {
          include: {
            lawyer: { select: { name: true } },
            reviewer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    if (rows.length > limit)
      throw new Error("More than 10,000 records. Narrow the date range.");
    return {
      title: "Revenue report",
      headers: [
        "Date",
        "Application",
        "Type",
        "Lawyer",
        "Reviewer",
        "Total ($)",
        "Lawyer ($)",
        "Reviewer ($)",
        "Government ($)",
      ],
      rows: rows.map((r) => [
        date(r.createdAt),
        r.application.reference,
        r.application.typeName,
        r.application.lawyer.name,
        r.application.reviewer?.name || "",
        r.totalCents / 100,
        r.lawyerCents / 100,
        r.reviewerCents / 100,
        r.governmentCents / 100,
      ]),
    };
  }
  if (type === "active" || type === "expired") {
    const rows = await db.license.findMany({
      where: {
        issuedAt: period,
        ...(type === "active"
          ? { status: "ACTIVE" as const, expiresAt: { gt: now } }
          : {
              OR: [
                { status: "EXPIRED" as const },
                { status: "ACTIVE" as const, expiresAt: { lte: now } },
              ],
            }),
      },
      include: {
        application: {
          include: {
            lawyer: { select: { name: true } },
            reviewer: { select: { name: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      take: limit + 1,
    });
    if (rows.length > limit)
      throw new Error("More than 10,000 records. Narrow the date range.");
    return {
      title: `${type === "active" ? "Active" : "Expired"} license report`,
      headers: [
        "License",
        "Citizen",
        "CID",
        "Type",
        "Issued",
        "Expires",
        "Status",
        "Lawyer",
        "Reviewer",
      ],
      rows: rows.map((l) => [
        l.number,
        l.citizenName,
        l.cid,
        l.application.typeName,
        date(l.issuedAt),
        date(l.expiresAt),
        effectiveStatus(l.status, l.expiresAt),
        l.application.lawyer.name,
        l.application.reviewer?.name || "",
      ]),
    };
  }
  const apps = await db.licenseApplication.findMany({
    where:
      type === "lawyers"
        ? { createdAt: period }
        : { reviewedAt: period, reviewerId: { not: null } },
    select: {
      lawyerId: true,
      reviewerId: true,
      status: true,
      lawyer: { select: { name: true } },
      reviewer: { select: { name: true } },
      revenue: { select: { lawyerCents: true, reviewerCents: true } },
    },
    take: limit + 1,
  });
  if (apps.length > limit)
    throw new Error("More than 10,000 applications. Narrow the date range.");
  const people = new Map<
    string,
    {
      name: string;
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      earned: number;
    }
  >();
  for (const a of apps) {
    const id = type === "lawyers" ? a.lawyerId : a.reviewerId;
    if (!id) continue;
    const v = people.get(id) || {
      name: type === "lawyers" ? a.lawyer.name : a.reviewer!.name,
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      earned: 0,
    };
    v.total++;
    if (a.status === "APPROVED") v.approved++;
    if (a.status === "REJECTED") v.rejected++;
    if (a.status === "PENDING") v.pending++;
    v.earned +=
      type === "lawyers"
        ? a.revenue?.lawyerCents || 0
        : a.revenue?.reviewerCents || 0;
    people.set(id, v);
  }
  return {
    title: `${type === "lawyers" ? "Lawyer" : "Reviewer"} performance report`,
    headers: [
      "Name",
      "Applications",
      "Approved",
      "Rejected",
      "Pending",
      "Earnings ($)",
    ],
    rows: [...people.values()]
      .sort((a, b) => b.total - a.total)
      .map((p) => [
        p.name,
        p.total,
        p.approved,
        p.rejected,
        p.pending,
        p.earned / 100,
      ]),
  };
}

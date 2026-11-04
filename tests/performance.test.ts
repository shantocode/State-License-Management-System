import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { applicationSummary, monthlyRevenue } from "../src/lib/dashboard";

test("dashboard preserves role scopes, empty counts, and reviewer queue with fewer queries", async () => {
  const originalGroup = db.licenseApplication.groupBy, originalCount = db.licenseApplication.count;
  const group = mock.fn(async (..._args: unknown[]) => [
    { status: "APPROVED", _count: { _all: 4 } },
    { status: "REJECTED", _count: { _all: 2 } },
  ]);
  const pending = mock.fn(async (..._args: unknown[]) => 9);
  db.licenseApplication.groupBy = group as unknown as typeof originalGroup;
  db.licenseApplication.count = pending as typeof originalCount;
  try {
    for (const role of ["ADMIN", "LAWYER", "REVIEWER", "STATE_EMPLOYEE", "STATE_ASSISTANT"] as const) {
      const reviewer = role !== "ADMIN" && role !== "LAWYER";
      assert.deepEqual(await applicationSummary(role, "actor"), {
        total: 6, approved: 4, rejected: 2,
        pending: reviewer ? 9 : 0, reviewed: reviewer ? 6 : 0,
      });
      assert.deepEqual(group.mock.calls.at(-1)?.arguments, [{
        by: ["status"], _count: { _all: true },
        where: role === "LAWYER" ? { lawyerId: "actor" } : reviewer ? { reviewerId: "actor" } : {},
      }]);
    }
    assert.equal(group.mock.callCount(), 5);
    assert.equal(pending.mock.callCount(), 3);
    assert.deepEqual(pending.mock.calls[0].arguments, [{ where: { status: "PENDING" } }]);
    group.mock.mockImplementation(async () => []);
    assert.deepEqual(await applicationSummary("LAWYER", "actor"), {
      total: 0, approved: 0, rejected: 0, pending: 0, reviewed: 0,
    });
  } finally { db.licenseApplication.groupBy = originalGroup; db.licenseApplication.count = originalCount; }
});

test("monthly totals retain cents and bind user IDs and dates as SQL parameters", async () => {
  const originalQuery = db.$queryRaw;
  const query = mock.fn(async (..._args: unknown[]) => [
    { month: "2026-10", cents: new Prisma.Decimal("123456789") },
  ]);
  db.$queryRaw = query as typeof originalQuery;
  try {
    const since = new Date("2026-05-01T00:00:00Z");
    const id = "id' OR 1=1 --";
    assert.deepEqual(await monthlyRevenue(since, id), [{ month: "2026-10", cents: 123456789 }]);
    const personal = query.mock.calls[0].arguments[0] as Prisma.Sql;
    assert.deepEqual(personal.values, [id, since]);
    assert.match(personal.sql, /FROM Earnings WHERE userId = \?/);
    assert.ok(!personal.sql.includes(id));
    await monthlyRevenue(since, null);
    const all = query.mock.calls[1].arguments[0] as Prisma.Sql;
    assert.deepEqual(all.values, [since]);
    assert.match(all.sql, /FROM RevenueDistribution/);
    query.mock.mockImplementation(async () => []);
    assert.deepEqual(await monthlyRevenue(since, id), []);
  } finally { db.$queryRaw = originalQuery; }
});


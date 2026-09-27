import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { reviewApplication, expireLicenses } from "../../src/lib/service";
import { applicationWhere } from "../../src/lib/queries";
import { reportData } from "../../src/lib/report-data";
// Runs only against an explicitly named disposable database; never a live SLMS database.
test("transactional approval, RBAC, renewal, expiration, and reports", async () => {
  const url = new URL(process.env.DATABASE_URL || "mysql://localhost/missing");
  assert.match(
    url.pathname,
    /\/slms_test(?:_[a-z0-9]+)?$/,
    "Use a dedicated slms_test database.",
  );
  const prefix = randomUUID().slice(0, 8);
  try {
    for (const code of ["ADMIN", "LAWYER", "REVIEWER"] as const)
      await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const role = await db.role.findUniqueOrThrow({ where: { code: "LAWYER" } }),
      reviewRole = await db.role.findUniqueOrThrow({
        where: { code: "REVIEWER" },
      });
    const lawyer = await db.user.create({
      data: {
        username: `lawyer_${prefix}`,
        name: "Test Lawyer",
        passwordHash: "not-a-login",
        roleId: role.id,
      },
      include: { role: true },
    });
    const reviewer = await db.user.create({
      data: {
        username: `reviewer_${prefix}`,
        name: "Test Reviewer",
        passwordHash: "not-a-login",
        roleId: reviewRole.id,
      },
      include: { role: true },
    });
    const type = await db.licenseType.create({
      data: {
        name: `Test License ${prefix}`,
        description: "Integration test",
        price90Cents: 5000000,
        price180Cents: 5000000,
        price365Cents: 5000000,
      },
    });
    await db.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: { lawyerBps: 5000, reviewerBps: 3000, governmentBps: 2000 },
    });
    const create = (extra: Record<string, unknown> = {}) =>
      db.licenseApplication.create({
        data: {
          reference: `TEST-${randomUUID().slice(0, 30)}`,
          citizenName: "Test Citizen",
          cid: prefix,
          phone: "12345",
          licenseTypeId: type.id,
          typeName: type.name,
          priceCents: type.price90Cents,
          paymentCents: type.price90Cents,
          citizenIdUrl: "https://example.com/id.jpg",
          requestedDays: 90,
          notes: "",
          lawyerId: lawyer.id,
          ...extra,
        },
      });
    const app = await create();
    await assert.rejects(
      reviewApplication(lawyer, app.id, "approve", 90, "", "RECEIVED", "test"),
      /authorized reviewers/,
    );
    await assert.rejects(
      reviewApplication(reviewer, app.id, "approve", 90, "", "NOT_RECEIVED", "test"),
      /Verify payment/,
    );
    assert.equal(
      (await db.licenseApplication.findUniqueOrThrow({ where: { id: app.id } }))
        .status,
      "PENDING",
    );
    const decisions = await Promise.allSettled([
      reviewApplication(reviewer, app.id, "approve", 90, "", "RECEIVED", "test"),
      reviewApplication(reviewer, app.id, "approve", 90, "", "RECEIVED", "test"),
    ]);
    assert.equal(decisions.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      await db.license.count({ where: { applicationId: app.id } }),
      1,
    );
    const revenue = await db.revenueDistribution.findUniqueOrThrow({
      where: { applicationId: app.id },
      include: { earnings: true },
    });
    assert.equal(revenue.lawyerCents, 2500000);
    assert.equal(revenue.reviewerCents, 1500000);
    assert.equal(revenue.governmentCents, 1000000);
    assert.equal(revenue.earnings.length, 2);
    assert.equal(
      await db.licenseApplication.count({
        where: applicationWhere("LAWYER", "unrelated", prefix),
      }),
      0,
    );
    const license = await db.license.findUniqueOrThrow({
        where: { applicationId: app.id },
      }),
      renewal = await create({ renewalOfId: license.id });
    await reviewApplication(
      reviewer,
      renewal.id,
      "approve",
      180,
      "",
      "RECEIVED",
      "test",
    );
    const next = await db.license.findUniqueOrThrow({
        where: { applicationId: renewal.id },
      }),
      old = await db.license.findUniqueOrThrow({ where: { id: license.id } });
    assert.equal(old.expiresAt.getTime(), license.expiresAt.getTime());
    assert.ok(old.supersededAt);
    assert.equal(
      next.expiresAt.getTime(),
      license.expiresAt.getTime() + 180 * 86400000,
    );
    const reject = await create();
    await reviewApplication(
      reviewer,
      reject.id,
      "reject",
      0,
      "Invalid proof",
      "NOT_RECEIVED",
      "test",
    );
    assert.equal(
      await db.revenueDistribution.count({
        where: { applicationId: reject.id },
      }),
      0,
    );
    await db.license.update({
      where: { id: next.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expireLicenses();
    assert.equal(
      (await db.license.findUniqueOrThrow({ where: { id: next.id } })).status,
      "EXPIRED",
    );
    const notices = await db.notification.count({
      where: { userId: lawyer.id },
    });
    await expireLicenses();
    assert.equal(
      await db.notification.count({ where: { userId: lawyer.id } }),
      notices,
    );
    const report = await reportData("revenue", null, null);
    assert.ok(report.rows.some((r) => r.includes(app.reference)));
  } finally {
    await db.$disconnect();
  }
});

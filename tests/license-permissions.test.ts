import { test } from "node:test";
import assert from "node:assert/strict";
import { applicationTerms, canRevoke, canReview, canReadApplication, date, effectiveStatus, drivingSplit, distribute } from "../src/lib/policy";
import { applicationWhere, licenseWhere } from "../src/lib/queries";
import { reviewApplication } from "../src/lib/service";
import { db } from "../src/lib/db";

test("revocation boundaries apply to all roles and exact expiry instant", () => {
  const now = new Date("2026-10-12T00:00:00Z"), future = new Date(now.getTime() + 1);
  for (const role of ["STATE_ASSISTANT", "STATE_EMPLOYEE", "REVIEWER"] as const) {
    assert.equal(canRevoke(role, "ACTIVE", now, now), true);
    assert.equal(canRevoke(role, "EXPIRED", future, now), true);
    assert.equal(canRevoke(role, "ACTIVE", future, now), false);
    assert.equal(canRevoke(role, "ACTIVE", null, now), false);
    assert.equal(canRevoke(role, "REVOKED", now, now), false);
  }
  assert.equal(canRevoke("ADMIN", "ACTIVE", null, now), true);
  assert.equal(canRevoke("ADMIN", "ACTIVE", future, now), true);
  for (const role of ["LAWYER", "DRIVING_INSTRUCTOR"] as const) {
    assert.equal(canRevoke(role, "EXPIRED", now, now), false);
    assert.equal(canReview(role), false);
    assert.equal(canReadApplication(role, "me", "other"), false);
  }
});
test("driving submission fixes price and lifetime, rejects other role/type combinations", () => {
  assert.deepEqual(applicationTerms("DRIVING_INSTRUCTOR", true, 365), { days: 0, priceCents: 300000 });
  assert.throws(() => applicationTerms("DRIVING_INSTRUCTOR", false, 60));
  assert.throws(() => applicationTerms("LAWYER", true, 0));
  assert.throws(() => applicationTerms("LAWYER", false, 0));
  assert.deepEqual(applicationTerms("LAWYER", false, 60), { days: 60, priceCents: null });
  assert.deepEqual(distribute(300000, drivingSplit.lawyerBps, drivingSplit.reviewerBps, drivingSplit.governmentBps), { lawyerCents: 210000, reviewerCents: 0, governmentCents: 90000 });
  assert.equal(date(null), "No expiry");
  assert.equal(effectiveStatus("ACTIVE", null), "ACTIVE");
  assert.equal(effectiveStatus("REVOKED", null), "REVOKED");
});
test("registry visibility differs from private application visibility", () => {
  assert.equal(applicationWhere("DRIVING_INSTRUCTOR", "me").lawyerId, "me");
  assert.deepEqual(licenseWhere("LAWYER", "me").application, {});
  const instructor = licenseWhere("DRIVING_INSTRUCTOR", "me", "", "", "forged-type");
  assert.deepEqual(instructor.application, { licenseType: { isDriving: true }, licenseTypeId: "forged-type" });
  assert.equal(instructor.deletedAt, null);
  const active = licenseWhere("ADMIN", "me", "", "ACTIVE");
  assert.deepEqual(active.OR?.[0], { expiresAt: null });
  assert.ok(active.OR?.[1]);
});

test("approval service issues lifetime driving licenses and records fixed allocations", async () => {
  const original = db.$transaction;
  let license: any, revenue: any;
  const app = { id: "app", reference: "APP-TEST", status: "PENDING", lawyerId: "instructor", requestedDays: 0, priceCents: 300000, paymentCents: 300000, citizenName: "Citizen", cid: "CID", licenseType: { isDriving: true }, renewalOf: null };
  const tx = {
    licenseApplication: { findUniqueOrThrow: async () => app, updateMany: async () => ({ count: 1 }) },
    license: { create: async ({ data }: any) => { license = data; } },
    revenueDistribution: { create: async ({ data }: any) => { revenue = data; } },
    notification: { create: async () => ({}) }, auditLog: { create: async () => ({}) },
    systemSettings: { findUniqueOrThrow: async () => {
      assert.equal(app.licenseType.isDriving, false, "Driving terms must ignore global settings");
      return { lawyerBps: 5000, reviewerBps: 3000, governmentBps: 2000 };
    } },
  };
  (db as any).$transaction = async (fn: any) => fn(tx);
  try {
    const actor = { id: "reviewer", name: "Reviewer", role: { code: "REVIEWER" as const } };
    await assert.rejects(reviewApplication(actor, "app", "approve", 60, "", "RECEIVED", "test"), /requested duration/);
    await reviewApplication(actor, "app", "approve", 0, "", "RECEIVED", "test");
    assert.equal(license.expiresAt, null);
    assert.equal(revenue.totalCents, 300000);
    assert.equal(revenue.lawyerCents, 210000);
    assert.equal(revenue.governmentCents, 90000);
    assert.equal(revenue.reviewerCents, 0);
    assert.equal(revenue.earnings.create[0].userId, "instructor");
    app.licenseType.isDriving = false; app.requestedDays = 60;
    await reviewApplication(actor, "app", "approve", 60, "", "RECEIVED", "test");
    assert.equal(license.expiresAt.getTime() - license.issuedAt.getTime(), 60 * 86400000);
    assert.equal(revenue.lawyerBps, 5000);
  } finally { db.$transaction = original; }
});

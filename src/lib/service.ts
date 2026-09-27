import { Prisma, type User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  distribute,
  expiration,
  canReview,
  paymentStatuses,
  type RoleCode,
} from "./policy";
type Actor = Pick<User, "id" | "name"> & { role: { code: RoleCode } };
export const reference = (prefix: string) =>
  `${prefix}-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
export function audit(
  tx: Prisma.TransactionClient,
  actor: Pick<User, "id" | "name"> | null,
  action: string,
  entityId: string | null,
  ipAddress: string,
  details?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: {
      userId: actor?.id,
      actorName: actor?.name ?? "System",
      action,
      entityId,
      ipAddress,
      details,
    },
  });
}
// Serializable transactions and a conditional status claim prevent duplicate license and payout creation.
export async function reviewApplication(
  actor: Actor,
  id: string,
  decision: string,
  days: number,
  reason: string,
  paymentStatus: string,
  ip: string,
) {
  if (!canReview(actor.role.code))
    throw new Error("Only authorized reviewers can decide applications.");
  if (!["approve", "reject"].includes(decision))
    throw new Error("Invalid review decision.");
  if (
    decision === "reject" &&
    (reason.trim().length < 3 || reason.length > 1000)
  )
    throw new Error("Provide a rejection reason (3–1,000 characters).");
  if (
    decision === "approve" &&
    !(paymentStatuses as readonly string[]).includes(paymentStatus)
  )
    throw new Error("Select a payment status.");
  return db.$transaction(
    async (tx) => {
      const app = await tx.licenseApplication.findUniqueOrThrow({
        where: { id },
        include: { renewalOf: true },
      });
      if (app.status !== "PENDING")
        throw new Error("This application has already been reviewed.");
      if (app.lawyerId === actor.id)
        throw new Error("You cannot review your own application.");
      const now = new Date();
      const claimed = await tx.licenseApplication.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: decision === "approve" ? "APPROVED" : "REJECTED",
          reviewerId: actor.id,
          reviewedAt: now,
          rejectionReason: decision === "reject" ? reason : null,
          paymentStatus:
            decision === "approve"
              ? (paymentStatus as "RECEIVED" | "NOT_RECEIVED" | "WAIVED")
              : "NOT_RECEIVED",
          durationDays: decision === "approve" ? days : null,
        },
      });
      if (claimed.count !== 1)
        throw new Error("Another reviewer already decided this application.");
      if (decision === "approve") {
        if (paymentStatus === "NOT_RECEIVED")
          throw new Error(
            "Payment has not been received. Mark it Received or Waived before approving.",
          );
        if (
          paymentStatus === "RECEIVED" &&
          app.paymentCents !== app.priceCents
        )
          throw new Error(
            "Verify payment. Payment amount must exactly match the license price.",
          );
        if (app.renewalOf?.status === "REVOKED" || app.renewalOf?.supersededAt)
          throw new Error("A revoked or superseded license cannot be renewed.");
        const settings = await tx.systemSettings.findUniqueOrThrow({
          where: { id: 1 },
        });
        const split = distribute(
          app.priceCents,
          settings.lawyerBps,
          settings.reviewerBps,
          settings.governmentBps,
        );
        const start =
          app.renewalOf && app.renewalOf.expiresAt > now
            ? app.renewalOf.expiresAt
            : now;
        await tx.license.create({
          data: {
            number: reference("LIC"),
            applicationId: id,
            citizenName: app.citizenName,
            cid: app.cid,
            issuedAt: now,
            expiresAt: expiration(days, start),
          },
        });
        if (app.renewalOf)
          await tx.license.update({
            where: { id: app.renewalOf.id },
            data: { status: "EXPIRED", supersededAt: now },
          });
        await tx.revenueDistribution.create({
          data: {
            applicationId: id,
            totalCents: app.priceCents,
            lawyerBps: settings.lawyerBps,
            reviewerBps: settings.reviewerBps,
            governmentBps: settings.governmentBps,
            ...split,
            earnings: {
              create: [
                {
                  userId: app.lawyerId,
                  kind: "LAWYER",
                  amountCents: split.lawyerCents,
                },
                {
                  userId: actor.id,
                  kind: "REVIEWER",
                  amountCents: split.reviewerCents,
                },
              ],
            },
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: app.lawyerId,
          message: `${app.reference} was ${decision === "approve" ? "approved" : "rejected"}.`,
          href: `/applications/${id}`,
        },
      });
      await audit(
        tx,
        actor,
        decision === "approve"
          ? "APPLICATION_APPROVED"
          : "APPLICATION_REJECTED",
        id,
        ip,
        {
          reason:
            decision === "reject"
              ? reason
              : `Payment status: ${paymentStatus}`,
          durationDays: decision === "approve" ? days : 0,
        },
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function expireLicenses() {
  const now = new Date(),
    soon = new Date(Date.now() + 7 * 86400000);
  return db.$transaction(
    async (tx) => {
      const licenses = await tx.license.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { expiresAt: { lte: now }, expiredNotifiedAt: null },
            { expiresAt: { gt: now, lte: soon }, expiringNotifiedAt: null },
          ],
        },
        include: { application: true },
        take: 500,
      });
      let expired = 0,
        notified = 0;
      for (const license of licenses) {
        const isExpired = license.expiresAt <= now;
        const changed = await tx.license.updateMany({
          where: {
            id: license.id,
            status: "ACTIVE",
            ...(isExpired
              ? { expiredNotifiedAt: null }
              : { expiringNotifiedAt: null }),
          },
          data: isExpired
            ? { status: "EXPIRED", expiredNotifiedAt: now }
            : { expiringNotifiedAt: now },
        });
        if (!changed.count) continue;
        await tx.notification.create({
          data: {
            userId: license.application.lawyerId,
            message: `${license.number} ${isExpired ? "has expired" : "expires within 7 days"}.`,
            href: `/licenses/${license.id}`,
          },
        });
        await audit(
          tx,
          null,
          isExpired ? "LICENSE_EXPIRED" : "LICENSE_EXPIRING",
          license.id,
          "scheduled",
        );
        if (isExpired) expired++;
        else notified++;
      }
      await tx.session.deleteMany({ where: { expiresAt: { lt: now } } });
      await tx.loginAttempt.deleteMany({ where: { resetAt: { lt: now } } });
      return { expired, notified, batchSize: licenses.length };
    },
    { timeout: 20000 },
  );
}

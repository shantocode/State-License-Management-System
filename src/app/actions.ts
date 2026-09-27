"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  currentUser,
  requireUser,
  ipAddress,
  newSession,
  cookieName,
} from "@/lib/auth";
import { hashPassword, verifyPassword, digest } from "@/lib/password";
import {
  citizenSchema,
  userSchema,
  passwordSchema,
  object,
  licenseTypeIds,
  requestedDaysByType,
} from "@/lib/validation";
import { audit, reference, reviewApplication, reviewGroupApplications } from "@/lib/service";
import { cents, distribute, reviewers, priceForDays } from "@/lib/policy";
export type ActionResult = { error?: string; success?: string };
function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0].message;
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return error.code === "P2002"
      ? "That record already exists."
      : error.code === "P2034"
        ? "The record changed during your request. Please retry."
        : "The request could not be completed. Please refresh and retry.";
  if (
    error instanceof Error &&
    !error.message.includes("prisma") &&
    !error.message.includes("database")
  )
    return error.message;
  return "The service is unavailable. Please try again later.";
}
export async function login(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const username = String(form.get("username") || "")
      .toLowerCase()
      .trim(),
    password = String(form.get("password") || "");
  if (!/^[a-z0-9._-]{3,60}$/.test(username) || password.length > 128)
    return { error: "Invalid username or password." };
  try {
    const ip = await ipAddress(),
      key = digest(`login:${username}`),
      now = new Date();
    const attempt = await db.$transaction(async (tx) => {
      await tx.loginAttempt.deleteMany({
        where: { key, resetAt: { lte: now } },
      });
      return tx.loginAttempt.upsert({
        where: { key },
        create: {
          key,
          attempts: 1,
          resetAt: new Date(Date.now() + 15 * 60000),
        },
        update: { attempts: { increment: 1 } },
      });
    });
    if (attempt.attempts > 10)
      return { error: "Too many attempts. Please wait 15 minutes." };
    const user = await db.user.findUnique({ where: { username } });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ||
        "scrypt:00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!user || !valid || !user.enabled || user.deletedAt) {
      await audit(db, null, "LOGIN_FAILED", null, ip);
      return { error: "Invalid username or password." };
    }
    await db.loginAttempt.deleteMany({ where: { key } });
    await newSession(user.id);
    await audit(db, user, "LOGIN", user.id, ip);
  } catch {
    return {
      error: "Unable to sign in. Check the database connection and try again.",
    };
  }
  redirect("/dashboard");
}
export async function logout() {
  const user = await currentUser(),
    jar = await cookies(),
    token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  if (user) await audit(db, user, "LOGOUT", user.id, await ipAddress());
  jar.delete(cookieName);
  redirect("/login");
}
export async function changePassword(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser(undefined, true);
  try {
    const password = passwordSchema.parse(form.get("password"));
    if (password !== form.get("confirm"))
      return { error: "New passwords do not match." };
    if (
      !(await verifyPassword(
        String(form.get("current") || ""),
        user.passwordHash,
      ))
    )
      return { error: "Current password is incorrect." };
    if (await verifyPassword(password, user.passwordHash))
      return { error: "Choose a different password." };
    const hash = await hashPassword(password),
      ip = await ipAddress();
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: hash, mustChangePassword: false },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await audit(tx, user, "PASSWORD_CHANGED", user.id, ip);
    });
    await newSession(user.id);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect("/dashboard");
}
export async function submitApplication(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser(["LAWYER"]);
  let ids: string[] = [];
  let groupId: string | null = null;
  try {
    const data = citizenSchema.parse(object(form)),
      typeIds = licenseTypeIds(form),
      daysByType = requestedDaysByType(form, typeIds),
      ip = await ipAddress();
    const renewalId = String(form.get("renewalOfId") || "");
    if (renewalId && typeIds.length > 1)
      throw new Error("A renewal can only include the existing license type.");
    ({ ids, groupId } = await db.$transaction(
      async (tx) => {
        const types = await tx.licenseType.findMany({
          where: { id: { in: typeIds } },
        });
        if (types.length !== typeIds.length)
          throw new Error("One of the selected license types is unavailable.");
        for (const type of types)
          if (!type.enabled || type.deletedAt)
            throw new Error(
              `"${type.name}" is no longer available. Remove it and resubmit.`,
            );
        let prior = null;
        if (renewalId) {
          prior = await tx.license.findUniqueOrThrow({
            where: { id: renewalId },
            include: {
              application: true,
              renewals: { where: { status: { in: ["PENDING", "APPROVED"] } } },
            },
          });
          if (
            prior.application.lawyerId !== user.id ||
            prior.status === "REVOKED" ||
            prior.renewals.length ||
            prior.cid !== data.cid ||
            prior.application.licenseTypeId !== types[0].id
          )
            throw new Error(
              "This license cannot be renewed. Check ownership, CID, type, and renewal history.",
            );
        }
        const groupId = types.length > 1 ? reference("GRP") : null;
        const created: any[] = [];
        for (const type of types) {
          const days = daysByType.get(type.id)!,
            priceCents = priceForDays(type, days);
          created.push(
            await tx.licenseApplication.create({
              data: {
                ...data,
                licenseTypeId: type.id,
                reference: reference("APP"),
                groupId,
                typeName: type.name,
                priceCents,
                paymentCents: priceCents,
                requestedDays: days,
                lawyerId: user.id,
                renewalOfId: renewalId || null,
              },
            }),
          );
        }
        const recipients = await tx.user.findMany({
          where: {
            enabled: true,
            deletedAt: null,
            role: { code: { in: reviewers } },
          },
          select: { id: true },
        });
        await tx.notification.createMany({
          data: groupId
            ? [
                ...recipients.map((r) => ({
                  userId: r.id,
                  message: `New joint application (${created.length} license types) awaits review.`,
                  href: `/applications/group/${groupId}`,
                })),
                {
                  userId: user.id,
                  message: `Joint application for ${created.length} license types was submitted successfully.`,
                  href: `/applications/group/${groupId}`,
                },
              ]
            : [
                ...recipients.flatMap((r) =>
                  created.map((app) => ({
                    userId: r.id,
                    message: `New application ${app.reference} awaits review.`,
                    href: `/applications/${app.id}`,
                  })),
                ),
                ...created.map((app) => ({
                  userId: user.id,
                  message: `${app.reference} was submitted successfully.`,
                  href: `/applications/${app.id}`,
                })),
              ],
        });
        for (const app of created)
          await audit(
            tx,
            user,
            renewalId ? "RENEWAL_SUBMITTED" : "APPLICATION_CREATED",
            app.id,
            ip,
          );
        return { ids: created.map((app) => app.id), groupId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  redirect(
    groupId
      ? `/applications/group/${groupId}`
      : `/applications/${ids[0]}`,
  );
}
export async function review(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser(reviewers);
  try {
    await reviewApplication(
      user,
      String(form.get("id")),
      String(form.get("decision")),
      Number(form.get("days")),
      String(form.get("reason") || ""),
      String(form.get("paymentStatus") || ""),
      await ipAddress(),
    );
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { success: "Application reviewed successfully." };
}
export async function reviewGroup(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireUser(reviewers);
  let result;
  try {
    result = await reviewGroupApplications(
      user,
      String(form.get("groupId")),
      String(form.get("decision")),
      String(form.get("paymentStatus") || "RECEIVED"),
      await ipAddress(),
    );
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {
    success:
      result.approved === result.total
        ? `All ${result.approved} pending item(s) reviewed successfully.`
        : `${result.approved} of ${result.total} reviewed. Some items need individual attention: ${result.failures.join(" ")}`,
  };
}
export async function saveUser(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireUser(["ADMIN"]);
  try {
    const data = userSchema.parse(object(form)),
      id = String(form.get("id") || ""),
      ip = await ipAddress();
    const password = String(form.get("password") || ""),
      passwordHash = password
        ? await hashPassword(passwordSchema.parse(password))
        : undefined;
    if (!id && !passwordHash)
      throw new Error("Set an initial password of at least 8 characters.");
    await db.$transaction(
      async (tx) => {
        const role = await tx.role.findUniqueOrThrow({
          where: { code: data.role },
        });
        if (
          id === actor.id &&
          (data.role !== "ADMIN" || form.get("enabled") !== "on")
        )
          throw new Error(
            "You cannot disable or demote your own administrator account.",
          );
        const fields = {
          username: data.username,
          name: data.name,
          roleId: role.id,
          enabled: form.get("enabled") === "on",
          ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
        };
        const user = id
          ? await tx.user.update({
              where: { id, deletedAt: null },
              data: fields,
            })
          : await tx.user.create({
              data: { ...fields, passwordHash: passwordHash! },
            });
        if (id) await tx.session.deleteMany({ where: { userId: id } });
        await audit(
          tx,
          actor,
          id ? "USER_UPDATED" : "USER_CREATED",
          user.id,
          ip,
          {
            role: data.role,
            passwordReset: !!passwordHash,
            enabled: fields.enabled,
          },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { success: "User account saved. Existing sessions were invalidated." };
}
export async function deleteUser(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireUser(["ADMIN"]),
    id = String(form.get("id"));
  if (id === actor.id) return { error: "You cannot delete your own account." };
  if (form.get("confirm") !== "on")
    return { error: "Confirm account deletion." };
  try {
    const ip = await ipAddress();
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), enabled: false },
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, actor, "USER_DELETED", id, ip);
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { success: "Account deleted. Historical records were retained." };
}
export async function saveType(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireUser(["ADMIN"]);
  try {
    const id = String(form.get("id") || ""),
      name = z.string().trim().min(2).max(100).parse(form.get("name")),
      description = z.string().max(500).parse(form.get("description")),
      price90Cents = cents(form.get("price90")),
      price180Cents = cents(form.get("price180")),
      price365Cents = cents(form.get("price365")),
      ip = await ipAddress();
    if (![price90Cents, price180Cents, price365Cents].every((p) => p > 0))
      throw new Error("Every duration's price must be greater than zero.");
    await db.$transaction(async (tx) => {
      const data = {
        name,
        description,
        price90Cents,
        price180Cents,
        price365Cents,
        enabled: form.get("enabled") === "on",
      };
      const type = id
        ? await tx.licenseType.update({ where: { id, deletedAt: null }, data })
        : await tx.licenseType.create({ data });
      await audit(
        tx,
        actor,
        id ? "LICENSE_TYPE_UPDATED" : "LICENSE_TYPE_CREATED",
        type.id,
        ip,
        data,
      );
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {
    success: "License type saved. Existing application prices are unchanged.",
  };
}
export async function deleteType(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireUser(["ADMIN"]);
  if (form.get("confirm") !== "on") return { error: "Confirm deletion." };
  try {
    const id = String(form.get("id")),
      ip = await ipAddress();
    await db.$transaction(async (tx) => {
      await tx.licenseType.update({
        where: { id },
        data: { deletedAt: new Date(), enabled: false },
      });
      await audit(tx, actor, "LICENSE_TYPE_DELETED", id, ip);
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {
    success: "License type removed from the catalog. History retained.",
  };
}
export async function saveSettings(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireUser(["ADMIN"]);
  try {
    const organization = z
      .string()
      .trim()
      .min(2)
      .max(100)
      .parse(form.get("organization"));
    const lawyerBps = cents(form.get("lawyer")),
      reviewerBps = cents(form.get("reviewer")),
      governmentBps = cents(form.get("government"));
    distribute(100, lawyerBps, reviewerBps, governmentBps);
    const ip = await ipAddress();
    await db.$transaction(async (tx) => {
      const before = await tx.systemSettings.findUniqueOrThrow({
        where: { id: 1 },
      });
      const data = { organization, lawyerBps, reviewerBps, governmentBps };
      await tx.systemSettings.update({ where: { id: 1 }, data });
      await audit(tx, actor, "SETTINGS_CHANGED", "1", ip, {
        before: {
          organization: before.organization,
          lawyerBps: before.lawyerBps,
          reviewerBps: before.reviewerBps,
          governmentBps: before.governmentBps,
        },
        after: data,
      });
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return {
    success: "Settings saved. New percentages apply only to future approvals.",
  };
}
export async function updateLicense(
  _: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireUser(["ADMIN"]);
  try {
    const id = String(form.get("id")),
      reason = z.string().trim().min(3).max(1000).parse(form.get("reason")),
      ip = await ipAddress();
    await db.$transaction(async (tx) => {
      const prior = await tx.license.findUniqueOrThrow({ where: { id } });
      if (form.get("operation") === "revoke") {
        if (prior.status === "REVOKED")
          throw new Error("This license is already revoked.");
        await tx.license.update({
          where: { id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revocationReason: reason,
          },
        });
      } else {
        const citizenName = z
            .string()
            .trim()
            .min(2)
            .max(120)
            .parse(form.get("citizenName")),
          cid = z
            .string()
            .trim()
            .min(1)
            .max(60)
            .regex(/^[\w-]+$/)
            .parse(form.get("cid")),
          expiryInput = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).parse(form.get("expiresAt")),
          expiresAt = z.coerce.date().parse(`${expiryInput}:00Z`);
        if (expiresAt <= prior.issuedAt)
          throw new Error("Expiration must be after the issue date.");
        await tx.license.update({
          where: { id },
          data: {
            citizenName,
            cid,
            expiresAt,
            status:
              prior.status === "REVOKED"
                ? "REVOKED"
                : prior.supersededAt
                  ? "EXPIRED"
                  : expiresAt > new Date()
                    ? "ACTIVE"
                    : "EXPIRED",
            expiringNotifiedAt: null,
            expiredNotifiedAt: null,
          },
        });
      }
      await audit(
        tx,
        actor,
        form.get("operation") === "revoke"
          ? "LICENSE_REVOKED"
          : "LICENSE_EDITED",
        id,
        ip,
        {
          reason,
          before: {
            citizenName: prior.citizenName,
            cid: prior.cid,
            expiresAt: prior.expiresAt.toISOString(),
            status: prior.status,
          },
          after:
            form.get("operation") === "revoke"
              ? { status: "REVOKED" }
              : {
                  citizenName: String(form.get("citizenName")),
                  cid: String(form.get("cid")),
                  expiresAt: String(form.get("expiresAt")),
                },
        },
      );
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { success: "License updated." };
}
export async function readNotifications() {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

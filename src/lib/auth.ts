import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { digest } from "./password";
import type { RoleCode } from "./policy";
export const cookieName =
  process.env.NODE_ENV === "production" ? "__Host-slms" : "slms";
export async function ipAddress() {
  if (process.env.TRUST_PROXY !== "true") return "unavailable";
  return (
    (await headers())
      .get("x-forwarded-for")
      ?.split(",")[0]
      .trim()
      .slice(0, 64) || "unavailable"
  );
}
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  return sessionUser(token);
}
// React deduplicates layout/page reads only within a render, never across requests.
// Key by token so a session cookie changed by an action cannot reuse the old user.
const sessionUser = cache(async (token: string) => {
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: { include: { role: true } } },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.user.enabled ||
    session.user.deletedAt
  )
    return null;
  return session.user;
});
export async function requireUser(
  allowed?: readonly RoleCode[],
  allowPasswordChange = false,
) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !allowPasswordChange)
    redirect("/change-password");
  if (allowed && !allowed.includes(user.role.code))
    throw new Error("You do not have permission to perform this action.");
  return user;
}
export async function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 3600000);
  await db.session.create({ data: { id: digest(token), userId, expiresAt } });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    expires: expiresAt,
  });
}

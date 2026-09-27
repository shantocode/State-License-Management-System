import type { Prisma } from "@prisma/client";
import { effectiveStatus } from "./policy";
export type SearchParams = Record<string, string | string[] | undefined>;
export const param = (p: SearchParams, key: string) =>
  typeof p[key] === "string" ? (p[key] as string).slice(0, 150) : "";
export const pageNumber = (p: SearchParams) =>
  Math.min(100000, Math.max(1, Number.parseInt(param(p, "page")) || 1));
export function applicationWhere(
  role: string,
  userId: string,
  q = "",
  status = "",
  type = "",
  lawyer = "",
): Prisma.LicenseApplicationWhereInput {
  return {
    ...(role === "LAWYER"
      ? { lawyerId: userId }
      : lawyer
        ? { lawyerId: lawyer }
        : {}),
    ...(type ? { licenseTypeId: type } : {}),
    ...(["PENDING", "APPROVED", "REJECTED"].includes(status)
      ? { status: status as "PENDING" | "APPROVED" | "REJECTED" }
      : {}),
    ...(q
      ? {
          OR: [
            { citizenName: { contains: q } },
            { cid: { contains: q } },
            { reference: { contains: q } },
            { typeName: { contains: q } },
            { lawyer: { name: { contains: q } } },
            { reviewer: { name: { contains: q } } },
            { license: { number: { contains: q } } },
          ],
        }
      : {}),
  };
}
export function licenseWhere(
  role: string,
  userId: string,
  q = "",
  status = "",
  type = "",
): Prisma.LicenseWhereInput {
  const now = new Date();
  return {
    application: {
      ...(role === "LAWYER" ? { lawyerId: userId } : {}),
      ...(type ? { licenseTypeId: type } : {}),
    },
    ...(status === "ACTIVE"
      ? { status: "ACTIVE", expiresAt: { gt: now } }
      : status === "EXPIRED"
        ? {
            OR: [
              { status: "EXPIRED" },
              { status: "ACTIVE", expiresAt: { lte: now } },
            ],
          }
        : status === "REVOKED"
          ? { status: "REVOKED" }
          : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { citizenName: { contains: q } },
                { cid: { contains: q } },
                { number: { contains: q } },
                { application: { typeName: { contains: q } } },
                { application: { lawyer: { name: { contains: q } } } },
                { application: { reviewer: { name: { contains: q } } } },
              ],
            },
          ],
        }
      : {}),
  };
}
export { effectiveStatus };

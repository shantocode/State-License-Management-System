import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationWhere, licenseWhere } from "@/lib/queries";
import { effectiveStatus } from "@/lib/policy";
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.mustChangePassword)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url),
    q = (url.searchParams.get("q") || "").slice(0, 150),
    type = (url.searchParams.get("type") || "").slice(0, 100);
  if (q.length < 1) return Response.json({ applications: [], licenses: [] });
  const [applications, licenses] = await Promise.all([
    db.licenseApplication.findMany({
      where: applicationWhere(user.role.code, user.id, q, "", type),
      select: {
        id: true,
        reference: true,
        citizenName: true,
        cid: true,
        typeName: true,
        status: true,
      },
      take: 25,
      orderBy: { createdAt: "desc" },
    }),
    db.license.findMany({
      where: licenseWhere(user.role.code, user.id, q, "", type),
      select: {
        id: true,
        number: true,
        citizenName: true,
        cid: true,
        status: true,
        expiresAt: true,
      },
      take: 25,
      orderBy: { issuedAt: "desc" },
    }),
  ]);
  return Response.json(
    {
      applications,
      licenses: licenses.map((l) => ({
        ...l,
        status: effectiveStatus(l.status, l.expiresAt),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

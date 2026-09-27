import { currentUser, ipAddress } from "@/lib/auth";
import { audit } from "@/lib/service";
import { db } from "@/lib/db";
import { canReadApplication } from "@/lib/policy";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user || user.mustChangePassword)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const meta = await db.paymentProof.findUnique({
    where: { id },
    select: { application: { select: { lawyerId: true } } },
  });
  if (
    !meta ||
    !canReadApplication(user.role.code, user.id, meta.application.lawyerId)
  )
    return Response.json({ error: "Not found" }, { status: 404 });
  const proof = await db.paymentProof.findUniqueOrThrow({ where: { id } });
  await audit(
    db,
    user,
    "PAYMENT_PROOF_DOWNLOADED",
    proof.applicationId,
    await ipAddress(),
  );
  return new Response(new Uint8Array(proof.data), {
    headers: {
      "Content-Type": proof.mime,
      "Content-Disposition": `attachment; filename="${proof.name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

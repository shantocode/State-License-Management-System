import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Heading, Panel } from "@/components/common";
import { ApplicationForm } from "@/components/application-form";
export default async function NewApplication({
  searchParams,
}: {
  searchParams: Promise<{ renewal?: string }>;
}) {
  const user = await requireUser(["LAWYER"]),
    { renewal: id } = await searchParams;
  const [types, prior, settings] = await Promise.all([
    db.licenseType.findMany({
      where: { enabled: true, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    id
      ? db.license.findUnique({ where: { id }, include: { application: true } })
      : null,
    db.systemSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (
    id &&
    (!prior ||
      prior.application.lawyerId !== user.id ||
      prior.status === "REVOKED")
  )
    notFound();
  return (
    <>
      <Heading
        title={prior ? "Renew license" : "New application"}
        description={
          prior
            ? `Renewal of ${prior.number}. Previous records remain in the license history.`
            : "Enter citizen details and a link to the Citizen ID picture for review."
        }
      />
      <Panel title="Application details">
        <ApplicationForm
          types={types}
          split={{
            lawyerBps: settings.lawyerBps,
            reviewerBps: settings.reviewerBps,
            governmentBps: settings.governmentBps,
          }}
          renewal={
            prior
              ? {
                  id: prior.id,
                  cid: prior.cid,
                  citizenName: prior.citizenName,
                  phone: prior.application.phone,
                  licenseTypeId: prior.application.licenseTypeId,
                }
              : undefined
          }
        />
      </Panel>
    </>
  );
}

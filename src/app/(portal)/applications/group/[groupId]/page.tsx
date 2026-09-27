import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canReadApplication,
  money,
  date,
  durationLabel,
  distribute,
} from "@/lib/policy";
import { Heading, Panel, Badge } from "@/components/common";
export default async function ApplicationGroup({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const user = await requireUser(),
    { groupId } = await params;
  const [apps, settings] = await Promise.all([
    db.licenseApplication.findMany({
      where: { groupId },
      include: {
        lawyer: { select: { name: true } },
        license: true,
        revenue: true,
      },
      orderBy: { typeName: "asc" },
    }),
    db.systemSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (!apps.length || !canReadApplication(user.role.code, user.id, apps[0].lawyerId))
    notFound();
  const first = apps[0];
  const totalCents = apps.reduce((sum, a) => sum + a.priceCents, 0);
  // Actual split where an app was already approved; otherwise an estimate
  // from current settings, since real amounts are only recorded on approval.
  const split = apps.reduce(
    (sum, a) => {
      if (a.status === "REJECTED") return sum;
      const s = a.revenue
        ? a.revenue
        : distribute(
            a.priceCents,
            settings.lawyerBps,
            settings.reviewerBps,
            settings.governmentBps,
          );
      return {
        lawyerCents: sum.lawyerCents + s.lawyerCents,
        reviewerCents: sum.reviewerCents + s.reviewerCents,
        governmentCents: sum.governmentCents + s.governmentCents,
      };
    },
    { lawyerCents: 0, reviewerCents: 0, governmentCents: 0 },
  );
  const allDecided = apps.every((a) => a.status !== "PENDING");
  return (
    <>
      <Heading
        title={first.citizenName}
        description={`Joint submission · ${apps.length} license types · CID ${first.cid}`}
      />
      <Panel title="Submission details">
        <dl className="details">
          <div>
            <dt>Citizen</dt>
            <dd>{first.citizenName}</dd>
          </div>
          <div>
            <dt>CID</dt>
            <dd>{first.cid}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{first.phone}</dd>
          </div>
          <div>
            <dt>Submitted by</dt>
            <dd>{first.lawyer.name}</dd>
          </div>
          <div>
            <dt>Submitted on</dt>
            <dd>{date(first.createdAt)}</dd>
          </div>
          <div>
            <dt>Combined license price</dt>
            <dd>{money(totalCents)}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="License types in this submission">
        <div className="checkbox-list">
          {apps.map((a) => (
            <Link
              key={a.id}
              href={`/applications/${a.id}`}
              className="license-type-row"
              style={{
                justifyContent: "space-between",
                padding: "10px 4px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <strong>{a.typeName}</strong>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  {money(a.priceCents)} · {durationLabel(a.requestedDays)}{" "}
                  requested · {a.reference}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge
                  status={
                    a.status === "APPROVED" && a.license
                      ? a.license.status
                      : a.status
                  }
                />
                <ChevronRight size={17} />
              </div>
            </Link>
          ))}
        </div>
      </Panel>
      <Panel title={allDecided ? "Revenue split" : "Revenue split (estimated)"}>
        {!allDecided && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Rejected items earn nothing; pending items are estimated from
            current settings until reviewed.
          </p>
        )}
        <dl className="details">
          {[
            ["Lawyer", money(split.lawyerCents)],
            ["Reviewer", money(split.reviewerCents)],
            ["Government", money(split.governmentCents)],
            ["Combined total", money(totalCents)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}

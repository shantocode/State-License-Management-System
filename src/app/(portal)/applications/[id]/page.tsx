import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canReadApplication,
  canReview,
  money,
  date,
  durationLabel,
  paymentStatusLabel,
  distribute,
} from "@/lib/policy";
import { Heading, Panel, Badge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ReviewForm } from "@/components/review-form";
export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(),
    { id } = await params;
  const a = await db.licenseApplication.findUnique({
    where: { id },
    include: {
      lawyer: { select: { name: true } },
      reviewer: { select: { name: true } },
      license: true,
      renewalOf: true,
      revenue: true,
    },
  });
  if (!a || !canReadApplication(user.role.code, user.id, a.lawyerId))
    notFound();
  const [siblingCount, settings] = await Promise.all([
    a.groupId
      ? db.licenseApplication.count({ where: { groupId: a.groupId } })
      : Promise.resolve(0),
    db.systemSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  const projectedSplit = !a.revenue
    ? distribute(
        a.priceCents,
        settings.lawyerBps,
        settings.reviewerBps,
        settings.governmentBps,
      )
    : null;
  const details = [
    ["Citizen", a.citizenName],
    ["CID", a.cid],
    ["Phone", a.phone],
    ["License type", a.typeName],
    ["License price", money(a.priceCents)],
    ["Payment amount", money(a.paymentCents)],
    ["Requested duration", durationLabel(a.requestedDays)],
    ["Submitted by", a.lawyer.name],
    ["Submitted on", date(a.createdAt)],
  ];
  return (
    <>
      <Heading
        title={a.reference}
        description={`${a.typeName} · ${a.renewalOf ? "Renewal application" : "New application"}`}
        action={<Badge status={a.status} />}
      />
      {siblingCount > 1 && (
        <div className="alert info full" style={{ marginBottom: 16 }}>
          One of {siblingCount} license types submitted together for this
          citizen.{" "}
          <Link className="text-link" href={`/applications/group/${a.groupId}`}>
            View the joint submission →
          </Link>
        </div>
      )}
      <div className="two-column">
        <div>
          <Panel title="Citizen & payment details">
            <dl className="details">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="panel-body" style={{ paddingTop: 0 }}>
              <Button asChild variant="outline">
                <a href={a.citizenIdUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  View Citizen ID picture
                </a>
              </Button>
            </div>
            {a.notes && (
              <div className="panel-body">
                <h3>Notes</h3>
                <p
                  style={{ whiteSpace: "pre-wrap", marginTop: 9, fontSize: 14 }}
                >
                  {a.notes}
                </p>
              </div>
            )}
          </Panel>
          {a.status === "PENDING" && canReview(user.role.code) && (
            <Panel title="Review application">
              <ReviewForm id={a.id} requestedDays={a.requestedDays} />
            </Panel>
          )}
        </div>
        <div>
          <Panel title="Approval history">
            <dl className="details" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <dt>Submitted</dt>
                <dd>
                  {date(a.createdAt)} by {a.lawyer.name}
                </dd>
              </div>
              <div>
                <dt>Review status</dt>
                <dd>
                  <Badge status={a.status} />
                </dd>
              </div>
              {a.reviewedAt && (
                <>
                  <div>
                    <dt>Reviewed</dt>
                    <dd>
                      {date(a.reviewedAt)} by {a.reviewer?.name}
                    </dd>
                  </div>
                  {a.rejectionReason && (
                    <div>
                      <dt>Rejection reason</dt>
                      <dd>{a.rejectionReason}</dd>
                    </div>
                  )}
                  {a.durationDays && (
                    <div>
                      <dt>Approved duration</dt>
                      <dd>{a.durationDays} days</dd>
                    </div>
                  )}
                  <div>
                    <dt>Payment status</dt>
                    <dd>{paymentStatusLabel(a.paymentStatus)}</dd>
                  </div>
                </>
              )}
              {a.license && (
                <div>
                  <dt>Issued license</dt>
                  <dd>
                    <Link
                      className="text-link"
                      href={`/licenses/${a.license.id}`}
                    >
                      {a.license.number} →
                    </Link>
                  </dd>
                </div>
              )}
              {a.renewalOf && (
                <div>
                  <dt>Previous license</dt>
                  <dd>
                    <Link
                      className="text-link"
                      href={`/licenses/${a.renewalOf.id}`}
                    >
                      {a.renewalOf.number} →
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Panel>
          {a.revenue ? (
            <Panel title="Revenue allocated">
              <dl className="details">
                {[
                  ["Lawyer", money(a.revenue.lawyerCents)],
                  ["Reviewer", money(a.revenue.reviewerCents)],
                  ["Government", money(a.revenue.governmentCents)],
                  ["Total", money(a.revenue.totalCents)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : (
            projectedSplit && (
              <Panel title="Revenue split (estimated)">
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  Based on the license price and current settings. Recorded
                  only once the application is approved.
                </p>
                <dl className="details">
                  {[
                    ["Lawyer", money(projectedSplit.lawyerCents)],
                    ["Reviewer", money(projectedSplit.reviewerCents)],
                    ["Government", money(projectedSplit.governmentCents)],
                    ["Total", money(a.priceCents)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            )
          )}
        </div>
      </div>
    </>
  );
}

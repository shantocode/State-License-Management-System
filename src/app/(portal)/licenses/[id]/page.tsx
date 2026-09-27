import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark, RefreshCcw } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canReadApplication, date, effectiveStatus } from "@/lib/policy";
import { Heading, Panel, Badge, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ActionForm, Submit } from "@/components/form";
import { updateLicense } from "@/app/actions";
export default async function LicenseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(),
    { id } = await params,
    l = await db.license.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            lawyer: { select: { name: true } },
            reviewer: { select: { name: true } },
            renewalOf: true,
          },
        },
        renewals: {
          include: { license: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  if (
    !l ||
    !canReadApplication(user.role.code, user.id, l.application.lawyerId)
  )
    notFound();
  const status = effectiveStatus(l.status, l.expiresAt);
  return (
    <>
      <Heading
        title={l.number}
        description="Official license record"
        action={
          user.role.code === "LAWYER" &&
          l.status !== "REVOKED" &&
          !l.renewals.some((r) => r.status !== "REJECTED") && (
            <Button asChild>
              <Link href={`/applications/new?renewal=${l.id}`}>
                <RefreshCcw size={16} />
                Apply for renewal
              </Link>
            </Button>
          )
        }
      />
      <div className="two-column">
        <div>
          <Panel className="license-card">
            <div className="license-seal">
              <Landmark size={42} />
              <div>
                <small>STATE LICENSING AUTHORITY</small>
                <h2>{l.application.typeName}</h2>
              </div>
            </div>
            <dl className="details">
              {[
                ["Citizen", l.citizenName],
                ["CID", l.cid],
                ["License number", l.number],
                ["Issue date", date(l.issuedAt)],
                ["Expiration date", date(l.expiresAt)],
                ["Approved by", l.application.reviewer?.name || "—"],
                ["Submitted by", l.application.lawyer.name],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge status={status} />
                </dd>
              </div>
            </dl>
            {l.revocationReason && (
              <div className="panel-body alert error">
                Revoked: {l.revocationReason}
              </div>
            )}
          </Panel>
          {user.role.code === "ADMIN" && (
            <Panel title="Edit license details">
              <ActionForm action={updateLicense}>
                <input name="id" value={l.id} type="hidden" />
                <input name="operation" value="edit" type="hidden" />
                <Field label="Citizen name">
                  <input
                    name="citizenName"
                    defaultValue={l.citizenName}
                    required
                    maxLength={120}
                  />
                </Field>
                <Field label="CID">
                  <input
                    name="cid"
                    defaultValue={l.cid}
                    required
                    maxLength={60}
                  />
                </Field>
                <Field label="Expiration (UTC)">
                  <input
                    name="expiresAt"
                    type="datetime-local"
                    defaultValue={l.expiresAt.toISOString().slice(0, 16)}
                    required
                  />
                </Field>
                <Field label="Reason for change">
                  <input
                    name="reason"
                    required
                    minLength={3}
                    maxLength={1000}
                  />
                </Field>
                <div className="form-footer">
                  <Submit />
                </div>
              </ActionForm>
            </Panel>
          )}
        </div>
        <div>
          <Panel title="License history">
            <div className="panel-body">
              <Link
                className="text-link"
                href={`/applications/${l.applicationId}`}
              >
                Original application →
              </Link>
              {l.application.renewalOf && (
                <p style={{ marginTop: 15 }}>
                  <Link
                    className="text-link"
                    href={`/licenses/${l.application.renewalOf.id}`}
                  >
                    Previous license: {l.application.renewalOf.number}
                  </Link>
                </p>
              )}
              {l.renewals.map((r) => (
                <div key={r.id} style={{ marginTop: 20 }}>
                  <Link className="text-link" href={`/applications/${r.id}`}>
                    {r.reference}
                  </Link>
                  <p>
                    <Badge status={r.status} />{" "}
                    <small>{date(r.createdAt)}</small>
                  </p>
                  {r.license && (
                    <Link
                      className="text-link"
                      href={`/licenses/${r.license.id}`}
                    >
                      Renewed license →
                    </Link>
                  )}
                </div>
              ))}
              {!l.renewals.length && (
                <p
                  style={{ color: "var(--muted)", fontSize: 14, marginTop: 14 }}
                >
                  No renewal applications.
                </p>
              )}
            </div>
          </Panel>
          {user.role.code === "ADMIN" && l.status !== "REVOKED" && (
            <Panel title="Revoke license">
              <ActionForm action={updateLicense}>
                <input name="id" type="hidden" value={l.id} />
                <input name="operation" type="hidden" value="revoke" />
                <div className="full">
                  <Field label="Reason for revocation">
                    <textarea
                      name="reason"
                      required
                      minLength={3}
                      maxLength={1000}
                    />
                  </Field>
                </div>
                <p
                  className="full"
                  style={{ fontSize: 13, color: "var(--muted)" }}
                >
                  Revocation takes effect immediately. The historical revenue
                  allocation is retained.
                </p>
                <div className="form-footer">
                  <Submit danger>Revoke license</Submit>
                </div>
              </ActionForm>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

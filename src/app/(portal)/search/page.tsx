import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applicationWhere,
  licenseWhere,
  param,
  type SearchParams,
} from "@/lib/queries";
import { Heading, Panel, Badge, Empty } from "@/components/common";
import { ApplicationTable } from "@/components/application-table";
import { Button } from "@/components/ui/button";
import { effectiveStatus } from "@/lib/policy";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser(),
    p = await searchParams,
    q = param(p, "q"),
    type = param(p, "type");
  const [apps, licenses] = q
    ? await Promise.all([
        db.licenseApplication.findMany({
          where: applicationWhere(user.role.code, user.id, q, "", type),
          include: { lawyer: { select: { name: true } }, license: true },
          take: 20,
          orderBy: { createdAt: "desc" },
        }),
        db.license.findMany({
          where: licenseWhere(user.role.code, user.id, q, "", type),
          include: { application: true },
          take: 20,
          orderBy: { issuedAt: "desc" },
        }),
      ])
    : [[], []];
  const types = await db.licenseType.findMany({ where: { deletedAt: null } });
  return (
    <>
      <Heading
        title="Global search"
        description="Search by citizen, CID, license ID, lawyer, reviewer, or license type."
      />
      <Panel>
        <form className="filter-bar">
          <input
            name="q"
            defaultValue={q}
            placeholder="Enter a name or identifier…"
            aria-label="Global search"
            required
          />
          <select name="type" defaultValue={type} aria-label="License type">
            <option value="">All license types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button>Search</Button>
        </form>
      </Panel>
      {q ? (
        <>
          <Panel
            title={`Applications · ${apps.length}${apps.length === 20 ? "+" : ""}`}
            action={
              <Link
                href={`/applications?q=${encodeURIComponent(q)}&type=${type}`}
              >
                All results →
              </Link>
            }
          >
            <ApplicationTable rows={apps} />
          </Panel>
          <Panel
            title={`Licenses · ${licenses.length}${licenses.length === 20 ? "+" : ""}`}
            action={
              <Link href={`/licenses?q=${encodeURIComponent(q)}&type=${type}`}>
                All results →
              </Link>
            }
          >
            {licenses.length ? (
              <div className="notice-list">
                {licenses.map((l) => (
                  <Link key={l.id} href={`/licenses/${l.id}`}>
                    <strong>{l.number}</strong> · {l.citizenName}{" "}
                    <Badge status={effectiveStatus(l.status, l.expiresAt)} />
                    <small>
                      {l.application.typeName} · CID {l.cid}
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="No licenses found" />
            )}
          </Panel>
        </>
      ) : (
        <Empty
          title="Find a licensing record"
          description="Enter a search term to see the records available to your role."
        />
      )}
    </>
  );
}

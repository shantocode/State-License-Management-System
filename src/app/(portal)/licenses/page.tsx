import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  licenseWhere,
  param,
  pageNumber,
  type SearchParams,
} from "@/lib/queries";
import { date, effectiveStatus } from "@/lib/policy";
import { Heading, Panel, Badge, Empty, Pagination } from "@/components/common";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
export default async function Licenses({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser(),
    p = await searchParams,
    q = param(p, "q"),
    status = param(p, "status"),
    type = param(p, "type"),
    page = pageNumber(p);
  const [rows, types] = await Promise.all([
    db.license.findMany({
      where: licenseWhere(user.role.code, user.id, q, status, type),
      include: {
        application: { include: { lawyer: { select: { name: true } } } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * 20,
      take: 21,
    }),
    db.licenseType.findMany({ where: { deletedAt: null } }),
  ]);
  return (
    <>
      <Heading
        title="License registry"
        description="Issued licenses, validity periods, and renewal records."
      />
      <Panel>
        <form className="filter-bar">
          <input
            name="q"
            defaultValue={q}
            aria-label="Search licenses"
            placeholder="Search citizen, CID, or license ID…"
          />
          <select name="status" defaultValue={status} aria-label="Status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>
          <select name="type" defaultValue={type} aria-label="License type">
            <option value="">All license types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button variant="outline">Apply filters</Button>
        </form>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "License / citizen",
                  "Type",
                  "Lawyer",
                  "Issued",
                  "Expires",
                  "Status",
                ].map((t) => (
                  <TableHead key={t}>{t}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link className="text-link" href={`/licenses/${l.id}`}>
                      {l.number}
                    </Link>
                    <small>
                      {l.citizenName} · {l.cid}
                    </small>
                  </TableCell>
                  <TableCell>{l.application.typeName}</TableCell>
                  <TableCell>{l.application.lawyer.name}</TableCell>
                  <TableCell>{date(l.issuedAt)}</TableCell>
                  <TableCell>{date(l.expiresAt)}</TableCell>
                  <TableCell>
                    <Badge status={effectiveStatus(l.status, l.expiresAt)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty title="No licenses found" />
        )}
        <Pagination
          path="/licenses"
          page={page}
          hasMore={rows.length > 20}
          params={{ q, status, type }}
        />
      </Panel>
    </>
  );
}

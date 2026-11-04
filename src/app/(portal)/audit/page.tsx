import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { param, pageNumber, type SearchParams } from "@/lib/queries";
import { Heading, Panel, Pagination } from "@/components/common";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser(["ADMIN"]);
  const p = await searchParams,
    q = param(p, "q"),
    page = pageNumber(p),
    rows = await db.auditLog.findMany({
      where: q
        ? {
            OR: [
              { actorName: { contains: q } },
              { action: { contains: q } },
              { entityId: { contains: q } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 30,
      take: 31,
    });
  return (
    <>
      <Heading
        title="Audit trail"
        description="A chronological record of account, licensing, and settings activity."
      />
      <Panel>
        <form className="filter-bar">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search actor, action, or record ID…"
            aria-label="Search audit logs"
          />
          <Button variant="outline">Search</Button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Time (UTC)",
                "Actor",
                "Action / record",
                "IP address",
                "Details",
              ].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 30).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {a.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </TableCell>
                <TableCell>{a.actorName}</TableCell>
                <TableCell>
                  {a.action.toLowerCase().replaceAll("_", " ")}
                  <small>{a.entityId || "—"}</small>
                </TableCell>
                <TableCell>{a.ipAddress}</TableCell>
                <TableCell className="break-word">
                  {a.details && (
                    <details>
                      <summary>View changes</summary>
                      <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(a.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          path="/audit"
          page={page}
          hasMore={rows.length > 30}
          params={{ q }}
        />
      </Panel>
    </>
  );
}

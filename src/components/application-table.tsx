import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LicenseApplication, User, License } from "@prisma/client";
import { Badge, Empty } from "./common";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { money, date, effectiveStatus } from "@/lib/policy";
type Row = LicenseApplication & {
  lawyer: Pick<User, "name">;
  license?: License | null;
};
// Rows created from one multi-type submission share a groupId; collapse
// them into a single line (ungrouped/singleton rows use their own id).
function groupRows(rows: Row[]) {
  const order: string[] = [];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.groupId ?? row.id;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }
  return order.map((key) => ({ key, items: groups.get(key)! }));
}
export function ApplicationTable({ rows }: { rows: Row[] }) {
  if (!rows.length)
    return (
      <Empty
        title="No applications yet"
        description="Submitted applications and review decisions will appear here."
      />
    );
  const groups = groupRows(rows);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {[
            "Application / citizen",
            "License type",
            "Submitted by",
            "Amount",
            "Status",
            "",
          ].map((x, i) => (
            <TableHead key={i}>{x}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(({ key, items }) => {
          const a = items[0];
          const href =
            items.length > 1
              ? `/applications/group/${key}`
              : `/applications/${a.id}`;
          const totalCents = items.reduce((sum, x) => sum + x.priceCents, 0);
          const statuses = new Set(items.map((x) => x.status));
          return (
            <TableRow key={key}>
              <TableCell>
                <Link className="text-link" href={href}>
                  {a.citizenName}
                </Link>
                <small>
                  {items.length > 1
                    ? `${items.length} license types · CID ${a.cid}`
                    : `${a.reference} · CID ${a.cid}`}
                </small>
              </TableCell>
              <TableCell>
                {items.map((x) => x.typeName).join(", ")}
              </TableCell>
              <TableCell>
                {a.lawyer.name}
                <small>{date(a.createdAt)}</small>
              </TableCell>
              <TableCell>{money(totalCents)}</TableCell>
              <TableCell>
                {statuses.size > 1 ? (
                  <span className="badge pending">
                    {items.filter((x) => x.status === "PENDING").length
                      ? `${items.filter((x) => x.status === "PENDING").length} pending`
                      : "Mixed"}
                  </span>
                ) : (
                  <Badge
                    status={
                      a.status === "APPROVED" &&
                      a.license &&
                      effectiveStatus(
                        a.license.status,
                        a.license.expiresAt,
                      ) !== "ACTIVE"
                        ? effectiveStatus(a.license.status, a.license.expiresAt)
                        : a.status
                    }
                  />
                )}
              </TableCell>
              <TableCell>
                <Link aria-label={`View ${a.citizenName}`} href={href}>
                  <ChevronRight size={17} />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

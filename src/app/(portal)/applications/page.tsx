import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applicationWhere,
  param,
  pageNumber,
  type SearchParams,
} from "@/lib/queries";
import { Heading, Panel, Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApplicationTable } from "@/components/application-table";
export default async function Applications({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser(),
    p = await searchParams,
    q = param(p, "q"),
    status = param(p, "status"),
    type = param(p, "type"),
    view = param(p, "view"),
    lawyer = param(p, "lawyer"),
    page = pageNumber(p);
  const [apps, types, lawyers] = await Promise.all([
    db.licenseApplication.findMany({
      where: {
        ...applicationWhere(user.role.code, user.id, q, status, type, lawyer),
        ...(view === "reviewed" && user.role.code !== "LAWYER"
          ? { reviewerId: user.id }
          : {}),
      },
      include: { lawyer: { select: { name: true } }, license: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 21,
    }),
    db.licenseType.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    user.role.code !== "LAWYER"
      ? db.user.findMany({
          where: { deletedAt: null, role: { code: "LAWYER" } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  return (
    <>
      <Heading
        title="Applications"
        description={
          user.role.code === "LAWYER"
            ? "Submit citizen applications and follow each review."
            : "Review payments, decide applications, and track their history."
        }
        action={
          user.role.code === "LAWYER" && (
            <Button asChild>
              <Link href="/applications/new">
                <Plus size={17} />
                New application
              </Link>
            </Button>
          )
        }
      />
      <Panel>
        <form className="filter-bar">
          <input
            name="q"
            defaultValue={q}
            aria-label="Search applications"
            placeholder="Search by citizen, CID, or application…"
          />
          <select
            name="status"
            defaultValue={status}
            aria-label="Application status"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select name="type" defaultValue={type} aria-label="License type">
            <option value="">All license types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {user.role.code !== "LAWYER" && (
            <select name="lawyer" defaultValue={lawyer} aria-label="Lawyer">
              <option value="">All lawyers</option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline">Apply filters</Button>
          {user.role.code !== "LAWYER" && (
            <select name="view" defaultValue={view} aria-label="Review history">
              <option value="">All applications</option>
              <option value="reviewed">My review history</option>
            </select>
          )}
        </form>
        <ApplicationTable rows={apps.slice(0, 20)} />
        <Pagination
          path="/applications"
          page={page}
          hasMore={apps.length > 20}
          params={{ q, status, type, view, lawyer }}
        />
      </Panel>
    </>
  );
}

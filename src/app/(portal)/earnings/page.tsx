import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money, date } from "@/lib/policy";
import { param, pageNumber, type SearchParams } from "@/lib/queries";
import { reportPeriod } from "@/lib/report-data";
import { Heading, Panel, Empty, Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
export default async function Earnings({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser(),
    admin = user.role.code === "ADMIN",
    p = await searchParams,
    page = pageNumber(p),
    from = param(p, "from"),
    to = param(p, "to");
  let period;
  try {
    period = reportPeriod(from, to);
  } catch {
    return (
      <>
        <Heading title="Invalid date range" />
        <Link href="/earnings">Reset filters</Link>
      </>
    );
  }
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const [summary, monthly, rows, types] = await Promise.all([
    admin
      ? db.revenueDistribution.aggregate({
          where: { createdAt: period },
          _sum: {
            totalCents: true,
            governmentCents: true,
            lawyerCents: true,
            reviewerCents: true,
          },
        })
      : db.earnings.aggregate({
          where: { userId: user.id, createdAt: period },
          _sum: { amountCents: true },
        }),
    admin
      ? db.revenueDistribution.aggregate({
          where: { createdAt: { gte: month } },
          _sum: { governmentCents: true },
        })
      : db.earnings.aggregate({
          where: { userId: user.id, createdAt: { gte: month } },
          _sum: { amountCents: true },
        }),
    db.revenueDistribution.findMany({
      where: {
        createdAt: period,
        ...(!admin ? { earnings: { some: { userId: user.id } } } : {}),
      },
      include: {
        application: {
          include: {
            lawyer: { select: { name: true } },
            reviewer: { select: { name: true } },
          },
        },
        earnings: { where: { userId: user.id } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 21,
    }),
    admin
      ? db.licenseApplication.groupBy({
          by: ["typeName"],
          where: { status: "APPROVED", reviewedAt: period },
          _sum: { priceCents: true },
          _count: { id: true },
        })
      : [],
  ]);
  const s = summary._sum as {
      totalCents?: number | null;
      governmentCents?: number | null;
      lawyerCents?: number | null;
      reviewerCents?: number | null;
      amountCents?: number | null;
    },
    m = monthly._sum as {
      governmentCents?: number | null;
      amountCents?: number | null;
    };
  const cards = admin
    ? [
        ["Collected revenue", money(s.totalCents || 0)],
        ["Government share", money(s.governmentCents || 0)],
        ["Lawyer allocations", money(s.lawyerCents || 0)],
        ["Reviewer allocations", money(s.reviewerCents || 0)],
      ]
    : [
        ["Your earnings", money(s.amountCents || 0)],
        ["This month", money(m.amountCents || 0)],
      ];
  return (
    <>
      <Heading
        title={admin ? "Revenue & reports" : "My earnings"}
        description={
          admin
            ? "License revenue, distributions, and performance reports."
            : "Your revenue allocations from approved applications."
        }
      />
      <div className="stats">
        {cards.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="stat-top">{label}</div>
            <div className="stat-value">{value}</div>
            <small className="stat-note">
              {label === "This month"
                ? "Calendar month (UTC)"
                : "Selected period"}
            </small>
          </div>
        ))}
      </div>
      <Panel title="Revenue history">
        <form className="filter-bar">
          <label>
            From
            <input name="from" type="date" defaultValue={from} />
          </label>
          <label>
            To
            <input name="to" type="date" defaultValue={to} />
          </label>
          <Button variant="outline">Apply dates</Button>
        </form>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Date",
                  "Application",
                  "Type",
                  ...(admin
                    ? ["Total", "Lawyer", "Reviewer", "Government"]
                    : ["Your earnings"]),
                ].map((t) => (
                  <TableHead key={t}>{t}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{date(r.createdAt)}</TableCell>
                  <TableCell>
                    <Link
                      className="text-link"
                      href={`/applications/${r.applicationId}`}
                    >
                      {r.application.reference}
                    </Link>
                    <small>{r.application.citizenName}</small>
                  </TableCell>
                  <TableCell>{r.application.typeName}</TableCell>
                  {admin ? (
                    [
                      r.totalCents,
                      r.lawyerCents,
                      r.reviewerCents,
                      r.governmentCents,
                    ].map((v, i) => <TableCell key={i}>{money(v)}</TableCell>)
                  ) : (
                    <TableCell>
                      {money(r.earnings.reduce((n, e) => n + e.amountCents, 0))}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty
            title="No earnings recorded"
            description="Revenue is allocated when an application is approved."
          />
        )}
        <Pagination
          path="/earnings"
          page={page}
          hasMore={rows.length > 20}
          params={{ from, to }}
        />
      </Panel>
      {admin && (
        <>
          <Panel title="Revenue by license type">
            <div className="panel-body">
              {types.length ? (
                types.map((t) => (
                  <div className="split-row" key={t.typeName}>
                    <div>
                      <span>
                        {t.typeName} · {t._count.id} approvals
                      </span>
                      <strong>{money(t._sum.priceCents || 0)}</strong>
                    </div>
                    <div className="meter">
                      <i
                        style={{
                          width: `${((t._sum.priceCents || 0) / Math.max(s.totalCents || 0, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p>No approved applications in this period.</p>
              )}
              <p style={{ fontSize: 14, marginTop: 18 }}>
                Government revenue this month:{" "}
                <strong>{money(m.governmentCents || 0)}</strong>
              </p>
            </div>
          </Panel>
          <Panel title="Export reports">
            <div className="panel-body">
              <p
                style={{
                  fontSize: 14,
                  color: "var(--muted)",
                  marginBottom: 20,
                }}
              >
                Exports use the selected dates. License reports filter by issue
                date; performance reports use submission or review date.
              </p>
              {[
                ["revenue", "Revenue report"],
                ["active", "Active licenses"],
                ["expired", "Expired licenses"],
                ["lawyers", "Lawyer performance"],
                ["reviewers", "Reviewer performance"],
              ].map(([type, label]) => (
                <div className="split-row" key={type}>
                  <div>
                    <span>{label}</span>
                    <span>
                      <a
                        className="text-link"
                        href={`/api/reports?${new URLSearchParams({ type, format: "pdf", from, to })}`}
                      >
                        PDF
                      </a>{" "}
                      ·{" "}
                      <a
                        className="text-link"
                        href={`/api/reports?${new URLSearchParams({ type, format: "xlsx", from, to })}`}
                      >
                        Excel
                      </a>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

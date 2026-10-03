import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  Wallet,
  Clock3,
  ArrowUpRight,
  Plus,
  CheckCheck,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/settings";
import { applicationSummary, monthlyRevenue } from "@/lib/dashboard";
import { Heading, Panel, Empty } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApplicationTable } from "@/components/application-table";
import { money, date, roleLabel } from "@/lib/policy";
export default async function Dashboard() {
  const user = await requireUser(),
    admin = user.role.code === "ADMIN",
    lawyer = user.role.code === "LAWYER";
  const scope = lawyer ? { lawyerId: user.id } : {},
    now = new Date(),
    sixMonths = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );
  const [
    summary,
    active,
    expired,
    recent,
    revenue,
    earnings,
    settings,
    activity,
    users,
    lawyers,
    reviewers,
    transactions,
  ] = await Promise.all([
    applicationSummary(user.role.code, user.id),
    db.license.count({
      where: { application: scope, status: "ACTIVE", expiresAt: { gt: now } },
    }),
    db.license.count({
      where: {
        application: scope,
        OR: [
          { status: "EXPIRED" },
          { status: "ACTIVE", expiresAt: { lte: now } },
        ],
      },
    }),
    db.licenseApplication.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { lawyer: { select: { name: true } }, license: true },
    }),
    admin
      ? db.revenueDistribution.aggregate({
          _sum: { totalCents: true, governmentCents: true },
        })
      : null,
    !admin
      ? db.earnings.aggregate({
          where: { userId: user.id },
          _sum: { amountCents: true },
        })
      : null,
    systemSettings(),
    db.auditLog.findMany({
      where: admin ? {} : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    admin ? db.user.count({ where: { deletedAt: null } }) : 0,
    admin
      ? db.user.count({ where: { deletedAt: null, role: { code: "LAWYER" } } })
      : 0,
    admin
      ? db.user.count({
          where: {
            deletedAt: null,
            role: {
              code: { in: ["STATE_EMPLOYEE", "STATE_ASSISTANT", "REVIEWER"] },
            },
          },
        })
      : 0,
    monthlyRevenue(sixMonths, admin ? null : user.id),
  ]);
  if (!settings) throw new Error("System settings are missing.");
  const { total, pending, approved, rejected, reviewed } = summary;
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1),
    );
    return {
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      key: d.toISOString().slice(0, 7),
      value: 0,
    };
  });
  for (const t of transactions) {
    const m = months.find(
      (m) => m.key === t.month,
    );
    if (m) m.value += t.cents;
  }
  const monthly = transactions
      .filter((t) => t.month >= now.toISOString().slice(0, 7))
      .reduce((sum, t) => sum + t.cents, 0),
    max = Math.max(...months.map((m) => m.value), 1);
  const stats = admin
    ? [
        ["Total applications", total, FileText, `${pending} awaiting review`],
        ["Active licenses", active, ShieldCheck, `${expired} expired licenses`],
        [
          "Total collected",
          money(revenue?._sum.totalCents || 0),
          Wallet,
          `${money(monthly)} this month`,
        ],
        [
          "User accounts",
          users,
          Users,
          `${lawyers} lawyers · ${reviewers} reviewers`,
        ],
      ]
    : lawyer
      ? [
          [
            "Applications submitted",
            total,
            FileText,
            `${approved} approved · ${rejected} rejected`,
          ],
          ["Pending applications", pending, Clock3, "Awaiting a reviewer"],
          [
            "Active licenses",
            active,
            ShieldCheck,
            `${expired} expired licenses`,
          ],
          [
            "Total earnings",
            money(earnings?._sum.amountCents || 0),
            Wallet,
            `${money(monthly)} this month`,
          ],
        ]
      : [
          [
            "Applications reviewed",
            reviewed,
            CheckCheck,
            `${approved} approved · ${rejected} rejected`,
          ],
          ["Pending reviews", pending, Clock3, "Ready for your review"],
          [
            "Active licenses",
            active,
            ShieldCheck,
            `${expired} expired licenses`,
          ],
          [
            "Total earnings",
            money(earnings?._sum.amountCents || 0),
            Wallet,
            `${money(monthly)} this month`,
          ],
        ];
  return (
    <>
      <Heading
        eyebrow={`${roleLabel(user.role.code)} workspace`}
        title="Dashboard overview"
        description={`Welcome back, ${user.name.split(" ")[0]}. Here’s your licensing activity.`}
        action={
          <Button asChild>
            <Link
              href={
                lawyer ? "/applications/new" : "/applications?status=PENDING"
              }
            >
              {lawyer ? <Plus size={17} /> : <FileText size={17} />}{" "}
              {lawyer ? "New application" : "Review applications"}
            </Link>
          </Button>
        }
      />
      <div className="stats">
        {stats.map(([label, value, Icon, note]) => {
          const I = Icon as typeof FileText;
          return (
            <div className="stat" key={String(label)}>
              <div className="stat-top">
                <span>{String(label)}</span>
                <span className="stat-icon">
                  <I size={18} />
                </span>
              </div>
              <div className="stat-value">{String(value)}</div>
              <div className="stat-note">{String(note)}</div>
            </div>
          );
        })}
      </div>
      <div className="two-column">
        <Panel
          title={admin ? "Revenue overview" : "Earnings overview"}
          action={
            <Link href="/earnings">
              View report{" "}
              <ArrowUpRight style={{ display: "inline" }} size={14} />
            </Link>
          }
        >
          <div className="chart">
            <div className="chart-summary">
              <strong>{money(monthly)}</strong>
              <span>
                This month
                <br />
                {admin ? "License fees collected" : "Your allocated earnings"}
              </span>
            </div>
            <div
              className="chart-bars"
              role="img"
              aria-label={months
                .map((m) => `${m.label}: ${money(m.value)}`)
                .join(", ")}
            >
              {months.map((m) => (
                <div
                  key={m.key}
                  className="chart-bar"
                  title={`${m.label}: ${money(m.value)}`}
                >
                  <div style={{ height: `${(m.value / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="chart-labels">
              {months.map((m) => (
                <span key={m.key}>{m.label}</span>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Revenue distribution">
          <div className="panel-body">
            {[
              ["Lawyer", settings.lawyerBps],
              ["Reviewer", settings.reviewerBps],
              ["Government", settings.governmentBps],
            ].map(([label, bps]) => (
              <div className="split-row" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{Number(bps) / 100}%</strong>
                </div>
                <div className="meter">
                  <i style={{ width: `${Number(bps) / 100}%` }} />
                </div>
              </div>
            ))}
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 19 }}>
              Applied when an application is approved.
              {admin &&
                ` Government revenue to date: ${money(revenue?._sum.governmentCents || 0)}.`}
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title="Recent applications"
        action={<Link href="/applications">View all applications →</Link>}
      >
        <ApplicationTable rows={recent} />
      </Panel>
      <div className="equal-columns">
        <Panel title="Recent activity">
          {activity.length ? (
            <div className="activity">
              {activity.map((a) => (
                <div className="activity-item" key={a.id}>
                  <span className="activity-icon">
                    <CheckCheck size={17} />
                  </span>
                  <div>
                    <p>{a.action.toLowerCase().replaceAll("_", " ")}</p>
                    <small>
                      {a.actorName} · {date(a.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Your activity starts here" />
          )}
        </Panel>
        <Panel title="License catalog">
          <div className="panel-body">
            <p
              style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}
            >
              Current license prices are set by the administrator. Every
              application keeps the price at submission.
            </p>
            <Button asChild variant="outline">
              <Link
                href={
                  admin
                    ? "/license-types"
                    : lawyer
                      ? "/applications/new"
                      : "/licenses"
                }
              >
                {admin
                  ? "Manage license types"
                  : lawyer
                    ? "Start an application"
                    : "Open license registry"}{" "}
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

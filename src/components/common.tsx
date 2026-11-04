import Link from "next/link";
import { FileCheck2, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      {(
        {
          PENDING: "Pending review",
          APPROVED: "Approved",
          ACTIVE: "Active",
          EXPIRED: "Expired",
          REVOKED: "Revoked",
          REJECTED: "Rejected",
        } as Record<string, string>
      )[status] || status}
    </span>
  );
}
export function Heading({
  eyebrow = "Licensing workspace",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title = "No records found",
  description = "Records will appear here as your team completes work.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <FileCheck2 size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Pagination({
  page,
  hasMore,
  params,
  path,
}: {
  page: number;
  hasMore: boolean;
  params: Record<string, string>;
  path: string;
}) {
  const href = (p: number) =>
    `${path}?${new URLSearchParams({ ...params, page: String(p) })}`;
  return (
    <div className="pagination">
      <span>Page {page}</span>
      <div>
        {page > 1 && (
          <Button asChild variant="outline">
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        )}
        {hasMore && (
          <Button asChild variant="outline">
            <Link href={href(page + 1)}>
              Next <ChevronRight size={16} />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

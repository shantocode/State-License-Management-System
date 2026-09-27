import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/policy";
import { Heading, Panel, Empty, Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { readNotifications } from "@/app/actions";
import { pageNumber, type SearchParams } from "@/lib/queries";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser(),
    page = pageNumber(await searchParams),
    rows = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 31,
      skip: (page - 1) * 30,
    });
  return (
    <>
      <Heading
        title="Notifications"
        description="Application updates and upcoming license expirations."
        action={
          <form action={readNotifications}>
            <Button variant="outline">Mark all as read</Button>
          </form>
        }
      />
      <Panel>
        {rows.length ? (
          <div className="notice-list">
            {rows.slice(0, 30).map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className={n.readAt ? "" : "unread"}
              >
                {n.message}
                <small>
                  {date(n.createdAt)}
                  {!n.readAt ? " · Unread" : ""}
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="You’re all caught up" />
        )}
        <Pagination
          path="/notifications"
          page={page}
          hasMore={rows.length > 30}
          params={{}}
        />
      </Panel>
    </>
  );
}

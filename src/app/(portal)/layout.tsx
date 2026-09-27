import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Navigation,
  ThemeToggle,
  NotificationsLink,
} from "@/components/navigation";
import { date } from "@/lib/policy";
export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [settings, notifications] = await Promise.all([
    db.systemSettings.findUnique({ where: { id: 1 } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navigation
        role={user.role.code}
        name={user.name}
        organization={settings?.organization || "State Licensing Authority"}
      />
      <div className="workspace">
        <header className="topbar">
          <form className="topbar-search" action="/search">
            <Search size={19} />
            <input
              name="q"
              aria-label="Global search"
              placeholder="Search citizens, licenses, or people…"
            />
          </form>
          <div className="topbar-actions">
            <span className="today">{date(new Date())}</span>
            <ThemeToggle />
            <NotificationsLink count={notifications} />
          </div>
        </header>
        <main id="main" className="main">
          {children}
          <footer className="footer">
  <span>
    © 2026 State License Management System • Developed & Managed by{" "}
    <a
  href="https://shant0.xyz"
  target="_blank"
  rel="noopener noreferrer"
  className="footer-credit"
>
  Shanto
</a>
  </span>
</footer>
        </main>
      </div>
    </>
  );
}


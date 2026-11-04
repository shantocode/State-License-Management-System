import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/settings";
import {
  Navigation,
  NotificationsLink,
} from "@/components/navigation";
import { date, dutyRoles, canToggleDuty } from "@/lib/policy";
import { DutyToggle } from "@/components/duty-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
export const dynamic = "force-dynamic";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [settings, notifications, stateOnDuty] = await Promise.all([
    systemSettings(),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.user.count({
      where: {
        onDuty: true,
        enabled: true,
        deletedAt: null,
        role: { code: { in: dutyRoles } },
        sessions: { some: { expiresAt: { gt: new Date() } } },
      },
    }),
  ]);
  const stateAvailable = stateOnDuty > 0;
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
        <div className="service-strip">
          <span
            className={`state-status ${stateAvailable ? "available" : "unavailable"}`}
            role="status"
          >
            <i aria-hidden="true" />
            {stateAvailable ? "STATE AVAILABLE" : "STATE NOT AVAILABLE"}
          </span>
          <span>City of Los Santos · State Licensing Authority</span>
          <span>Personnel portal</span>
        </div>
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
            {canToggleDuty(user.role.code) && <DutyToggle onDuty={user.onDuty} />}
            <span className="today">{date(new Date())}</span>
            <NotificationsLink count={notifications} />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="main">
          {children}
          <footer className="footer">
            <span>© 2026 State License Management System</span>
            <span>
              Developed & managed by{" "}
              <a href="https://shant0.xyz" target="_blank" rel="noopener noreferrer" className="footer-credit">
                Shanto
              </a>
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}

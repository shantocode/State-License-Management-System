"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Wallet,
  Users,
  Layers3,
  ScrollText,
  Settings,
  Bell,
  Moon,
  Sun,
  Landmark,
  Menu,
  X,
  LogOut,
  KeyRound,
} from "lucide-react";
import { logout } from "@/app/actions";
import { roleLabel } from "@/lib/policy";
export function Navigation({
  role,
  name,
  organization,
}: {
  role: string;
  name: string;
  organization: string;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const items: [string, string, typeof LayoutDashboard][] = [
    ["/dashboard", "Overview", LayoutDashboard],
    ["/applications", "Applications", FileText],
    ["/licenses", "License registry", ShieldCheck],
    [
      "/earnings",
      role === "ADMIN" ? "Revenue & reports" : "My earnings",
      Wallet,
    ],
  ];
  if (role === "ADMIN")
    items.push(
      ["/users", "User accounts", Users],
      ["/license-types", "License catalog", Layers3],
      ["/audit", "Audit trail", ScrollText],
      ["/settings", "Settings", Settings],
    );
  return (
    <>
      <button
        className="mobile-menu icon-button"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {open ? <X /> : <Menu />}
      </button>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Landmark size={25} />
          </span>
          <span>
            SLMS<small>STATE LICENSING</small>
          </span>
        </Link>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav>
          {items.map(([href, label, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              className={path.startsWith(href) ? "selected" : ""}
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="authority">
            <ShieldCheck size={19} />
            <span>
              {organization}
              <small>Authorized personnel only</small>
            </span>
          </div>
          <div className="profile">
            <span className="avatar">
              {name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{name}</strong>
              <small>{roleLabel(role)}</small>
            </div>
          </div>
          <div className="profile-actions">
            <Link href="/change-password">
              <KeyRound size={16} />
              Password
            </Link>
            <form action={logout}>
              <button title="Sign out" aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem("slms-theme") === "dark";
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
  }, []);
  return (
    <button
      className="icon-button"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => {
        document.documentElement.classList.toggle("dark", !dark);
        localStorage.setItem("slms-theme", !dark ? "dark" : "light");
        setDark(!dark);
      }}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
export function NotificationsLink({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      className="notification-link icon-button"
      aria-label={`Notifications, ${count} unread`}
    >
      <Bell size={20} />
      {count > 0 && <span>{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

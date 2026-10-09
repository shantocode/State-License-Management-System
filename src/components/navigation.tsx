"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
        aria-expanded={open}
        aria-controls="licensing-sidebar"
      >
        {open ? <X /> : <Menu />}
      </button>
      <aside id="licensing-sidebar" className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Image src="/state-logo.png" alt="City of Los Santos seal" width={52} height={52} />
          </span>
          <span>
            SLMS<small>STATE LICENSING</small>
          </span>
        </Link>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav aria-label="Licensing navigation">
          {items.map(([href, label, Icon]) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                onClick={() => setOpen(false)}
                className={active ? "selected" : ""}
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} />
                {label}
              </Link>
            );
          })}
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

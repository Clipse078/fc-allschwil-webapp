"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  BadgeIcon,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Flag,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import { getVisibleAdminNav } from "@/lib/permissions/get-visible-admin-nav";
import type { PermissionKey } from "@/lib/permissions/permissions";

type AdminSidebarProps = {
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
  roleKeys?: string[];
  activeTenantName?: string;
  collapsed?: boolean;
  onToggle?: () => void;
};

function getNavIcon(label: string) {
  switch (label) {
    case "Dashboard":       return LayoutDashboard;
    case "Tenants / Clubs": return Building2;
    case "Users & Roles":   return Shield;
    case "Runtime":         return Activity;
    case "Audit Logs":      return Database;
    case "Platform Settings": return Settings;
    case "Vereinsleitung":  return Briefcase;
    case "Meetings":        return ScrollText;
    case "Initiativen":     return Flag;
    case "KPIs":            return BarChart3;
    case "Saisons":         return CalendarRange;
    case "Saisonplanner":   return ClipboardList;
    case "Wochenplanner":   return CalendarDays;
    case "Tagesplanner":    return CalendarDays;
    case "Teams":           return Users;
    case "Events":          return CalendarDays;
    case "Personen":        return UserCircle2;
    case "Spieler":         return UserRound;
    case "Trainer":         return BadgeIcon;
    default:                return LayoutDashboard;
  }
}

function isVereinsleitungChild(label: string) {
  return label === "Meetings" || label === "Initiativen" || label === "KPIs";
}

function isPlannerChild(label: string) {
  return label === "Wochenplanner" || label === "Tagesplanner";
}

function shouldCarrySeason(href: string) {
  return (
    href.startsWith("/dashboard/seasons") ||
    href.startsWith("/dashboard/planner") ||
    href.startsWith("/dashboard/teams") ||
    href.startsWith("/dashboard/events")
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SceWordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0b4aa2]">
        <span className="font-[var(--font-display)] text-[0.75rem] font-black tracking-tight text-white">
          SCE
        </span>
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Platform
          </p>
          <p className="font-[var(--font-display)] text-[1rem] font-black uppercase leading-tight tracking-[-0.02em] text-slate-900">
            SportClubEvo
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 border-t border-slate-200/80" />;
  }
  return (
    <p className="mb-1.5 mt-5 px-3 text-[9.5px] font-bold uppercase tracking-[0.22em] text-slate-400">
      {label}
    </p>
  );
}

function ClubBadge({
  tenantName,
  collapsed,
}: {
  tenantName: string | undefined;
  collapsed: boolean;
}) {
  if (collapsed) return null;
  return (
    <div className="mx-1 mb-2 flex items-center gap-2 rounded-[14px] border border-slate-200/70 bg-slate-50/80 px-3 py-2">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#0b4aa2]">
        <Building2 className="h-3 w-3 text-white" />
      </div>
      <p className="min-w-0 truncate text-[0.75rem] font-semibold text-slate-700">
        {tenantName ?? "No club selected"}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminSidebar({
  firstName,
  lastName,
  email,
  permissionKeys,
  roleKeys = [],
  activeTenantName,
  collapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");
  const navItems = getVisibleAdminNav(permissionKeys as PermissionKey[], roleKeys);

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const resolvedCollapsed = typeof collapsed === "boolean" ? collapsed : internalCollapsed;
  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((c) => !c);

  const platformItems = navItems.filter((i) => i.section === "platform");
  const clubRootItems = navItems.filter(
    (i) =>
      (i.section === "club" || i.section === "main") &&
      !isVereinsleitungChild(i.label) &&
      !isPlannerChild(i.label),
  );
  const vereinsleitungChildren = navItems.filter((i) => isVereinsleitungChild(i.label));
  const plannerChildren = navItems.filter((i) => isPlannerChild(i.label));

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) return baseHref;
    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  function isActive(href: string) {
    if (href === "#") return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");
  }

  function renderItem(
    item: (typeof navItems)[number],
    opts: { small?: boolean } = {},
  ) {
    const Icon = getNavIcon(item.label);
    const href = buildHref(item.href);
    const active = isActive(item.href);
    const isDisabled = item.disabled === true;
    const small = opts.small ?? false;

    if (isDisabled) {
      return (
        <li key={item.label}>
          <div
            title={resolvedCollapsed ? item.label : undefined}
            className={
              resolvedCollapsed
                ? "flex h-10 cursor-not-allowed items-center justify-center rounded-[16px] opacity-40"
                : `flex cursor-not-allowed items-center gap-3 rounded-[16px] px-3 ${small ? "py-2" : "py-2.5"} opacity-40`
            }
          >
            <Icon className="h-4 w-4 shrink-0 text-slate-500" />
            {!resolvedCollapsed ? (
              <span className="flex-1 text-[0.82rem] font-medium text-slate-500">
                {item.label}
              </span>
            ) : null}
            {!resolvedCollapsed ? (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Soon
              </span>
            ) : null}
          </div>
        </li>
      );
    }

    return (
      <li key={item.href}>
        <Link
          href={href}
          title={resolvedCollapsed ? item.label : undefined}
          className={
            active
              ? resolvedCollapsed
                ? "flex h-10 items-center justify-center rounded-[16px] bg-[#0b4aa2]/10 text-[#0b4aa2]"
                : `flex items-center gap-3 rounded-[16px] bg-[#0b4aa2]/8 px-3 ${small ? "py-2" : "py-2.5"} text-[0.82rem] font-semibold text-[#0b4aa2]`
              : resolvedCollapsed
                ? "flex h-10 items-center justify-center rounded-[16px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                : `flex items-center gap-3 rounded-[16px] px-3 ${small ? "py-2" : "py-2.5"} text-[0.82rem] font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-slate-900`
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!resolvedCollapsed ? <span>{item.label}</span> : null}
        </Link>

        {/* Vereinsleitung nested children */}
        {!resolvedCollapsed && item.label === "Vereinsleitung" && vereinsleitungChildren.length > 0 ? (
          <ul className="mt-1 space-y-0.5 pl-6">
            {vereinsleitungChildren.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={
                    isActive(child.href)
                      ? "flex items-center gap-2.5 rounded-[12px] bg-blue-50 px-3 py-2 text-[0.78rem] font-semibold text-[#0b4aa2]"
                      : "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-[0.78rem] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  }
                >
                  {(() => { const C = getNavIcon(child.label); return <C className="h-3.5 w-3.5 shrink-0" />; })()}
                  <span>{child.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Saisonplanner nested children */}
        {!resolvedCollapsed && item.label === "Saisonplanner" && plannerChildren.length > 0 ? (
          <ul className="mt-1 space-y-0.5 pl-6">
            {plannerChildren.map((child) => {
              const childHref = buildHref(child.href);
              return (
                <li key={child.href}>
                  <Link
                    href={childHref}
                    className={
                      isActive(child.href)
                        ? "flex items-center gap-2.5 rounded-[12px] bg-blue-50 px-3 py-2 text-[0.78rem] font-semibold text-[#0b4aa2]"
                        : "flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-[0.78rem] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    }
                  >
                    {(() => { const C = getNavIcon(child.label); return <C className="h-3.5 w-3.5 shrink-0" />; })()}
                    <span>{child.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <aside
      className={`${
        resolvedCollapsed ? "w-[72px]" : "w-[272px]"
      } flex min-h-screen shrink-0 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-xl transition-[width] duration-200`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between ${resolvedCollapsed ? "px-3 py-4" : "px-4 py-4"}`}>
        <SceWordmark collapsed={resolvedCollapsed} />

        {!resolvedCollapsed ? (
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggle}
            aria-label="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className={`flex-1 overflow-y-auto ${resolvedCollapsed ? "px-2 py-2" : "px-3 py-2"}`}>

        {/* Platform section */}
        {platformItems.length > 0 ? (
          <>
            <SectionLabel label="SportClubEvo" collapsed={resolvedCollapsed} />
            <ul className="space-y-0.5">
              {platformItems.map((item) => renderItem(item))}
            </ul>
          </>
        ) : null}

        {/* Club section */}
        {clubRootItems.length > 0 ? (
          <>
            <SectionLabel label="Active Club" collapsed={resolvedCollapsed} />
            <ClubBadge tenantName={activeTenantName} collapsed={resolvedCollapsed} />
            <ul className="space-y-0.5">
              {clubRootItems.map((item) => renderItem(item))}
            </ul>
          </>
        ) : null}
      </nav>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className={`border-t border-slate-200/80 ${resolvedCollapsed ? "px-2 py-3" : "px-3 py-4"}`}>
        {!resolvedCollapsed ? (
          <div className="mb-3 rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-3">
            <p className="truncate text-[0.82rem] font-semibold text-slate-800">
              {firstName} {lastName}
            </p>
            <p className="mt-0.5 truncate text-[0.72rem] text-slate-500">{email}</p>
          </div>
        ) : null}

        <SignOutButton collapsed={resolvedCollapsed} />

        {!resolvedCollapsed ? (
          <p className="mt-3 text-center text-[9px] font-medium tracking-wider text-slate-300 uppercase">
            SportClubEvo Platform
          </p>
        ) : null}
      </div>
    </aside>
  );
}

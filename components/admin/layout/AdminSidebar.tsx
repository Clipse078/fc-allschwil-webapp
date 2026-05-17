"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BadgeIcon,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  LayoutDashboard,
  ScrollText,
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
  isSuperAdmin?: boolean;
  activeTenantName?: string;
  activeTenantSlug?: string;
  collapsed?: boolean;
  onToggle?: () => void;
};

// Nav items that belong to the PLATFORM section
const PLATFORM_NAV_LABELS = new Set(["Dashboard", "Benutzer"]);

// Nav items that are children of Vereinsleitung
function isVereinsleitungChild(label: string) {
  return label === "Meetings" || label === "Initiativen" || label === "KPIs";
}

// Nav items that are children of Saisonplanner
function isPlannerChild(label: string) {
  return label === "Wochenplanner" || label === "Tagesplanner";
}

function shouldCarrySeason(href: string) {
  return (
    href === "/dashboard" ||
    href.startsWith("/dashboard/seasons") ||
    href.startsWith("/dashboard/planner") ||
    href.startsWith("/dashboard/teams") ||
    href.startsWith("/dashboard/events")
  );
}

function getNavIcon(label: string) {
  switch (label) {
    case "Dashboard":        return LayoutDashboard;
    case "Vereinsleitung":   return Briefcase;
    case "Meetings":         return ScrollText;
    case "Initiativen":      return Flag;
    case "KPIs":             return BarChart3;
    case "Saisons":          return CalendarRange;
    case "Saisonplanner":    return ClipboardList;
    case "Wochenplanner":    return CalendarDays;
    case "Tagesplanner":     return CalendarDays;
    case "Teams":            return Users;
    case "Events":           return CalendarDays;
    case "Personen":         return UserCircle2;
    case "Spieler":          return UserRound;
    case "Trainer":          return BadgeIcon;
    case "Benutzer":         return Shield;
    default:                 return LayoutDashboard;
  }
}

// Reusable nav link renderer
function NavLink({
  href,
  label,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = getNavIcon(label);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={
        active
          ? collapsed
            ? "flex h-12 items-center justify-center rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-[#0b4aa2] shadow-sm"
            : "flex items-center gap-3 rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3.5 text-sm font-semibold text-[#0b4aa2] shadow-sm"
          : collapsed
            ? "flex h-12 items-center justify-center rounded-[20px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            : "flex items-center gap-3 rounded-[20px] px-4 py-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );
}

// Section label separator
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-8 bg-slate-200" />;
  return (
    <p className="mb-1 mt-3 px-4 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-slate-400">
      {label}
    </p>
  );
}

export default function AdminSidebar({
  firstName,
  lastName,
  email,
  permissionKeys,
  isSuperAdmin = false,
  activeTenantName = "FC Allschwil",
  activeTenantSlug = "fc-allschwil",
  collapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");
  const navItems = getVisibleAdminNav(permissionKeys as PermissionKey[]);

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const resolvedCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((current) => !current);

  // Split nav into platform and club sections
  const platformItems = navItems.filter(
    (item) =>
      PLATFORM_NAV_LABELS.has(item.label) &&
      !isVereinsleitungChild(item.label) &&
      !isPlannerChild(item.label),
  );
  const clubItems = navItems.filter(
    (item) =>
      !PLATFORM_NAV_LABELS.has(item.label) &&
      !isVereinsleitungChild(item.label) &&
      !isPlannerChild(item.label),
  );
  const vereinsleitungChildren = navItems.filter((item) =>
    isVereinsleitungChild(item.label),
  );
  const plannerChildren = navItems.filter((item) => isPlannerChild(item.label));

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) return baseHref;
    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  return (
    <aside
      className={`${resolvedCollapsed ? "w-[96px]" : "w-[310px]"} flex min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white/92 backdrop-blur-xl transition-[width] duration-200`}
    >
      {/* ── Platform header ───────────────────────────────────────────────── */}
      <div className={resolvedCollapsed ? "px-4 py-5" : "px-5 py-5"}>
        <div className="flex items-start justify-between gap-3">
          <div
            className={
              resolvedCollapsed
                ? "flex w-full justify-center"
                : "flex min-w-0 items-center gap-3"
            }
          >
            <div
              className={
                resolvedCollapsed
                  ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50"
                  : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50"
              }
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" />
                <path
                  d="M8 12h8M12 8l4 4-4 4"
                  stroke="#16a34a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {!resolvedCollapsed ? (
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-green-600">
                  Platform
                </p>
                <h2 className="mt-0.5 font-[var(--font-display)] text-[1.35rem] font-bold uppercase leading-[0.92] tracking-[-0.03em] text-slate-900">
                  SportClubEvo
                </h2>
              </div>
            ) : null}
          </div>

          {!resolvedCollapsed ? (
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Menü einklappen"
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {resolvedCollapsed ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleToggle}
              aria-label="Menü erweitern"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Active tenant block ───────────────────────────────────────────── */}
      {!resolvedCollapsed ? (
        <div className="mx-5 mb-1">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3.5 py-2.5 shadow-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <Building2 className="h-4 w-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-slate-400">
                Active club
              </p>
              <p className="truncate text-xs font-semibold text-slate-700">
                {activeTenantName || activeTenantSlug}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center px-4 pb-1">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white"
            title={activeTenantName || activeTenantSlug}
          >
            <Building2 className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className={resolvedCollapsed ? "flex-1 px-3 py-2" : "flex-1 px-4 py-2"}>

        {/* PLATFORM section */}
        {platformItems.length > 0 ? (
          <>
            <SectionLabel label="Platform" collapsed={resolvedCollapsed} />
            <ul className="space-y-1">
              {platformItems.map((item) => {
                const resolvedHref = buildHref(item.href);
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <NavLink
                      href={resolvedHref}
                      label={item.label}
                      collapsed={resolvedCollapsed}
                      active={isActive}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {/* CLUB section */}
        {clubItems.length > 0 ? (
          <>
            <SectionLabel
              label={
                resolvedCollapsed
                  ? "Club"
                  : `Club — ${activeTenantName || activeTenantSlug}`
              }
              collapsed={resolvedCollapsed}
            />
            <ul className="space-y-1">
              {clubItems.map((item) => {
                const resolvedHref = buildHref(item.href);
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <NavLink
                      href={resolvedHref}
                      label={item.label}
                      collapsed={resolvedCollapsed}
                      active={isActive}
                    />

                    {/* Vereinsleitung children */}
                    {!resolvedCollapsed && item.label === "Vereinsleitung" ? (
                      <ul className="mt-1 space-y-1 pl-7">
                        {vereinsleitungChildren.map((child) => {
                          const childActive =
                            pathname === child.href ||
                            pathname.startsWith(`${child.href}/`);
                          return (
                            <li key={child.href}>
                              <NavLink
                                href={child.href}
                                label={child.label}
                                collapsed={false}
                                active={childActive}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {/* Saisonplanner children */}
                    {!resolvedCollapsed && item.label === "Saisonplanner" ? (
                      <ul className="mt-1 space-y-1 pl-7">
                        {plannerChildren.map((child) => {
                          const childHref = buildHref(child.href);
                          const childActive =
                            pathname === child.href ||
                            pathname.startsWith(`${child.href}/`);
                          return (
                            <li key={child.href}>
                              <NavLink
                                href={childHref}
                                label={child.label}
                                collapsed={false}
                                active={childActive}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </nav>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div
        className={
          resolvedCollapsed
            ? "border-t border-slate-200 px-3 py-4"
            : "border-t border-slate-200 px-5 py-5"
        }
      >
        {!resolvedCollapsed ? (
          <div className="mb-4 rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              {firstName} {lastName}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{email}</p>
            {isSuperAdmin ? (
              <span className="mt-2 inline-block rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-green-700">
                Superadmin
              </span>
            ) : null}
          </div>
        ) : null}

        <SignOutButton collapsed={resolvedCollapsed} />
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BadgeIcon,
  BarChart3,
  BookCheck,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  FileText,
  Flag,
  FolderClosed,
  Globe,
  Home,
  ImageIcon,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  MapPin,
  Menu,
  Monitor,
  Newspaper,
  Palette,
  PenLine,
  ScrollText,
  Settings2,
  ShieldCheck,
  Target,
  UserCircle2,
  UserRound,
  Users,
  Volleyball,
} from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import SidebarBrandHeader from "@/components/admin/branding/SidebarBrandHeader";
import PoweredByBadge from "@/components/admin/branding/PoweredByBadge";
import { getVisibleNavSections } from "@/lib/nav/nav-config";
import type { NavSection } from "@/lib/nav/nav-config";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { cn } from "@/lib/cn";

type AdminSidebarProps = {
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string | null;
  permissionKeys: string[];
  /** Tenant display name. Falls back to "SportClubEvo" when not provided. */
  clubName?: string;
  /** Raw logoUrl from tenant config. Null/invalid → fallback icon. */
  logoUrl?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
};

function getNavIcon(label: string) {
  switch (label) {
    // Top-level primary modules
    case "Dashboard":                   return LayoutDashboard;
    case "Organisation":                return Building2;
    case "Website":                     return Globe;
    case "Planung":                     return CalendarDays;
    case "Workspace":                   return FolderClosed;
    case "Dokumente":                   return FolderClosed;
    case "Anmeldungen":                 return Inbox;
    case "Meetings":                    return ScrollText;
    case "Initiativen":                 return Flag;
    case "Infoboard":                   return Monitor;
    case "MatchCenter":                 return Volleyball;
    case "Administration":              return Settings2;
    // Organisation children
    case "Organisationseinheiten":      return Building2;
    case "Zielgruppen":                 return Target;
    case "Teams":                       return Users;
    case "Personen":                    return UserCircle2;
    // Website children
    case "CMS Übersicht":               return Globe;
    case "News":                        return Newspaper;
    case "Seiten":                      return FileText;
    case "Homepage Builder":            return Home;
    case "Navigation":                  return Menu;
    case "Block-Bibliothek":            return LayoutTemplate;
    case "Medien":                      return ImageIcon;
    case "Redaktion":                   return PenLine;
    case "Veröffentlichungen":          return Layers;
    case "Wiederverwendbare Inhalte":   return BookCheck;
    case "Einstellungen":               return Settings2;
    // Planung children
    case "TrainingCenter":              return Dumbbell;
    case "Veranstaltungen":             return CalendarDays;
    case "Anlagen":                     return MapPin;
    // Legacy Planung labels (kept for any remaining references)
    case "Trainingsplaner":             return Dumbbell;
    case "Saisons":                     return CalendarRange;
    case "Saisonplanung":               return ClipboardList;
    case "Events":                      return CalendarDays;
    case "Feld & Ressourcen":           return Layers;
    // Administration children
    case "Darstellung":                 return Palette;
    case "Anlagen & Ressourcen":        return Building2;
    case "Benutzer":                    return Users;
    case "Rollen":                      return ShieldCheck;
    case "Rollen & Berechtigungen":     return ShieldCheck;
    case "Berechtigungen":              return KeyRound;
    case "Tenants":                     return Globe;
    // Legacy / fallback (keep so any remaining references resolve cleanly)
    case "Admin":                       return Settings2;
    case "Vereinsleitung":              return Briefcase;
    case "KPIs":                        return BarChart3;
    case "Ziele":                       return Target;
    case "Vorlagen":                    return FileText;
    case "Saisonplanner":               return ClipboardList;
    case "Wochenplanner":               return CalendarDays;
    case "Tagesplanner":                return CalendarDays;
    case "Spieler":                     return UserRound;
    case "Trainer":                     return BadgeIcon;
    case "Registrierungen":             return Inbox;
    default:                            return LayoutDashboard;
  }
}

const SEASON_CARRY_PREFIXES = [
  "/dashboard",
  "/dashboard/seasons",
  "/dashboard/planner",
  "/dashboard/teams",
  "/dashboard/events",
];

function shouldCarrySeason(href: string) {
  return SEASON_CARRY_PREFIXES.some((prefix) => href === prefix || href.startsWith(prefix + "/") || href.startsWith(prefix + "?"));
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function AdminSidebar({
  firstName,
  lastName,
  email,
  imageUrl,
  permissionKeys,
  clubName,
  logoUrl,
  collapsed,
  onToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed =
    typeof collapsed === "boolean" ? collapsed : internalCollapsed;

  const handleToggle =
    typeof onToggle === "function"
      ? onToggle
      : () => setInternalCollapsed((c) => !c);

  const sections: NavSection[] = getVisibleNavSections(
    permissionKeys as PermissionKey[],
  );

  const displayClubName = clubName ?? "SportClubEvo";

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) return baseHref;
    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  function isItemActive(href: string): boolean {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  }

  return (
    <aside
      className={cn(
        "sce-sidebar flex-shrink-0",
        isCollapsed && "collapsed",
      )}
    >
      {/* Brand header — tenant identity is dominant (DASHBOARD-SHELL-UX-01) */}
      <div className="sce-sidebar-brand">
        <SidebarBrandHeader
          tenantName={displayClubName}
          logoUrl={logoUrl}
          collapsed={isCollapsed}
        />

        <button
          type="button"
          onClick={handleToggle}
          aria-label={isCollapsed ? "Menü erweitern" : "Menü einklappen"}
          className="sce-icon-button shrink-0 ml-auto"
        >
          {isCollapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {sections.map((section, sectionIdx) => (
          <div key={section.sectionLabel ?? `nav-section:${sectionIdx}`}>
            {/* Section divider */}
            {section.sectionLabel && !isCollapsed && (
              <p
                className={cn(
                  "px-2 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]",
                  sectionIdx > 0 && "mt-4",
                )}
              >
                {section.sectionLabel}
              </p>
            )}
            {section.sectionLabel && isCollapsed && sectionIdx > 0 && (
              <div className="my-2 mx-2 border-t border-[var(--border)]" />
            )}

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = getNavIcon(item.label);
                const resolvedHref = buildHref(item.href);
                const childActive = item.children?.some((c) => isItemActive(c.href)) ?? false;
                const isActive = isItemActive(item.href) || childActive;

                return (
                  <li key={item.key}>
                    <Link
                      href={resolvedHref}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "sce-nav-item",
                        isActive && "active",
                        isCollapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>

                    {/* Children (always expanded when sidebar is open) */}
                    {!isCollapsed && item.children && item.children.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.children.map((child) => {
                          const ChildIcon = getNavIcon(child.label);
                          const childHref = buildHref(child.href);
                          const isChildActive = isItemActive(child.href);
                          return (
                            <li key={child.key}>
                              <Link
                                href={childHref}
                                className={cn("sce-nav-child", isChildActive && "active")}
                              >
                                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>{child.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-2 py-3 space-y-2">
        {!isCollapsed && (
          <Link
            href="/dashboard/account"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
              "hover:bg-[var(--surface-2)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
            )}
            title="Mein Konto"
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white overflow-hidden"
              style={imageUrl ? undefined : { background: "var(--tenant-primary)" }}
              aria-hidden="true"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`${firstName} ${lastName}`}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(firstName, lastName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                {firstName} {lastName}
              </p>
              <p className="truncate text-[0.7rem] text-[var(--muted)]">{email}</p>
            </div>
          </Link>
        )}

        {isCollapsed && (
          <div className="flex justify-center">
            <Link
              href="/dashboard/account"
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white transition-opacity hover:opacity-80 overflow-hidden",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
              )}
              style={imageUrl ? undefined : { background: "var(--tenant-primary)" }}
              title="Mein Konto"
              aria-label="Mein Konto"
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`${firstName} ${lastName}`}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(firstName, lastName)
              )}
            </Link>
          </div>
        )}

        <SignOutButton collapsed={isCollapsed} />

        {/* SportClubEvo platform attribution — subtle, secondary to the tenant brand */}
        <PoweredByBadge collapsed={isCollapsed} />
      </div>
    </aside>
  );
}

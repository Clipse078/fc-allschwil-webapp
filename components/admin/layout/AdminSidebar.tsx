"use client";

import Link from "next/link";
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
  Handshake,
  Home,
  ImageIcon,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MapPin,
  Menu,
  Monitor,
  MonitorPlay,
  Newspaper,
  Package,
  Palette,
  PenLine,
  ScrollText,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCircle2,
  UserRound,
  Users,
  Trophy,
  Volleyball,
  Wallet,
} from "lucide-react";
import SidebarBrandHeader from "@/components/admin/branding/SidebarBrandHeader";
import SidebarPlatformBrand from "@/components/admin/branding/SidebarPlatformBrand";
import { MotionIcon } from "@/components/ui/MotionIcon";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { getNavMotionIntent } from "@/lib/motion/nav-intents";
import { getVisibleNavSections } from "@/lib/nav/nav-config";
import type { NavSection } from "@/lib/nav/nav-config";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { cn } from "@/lib/cn";

type AdminSidebarProps = {
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
    case "Vorschau":                    return MonitorPlay;
    case "MatchCenter":                 return Volleyball;
    case "TournamentCenter":            return Trophy;
    case "Administration":              return Settings2;
    case "Kommunikation":               return Mail;
    case "Sponsoring":                  return Handshake;
    case "Organisationseinheiten":      return Building2;
    case "Zielgruppen":                 return Target;
    case "Teams":                       return Users;
    case "Personen":                    return UserCircle2;
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
    case "TrainingCenter":              return Dumbbell;
    case "Veranstaltungen":             return CalendarDays;
    case "Anlagen":                     return MapPin;
    case "Trainingsplaner":             return Dumbbell;
    case "Saisons":                     return CalendarRange;
    case "Saisonplanung":               return ClipboardList;
    case "Events":                      return CalendarDays;
    case "Feld & Ressourcen":           return Layers;
    case "Darstellung":                 return Palette;
    case "E-Mail-Absender":             return Mail;
    case "Anlagen & Ressourcen":        return Building2;
    case "Benutzer":                    return Users;
    case "Rollen":                      return ShieldCheck;
    case "Rollen & Berechtigungen":     return ShieldCheck;
    case "Berechtigungen":              return KeyRound;
    case "Tenants":                     return Globe;
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
    case "Club Entwicklung":            return TrendingUp;
    case "Prozesse & Aufgaben":         return ClipboardList;
    case "Material & Inventar":         return Package;
    case "Finanzen":                    return Wallet;
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
  return SEASON_CARRY_PREFIXES.some(
    (prefix) =>
      href === prefix ||
      href.startsWith(prefix + "/") ||
      href.startsWith(prefix + "?"),
  );
}

export default function AdminSidebar({
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

  const { isResizing, onResizePointerDown, onResizeKeyDown } = useSidebarResize({
    collapsed: isCollapsed,
  });

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
        "sce-sidebar flex-shrink-0 relative",
        isCollapsed && "collapsed",
        isResizing && "sce-sidebar-resizing",
      )}
    >
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

      <nav className="sce-sidebar-nav flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {sections.map((section, sectionIdx) => (
          <div key={section.sectionLabel ?? `nav-section:${sectionIdx}`}>
            {section.sectionLabel && !isCollapsed && (
              <p
                className={cn(
                  "sce-nav-section-label",
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
                const motionIntent = getNavMotionIntent(item.label);
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
                      <MotionIcon
                        icon={Icon}
                        intent={motionIntent}
                        active={isActive}
                        className="h-4 w-4"
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Link>

                    {!isCollapsed && item.children && item.children.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.children.map((child) => {
                          const ChildIcon = getNavIcon(child.label);
                          const childMotionIntent = getNavMotionIntent(child.label);
                          const childHref = buildHref(child.href);
                          const isChildActive = isItemActive(child.href);
                          return (
                            <li key={child.key}>
                              <Link
                                href={childHref}
                                className={cn("sce-nav-child", isChildActive && "active")}
                              >
                                <MotionIcon
                                  icon={ChildIcon}
                                  intent={childMotionIntent}
                                  active={isChildActive}
                                  className="h-3.5 w-3.5"
                                />
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

      <div className="shrink-0 border-t border-[var(--border)] px-2 py-3">
        <SidebarPlatformBrand collapsed={isCollapsed} />
      </div>

      {!isCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Seitenleiste vergrössern oder verkleinern"
          tabIndex={0}
          className="sce-sidebar-resize-handle hidden md:block"
          onMouseDown={onResizePointerDown}
          onKeyDown={onResizeKeyDown}
        />
      )}
    </aside>
  );
}

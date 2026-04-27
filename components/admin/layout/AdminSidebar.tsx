"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  BadgeIcon,
  BarChart3,
  BookOpen,
  Briefcase,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  FolderKanban,
  GraduationCap,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Network,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  UserCircle2,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import SignOutButton from "@/components/admin/layout/SignOutButton";
import { BRANDING } from "@/lib/config/branding";
import { getVisibleAdminNav } from "@/lib/permissions/get-visible-admin-nav";
import type { PermissionKey } from "@/lib/permissions/permissions";

type AdminSidebarProps = {
  firstName: string;
  lastName: string;
  email: string;
  permissionKeys: string[];
  currentSeasonLabel: string;
  nextSeasonLabel: string;
  collapsed?: boolean;
  onToggle?: () => void;
};

function normalizeLabel(label: string) {
  return label.replace(/^\d+(?:\.\d+)?\s+/, "");
}

function getNavIcon(label: string) {
  const normalized = normalizeLabel(label);

  switch (normalized) {
    case "Dashboard":
      return LayoutDashboard;
    case "Vereinsleitung":
      return Briefcase;
    case "Meetings":
      return ScrollText;
    case "Initiativen":
      return Flag;
    case "Organigramm":
      return Network;
    case "Kommunikation HUB":
      return Megaphone;
    case "Operations & Organisation":
      return BriefcaseBusiness;
    case "Finanzen":
      return Wallet;
    case "Material":
      return Wrench;
    case "Medien":
      return ImageIcon;
    case "AktivitÃ¤ten / Events":
      return CalendarDays;
    case "Business Club":
      return ShieldCheck;
    case "Archiv":
      return Archive;
    case "Ressourcen":
      return Wrench;
    case "Technische Kommission":
      return GraduationCap;
    case "Leistungsplan Aktive":
      return BookOpen;
    case "Jugend-Ausbildungsplan":
      return FolderKanban;
    case "Aktuelle Saison":
    case "Current Season":
      return CalendarRange;
    case "NÃ¤chste Saison":
    case "Next Season":
      return CalendarRange;
    case "Jahresplan":
      return ClipboardList;
    case "Wochenplan":
      return CalendarDays;
    case "Platz reservieren":
      return CalendarDays;
    case "Tagesplan":
      return CalendarDays;
    case "Infoboard":
      return CalendarDays;
    case "Teams":
      return Users;
    case "Personen":
    case "Persons":
      return UserCircle2;
    case "Trainer":
    case "Trainers":
      return BadgeIcon;
    case "Spieler":
    case "Players":
      return UserRound;
    case "VereinsfunktionÃ¤re":
      return Users;
    case "Externe Kontakte":
    case "External Contacts":
      return UserCircle2;
    case "Neue Anmeldungen":
      return UserPlus;
    case "Neue Trainer":
    case "Neue Trainers":
      return BadgeIcon;
    case "Neue Spieler":
    case "Neue Players":
      return UserRound;
    case "Benutzer & Rollen":
    case "Users & Roles":
      return Shield;
    default:
      return BarChart3;
  }
}

function shouldCarrySeason(href: string) {
  return (
    href === "/dashboard" ||
    href.startsWith("/dashboard/seasons") ||
    href.startsWith("/dashboard/planner") ||
    href.startsWith("/dashboard/teams") ||
    href.startsWith("/dashboard/events") ||
    href.startsWith("/dashboard/current-season")
  );
}

function getDisplayLabel(label: string) {
  const normalized = normalizeLabel(label);

  switch (normalized) {
    case "Current Season":
      return "Aktuelle Saison";
    case "Next Season":
      return "NÃ¤chste Saison";
    case "Persons":
      return "Personen";
    case "Trainers":
      return "Trainer";
    case "Players":
      return "Spieler";
    case "External Contacts":
      return "Externe Kontakte";
    case "Users & Roles":
      return "Benutzer & Rollen";
    case "Media":
      return "Medien";
    case "Neue Trainers":
      return "Neue Trainer";
    case "Neue Players":
      return "Neue Spieler";
    default:
      return normalized;
  }
}

export default function VereinsOSSidebar({
  firstName,
  lastName,
  email,
  permissionKeys,
  currentSeasonLabel,
  nextSeasonLabel,
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

  const topLevelItems = navItems.filter((item) => !item.parentLabel);

  function buildHref(baseHref: string) {
    if (!selectedSeason || !shouldCarrySeason(baseHref)) {
      return baseHref;
    }

    return `${baseHref}?season=${encodeURIComponent(selectedSeason)}`;
  }

  return (
    <aside
      className={`${resolvedCollapsed ? "w-[92px]" : "w-[286px]"} flex min-h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200`}
    >
      <div className={resolvedCollapsed ? "px-3 py-4" : "px-4 py-4"}>
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
          <div className={resolvedCollapsed ? "p-3" : "p-4"}>
            <div className="flex items-start justify-between gap-3">
              <div
                className={
                  resolvedCollapsed
                    ? "flex w-full justify-center"
                    : "flex min-w-0 items-center gap-3"
                }
              >
                <div className={resolvedCollapsed ? "relative h-11 w-11 shrink-0" : "relative h-12 w-12 shrink-0"}>
                  <Image
                    src="/images/logos/fc-allschwil.png"
                    alt={BRANDING.clubName}
                    fill
                    className="object-contain"
                    sizes="48px"
                    priority
                  />
                </div>

                {!resolvedCollapsed ? (
                  <div className="min-w-0">
                    <p className="fca-eyebrow">{BRANDING.clubName}</p>
                    <h2 className="mt-1 font-[var(--font-display)] text-[1.45rem] font-bold leading-[0.96] tracking-[-0.03em] text-[#0b4aa2]">
                      {BRANDING.systemName}
                    </h2>
                  </div>
                ) : null}
              </div>

              {!resolvedCollapsed ? (
                <button
                  type="button"
                  onClick={handleToggle}
                  aria-label="MenÃ¼ einklappen"
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
                  aria-label="MenÃ¼ erweitern"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav className={resolvedCollapsed ? "flex-1 px-3 py-2" : "flex-1 px-3 py-2"}>
        <ul className="space-y-2">
          {topLevelItems.map((item) => {
            const displayLabel = getDisplayLabel(item.label);
            const Icon = getNavIcon(displayLabel);
            const resolvedHref = buildHref(item.href);
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            const childItems = navItems.filter((child) => child.parentLabel === item.label);

            const seasonBadgeLabel =
              item.label === "Current Season"
                ? currentSeasonLabel
                : item.label === "Next Season"
                  ? nextSeasonLabel
                  : null;

            return (
              <li key={item.href}>
                <Link
                  href={resolvedHref}
                  title={resolvedCollapsed ? displayLabel : undefined}
                  className={
                    isActive
                      ? resolvedCollapsed
                        ? "flex h-12 items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 text-[#0b4aa2] shadow-sm"
                        : "group relative flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-[#0b4aa2] shadow-sm"
                      : resolvedCollapsed
                        ? "flex h-12 items-center justify-center rounded-[18px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        : "group flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  }
                >
                  {!resolvedCollapsed && isActive ? (
                    <div className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
                  ) : null}

                  <div
                    className={
                      isActive
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition group-hover:bg-white group-hover:shadow-sm"
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {!resolvedCollapsed ? (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{displayLabel}</span>
                          {seasonBadgeLabel ? (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {seasonBadgeLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {childItems.length > 0 ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : null}
                    </div>
                  ) : null}
                </Link>

                {!resolvedCollapsed && childItems.length > 0 ? (
                  <ul className="mt-2 space-y-2 pl-8">
                    {childItems.map((child) => {
                      const childDisplayLabel = getDisplayLabel(child.label);
                      const ChildIcon = getNavIcon(childDisplayLabel);
                      const childHref = buildHref(child.href);
                      const childActive =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);

                      return (
                        <li key={`${child.parentLabel}-${child.href}`}>
                          <Link
                            href={childHref}
                            className={
                              childActive
                                ? "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-semibold text-[#0b4aa2]"
                                : "flex items-center gap-3 rounded-[16px] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                            }
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{childDisplayLabel}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={resolvedCollapsed ? "border-t border-slate-200 px-3 py-4" : "border-t border-slate-200 px-4 py-4"}>
        {!resolvedCollapsed ? (
          <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1f4fbf] font-semibold text-white shadow-sm">
                {firstName.charAt(0)}
                {lastName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {firstName} {lastName}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">Super Admin</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <SignOutButton collapsed={resolvedCollapsed} />
        </div>
      </div>
    </aside>
  );
}






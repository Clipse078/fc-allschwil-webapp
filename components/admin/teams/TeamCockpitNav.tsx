"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type TabDef = {
  key: string;
  label: string;
  href: string;
  exact?: boolean;
};

const PRIMARY_TABS: TabDef[] = [
  { key: "uebersicht", label: "Übersicht", href: "", exact: true },
  { key: "spiele", label: "Nächste Spiele", href: "/spiele" },
  { key: "resultate", label: "Resultate", href: "/resultate" },
  { key: "rangliste", label: "Rangliste", href: "/rangliste" },
  { key: "kader", label: "Kader", href: "/kader" },
  { key: "trainerteam", label: "Trainerteam", href: "/trainerteam" },
  { key: "administration", label: "Administration", href: "/administration" },
];

const MORE_TABS: TabDef[] = [
  { key: "anwesenheit", label: "Anwesenheit", href: "/anwesenheit" },
  { key: "teilnahmen", label: "Teilnahmen", href: "/teilnahmen" },
];

type Props = {
  teamId: string;
  canManage: boolean;
  canDelete: boolean;
};

function buildTeamBasePath(teamId: string) {
  return `/dashboard/teams/${teamId}`;
}

function isTabActive(pathname: string, basePath: string, tab: TabDef) {
  const href = `${basePath}${tab.href}`;

  if (tab.exact) {
    return pathname === basePath || pathname === `${basePath}/`;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * TEAM-COCKPIT-PREMIUM-01D: URL-addressable secondary navigation for the
 * Team Cockpit workspace. Primary sporting sections plus a restrained
 * "Mehr" area for operational Anwesenheit/Teilnahmen access.
 */
export default function TeamCockpitNav({
  teamId,
  canManage,
  canDelete,
}: Props) {
  const pathname = usePathname();
  const basePath = buildTeamBasePath(teamId);
  const showAdministration = canManage || canDelete;
  const visiblePrimaryTabs = showAdministration
    ? PRIMARY_TABS
    : PRIMARY_TABS.filter((tab) => tab.key !== "administration");
  const moreTabActive = MORE_TABS.some((tab) =>
    isTabActive(pathname, basePath, tab),
  );

  return (
    <nav
      aria-label="Team Cockpit"
      className="flex items-end gap-3 border-b border-[var(--border)]"
      data-testid="team-cockpit-nav"
    >
      <div
        role="tablist"
        aria-label="Team Cockpit Bereiche"
        className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-thin"
      >
        {visiblePrimaryTabs.map((tab) => {
          const href = `${basePath}${tab.href}`;
          const isActive = isTabActive(pathname, basePath, tab);

          return (
            <Link
              key={tab.key}
              href={href}
              role="tab"
              aria-selected={isActive}
              data-testid={`team-cockpit-nav-${tab.key}`}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4",
                isActive
                  ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--foreground)]",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="relative shrink-0 pb-2.5">
        <details className="group relative">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors marker:content-none [&::-webkit-details-marker]:hidden",
              moreTabActive
                ? "text-[var(--sce-primary)]"
                : "text-[var(--text-2)] hover:text-[var(--foreground)]",
            )}
            data-testid="team-cockpit-nav-mehr"
          >
            Mehr
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div
            className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm"
            role="menu"
          >
            {MORE_TABS.map((tab) => {
              const href = `${basePath}${tab.href}`;
              const isActive = isTabActive(pathname, basePath, tab);

              return (
                <Link
                  key={tab.key}
                  href={href}
                  role="menuitem"
                  data-testid={`team-cockpit-nav-${tab.key}`}
                  className={cn(
                    "block px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-[var(--sce-primary)]"
                      : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </details>
      </div>
    </nav>
  );
}

export { buildTeamBasePath, isTabActive, PRIMARY_TABS, MORE_TABS };

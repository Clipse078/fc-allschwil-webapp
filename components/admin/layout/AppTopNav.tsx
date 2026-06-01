"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import AdminPageActions from "@/components/admin/layout/AdminPageActions";

type AppTopNavProps = {
  firstName: string;
  lastName: string;
};

function getPageMeta(pathname: string): { eyebrow: string; title: string } {
  if (pathname === "/dashboard") return { eyebrow: "Home", title: "Dashboard" };
  if (pathname.startsWith("/dashboard/planner/week")) return { eyebrow: "Planner", title: "Wochenplanner" };
  if (pathname.startsWith("/dashboard/planner/day")) return { eyebrow: "Planner", title: "Tagesplanner" };
  if (pathname.startsWith("/dashboard/planner")) return { eyebrow: "Planner", title: "Saisonplanner" };
  if (pathname.startsWith("/dashboard/seasons")) return { eyebrow: "Saisons", title: "Saisonplanung" };
  if (pathname.startsWith("/dashboard/teams")) return { eyebrow: "Teams", title: "Teams" };
  if (pathname.startsWith("/dashboard/events")) return { eyebrow: "Events", title: "Events" };
  if (pathname.startsWith("/dashboard/persons")) return { eyebrow: "Personen", title: "Personen" };
  if (pathname.startsWith("/dashboard/players")) return { eyebrow: "Spieler", title: "Spieler" };
  if (pathname.startsWith("/dashboard/trainers")) return { eyebrow: "Trainer", title: "Trainer" };
  if (pathname.startsWith("/dashboard/users")) return { eyebrow: "Benutzer", title: "Benutzerverwaltung" };
  if (pathname.startsWith("/dashboard/org-units")) return { eyebrow: "Organisation", title: "Org-Einheiten" };
  if (pathname.startsWith("/vereinsleitung/meetings")) return { eyebrow: "Vereinsleitung", title: "Meetings" };
  if (pathname.startsWith("/vereinsleitung/initiativen")) return { eyebrow: "Vereinsleitung", title: "Initiativen" };
  if (pathname.startsWith("/vereinsleitung/kpis")) return { eyebrow: "Vereinsleitung", title: "KPIs" };
  if (pathname.startsWith("/vereinsleitung/targets")) return { eyebrow: "Vereinsleitung", title: "Ziele" };
  if (pathname.startsWith("/vereinsleitung/templates")) return { eyebrow: "Vereinsleitung", title: "Vorlagen" };
  if (pathname.startsWith("/vereinsleitung")) return { eyebrow: "Vereinsleitung", title: "Übersicht" };
  return { eyebrow: "FC Allschwil", title: "WebApp" };
}

export default function AppTopNav({ firstName, lastName }: AppTopNavProps) {
  const pathname = usePathname();
  const { eyebrow, title } = getPageMeta(pathname);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <header className="sce-topnav">
      {/* Left: page title */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <p className="sce-page-eyebrow">{eyebrow}</p>
          <p className="sce-page-title">{title}</p>
        </div>
      </div>

      {/* Center: search slot */}
      <div className="hidden md:flex flex-1 justify-center">
        <button
          type="button"
          className="sce-search-slot w-full"
          aria-label="Suche öffnen"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left text-[0.8rem]">Suchen…</span>
          <kbd className="hidden lg:inline-block text-[0.65rem] font-mono opacity-60 border border-[var(--border-strong)] rounded px-1">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: actions + notifications + user */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Page-level actions */}
        <div className="hidden xl:flex items-center gap-1.5">
          <AdminPageActions />
        </div>

        {/* Notification bell */}
        <button
          type="button"
          className="sce-icon-button relative"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-4 w-4" />
          {/* notification dot */}
          <span
            className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full bg-[var(--red)]"
            aria-hidden="true"
          />
        </button>

        {/* User avatar */}
        <div
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[0.7rem] font-bold text-white select-none"
          style={{ background: "var(--blue)" }}
          title={`${firstName} ${lastName}`}
          aria-label="Benutzerprofil"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}

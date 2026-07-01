"use client";

import { usePathname } from "next/navigation";
import { Bell, HelpCircle, Menu, Search, Settings } from "lucide-react";
import { Suspense } from "react";
import AdminPageActions from "@/components/admin/layout/AdminPageActions";

type AppTopNavProps = {
  firstName: string;
  lastName: string;
};

type PageMeta = { eyebrow: string; title: string };

function getPageMeta(pathname: string): PageMeta {
  if (pathname === "/dashboard") return { eyebrow: "Home", title: "Dashboard" };
  if (pathname.startsWith("/admin")) return { eyebrow: "Platform", title: "Admin" };

  // Planner
  if (pathname.startsWith("/dashboard/planner/week")) return { eyebrow: "Planung", title: "Wochenplanner" };
  if (pathname.startsWith("/dashboard/planner/day")) return { eyebrow: "Planung", title: "Tagesplanner" };
  if (pathname.startsWith("/dashboard/planner")) return { eyebrow: "Planung", title: "Saisonplanner" };
  if (pathname.startsWith("/dashboard/seasons")) return { eyebrow: "Planung", title: "Saisonplanung" };
  if (pathname.startsWith("/dashboard/events")) return { eyebrow: "Planung", title: "Events" };

  // Organisation
  if (pathname.startsWith("/dashboard/teams")) return { eyebrow: "Organisation", title: "Teams" };
  if (pathname.startsWith("/dashboard/persons")) return { eyebrow: "Organisation", title: "Personen" };
  if (pathname.startsWith("/dashboard/players")) return { eyebrow: "Organisation", title: "Spieler" };
  if (pathname.startsWith("/dashboard/trainers")) return { eyebrow: "Organisation", title: "Trainer" };
  if (pathname.startsWith("/dashboard/org-units")) return { eyebrow: "Organisation", title: "Organisationseinheiten" };
  if (pathname.startsWith("/dashboard/target-groups")) return { eyebrow: "Organisation", title: "Zielgruppen" };

  // Website & Content
  if (pathname.startsWith("/dashboard/website/news")) return { eyebrow: "Website", title: "News" };
  if (pathname.startsWith("/dashboard/website/pages")) return { eyebrow: "Website", title: "Seiten" };
  if (pathname.startsWith("/dashboard/website/media")) return { eyebrow: "Website", title: "Medien" };
  if (pathname.startsWith("/dashboard/website/publishing")) return { eyebrow: "Website", title: "Veröffentlichungen" };
  if (pathname.startsWith("/dashboard/website/settings")) return { eyebrow: "Website", title: "Einstellungen" };
  if (pathname.startsWith("/dashboard/website/navigation")) return { eyebrow: "Website", title: "Navigation" };
  if (pathname.startsWith("/dashboard/website")) return { eyebrow: "Website", title: "Website" };

  // Registrations / Infoboard
  if (pathname.startsWith("/dashboard/registrations")) return { eyebrow: "Anmeldungen", title: "Anmeldungs-Inbox" };
  if (pathname.startsWith("/dashboard/infoboard")) return { eyebrow: "Infoboard", title: "Infoboard" };
  if (pathname.startsWith("/dashboard/logs")) return { eyebrow: "Admin", title: "Aktivitätslog" };

  // Administration
  if (pathname.startsWith("/dashboard/admin/branding")) return { eyebrow: "Administration", title: "Darstellung" };
  if (pathname.startsWith("/dashboard/admin/facilities")) return { eyebrow: "Administration", title: "Anlagen & Ressourcen" };
  if (pathname.startsWith("/dashboard/users")) return { eyebrow: "Administration", title: "Benutzerverwaltung" };
  if (pathname.startsWith("/dashboard/roles")) return { eyebrow: "Administration", title: "Rollen" };
  if (pathname.startsWith("/dashboard/tenants")) return { eyebrow: "Administration", title: "Tenants" };

  // Vereinsleitung
  if (pathname.startsWith("/vereinsleitung/meetings")) return { eyebrow: "Vereinsleitung", title: "Meetings" };
  if (pathname.startsWith("/vereinsleitung/initiativen")) return { eyebrow: "Vereinsleitung", title: "Initiativen" };
  if (pathname.startsWith("/vereinsleitung/kpis")) return { eyebrow: "Vereinsleitung", title: "KPIs" };
  if (pathname.startsWith("/vereinsleitung/targets")) return { eyebrow: "Vereinsleitung", title: "Ziele" };
  if (pathname.startsWith("/vereinsleitung/templates")) return { eyebrow: "Vereinsleitung", title: "Vorlagen" };
  if (pathname.startsWith("/vereinsleitung")) return { eyebrow: "Vereinsleitung", title: "Übersicht" };

  return { eyebrow: "SportClubEvo", title: "WebApp" };
}

export default function AppTopNav({ firstName, lastName }: AppTopNavProps) {
  const pathname = usePathname();
  const { eyebrow, title } = getPageMeta(pathname);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <header className="sce-topnav">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Hamburger — decorative, sidebar toggle is in AdminSidebar */}
        <button
          type="button"
          className="sce-icon-button shrink-0"
          aria-label="Menü"
          tabIndex={-1}
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
          <span className="text-[0.8rem] text-[var(--muted)]">{eyebrow}</span>
          <span className="text-[var(--muted)] text-[0.8rem]">›</span>
          <span className="text-[0.8rem] font-semibold text-[var(--foreground)]">{title}</span>
        </nav>
      </div>

      {/* Center: search */}
      <div className="hidden md:flex flex-1 max-w-xs justify-center">
        <button
          type="button"
          className="sce-search-slot w-full flex items-center gap-2"
          aria-label="Suche"
          disabled
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left text-[var(--muted)]">Suche…</span>
          <kbd className="shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--muted)] border border-[var(--border)] bg-[var(--surface-2)]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: page actions + icons */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden xl:flex items-center gap-1">
          <Suspense fallback={null}>
            <AdminPageActions />
          </Suspense>
        </div>

        <button type="button" className="sce-icon-button" aria-label="Benachrichtigungen" disabled>
          <Bell className="h-4 w-4" />
        </button>

        <button type="button" className="sce-icon-button" aria-label="Hilfe" disabled>
          <HelpCircle className="h-4 w-4" />
        </button>

        <button type="button" className="sce-icon-button" aria-label="Einstellungen" disabled>
          <Settings className="h-4 w-4" />
        </button>

        {/* User avatar */}
        <div
          className="ml-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[0.7rem] font-bold text-white select-none"
          style={{ background: "var(--tenant-primary)" }}
          title={`${firstName} ${lastName}`}
          aria-label="Benutzerprofil"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}

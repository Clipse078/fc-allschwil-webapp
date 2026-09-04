"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import AdminPageActions from "@/components/admin/layout/AdminPageActions";
import AccountMenu from "@/components/admin/layout/AccountMenu";

type AppTopNavProps = {
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string | null;
};

type PageMeta = { eyebrow: string; title: string };

function getPageMeta(pathname: string): PageMeta {
  if (pathname === "/dashboard") return { eyebrow: "Start", title: "Dashboard" };
  if (pathname.startsWith("/admin")) return { eyebrow: "Platform", title: "Admin" };
  if (pathname.startsWith("/dashboard/planner/week")) return { eyebrow: "Planner", title: "Wochenplanner" };
  if (pathname.startsWith("/dashboard/planner/day")) return { eyebrow: "Planner", title: "Tagesplanner" };
  if (pathname.startsWith("/dashboard/planner")) return { eyebrow: "Planner", title: "Saisonplanner" };
  if (pathname.startsWith("/dashboard/training")) return { eyebrow: "Planung", title: "TrainingCenter" };
  if (pathname.startsWith("/dashboard/seasons")) return { eyebrow: "Saisons", title: "Saisonplanung" };
  if (pathname.startsWith("/dashboard/teams")) return { eyebrow: "Teams", title: "Teams" };
  if (pathname.startsWith("/dashboard/events")) return { eyebrow: "Events", title: "Events" };
  if (pathname.startsWith("/dashboard/persons")) return { eyebrow: "Personen", title: "Personen" };
  if (pathname.startsWith("/dashboard/players")) return { eyebrow: "Personen", title: "Spieler" };
  if (pathname.startsWith("/dashboard/trainers")) return { eyebrow: "Personen", title: "Trainer" };
  if (pathname.startsWith("/dashboard/users")) return { eyebrow: "Admin", title: "Benutzerverwaltung" };
  if (pathname.startsWith("/dashboard/org-units")) return { eyebrow: "Admin", title: "Org-Einheiten" };
  if (pathname.startsWith("/dashboard/target-groups")) return { eyebrow: "Admin", title: "Zielgruppen" };
  if (pathname.startsWith("/dashboard/admin/branding")) return { eyebrow: "Admin", title: "Darstellung" };
  if (pathname.startsWith("/vereinsleitung/meetings")) return { eyebrow: "Vereinsleitung", title: "Meetings" };
  if (pathname.startsWith("/vereinsleitung/initiativen")) return { eyebrow: "Vereinsleitung", title: "Initiativen" };
  if (pathname.startsWith("/vereinsleitung/kpis")) return { eyebrow: "Vereinsleitung", title: "KPIs" };
  if (pathname.startsWith("/vereinsleitung/targets")) return { eyebrow: "Vereinsleitung", title: "Ziele" };
  if (pathname.startsWith("/vereinsleitung/templates")) return { eyebrow: "Vereinsleitung", title: "Vorlagen" };
  if (pathname.startsWith("/vereinsleitung")) return { eyebrow: "Vereinsleitung", title: "Übersicht" };
  if (pathname.startsWith("/dashboard/account")) return { eyebrow: "Konto", title: "Mein Konto" };
  return { eyebrow: "SportClubEvo", title: "Übersicht" };
}

export default function AppTopNav({
  firstName,
  lastName,
  email,
  imageUrl,
}: AppTopNavProps) {
  const pathname = usePathname();
  const { eyebrow, title } = getPageMeta(pathname);

  return (
    <header className="sce-topnav">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
          <span className="text-[0.8125rem] text-[var(--muted)]">{eyebrow}</span>
          <span className="text-[var(--muted)] text-[0.8125rem]" aria-hidden="true">›</span>
          <span className="text-[0.8125rem] font-semibold text-[var(--foreground)]">{title}</span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden xl:flex items-center gap-1">
          <Suspense fallback={null}>
            <AdminPageActions />
          </Suspense>
        </div>

        <AccountMenu
          firstName={firstName}
          lastName={lastName}
          email={email}
          imageUrl={imageUrl}
        />
      </div>
    </header>
  );
}

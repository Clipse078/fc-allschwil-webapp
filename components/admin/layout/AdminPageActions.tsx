"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  ShieldPlus,
  Trophy,
  Users,
} from "lucide-react";

export default function AdminPageActions() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");

  const seasonsHref = selectedSeason
    ? `/dashboard/seasons?season=${encodeURIComponent(selectedSeason)}`
    : "/dashboard/seasons";

  const plannerHref = selectedSeason
    ? `/dashboard/planner?season=${encodeURIComponent(selectedSeason)}`
    : "/dashboard/planner";

  const weekHref = selectedSeason
    ? `/dashboard/planner/week?season=${encodeURIComponent(selectedSeason)}`
    : "/dashboard/planner/week";

  const dayHref = selectedSeason
    ? `/dashboard/planner/day?season=${encodeURIComponent(selectedSeason)}`
    : "/dashboard/planner/day";

  const plannerNewHref = selectedSeason
    ? `/dashboard/planner/new?season=${encodeURIComponent(selectedSeason)}`
    : "/dashboard/planner/new";

  // DASHBOARD-SHELL-UX-01: the tenant dashboard itself no longer surfaces
  // global "Planner öffnen" / "Saisons verwalten" shortcuts in the top bar —
  // they duplicated the sidebar navigation and added noise without extra
  // value. Season/planner pages below keep their own contextual actions.

  if (pathname === "/dashboard/seasons" || pathname.startsWith("/dashboard/seasons/")) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/dashboard/seasons#create-season"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Plus className="h-4 w-4" />
          Neue Saison
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/planner" || pathname === "/dashboard/planner/week" || pathname === "/dashboard/planner/day") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={plannerNewHref}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Plus className="h-4 w-4" />
          Neuer Eintrag
        </Link>

        {pathname !== "/dashboard/planner" ? (
          <Link
            href={plannerHref}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
          >
            <CalendarPlus className="h-4 w-4" />
            Saisonplanner
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/week" ? (
          <Link
            href={weekHref}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
          >
            <CalendarPlus className="h-4 w-4" />
            Wochenplanner
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/day" ? (
          <Link
            href={dayHref}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
          >
            <CalendarPlus className="h-4 w-4" />
            Tagesplanner
          </Link>
        ) : null}
      </div>
    );
  }

  if (pathname === "/dashboard/planner/new") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={plannerHref}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
        >
          <CalendarPlus className="h-4 w-4" />
          Zurück zum Planner
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/teams" || pathname.startsWith("/dashboard/teams/")) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={seasonsHref}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <ShieldPlus className="h-4 w-4" />
          Saison wechseln
        </Link>

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Users className="h-4 w-4" />
          Neues Team
        </button>
      </div>
    );
  }

  if (pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/")) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={seasonsHref}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <ShieldPlus className="h-4 w-4" />
          Saison wechseln
        </Link>

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Trophy className="h-4 w-4" />
          Neues Event
        </button>
      </div>
    );
  }

  if (pathname === "/vereinsleitung/meetings" || pathname.startsWith("/vereinsleitung/meetings/")) {
    if (pathname === "/vereinsleitung/meetings") {
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <CalendarPlus className="h-4 w-4" />
            Meeting planen
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </button>

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <CheckCircle2 className="h-4 w-4" />
          Beschluss fassen
        </button>
      </div>
    );
  }

  if (pathname === "/vereinsleitung/initiativen" || pathname.startsWith("/vereinsleitung/initiativen/")) {
    if (pathname === "/vereinsleitung/initiativen") {
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <Plus className="h-4 w-4" />
            Neue Initiative
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </button>

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Plus className="h-4 w-4" />
          Neue Aufgabe
        </button>
      </div>
    );
  }

  if (pathname === "/vereinsleitung" || pathname.startsWith("/vereinsleitung/")) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <CalendarPlus className="h-4 w-4" />
          Meeting planen
        </button>

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Plus className="h-4 w-4" />
          Neue Initiative
        </button>
      </div>
    );
  }

  return null;
}

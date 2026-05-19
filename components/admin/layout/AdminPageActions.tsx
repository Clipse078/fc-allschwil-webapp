"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  Settings2,
  ShieldPlus,
  Trophy,
  Users,
} from "lucide-react";

const primaryActionClass =
  "sce-action-primary h-11 px-4 text-sm";
const secondaryActionClass =
  "sce-action-secondary h-11 px-4 text-sm font-medium";
const dangerActionClass =
  "sce-action-danger h-11 px-4 text-sm font-medium";

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

  if (pathname === "/dashboard") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={plannerHref}
          className={secondaryActionClass}
        >
          <CalendarPlus className="h-4 w-4" />
          Planner öffnen
        </Link>

        <Link
          href={seasonsHref}
          className={primaryActionClass}
        >
          <Settings2 className="h-4 w-4" />
          Saisons verwalten
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/seasons" || pathname.startsWith("/dashboard/seasons/")) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className={dangerActionClass}
        >
          <Settings2 className="h-4 w-4" />
          Saison löschen
        </button>

        <Link
          href="/dashboard/seasons#create-season"
          className={primaryActionClass}
        >
          <Plus className="h-4 w-4" />
          Neue Saison planen
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/planner" || pathname === "/dashboard/planner/week" || pathname === "/dashboard/planner/day") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={plannerNewHref}
          className={primaryActionClass}
        >
          <Plus className="h-4 w-4" />
          Neuer Eintrag
        </Link>

        {pathname !== "/dashboard/planner" ? (
          <Link
            href={plannerHref}
            className={secondaryActionClass}
          >
            <CalendarPlus className="h-4 w-4" />
            Saisonplanner
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/week" ? (
          <Link
            href={weekHref}
            className={secondaryActionClass}
          >
            <CalendarPlus className="h-4 w-4" />
            Wochenplanner
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/day" ? (
          <Link
            href={dayHref}
            className={secondaryActionClass}
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
          className={secondaryActionClass}
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
          className={secondaryActionClass}
        >
          <ShieldPlus className="h-4 w-4" />
          Saison wechseln
        </Link>

        <button
          type="button"
          className={primaryActionClass}
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
          className={secondaryActionClass}
        >
          <ShieldPlus className="h-4 w-4" />
          Saison wechseln
        </Link>

        <button
          type="button"
          className={primaryActionClass}
        >
          <Trophy className="h-4 w-4" />
          Neues Event
        </button>
      </div>
    );
  }

  if (pathname === "/meetings" || pathname.startsWith("/meetings/")) {
    if (pathname === "/meetings") {
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className={primaryActionClass}
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
          className={secondaryActionClass}
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </button>

        <button
          type="button"
          className={primaryActionClass}
        >
          <CheckCircle2 className="h-4 w-4" />
          Beschluss fassen
        </button>
      </div>
    );
  }

  if (pathname === "/initiatives" || pathname.startsWith("/initiatives/")) {
    if (pathname === "/initiatives") {
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className={primaryActionClass}
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
          className={secondaryActionClass}
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </button>

        <button
          type="button"
          className={primaryActionClass}
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
          className={secondaryActionClass}
        >
          <CalendarPlus className="h-4 w-4" />
          Meeting planen
        </button>

        <button
          type="button"
          className={primaryActionClass}
        >
          <Plus className="h-4 w-4" />
          Neue Initiative
        </button>
      </div>
    );
  }

  return null;
}

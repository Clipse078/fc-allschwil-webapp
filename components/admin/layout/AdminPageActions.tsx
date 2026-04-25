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

export default function AdminPageActions() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");

  const seasonsHref = selectedSeason
    ? "/dashboard/seasons?season=" + encodeURIComponent(selectedSeason)
    : "/dashboard/seasons";

  const plannerHref = selectedSeason
    ? "/dashboard/planner?season=" + encodeURIComponent(selectedSeason)
    : "/dashboard/planner";

  const weekHref = selectedSeason
    ? "/dashboard/planner/week?season=" + encodeURIComponent(selectedSeason)
    : "/dashboard/planner/week";

  const dayHref = selectedSeason
    ? "/dashboard/planner/day?season=" + encodeURIComponent(selectedSeason)
    : "/dashboard/planner/day";

  const plannerNewHref = selectedSeason
    ? "/dashboard/planner/new?season=" + encodeURIComponent(selectedSeason)
    : "/dashboard/planner/new";

  if (pathname === "/dashboard") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={plannerHref}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
        >
          <CalendarPlus className="h-4 w-4" />
          Jahresplan öffnen
        </Link>

        <Link
          href={seasonsHref}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <Settings2 className="h-4 w-4" />
          Saisons verwalten
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/seasons" || pathname.startsWith("/dashboard/seasons/")) {
    return null;
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

  if (pathname === "/vereinsleitung/meetings/new") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/vereinsleitung/meetings"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <CalendarPlus className="h-4 w-4" />
          Zurück zu den Meetings
        </Link>
      </div>
    );
  }

  if (pathname.startsWith("/vereinsleitung/meetings/") && pathname.endsWith("/edit")) {
    const detailHref = pathname.replace(/\/edit$/, "");

    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={detailHref}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <CalendarPlus className="h-4 w-4" />
          Zurück zum Meeting
        </Link>
      </div>
    );
  }

  if (pathname === "/vereinsleitung/meetings" || pathname.startsWith("/vereinsleitung/meetings/")) {
    if (pathname === "/vereinsleitung/meetings") {
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/vereinsleitung/meetings/new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <CalendarPlus className="h-4 w-4" />
            Meeting planen
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href={pathname + "/edit"}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </Link>

        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
        >
          <CheckCircle2 className="h-4 w-4" />
          Beschluss erfassen
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
        <Link
          href="/vereinsleitung/meetings/new"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900"
        >
          <CalendarPlus className="h-4 w-4" />
          Meeting planen
        </Link>

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
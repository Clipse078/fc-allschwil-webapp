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
import { makeSeasonUrl } from "@/lib/platform/season-url-helpers";
import { deChMessages } from "@/messages";

const SECONDARY_BTN =
  "inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900";
const PRIMARY_BTN =
  "inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]";
const DANGER_BTN =
  "inline-flex h-11 items-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 shadow-sm transition hover:-translate-y-[1px] hover:bg-rose-50";
const ACTION_ROW = "flex flex-wrap items-center gap-2.5";

export default function AdminPageActions() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");
  const seasonUrl = makeSeasonUrl(selectedSeason);
  const t = deChMessages.pageActions;
  const tNav = deChMessages.nav;

  if (pathname === "/dashboard") {
    return (
      <div className={ACTION_ROW}>
        <Link href={seasonUrl("/dashboard/planner")} className={SECONDARY_BTN}>
          <CalendarPlus className="h-4 w-4" />
          {t.plannerOpen}
        </Link>

        <Link href={seasonUrl("/dashboard/seasons")} className={PRIMARY_BTN}>
          <Settings2 className="h-4 w-4" />
          {t.seasonsManage}
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/seasons" || pathname.startsWith("/dashboard/seasons/")) {
    return (
      <div className={ACTION_ROW}>
        <button type="button" className={DANGER_BTN}>
          <Settings2 className="h-4 w-4" />
          {t.seasonDelete}
        </button>

        <Link href="/dashboard/seasons#create-season" className={PRIMARY_BTN}>
          <Plus className="h-4 w-4" />
          {t.seasonPlanNew}
        </Link>
      </div>
    );
  }

  if (
    pathname === "/dashboard/planner" ||
    pathname === "/dashboard/planner/week" ||
    pathname === "/dashboard/planner/day"
  ) {
    return (
      <div className={ACTION_ROW}>
        <Link href={seasonUrl("/dashboard/planner/new")} className={PRIMARY_BTN}>
          <Plus className="h-4 w-4" />
          {t.plannerEntryNew}
        </Link>

        {pathname !== "/dashboard/planner" ? (
          <Link href={seasonUrl("/dashboard/planner")} className={SECONDARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {tNav.saisonplanner}
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/week" ? (
          <Link href={seasonUrl("/dashboard/planner/week")} className={SECONDARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {tNav.wochenplanner}
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/day" ? (
          <Link href={seasonUrl("/dashboard/planner/day")} className={SECONDARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {tNav.tagesplanner}
          </Link>
        ) : null}
      </div>
    );
  }

  if (pathname === "/dashboard/planner/new") {
    return (
      <div className={ACTION_ROW}>
        <Link href={seasonUrl("/dashboard/planner")} className={SECONDARY_BTN}>
          <CalendarPlus className="h-4 w-4" />
          {t.backToPlanner}
        </Link>
      </div>
    );
  }

  if (pathname === "/dashboard/teams" || pathname.startsWith("/dashboard/teams/")) {
    return (
      <div className={ACTION_ROW}>
        <Link href={seasonUrl("/dashboard/seasons")} className={SECONDARY_BTN}>
          <ShieldPlus className="h-4 w-4" />
          {t.seasonSwitch}
        </Link>

        <button type="button" className={PRIMARY_BTN}>
          <Users className="h-4 w-4" />
          {t.teamNew}
        </button>
      </div>
    );
  }

  if (pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/")) {
    return (
      <div className={ACTION_ROW}>
        <Link href={seasonUrl("/dashboard/seasons")} className={SECONDARY_BTN}>
          <ShieldPlus className="h-4 w-4" />
          {t.seasonSwitch}
        </Link>

        <button type="button" className={PRIMARY_BTN}>
          <Trophy className="h-4 w-4" />
          {t.eventNew}
        </button>
      </div>
    );
  }

  if (
    pathname === "/vereinsleitung/meetings" ||
    pathname.startsWith("/vereinsleitung/meetings/")
  ) {
    if (pathname === "/vereinsleitung/meetings") {
      return (
        <div className={ACTION_ROW}>
          <button type="button" className={PRIMARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {t.meetingPlan}
          </button>
        </div>
      );
    }

    return (
      <div className={ACTION_ROW}>
        <button type="button" className={SECONDARY_BTN}>
          <Pencil className="h-4 w-4" />
          {t.edit}
        </button>

        <button type="button" className={PRIMARY_BTN}>
          <CheckCircle2 className="h-4 w-4" />
          {t.decisionMake}
        </button>
      </div>
    );
  }

  if (
    pathname === "/vereinsleitung/initiativen" ||
    pathname.startsWith("/vereinsleitung/initiativen/")
  ) {
    if (pathname === "/vereinsleitung/initiativen") {
      return (
        <div className={ACTION_ROW}>
          <button type="button" className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" />
            {t.initiativeNew}
          </button>
        </div>
      );
    }

    return (
      <div className={ACTION_ROW}>
        <button type="button" className={SECONDARY_BTN}>
          <Pencil className="h-4 w-4" />
          {t.edit}
        </button>

        <button type="button" className={PRIMARY_BTN}>
          <Plus className="h-4 w-4" />
          {t.taskNew}
        </button>
      </div>
    );
  }

  if (pathname === "/vereinsleitung" || pathname.startsWith("/vereinsleitung/")) {
    return (
      <div className={ACTION_ROW}>
        <button type="button" className={SECONDARY_BTN}>
          <CalendarPlus className="h-4 w-4" />
          {t.meetingPlan}
        </button>

        <button type="button" className={PRIMARY_BTN}>
          <Plus className="h-4 w-4" />
          {t.initiativeNew}
        </button>
      </div>
    );
  }

  return null;
}

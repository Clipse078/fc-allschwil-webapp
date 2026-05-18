"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, CheckCircle2, Pencil, Plus } from "lucide-react";
import { makeSeasonUrl } from "@/lib/platform/season-url-helpers";
import { getRouteActions, type ActionDef } from "@/lib/platform/admin-route-actions";

const SECONDARY_BTN =
  "inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-900";
const PRIMARY_BTN =
  "inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]";
const DANGER_BTN =
  "inline-flex h-11 items-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 shadow-sm transition hover:-translate-y-[1px] hover:bg-rose-50";
const ACTION_ROW = "flex flex-wrap items-center gap-2.5";

const VARIANT_CLASS: Record<string, string> = {
  primary: PRIMARY_BTN,
  secondary: SECONDARY_BTN,
  danger: DANGER_BTN,
};

export default function AdminPageActions() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedSeason = searchParams.get("season");
  const seasonUrl = makeSeasonUrl(selectedSeason);
  const tActions = useTranslations("pageActions");
  const tNav = useTranslations("nav");

  function getLabel(def: ActionDef): string {
    return def.labelNs === "nav"
      ? tNav(def.labelKey as Parameters<typeof tNav>[0])
      : tActions(def.labelKey as Parameters<typeof tActions>[0]);
  }

  function renderAction(def: ActionDef, idx: number) {
    const label = getLabel(def);
    const Icon = def.icon;
    const cls = VARIANT_CLASS[def.variant] ?? SECONDARY_BTN;

    if (def.type === "link" && def.href) {
      const href = def.seasonAware ? seasonUrl(def.href) : def.href;
      return (
        <Link key={idx} href={href} className={cls}>
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      );
    }

    return (
      <button key={idx} type="button" className={cls}>
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  }

  // ── Target detail pages: /targets/[id] ──────────────────────────────────
  const targetDetailMatch = /^\/targets\/([^/]+)$/.exec(pathname);
  if (targetDetailMatch && targetDetailMatch[1] !== "new") {
    const targetId = targetDetailMatch[1];
    return (
      <div className={ACTION_ROW}>
        <Link href={`/targets/${targetId}/edit`} className={SECONDARY_BTN}>
          <Pencil className="h-4 w-4" />
          {tActions("edit")}
        </Link>
      </div>
    );
  }

  // ── Target edit pages: /targets/[id]/edit ────────────────────────────────
  const targetEditMatch = /^\/targets\/([^/]+)\/edit$/.exec(pathname);
  if (targetEditMatch) {
    const targetId = targetEditMatch[1];
    return (
      <div className={ACTION_ROW}>
        <Link href={`/targets/${targetId}`} className={SECONDARY_BTN}>
          <CalendarPlus className="h-4 w-4" />
          {tActions("backToTarget")}
        </Link>
      </div>
    );
  }

  // ── Initiative detail pages: /initiatives/[id] ──────────────────────────
  const initiativeDetailMatch = /^\/initiatives\/([^/]+)$/.exec(pathname);
  if (initiativeDetailMatch && initiativeDetailMatch[1] !== "new") {
    const initiativeId = initiativeDetailMatch[1];
    return (
      <div className={ACTION_ROW}>
        <Link href={`/initiatives/${initiativeId}/edit`} className={SECONDARY_BTN}>
          <Pencil className="h-4 w-4" />
          {tActions("edit")}
        </Link>
      </div>
    );
  }

  // ── Initiative edit pages: /initiatives/[id]/edit ────────────────────────
  const initiativeEditMatch = /^\/initiatives\/([^/]+)\/edit$/.exec(pathname);
  if (initiativeEditMatch) {
    const initiativeId = initiativeEditMatch[1];
    return (
      <div className={ACTION_ROW}>
        <Link href={`/initiatives/${initiativeId}`} className={SECONDARY_BTN}>
          <CalendarPlus className="h-4 w-4" />
          {tActions("backToInitiative")}
        </Link>
      </div>
    );
  }

  // ── Meeting detail pages: /meetings/[id] ────────────────────────────────
  // Handled before config because the href requires the dynamic [id] segment.
  const meetingDetailMatch = /^\/meetings\/([^/]+)$/.exec(pathname);
  if (meetingDetailMatch && meetingDetailMatch[1] !== "new") {
    const meetingId = meetingDetailMatch[1];
    return (
      <div className={ACTION_ROW}>
        <Link href={`/meetings/${meetingId}/edit`} className={SECONDARY_BTN}>
          <Pencil className="h-4 w-4" />
          {tActions("edit")}
        </Link>
        <button type="button" className={PRIMARY_BTN}>
          <CheckCircle2 className="h-4 w-4" />
          {tActions("decisionMake")}
        </button>
      </div>
    );
  }

  // ── Meeting edit pages: /meetings/[id]/edit ──────────────────────────────
  const meetingEditMatch = /^\/meetings\/([^/]+)\/edit$/.exec(pathname);
  if (meetingEditMatch) {
    const meetingId = meetingEditMatch[1];
    return (
      <div className={ACTION_ROW}>
        <Link href={`/meetings/${meetingId}`} className={SECONDARY_BTN}>
          <CalendarPlus className="h-4 w-4" />
          {tActions("backToMeeting")}
        </Link>
      </div>
    );
  }

  // ── Config-driven routes (9 / 10 route groups) ───────────────────────────
  const configActions = getRouteActions(pathname);
  if (configActions) {
    return (
      <div className={ACTION_ROW}>
        {configActions.map((def, i) => renderAction(def, i))}
      </div>
    );
  }

  // ── Planner view-switcher (kept imperative) ───────────────────────────────
  // Three of the four actions have per-item conditional visibility
  // ("hide when already on that planner view") which is intentionally
  // kept imperative rather than encoded in config data.
  if (
    pathname === "/dashboard/planner" ||
    pathname === "/dashboard/planner/week" ||
    pathname === "/dashboard/planner/day"
  ) {
    return (
      <div className={ACTION_ROW}>
        <Link href={seasonUrl("/dashboard/planner/new")} className={PRIMARY_BTN}>
          <Plus className="h-4 w-4" />
          {tActions("plannerEntryNew")}
        </Link>

        {pathname !== "/dashboard/planner" ? (
          <Link href={seasonUrl("/dashboard/planner")} className={SECONDARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {tNav("saisonplanner")}
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/week" ? (
          <Link href={seasonUrl("/dashboard/planner/week")} className={SECONDARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {tNav("wochenplanner")}
          </Link>
        ) : null}

        {pathname !== "/dashboard/planner/day" ? (
          <Link href={seasonUrl("/dashboard/planner/day")} className={SECONDARY_BTN}>
            <CalendarPlus className="h-4 w-4" />
            {tNav("tagesplanner")}
          </Link>
        ) : null}
      </div>
    );
  }

  return null;
}

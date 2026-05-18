/**
 * Admin route action configuration.
 *
 * Defines the per-route action buttons/links that appear in the admin header.
 * AdminPageActions uses ADMIN_ROUTE_ACTIONS for straightforward routes and
 * falls back to imperative JSX for the planner view-switcher (which has
 * per-action conditional visibility based on the current pathname).
 *
 * Action variants:
 *   "primary"   — filled blue button/link
 *   "secondary" — white bordered button/link
 *   "danger"    — red bordered button/link
 */

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
import type { LucideIcon } from "lucide-react";
import { routeMatches, type AdminRouteMatch } from "@/lib/platform/admin-route-config";

export type ActionVariant = "primary" | "secondary" | "danger";

export type ActionDef = {
  /** Lucide icon component reference */
  icon: LucideIcon;
  /** Key within the labelNs messages namespace */
  labelKey: string;
  /** Which messages namespace the labelKey belongs to */
  labelNs: "pageActions" | "nav";
  variant: ActionVariant;
  /** "link" renders <Link>; "button" renders <button type="button"> */
  type: "link" | "button";
  /** For links: the base path. Season query is appended when seasonAware=true. */
  href?: string;
  /** If true, the href is wrapped with makeSeasonUrl() before rendering */
  seasonAware?: boolean;
};

export type RouteActionsEntry = {
  pattern: string;
  match: AdminRouteMatch;
  actions: ActionDef[];
};

/**
 * Ordered route action config. First match wins.
 * The planner view-switcher routes (prefix /dashboard/planner + week/day)
 * are intentionally EXCLUDED — their per-action conditional visibility
 * ("hide if already on this planner view") is handled imperatively in
 * AdminPageActions to avoid encoding routing logic in data.
 */
export const ADMIN_ROUTE_ACTIONS: RouteActionsEntry[] = [
  // ── Dashboard ────────────────────────────────────────────────────────────
  {
    pattern: "/dashboard",
    match: "exact",
    actions: [
      { icon: CalendarPlus, labelKey: "plannerOpen", labelNs: "pageActions", variant: "secondary", type: "link", href: "/dashboard/planner", seasonAware: true },
      { icon: Settings2,    labelKey: "seasonsManage", labelNs: "pageActions", variant: "primary",   type: "link", href: "/dashboard/seasons", seasonAware: true },
    ],
  },

  // ── Seasons ───────────────────────────────────────────────────────────────
  {
    pattern: "/dashboard/seasons",
    match: "prefix",
    actions: [
      { icon: Settings2, labelKey: "seasonDelete",   labelNs: "pageActions", variant: "danger",    type: "button" },
      { icon: Plus,      labelKey: "seasonPlanNew",  labelNs: "pageActions", variant: "primary",   type: "link",  href: "/dashboard/seasons#create-season" },
    ],
  },

  // ── Planner: back link (new/edit sub-pages) ───────────────────────────────
  // NOTE: /dashboard/planner, /week, /day are handled imperatively (view-switcher)
  {
    pattern: "/dashboard/planner/new",
    match: "exact",
    actions: [
      { icon: CalendarPlus, labelKey: "backToPlanner", labelNs: "pageActions", variant: "secondary", type: "link", href: "/dashboard/planner", seasonAware: true },
    ],
  },

  // ── Teams ─────────────────────────────────────────────────────────────────
  {
    pattern: "/dashboard/teams",
    match: "prefix",
    actions: [
      { icon: ShieldPlus, labelKey: "seasonSwitch", labelNs: "pageActions", variant: "secondary", type: "link",   href: "/dashboard/seasons", seasonAware: true },
      { icon: Users,      labelKey: "teamNew",      labelNs: "pageActions", variant: "primary",   type: "button" },
    ],
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    pattern: "/dashboard/events",
    match: "prefix",
    actions: [
      { icon: ShieldPlus, labelKey: "seasonSwitch", labelNs: "pageActions", variant: "secondary", type: "link",   href: "/dashboard/seasons", seasonAware: true },
      { icon: Trophy,     labelKey: "eventNew",     labelNs: "pageActions", variant: "primary",   type: "button" },
    ],
  },

  // ── Meetings (canonical standalone routes) ────────────────────────────────
  {
    pattern: "/meetings/new",
    match: "exact",
    actions: [
      {
        icon: CalendarPlus,
        labelKey: "backToMeetings",
        labelNs: "pageActions",
        variant: "secondary",
        type: "link",
        href: "/meetings",
      },
    ],
  },
  {
    pattern: "/meetings",
    match: "exact",
    actions: [
      {
        icon: CalendarPlus,
        labelKey: "meetingPlan",
        labelNs: "pageActions",
        variant: "primary",
        type: "link",    // link so it navigates to /meetings/new
        href: "/meetings/new",
      },
    ],
  },
  {
    pattern: "/meetings/",
    match: "startsWith",
    actions: [
      {
        icon: Pencil,
        labelKey: "edit",
        labelNs: "pageActions",
        variant: "secondary",
        type: "button",
      },
      {
        icon: CheckCircle2,
        labelKey: "decisionMake",
        labelNs: "pageActions",
        variant: "primary",
        type: "button",
      },
    ],
  },

  // ── Targets (canonical standalone routes) ─────────────────────────────────
  // /targets/[id] and /targets/[id]/edit are handled imperatively in AdminPageActions.
  {
    pattern: "/targets/new",
    match: "exact",
    actions: [{ icon: CalendarPlus, labelKey: "backToTargets", labelNs: "pageActions", variant: "secondary", type: "link", href: "/targets" }],
  },
  {
    pattern: "/targets",
    match: "exact",
    actions: [{ icon: Plus, labelKey: "targetNew", labelNs: "pageActions", variant: "primary", type: "link", href: "/targets/new" }],
  },

  // ── Initiatives (canonical standalone routes) ─────────────────────────────
  {
    pattern: "/initiatives/new",
    match: "exact",
    actions: [
      { icon: CalendarPlus, labelKey: "backToInitiatives", labelNs: "pageActions", variant: "secondary", type: "link", href: "/initiatives" },
    ],
  },
  {
    pattern: "/initiatives",
    match: "exact",
    actions: [
      { icon: Plus, labelKey: "initiativePlanNew", labelNs: "pageActions", variant: "primary", type: "link", href: "/initiatives/new" },
    ],
  },
  // Note: /initiatives/[id] and /initiatives/[id]/edit are handled imperatively
  // in AdminPageActions (dynamic ID in href requires regex matching).

  // ── Vereinsleitung / Meetings (legacy — redirects to /meetings) ────────────
  // TODO(decoupling): Patterns move to "/meetings" when Meetings module is decoupled.
  {
    pattern: "/vereinsleitung/meetings",
    match: "exact",
    actions: [
      { icon: CalendarPlus, labelKey: "meetingPlan", labelNs: "pageActions", variant: "primary", type: "button" },
    ],
  },
  {
    pattern: "/vereinsleitung/meetings/",
    match: "startsWith",
    actions: [
      { icon: Pencil,        labelKey: "edit",          labelNs: "pageActions", variant: "secondary", type: "button" },
      { icon: CheckCircle2,  labelKey: "decisionMake",  labelNs: "pageActions", variant: "primary",   type: "button" },
    ],
  },

  // ── Vereinsleitung / Initiativen ──────────────────────────────────────────
  // TODO(decoupling): Patterns move to "/initiatives" when Initiatives module is decoupled.
  {
    pattern: "/vereinsleitung/initiativen",
    match: "exact",
    actions: [
      { icon: Plus, labelKey: "initiativeNew", labelNs: "pageActions", variant: "primary", type: "button" },
    ],
  },
  {
    pattern: "/vereinsleitung/initiativen/",
    match: "startsWith",
    actions: [
      { icon: Pencil, labelKey: "edit",        labelNs: "pageActions", variant: "secondary", type: "button" },
      { icon: Plus,   labelKey: "taskNew",     labelNs: "pageActions", variant: "primary",   type: "button" },
    ],
  },

  // ── Vereinsleitung fallback ───────────────────────────────────────────────
  // TODO(decoupling): When /meetings and /initiatives have their own entries,
  // this fallback should only cover the Vereinsleitung overview itself.
  {
    pattern: "/vereinsleitung",
    match: "prefix",
    actions: [
      { icon: CalendarPlus, labelKey: "meetingPlan",   labelNs: "pageActions", variant: "secondary", type: "button" },
      { icon: Plus,         labelKey: "initiativeNew", labelNs: "pageActions", variant: "primary",   type: "button" },
    ],
  },
];

/**
 * Returns the matching actions for a given pathname, or null if no entry matches.
 * Returns null for the planner view-switcher paths (/dashboard/planner, /week, /day)
 * so AdminPageActions can handle them imperatively.
 */
export function getRouteActions(pathname: string): ActionDef[] | null {
  for (const entry of ADMIN_ROUTE_ACTIONS) {
    if (routeMatches(pathname, entry.pattern, entry.match)) {
      return entry.actions;
    }
  }
  return null;
}

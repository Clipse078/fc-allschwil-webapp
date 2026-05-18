/**
 * Admin route header configuration.
 *
 * Replaces the hardcoded path→content switch in AdminPageHeader.
 * Entries are evaluated in order; the first match wins.
 *
 * Match types:
 *   "exact"      pathname === pattern
 *   "prefix"     pathname === pattern  OR  pathname.startsWith(pattern + "/")
 *   "startsWith" pathname.startsWith(pattern)   — use when pattern already includes trailing "/"
 */

export type AdminRouteMatch = "exact" | "prefix" | "startsWith";

export type AdminRouteHeader = {
  eyebrow: string;
  title: string;
  description: string;
};

export type AdminRouteConfig = {
  pattern: string;
  match: AdminRouteMatch;
  header: AdminRouteHeader;
};

export function routeMatches(pathname: string, pattern: string, match: AdminRouteMatch): boolean {
  switch (match) {
    case "exact":
      return pathname === pattern;
    case "prefix":
      return pathname === pattern || pathname.startsWith(pattern + "/");
    case "startsWith":
      return pathname.startsWith(pattern);
  }
}

/**
 * Ordered route config — most specific entries must come before broader prefixes.
 * Order mirrors the original AdminPageHeader conditional chain exactly.
 */
export const ADMIN_ROUTE_CONFIGS: AdminRouteConfig[] = [
  // ── Planner ────────────────────────────────────────────────────────────────
  {
    pattern: "/dashboard/planner",
    match: "exact",
    header: {
      eyebrow: "Saisonplanner",
      title: "Saisonagenda",
      description:
        "Führende Saisonplanung mit Trainings, Matches, Turnieren, weiteren Events und Ferienperioden über die ganze Saison.",
    },
  },
  {
    pattern: "/dashboard/planner/week",
    match: "exact",
    header: {
      eyebrow: "Wochenplanner",
      title: "Wochenagenda",
      description:
        "Operative Wochenplanung pro Kalenderwoche. Diese Sicht ist für Website und später Mobile App vorgesehen.",
    },
  },
  {
    pattern: "/dashboard/planner/day",
    match: "exact",
    header: {
      eyebrow: "Tagesplanner",
      title: "Tagesagenda",
      description:
        "Operative Tagesplanung für den Live-Betrieb und die direkte Ausspielung auf das Infoboard.",
    },
  },

  // ── Meetings (canonical standalone routes) ────────────────────────────────
  {
    pattern: "/meetings",
    match: "exact",
    header: {
      eyebrow: "Meetings",
      title: "Sitzungen",
      description:
        "Sitzungen und Meetings zentral verwalten – unabhängig von Divisions, Teams oder Org-Einheiten.",
    },
  },
  {
    pattern: "/meetings/new",
    match: "exact",
    header: {
      eyebrow: "Meetings",
      title: "Neues Meeting",
      description: "Meeting planen und Traktanden, Teilnehmer und Beschlüsse erfassen.",
    },
  },
  {
    pattern: "/meetings/",
    match: "startsWith",
    header: {
      eyebrow: "Meetings",
      title: "Meeting Details",
      description: "Traktanden, Teilnehmer, Beschlüsse und Massnahmen.",
    },
  },

  // ── Vereinsleitung / Meetings (legacy — redirects to /meetings) ────────────
  // TODO(decoupling): When Meetings module is decoupled, these patterns move to
  // "/meetings" (exact) and "/meetings/" (startsWith). The MEETINGS_ROUTE_BASE
  // constant in lib/platform/constants.ts centralises this change.
  {
    pattern: "/vereinsleitung/meetings",
    match: "exact",
    header: {
      eyebrow: "Meetings",
      title: "Meetings",
      description: "Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag.",
    },
  },
  {
    pattern: "/vereinsleitung/meetings/vorstandssitzung-april",
    match: "exact",
    header: {
      eyebrow: "Meetings",
      title: "Vorstandssitzung April",
      description: "Protokoll & Beschlüsse",
    },
  },
  {
    pattern: "/vereinsleitung/meetings/",
    match: "startsWith",
    header: {
      eyebrow: "Meetings",
      title: "Meeting Details",
      description: "Protokoll, Teilnehmer, Beschlüsse und Massnahmen.",
    },
  },

  // ── Vereinsleitung / Initiativen ────────────────────────────────────────────
  // TODO(decoupling): When Initiatives module is decoupled, these patterns move to
  // "/initiatives" (exact) and "/initiatives/" (startsWith). The INITIATIVES_ROUTE_BASE
  // constant in lib/platform/constants.ts centralises this change.
  {
    pattern: "/vereinsleitung/initiativen",
    match: "exact",
    header: {
      eyebrow: "Initiativen",
      title: "Initiativen",
      description: "Übersicht aller Initiativen – absteigend vom neuesten zum ältesten Eintrag.",
    },
  },
  {
    pattern: "/vereinsleitung/initiativen/website-relaunch",
    match: "exact",
    header: {
      eyebrow: "Initiativen",
      title: "Website Relaunch",
      description: "Initiativen Details",
    },
  },
  {
    pattern: "/vereinsleitung/initiativen/",
    match: "startsWith",
    header: {
      eyebrow: "Initiativen",
      title: "Initiative Details",
      description: "Fortschritt, Aufgaben, Meetings und Entscheidungen.",
    },
  },

  // ── Vereinsleitung / KPIs + overview ────────────────────────────────────────
  {
    pattern: "/vereinsleitung/kpis",
    match: "exact",
    header: {
      eyebrow: "KPIs",
      title: "KPIs",
      description: "Kennzahlen und Trends für die strategische Steuerung des Vereins.",
    },
  },
  {
    pattern: "/vereinsleitung",
    match: "prefix",
    header: {
      eyebrow: "Vereinsleitung",
      title: "Vereinsleitung – Übersicht",
      description:
        "Strategische Steuerung des Vereins mit Zielen, Initiativen, Meetings, Aufgaben und Entscheidungen an einem Ort.",
    },
  },

  // ── Dashboard modules ────────────────────────────────────────────────────────
  {
    pattern: "/dashboard/seasons",
    match: "prefix",
    header: {
      eyebrow: "Saisons",
      title: "Saisonplanung",
      description:
        "Neue zukünftige Saisons sind in Planung. Die aktuelle Saison ist laufend. Vergangene Saisons werden nach Saisonende automatisch abgeschlossen.",
    },
  },
  {
    pattern: "/dashboard/events",
    match: "prefix",
    header: {
      eyebrow: "Events",
      title: "Events pro Saison",
      description:
        "Events sind saisongeführt und umfassen Matches, Turniere, Trainings sowie weitere Vereinsereignisse pro gewählter Saison.",
    },
  },
  {
    pattern: "/dashboard/teams",
    match: "prefix",
    header: {
      eyebrow: "Teams",
      title: "Teams pro Saison",
      description:
        "Teams sind saisongeführt und werden dynamisch pro Saison und Teamkategorie verwaltet.",
    },
  },
  {
    pattern: "/dashboard/users",
    match: "prefix",
    header: {
      eyebrow: "Benutzer & Rechte",
      title: "Benutzerverwaltung",
      description:
        "Benutzer, Rollen, Berechtigungen und Zugriffe sicher und zentral verwalten.",
    },
  },
  {
    pattern: "/dashboard/persons",
    match: "prefix",
    header: {
      eyebrow: "Personen",
      title: "Personenverwaltung",
      description:
        "Personenstammdaten für Spieler, Trainer und weitere Vereinsrollen strukturiert pflegen.",
    },
  },
  {
    pattern: "/dashboard/players",
    match: "prefix",
    header: {
      eyebrow: "Spieler",
      title: "Spielerverwaltung",
      description:
        "Spielerdaten zentral verwalten und für spätere Prozesse und Teams nutzbar machen.",
    },
  },
  {
    pattern: "/dashboard/trainers",
    match: "prefix",
    header: {
      eyebrow: "Trainer",
      title: "Trainerverwaltung",
      description:
        "Trainerdaten strukturiert verwalten und für Organisation und Website bereitstellen.",
    },
  },

  // ── Utility pages (previously fell through to default) ──────────────────────
  {
    pattern: "/dashboard/logs",
    match: "prefix",
    header: {
      eyebrow: "Admin Log",
      title: "Audit Logs",
      description:
        "Protokollierte Änderungen und Systemaktionen zur Nachvollziehbarkeit und Kontrolle.",
    },
  },
  {
    pattern: "/dashboard/runtime",
    match: "prefix",
    header: {
      eyebrow: "Deployment",
      title: "Runtime & Deployment",
      description:
        "Systemstatus, Deployment-Metadaten und Runtime-Konfiguration auf einen Blick.",
    },
  },
  {
    pattern: "/dashboard/wochenplan",
    match: "prefix",
    header: {
      eyebrow: "Wochenplan",
      title: "Feld-/Garderobenplanung",
      description:
        "Operative Wochenplanung mit Platz- und Garderobenzuteilung für den laufenden Betrieb.",
    },
  },
];

export const ADMIN_ROUTE_DEFAULT_HEADER: AdminRouteHeader = {
  eyebrow: "FC Allschwil",
  title: "Dashboard",
  description:
    "Saisongeführte Einstiegsseite. Saisons sind führend; Teams, Events und Planner werden dynamisch pro Saison aufgebaut.",
};

/**
 * Returns the header config for a given pathname.
 * Falls back to ADMIN_ROUTE_DEFAULT_HEADER if no entry matches.
 *
 * Dynamic segment overrides (regex-matched) run before the static config loop.
 * These cover paths like /meetings/[id]/edit where pattern-based matching can't
 * distinguish the edit path from the detail path without per-segment logic.
 */
export function getAdminRouteHeader(pathname: string): AdminRouteHeader {
  // Meeting edit pages: /meetings/[id]/edit
  if (/^\/meetings\/[^/]+\/edit$/.test(pathname)) {
    return {
      eyebrow: "Meetings",
      title: "Meeting bearbeiten",
      description:
        "Titel, Status, Datum und weitere Meeting-Felder anpassen.",
    };
  }

  for (const entry of ADMIN_ROUTE_CONFIGS) {
    if (routeMatches(pathname, entry.pattern, entry.match)) {
      return entry.header;
    }
  }
  return ADMIN_ROUTE_DEFAULT_HEADER;
}

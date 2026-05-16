import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

export type AdminModuleDefinition = {
  key: string;
  title: string;
  description: string;
  href: string;
  requiredPermissions?: PermissionKey[];
  carrySeason?: boolean;
  showInGrid?: boolean;
};

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Zentrale Übersicht über den aktuellen Systemstatus.",
    href: "/dashboard",
    showInGrid: false,
  },
  {
    key: "strategy",
    title: "Strategie",
    description: "Vereinsziele pro Modul definieren, empfohlene Ziele importieren und Trainingsblöcke gegen Ziele vergleichen.",
    href: "/dashboard/strategy",
    requiredPermissions: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE, PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
  },
  {
    key: "exercises",
    title: "Übungsdatenbank",
    description: "Premium-Übungsbibliothek für 7 Sportarten. Importieren, anpassen und im Vereinsbetrieb einsetzen.",
    href: "/dashboard/training/exercises",
    requiredPermissions: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
  },
  {
    key: "training-bulk-tag",
    title: "Schwerpunkt-Tags",
    description: "Bestehende Trainings nachträglich mit Schwerpunkt taggen um KPI-Tracking zu aktivieren.",
    href: "/dashboard/training/bulk-tag",
    requiredPermissions: [PERMISSIONS.EVENTS_MANAGE],
    showInGrid: false,
  },
  {
    key: "planner",
    title: "Saisonplanner",
    description: "Gesamte Saisonagenda mit Trainings, Matches, Turnieren, Events und Ferienperioden.",
    href: "/dashboard/planner",
    requiredPermissions: [PERMISSIONS.WOCHENPLAN_MANAGE, PERMISSIONS.EVENTS_MANAGE],
    carrySeason: true,
  },
  {
    key: "seasons",
    title: "Saisons",
    description: "Saisons als führende Club-Entität verwalten und die nächste Saison planen.",
    href: "/dashboard/seasons",
    requiredPermissions: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
    carrySeason: true,
  },
  {
    key: "events",
    title: "Events",
    description: "Matches, Turniere, Trainings und weitere Vereinsanlässe zentral verwalten und publizieren.",
    href: "/dashboard/events",
    requiredPermissions: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
    carrySeason: true,
  },
  {
    key: "wochenplan",
    title: "Wochenplan",
    description: "Operative Wochenplanung mit Platz- und Garderobenzuteilung für Sandra.",
    href: "/dashboard/wochenplan",
    requiredPermissions: [PERMISSIONS.WOCHENPLAN_MANAGE],
  },
  {
    key: "users",
    title: "Benutzer",
    description: "Benutzer, Rollen, Passwörter und Zugriffe verwalten.",
    href: "/dashboard/users",
    requiredPermissions: [PERMISSIONS.USERS_MANAGE],
  },
  {
    key: "teams",
    title: "Teams",
    description: "Teams, Kategorien, Saisons und Sichtbarkeit verwalten.",
    href: "/dashboard/teams",
    requiredPermissions: [PERMISSIONS.TEAMS_VIEW, PERMISSIONS.TEAMS_MANAGE],
    carrySeason: true,
  },
  {
    key: "persons",
    title: "Personen",
    description: "Zentrale Personenprofile mit Foto, Kontaktdaten und Rollenhinweisen verwalten.",
    href: "/dashboard/persons",
    requiredPermissions: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    key: "players",
    title: "Spieler",
    description: "Spielerübersichten, Kaderbezug und spätere Website-Publikation vorbereiten.",
    href: "/dashboard/players",
    requiredPermissions: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    key: "trainers",
    title: "Trainer",
    description: "Trainerprofile, Teamzuordnung und Funktionsrollen im FCA Premium UX verwalten.",
    href: "/dashboard/trainers",
    requiredPermissions: [PERMISSIONS.PEOPLE_VIEW, PERMISSIONS.PEOPLE_MANAGE],
  },
  {
    key: "website",
    title: "Website Builder",
    description: "Block-basierter Website-Builder. Seiten erstellen, Inhalte verwalten und Snapshots publizieren.",
    href: "/dashboard/website",
    requiredPermissions: [PERMISSIONS.WEBSITE_MANAGE],
  },
  {
    key: "website-news",
    title: "Website News",
    description: "News-Beiträge erstellen, publizieren und verwalten.",
    href: "/dashboard/website/news",
    requiredPermissions: [PERMISSIONS.WEBSITE_MANAGE],
  },
  {
    key: "website-sponsors",
    title: "Website Sponsoren",
    description: "Sponsor-Einträge verwalten und auf Website und Infoboard einblenden.",
    href: "/dashboard/website/sponsors",
    requiredPermissions: [PERMISSIONS.WEBSITE_MANAGE],
  },
  {
    key: "website-review",
    title: "Website Prüfung",
    description: "Seiten die auf Review und Freigabe warten – Vier-Augen-Inbox.",
    href: "/dashboard/website/review",
    requiredPermissions: [PERMISSIONS.WEBSITE_MANAGE],
  },
  {
    key: "website-settings",
    title: "Website Einstellungen",
    description: "Tenant-Konfiguration, Presets, Infoboard-Optionen und Branding.",
    href: "/dashboard/website/settings",
    requiredPermissions: [PERMISSIONS.WEBSITE_MANAGE],
  },
  {
    key: "logs",
    title: "Admin Log",
    description: "Änderungen und wichtige Systemaktionen nachvollziehen.",
    href: "/dashboard/logs",
    requiredPermissions: [PERMISSIONS.USERS_MANAGE],
  },
];

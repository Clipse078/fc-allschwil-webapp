import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";

export type AdminModuleDefinition = {
  key: string;
  title: string;
  description: string;
  href: string;
  requiredPermissions?: PermissionKey[];
};

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Zentrale Übersicht über den aktuellen Systemstatus.",
    href: "/dashboard",
  },
  {
    key: "seasons",
    title: "Saisons",
    description: "Saisons als führende Club-Entität verwalten und die nächste Saison planen.",
    href: "/dashboard/seasons",
    requiredPermissions: [PERMISSIONS.SEASONS_VIEW, PERMISSIONS.SEASONS_MANAGE],
  },
  {
    key: "events",
    title: "Events",
    description: "Matches, Turniere, Trainings und weitere Vereinsanlässe zentral verwalten und publizieren.",
    href: "/dashboard/events",
    requiredPermissions: [PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE],
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
    key: "logs",
    title: "Admin Log",
    description: "Änderungen und wichtige Systemaktionen nachvollziehen.",
    href: "/dashboard/logs",
    requiredPermissions: [PERMISSIONS.USERS_MANAGE],
  },
];

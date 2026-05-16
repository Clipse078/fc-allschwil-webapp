import { GoalModule } from "@prisma/client";

export type GoalTemplate = {
  id: string;
  sport: "football" | "all";
  module: GoalModule;
  title: string;
  description?: string;
  metricLabel?: string;
  metricValue?: string;
  sortOrder: number;
};

export const GOAL_MODULE_LABELS: Record<GoalModule, string> = {
  TRAINING_PLANNER: "Trainingsplanung",
  STRATEGY_TARGETS: "Strategie & Ziele",
  TEAMS: "Teams",
  REGISTRATIONS: "Anmeldungen",
  COMMUNICATION: "Kommunikation",
  MEDIA_NEWS: "Media & News",
  SPONSORS_BUSINESS: "Business Club & Sponsoren",
  EVENTS: "Vereinsanlässe",
  VOLUNTEERS_OPERATIONS: "Helfer & Betrieb",
  FINANCE: "Finanzen",
  WEBSITE_PUBLISHING: "Website & Publikation",
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // TRAINING_PLANNER
  {
    id: "tp-technique-30",
    sport: "football",
    module: "TRAINING_PLANNER",
    title: "30 % Technik-Fokus pro Saison",
    description: "Mindestens 30 % aller Trainingseinheiten mit Schwerpunkt Technik planen.",
    metricLabel: "% der Trainings",
    metricValue: "30",
    sortOrder: 1,
  },
  {
    id: "tp-conditioning-20",
    sport: "football",
    module: "TRAINING_PLANNER",
    title: "20 % Kondition-Fokus pro Saison",
    description: "Mindestens 20 % aller Trainingseinheiten mit Schwerpunkt Kondition planen.",
    metricLabel: "% der Trainings",
    metricValue: "20",
    sortOrder: 2,
  },
  {
    id: "tp-tactical-25",
    sport: "football",
    module: "TRAINING_PLANNER",
    title: "25 % Taktik-Fokus pro Saison",
    description: "Mindestens 25 % aller Trainingseinheiten mit Schwerpunkt Taktik.",
    metricLabel: "% der Trainings",
    metricValue: "25",
    sortOrder: 3,
  },
  {
    id: "tp-weekly-min",
    sport: "football",
    module: "TRAINING_PLANNER",
    title: "Mind. 1 strukturiertes Training pro Team pro Woche",
    description: "Jedes aktive Team plant mindestens eine strukturierte Trainingseinheit pro Woche.",
    metricLabel: "Trainings / Woche",
    metricValue: "1",
    sortOrder: 4,
  },
  {
    id: "tp-gk-weekly",
    sport: "football",
    module: "TRAINING_PLANNER",
    title: "Torhütertraining mind. 1x pro Woche",
    description: "Torhüter erhalten wöchentlich eine separate Trainingseinheit.",
    metricLabel: "Einheiten / Woche",
    metricValue: "1",
    sortOrder: 5,
  },

  // STRATEGY_TARGETS
  {
    id: "st-season-goal",
    sport: "football",
    module: "STRATEGY_TARGETS",
    title: "Saisonziel zu Saisonbeginn definieren",
    description: "Für jede aktive Mannschaft wird ein sportliches Saisonziel festgelegt.",
    sortOrder: 1,
  },
  {
    id: "st-review-mid",
    sport: "all",
    module: "STRATEGY_TARGETS",
    title: "Halbzeit-Review der Saisonziele",
    description: "Auf Halbzeit der Saison werden Ziele überprüft und ggf. angepasst.",
    sortOrder: 2,
  },

  // TEAMS
  {
    id: "teams-squad-min",
    sport: "football",
    module: "TEAMS",
    title: "Kaderstärke mind. 14 Spieler pro Team",
    description: "Jede Mannschaft startet mit mindestens 14 gemeldeten Spielern in die Saison.",
    metricLabel: "Spieler / Team",
    metricValue: "14",
    sortOrder: 1,
  },
  {
    id: "teams-trainer-min",
    sport: "football",
    module: "TEAMS",
    title: "Jedes Team hat mind. 1 Trainer",
    description: "Saisonstart erst wenn jede Mannschaft mindestens einen aktiven Trainer hat.",
    metricLabel: "Trainer / Team",
    metricValue: "1",
    sortOrder: 2,
  },

  // REGISTRATIONS
  {
    id: "reg-7days",
    sport: "all",
    module: "REGISTRATIONS",
    title: "Neue Anmeldungen innerhalb von 7 Tagen bearbeiten",
    description: "Eingehende Anmeldungen werden spätestens nach 7 Tagen beantwortet und verarbeitet.",
    metricLabel: "Tage",
    metricValue: "7",
    sortOrder: 1,
  },
  {
    id: "reg-youth-routing",
    sport: "football",
    module: "REGISTRATIONS",
    title: "Jede Junioranmeldung an Koordinator weiterleiten",
    description: "Anmeldungen im Juniorenbereich werden automatisch an den zuständigen Koordinator weitergeleitet.",
    sortOrder: 2,
  },

  // COMMUNICATION
  {
    id: "comm-trainer-weekly",
    sport: "all",
    module: "COMMUNICATION",
    title: "Wöchentliche Information an alle Trainer",
    description: "Mindestens 1 strukturierte Kommunikation pro Woche an alle aktiven Trainer.",
    metricLabel: "Nachrichten / Woche",
    metricValue: "1",
    sortOrder: 1,
  },
  {
    id: "comm-parents-monthly",
    sport: "football",
    module: "COMMUNICATION",
    title: "Elterninformation mind. 1x pro Monat (Junioren)",
    description: "Eltern von Juniorenspielern erhalten mindestens einmal pro Monat aktuelle Informationen.",
    metricLabel: "Nachrichten / Monat",
    metricValue: "1",
    sortOrder: 2,
  },

  // MEDIA_NEWS
  {
    id: "media-news-2pm",
    sport: "all",
    module: "MEDIA_NEWS",
    title: "2 News-Beiträge pro Monat veröffentlichen",
    description: "Mindestens 2 Beiträge auf der Vereinswebsite pro Monat publizieren.",
    metricLabel: "Beiträge / Monat",
    metricValue: "2",
    sortOrder: 1,
  },
  {
    id: "media-social-weekly",
    sport: "all",
    module: "MEDIA_NEWS",
    title: "1 Social-Media-Post pro Woche",
    description: "Wöchentlich mindestens einen Social-Media-Beitrag erstellen und publizieren.",
    metricLabel: "Posts / Woche",
    metricValue: "1",
    sortOrder: 2,
  },
  {
    id: "media-matchreport",
    sport: "football",
    module: "MEDIA_NEWS",
    title: "Spielbericht nach jedem Heimspiel der 1. Mannschaft",
    description: "Für jedes Heimspiel der 1. Mannschaft wird ein kurzer Spielbericht veröffentlicht.",
    sortOrder: 3,
  },

  // SPONSORS_BUSINESS
  {
    id: "sponsor-leads-5",
    sport: "all",
    module: "SPONSORS_BUSINESS",
    title: "5 neue Sponsor-Leads pro Saison erfassen",
    description: "Das Business-Club-Team kontaktiert mindestens 5 potenzielle neue Sponsoren pro Saison.",
    metricLabel: "Leads / Saison",
    metricValue: "5",
    sortOrder: 1,
  },
  {
    id: "sponsor-events-2",
    sport: "all",
    module: "SPONSORS_BUSINESS",
    title: "2 Sponsor-Events pro Saison organisieren",
    description: "Mindestens 2 Anlässe exklusiv für Sponsoren und Business-Club-Mitglieder.",
    metricLabel: "Events / Saison",
    metricValue: "2",
    sortOrder: 2,
  },

  // EVENTS
  {
    id: "events-club-2",
    sport: "all",
    module: "EVENTS",
    title: "2 Vereinsanlässe pro Saison organisieren",
    description: "Mindestens 2 Vereinsanlässe für alle Mitglieder pro Saison planen und durchführen.",
    metricLabel: "Anlässe / Saison",
    metricValue: "2",
    sortOrder: 1,
  },
  {
    id: "events-roles-preassign",
    sport: "all",
    module: "EVENTS",
    title: "Verantwortliche Rollen vor Event-Publikation zuweisen",
    description: "Vor der Veröffentlichung jedes Events müssen alle Verantwortlichen definiert sein.",
    sortOrder: 2,
  },

  // VOLUNTEERS_OPERATIONS
  {
    id: "vol-roles-seasonstart",
    sport: "all",
    module: "VOLUNTEERS_OPERATIONS",
    title: "Alle Helferrollen vor Saisonstart besetzen",
    description: "Operativer Saisonstart nur wenn alle definierten Helferfunktionen besetzt sind.",
    sortOrder: 1,
  },
  {
    id: "vol-plan-2weeks",
    sport: "all",
    module: "VOLUNTEERS_OPERATIONS",
    title: "Einsatzplan 2 Wochen vor Event erstellen",
    description: "Spätestens 2 Wochen vor einem Anlass liegt der Helfereinsatzplan vor.",
    metricLabel: "Wochen Vorlauf",
    metricValue: "2",
    sortOrder: 2,
  },

  // FINANCE (later-ready)
  {
    id: "fin-budget-approved",
    sport: "all",
    module: "FINANCE",
    title: "Vereinsbudget zu Saisonbeginn genehmigen",
    description: "Das Jahresbudget wird vor Saisonstart vom Vorstand genehmigt.",
    sortOrder: 1,
  },
  {
    id: "fin-quarterly-close",
    sport: "all",
    module: "FINANCE",
    title: "Quartalsabschluss fristgerecht erstellen",
    description: "Jeder Quartalsabschluss liegt spätestens 30 Tage nach Quartalsende vor.",
    metricLabel: "Tage Verzug max.",
    metricValue: "30",
    sortOrder: 2,
  },

  // WEBSITE_PUBLISHING (later-ready)
  {
    id: "web-teams-updated",
    sport: "all",
    module: "WEBSITE_PUBLISHING",
    title: "Teamseiten vor Saisonstart aktualisieren",
    description: "Alle Teamseiten werden vor dem ersten Pflichtspiel aktualisiert und veröffentlicht.",
    sortOrder: 1,
  },
  {
    id: "web-news-archive",
    sport: "all",
    module: "WEBSITE_PUBLISHING",
    title: "News-Archiv jährlich bereinigen",
    description: "Veraltete oder fehlerhafte News-Beiträge werden jährlich überprüft und bereinigt.",
    sortOrder: 2,
  },
];

export function getTemplatesByModule(): Map<GoalModule, GoalTemplate[]> {
  const map = new Map<GoalModule, GoalTemplate[]>();
  for (const tpl of GOAL_TEMPLATES) {
    const existing = map.get(tpl.module) ?? [];
    existing.push(tpl);
    map.set(tpl.module, existing);
  }
  return map;
}

export function getTemplateById(id: string): GoalTemplate | undefined {
  return GOAL_TEMPLATES.find((t) => t.id === id);
}

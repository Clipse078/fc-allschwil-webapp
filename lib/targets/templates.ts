export type TargetTemplateMetric = {
  label: string;
  type: "PERCENTAGE" | "NUMERIC" | "CURRENCY" | "BOOLEAN";
  direction: "INCREASE" | "DECREASE" | "MAINTAIN";
  targetValue: number;
  unit?: string;
  notes?: string;
};

export type TargetTemplateNudge = {
  title: string;
  body: string;
  frequency?: string;
};

export type TargetTemplate = {
  id: string;
  title: string;
  description: string;
  category: "SPORTLICHE_ENTWICKLUNG" | "MITGLIEDERWACHSTUM" | "FINANZEN" | "AUSBILDUNG" | "MEDIEN_SOZIALES" | "GOVERNANCE";
  period: "SEASON" | "QUARTER" | "YEAR" | "CUSTOM";
  periodLabel?: string;
  moduleKey?: string;
  sportCategory?: string;
  ageGroupHint?: string;
  metrics: TargetTemplateMetric[];
  nudges: TargetTemplateNudge[];
  tags: string[];
};

export const TARGET_TEMPLATES: TargetTemplate[] = [
  // --- SPORTLICHE ENTWICKLUNG ---
  {
    id: "youth-dev-technique",
    title: "Techniktraining Junioren steigern",
    description: "Anteil technischer Trainingseinheiten bei Junioren erhöhen.",
    category: "SPORTLICHE_ENTWICKLUNG",
    period: "SEASON",
    moduleKey: "training",
    sportCategory: "Fussball",
    ageGroupHint: "U10–U17",
    metrics: [
      {
        label: "Anteil Techniktraining",
        type: "PERCENTAGE",
        direction: "INCREASE",
        targetValue: 40,
        unit: "%",
        notes: "Anteil Trainingseinheiten mit Technikschwerpunkt",
      },
      {
        label: "Trainingseinheiten gesamt (Saison)",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 60,
        unit: "Einheiten",
      },
    ],
    nudges: [
      {
        title: "Trainingsplan prüfen",
        body: "Hast du den Trainingsplan für diese Woche auf Technikschwerpunkt geprüft?",
        frequency: "weekly",
      },
    ],
    tags: ["junioren", "training", "technik"],
  },
  {
    id: "player-retention",
    title: "Spielerverbleib verbessern",
    description: "Anteil der Spieler, die von einer Saison zur nächsten im Verein bleiben.",
    category: "SPORTLICHE_ENTWICKLUNG",
    period: "SEASON",
    moduleKey: "squads",
    sportCategory: "Fussball",
    metrics: [
      {
        label: "Spieler-Retention Rate",
        type: "PERCENTAGE",
        direction: "INCREASE",
        targetValue: 80,
        unit: "%",
      },
      {
        label: "Abgänge gesamt",
        type: "NUMERIC",
        direction: "DECREASE",
        targetValue: 10,
        unit: "Spieler",
      },
    ],
    nudges: [
      {
        title: "Abgangsgespräche führen",
        body: "Führe kurze Austrittsinterviews durch, um Abgangsgründe zu verstehen.",
        frequency: "monthly",
      },
    ],
    tags: ["spieler", "retention", "abgang"],
  },
  {
    id: "referee-dev",
    title: "Schiedsrichter-Nachwuchs fördern",
    description: "Anzahl aktiver Schiedsrichter aus den eigenen Reihen steigern.",
    category: "SPORTLICHE_ENTWICKLUNG",
    period: "YEAR",
    moduleKey: "functions",
    metrics: [
      {
        label: "Aktive Schiedsrichter",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 5,
        unit: "Personen",
      },
      {
        label: "Absolvierte SR-Kurse",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 3,
        unit: "Kurse",
      },
    ],
    nudges: [
      {
        title: "SR-Kursangebote prüfen",
        body: "Prüfe aktuelle Schiedsrichter-Kursangebote beim Regionalverband.",
        frequency: "quarterly",
      },
    ],
    tags: ["schiedsrichter", "nachwuchs", "ausbildung"],
  },

  // --- MITGLIEDERWACHSTUM ---
  {
    id: "women-football-growth",
    title: "Frauenfussball ausbauen",
    description: "Anzahl Spielerinnen und Teams im Frauenfussball gezielt steigern.",
    category: "MITGLIEDERWACHSTUM",
    period: "SEASON",
    moduleKey: "squads",
    sportCategory: "Fussball",
    ageGroupHint: "Frauen / Mädchen",
    metrics: [
      {
        label: "Aktive Spielerinnen",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 30,
        unit: "Spielerinnen",
      },
      {
        label: "Frauenteams",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 2,
        unit: "Teams",
      },
    ],
    nudges: [
      {
        title: "Rekrutierungskampagne starten",
        body: "Plant eine gezielte Schnupperwoche für Mädchen und Frauen.",
        frequency: "quarterly",
      },
    ],
    tags: ["frauen", "mädchen", "wachstum"],
  },
  {
    id: "youth-dev-junior-expansion",
    title: "Juniorenbereich ausbauen",
    description: "Mehr Junioren-Teams und Mitglieder für den Verein gewinnen.",
    category: "MITGLIEDERWACHSTUM",
    period: "SEASON",
    moduleKey: "squads",
    sportCategory: "Fussball",
    ageGroupHint: "U6–U17",
    metrics: [
      {
        label: "Aktive Junioren",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 150,
        unit: "Spieler",
      },
      {
        label: "Juniorenteams",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 12,
        unit: "Teams",
      },
    ],
    nudges: [
      {
        title: "Schulen kontaktieren",
        body: "Schule kontaktieren für gemeinsame Schnuppertage oder Fussball-AGs.",
        frequency: "quarterly",
      },
    ],
    tags: ["junioren", "wachstum", "kinderfussball"],
  },
  {
    id: "volunteer-engagement",
    title: "Ehrenamtliche Mitarbeit stärken",
    description: "Anzahl aktiver Ehrenamtlicher und deren Stunden erhöhen.",
    category: "MITGLIEDERWACHSTUM",
    period: "YEAR",
    moduleKey: "functions",
    metrics: [
      {
        label: "Aktive Ehrenamtliche",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 40,
        unit: "Personen",
      },
      {
        label: "Freiwilligenarbeit (Stunden)",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 1000,
        unit: "Stunden",
      },
    ],
    nudges: [
      {
        title: "Ehrenamtsanlässe planen",
        body: "Dankesevent oder Apéro für Ehrenamtliche einplanen.",
        frequency: "quarterly",
      },
    ],
    tags: ["ehrenamt", "freiwillig", "mitarbeit"],
  },

  // --- FINANZEN ---
  {
    id: "sponsor-growth",
    title: "Sponsoring-Einnahmen steigern",
    description: "Gesamte Sponsoring-Einnahmen gegenüber Vorjahr erhöhen.",
    category: "FINANZEN",
    period: "YEAR",
    moduleKey: "finances",
    metrics: [
      {
        label: "Sponsoring-Einnahmen",
        type: "CURRENCY",
        direction: "INCREASE",
        targetValue: 30000,
        unit: "CHF",
      },
      {
        label: "Anzahl Sponsoren",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 15,
        unit: "Sponsoren",
      },
    ],
    nudges: [
      {
        title: "Sponsorengespräche führen",
        body: "Hast du diese Woche mind. einen Sponsorenkontakt gepflegt?",
        frequency: "weekly",
      },
    ],
    tags: ["sponsoring", "finanzen", "einnahmen"],
  },
  {
    id: "fundraising",
    title: "Fundraising-Kampagne",
    description: "Gezielte Spenden- und Fundraisingaktionen für Vereinsprojekte.",
    category: "FINANZEN",
    period: "YEAR",
    moduleKey: "finances",
    metrics: [
      {
        label: "Spendeneinnahmen",
        type: "CURRENCY",
        direction: "INCREASE",
        targetValue: 10000,
        unit: "CHF",
      },
      {
        label: "Abgeschlossene Aktionen",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 3,
        unit: "Aktionen",
      },
    ],
    nudges: [
      {
        title: "Aktionskommunikation prüfen",
        body: "Ist die Spendenaktionstseite aktuell und erreichbar?",
        frequency: "monthly",
      },
    ],
    tags: ["fundraising", "spenden", "finanzen"],
  },

  // --- AUSBILDUNG ---
  {
    id: "trainer-education",
    title: "Trainer-Ausbildungsgrad erhöhen",
    description: "Mehr Trainer mit offiziellen J+S oder SFV-Lizenzen ausstatten.",
    category: "AUSBILDUNG",
    period: "YEAR",
    moduleKey: "training",
    metrics: [
      {
        label: "Lizenzierte Trainer",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 12,
        unit: "Trainer",
      },
      {
        label: "Absolvierte Kurse",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 5,
        unit: "Kurse",
      },
    ],
    nudges: [
      {
        title: "Kurskalender prüfen",
        body: "Prüfe J+S und SFV-Kursangebote für das laufende Quartal.",
        frequency: "quarterly",
      },
    ],
    tags: ["trainer", "lizenz", "ausbildung", "js"],
  },

  // --- MEDIEN & SOZIALES ---
  {
    id: "social-media-growth",
    title: "Social Media Präsenz ausbauen",
    description: "Follower-Zahlen und Engagement auf Social Media steigern.",
    category: "MEDIEN_SOZIALES",
    period: "YEAR",
    moduleKey: "media",
    metrics: [
      {
        label: "Follower gesamt",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 2000,
        unit: "Follower",
      },
      {
        label: "Posts pro Monat",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 12,
        unit: "Posts",
      },
    ],
    nudges: [
      {
        title: "Wochenbericht Social Media",
        body: "Wie viele Posts wurden diese Woche publiziert? Ist das Ziel on track?",
        frequency: "weekly",
      },
    ],
    tags: ["social-media", "kommunikation", "reichweite"],
  },
  {
    id: "news-frequency",
    title: "Medien- & Newsfrequenz steigern",
    description: "Regelmässigere Berichterstattung über Vereinsaktivitäten sicherstellen.",
    category: "MEDIEN_SOZIALES",
    period: "SEASON",
    moduleKey: "news",
    metrics: [
      {
        label: "News-Beiträge pro Monat",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 6,
        unit: "Beiträge",
      },
    ],
    nudges: [
      {
        title: "Redaktionsplan prüfen",
        body: "Sind für diesen Monat mind. 4 Beiträge eingeplant?",
        frequency: "monthly",
      },
    ],
    tags: ["news", "medien", "kommunikation"],
  },
  {
    id: "attendance",
    title: "Zuschauerbeteiligung steigern",
    description: "Durchschnittliche Zuschaueranzahl bei Heimspielen erhöhen.",
    category: "MEDIEN_SOZIALES",
    period: "SEASON",
    moduleKey: "events",
    metrics: [
      {
        label: "Durchschn. Zuschauer/Heimspiel",
        type: "NUMERIC",
        direction: "INCREASE",
        targetValue: 150,
        unit: "Personen",
      },
      {
        label: "Zuschauer-Auslastung",
        type: "PERCENTAGE",
        direction: "INCREASE",
        targetValue: 60,
        unit: "%",
      },
    ],
    nudges: [
      {
        title: "Matchtagskommunikation",
        body: "Wurde das Heimspiel auf allen Kanälen kommuniziert?",
        frequency: "weekly",
      },
    ],
    tags: ["zuschauer", "heimspiel", "publikum"],
  },

  // --- GOVERNANCE ---
  {
    id: "fair-play-discipline",
    title: "Fair-Play-Kultur verbessern",
    description: "Anzahl gelber und roter Karten sowie Verwarnungen senken.",
    category: "GOVERNANCE",
    period: "SEASON",
    moduleKey: "events",
    metrics: [
      {
        label: "Gelbe Karten gesamt",
        type: "NUMERIC",
        direction: "DECREASE",
        targetValue: 30,
        unit: "Karten",
      },
      {
        label: "Rote Karten gesamt",
        type: "NUMERIC",
        direction: "DECREASE",
        targetValue: 3,
        unit: "Karten",
      },
    ],
    nudges: [
      {
        title: "Fair-Play-Auswertung",
        body: "Wie entwickeln sich die Verwarnjungszahlen im Monatsvergleich?",
        frequency: "monthly",
      },
    ],
    tags: ["fair-play", "disziplin", "karten"],
  },
];

export function getTemplateById(id: string): TargetTemplate | undefined {
  return TARGET_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(
  category: TargetTemplate["category"],
): TargetTemplate[] {
  return TARGET_TEMPLATES.filter((t) => t.category === category);
}

export const CATEGORY_LABELS: Record<TargetTemplate["category"], string> = {
  SPORTLICHE_ENTWICKLUNG: "Sportliche Entwicklung",
  MITGLIEDERWACHSTUM: "Mitgliederwachstum",
  FINANZEN: "Finanzen & Infrastruktur",
  AUSBILDUNG: "Ausbildung",
  MEDIEN_SOZIALES: "Medien & Soziales",
  GOVERNANCE: "Governance",
};

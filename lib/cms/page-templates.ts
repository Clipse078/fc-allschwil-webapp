/**
 * lib/cms/page-templates.ts
 *
 * CMS V2 Premium — Page Templates.
 *
 * Provides starter block configurations for common page types.
 * Templates create structured section stacks, NOT hardcoded final content.
 *
 * Editors use these as a starting point and configure actual content
 * through the block property panels.
 *
 * Usage:
 *   const template = getPageTemplate("club-story");
 *   for (const section of template.sections) {
 *     await createPageSection(tenantId, pageId, section);
 *   }
 */

import type { SplitContentCardsSectionConfig } from "@/lib/homepage/section-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageTemplateSectionSeed = {
  type: string;
  label: string;
  config: Record<string, unknown>;
};

export type PageTemplate = {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  category: "content" | "club" | "conversion" | "event" | "other";
  sections: PageTemplateSectionSeed[];
};

// ---------------------------------------------------------------------------
// Helper: default SplitContentCards config factory
// ---------------------------------------------------------------------------

function splitCardsSection(
  label: string,
  eyebrow: string,
  headline: string,
  cards: SplitContentCardsSectionConfig["cards"],
  options?: Partial<SplitContentCardsSectionConfig>,
): PageTemplateSectionSeed {
  return {
    type: "splitContentCards",
    label,
    config: {
      eyebrow,
      headline,
      bodyRichText: null,
      layout: "TEXT_LEFT_CARDS_RIGHT",
      mediaPlacement: "NONE",
      images: [],
      cards: cards ?? [],
      style: {
        theme: "light",
        spacingTop: "md",
        spacingBottom: "md",
        width: "normal",
        alignment: "left",
      },
      background: { type: "none" },
      ...options,
    } satisfies SplitContentCardsSectionConfig,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Standard Content Page ──────────────────────────────────────────────────
  {
    id: "standard-content",
    displayName: "Standard-Inhaltsseite",
    description: "Hero, Fliesstext und ein optionaler CTA. Universell verwendbar.",
    icon: "FileText",
    category: "content",
    sections: [
      {
        type: "hero",
        label: "Hero-Bereich",
        config: {
          title: "",
          subtitle: "",
          ctaLabel: "",
          ctaUrl: "",
        },
      },
      {
        type: "callToAction",
        label: "Aufruf zum Handeln",
        config: {
          title: "",
          body: "",
          primaryLabel: "Jetzt anmelden",
          primaryUrl: "",
        },
      },
    ],
  },

  // ── Club Story Page ────────────────────────────────────────────────────────
  {
    id: "club-story",
    displayName: "Vereinsgeschichte",
    description: "Über-uns-Seite mit Hero, Geschichte und Werteblock.",
    icon: "Trophy",
    category: "club",
    sections: [
      {
        type: "hero",
        label: "Hero — Vereinsgeschichte",
        config: {
          title: "Unsere Geschichte",
          subtitle: "Seit [Jahr] für unsere Mitglieder.",
        },
      },
      splitCardsSection(
        "Unsere Werte",
        "Wer wir sind",
        "Die Werte des FC Allschwil",
        [
          { id: "v1", title: "Gemeinschaft", body: "Wir stehen füreinander ein.", variant: "orange" },
          { id: "v2", title: "Leidenschaft", body: "Fussball ist unsere Leidenschaft.", variant: "blue" },
          { id: "v3", title: "Respekt", body: "Auf und neben dem Platz.", variant: "neutral" },
        ],
      ),
      splitCardsSection(
        "Meilensteine",
        "Unsere Geschichte",
        "Wichtige Etappen auf unserem Weg",
        [
          { id: "m1", title: "Gründung", body: "Der Verein wird gegründet.", variant: "neutral" },
          { id: "m2", title: "Aufstieg", body: "Aufstieg in die höhere Liga.", variant: "orange" },
        ],
        { layout: "CARDS_LEFT_TEXT_RIGHT", style: { theme: "soft", spacingTop: "md", spacingBottom: "md", width: "normal", alignment: "left" } },
      ),
    ],
  },

  // ── Team Landing Page ──────────────────────────────────────────────────────
  {
    id: "team-landing",
    displayName: "Team-Landingpage",
    description: "Teamvorstellung mit Teams-Teaser und Mitmach-CTA.",
    icon: "Users",
    category: "club",
    sections: [
      {
        type: "hero",
        label: "Hero — Teams",
        config: {
          title: "Unsere Mannschaften",
          subtitle: "Entdecke alle Teams des FC Allschwil.",
        },
      },
      {
        type: "teamsTeaser",
        label: "Mannschaften",
        config: { itemCount: 8, heading: "Alle Teams" },
      },
      {
        type: "callToAction",
        label: "Mitmachen",
        config: {
          title: "Möchtest du mitspielen?",
          body: "Komm zu einem Probetraining und lerne unsere Mannschaften kennen.",
          primaryLabel: "Probetraining anfragen",
          primaryUrl: "/anmelden",
        },
      },
    ],
  },

  // ── Sponsor Landing Page ───────────────────────────────────────────────────
  {
    id: "sponsor-landing",
    displayName: "Sponsoren-Landingpage",
    description: "Sponsoring-Seite mit Mehrwert-Karten und Kontakt-CTA.",
    icon: "Award",
    category: "conversion",
    sections: [
      {
        type: "hero",
        label: "Hero — Sponsoring",
        config: {
          title: "Partner werden",
          subtitle: "Unterstütze den FC Allschwil und profitiere.",
        },
      },
      splitCardsSection(
        "Warum Sponsor werden?",
        "Ihre Vorteile",
        "Was Sie als Sponsor gewinnen",
        [
          { id: "s1", title: "Sichtbarkeit", body: "Logo auf Trikot, Bande und Website.", variant: "orange" },
          { id: "s2", title: "Reichweite", body: "Tausende Fans und Mitglieder.", variant: "blue" },
          { id: "s3", title: "Gemeinschaft", body: "Teil einer lebendigen Fussballfamilie.", variant: "neutral" },
        ],
      ),
      {
        type: "callToAction",
        label: "Kontakt aufnehmen",
        config: {
          title: "Interesse geweckt?",
          body: "Kontaktiere uns für ein unverbindliches Gespräch.",
          primaryLabel: "Jetzt anfragen",
          primaryUrl: "/kontakt",
        },
      },
    ],
  },

  // ── Event Landing Page ─────────────────────────────────────────────────────
  {
    id: "event-landing",
    displayName: "Event-Landingpage",
    description: "Veranstaltungsseite mit Hero, Programm-Karten und Anmelde-CTA.",
    icon: "Calendar",
    category: "event",
    sections: [
      {
        type: "hero",
        label: "Hero — Event",
        config: {
          title: "Veranstaltung",
          subtitle: "Datum · Ort · Details",
        },
      },
      {
        type: "eventsTeaser",
        label: "Kommende Veranstaltungen",
        config: { itemCount: 5, heading: "Programm" },
      },
      splitCardsSection(
        "Programm-Details",
        "Ablauf",
        "Was erwartet dich?",
        [
          { id: "e1", title: "Ankunft", body: "Ab 09:00 Uhr", variant: "neutral" },
          { id: "e2", title: "Hauptprogramm", body: "10:00 – 16:00 Uhr", variant: "orange" },
          { id: "e3", title: "Abschluss", body: "Gemütlicher Ausklang", variant: "blue" },
        ],
      ),
      {
        type: "callToAction",
        label: "Anmeldung",
        config: {
          title: "Jetzt anmelden",
          body: "Sichere dir deinen Platz.",
          primaryLabel: "Zur Anmeldung",
          primaryUrl: "/anmelden",
        },
      },
    ],
  },

  // ── Registration Landing Page ──────────────────────────────────────────────
  {
    id: "registration-landing",
    displayName: "Anmelde-Landingpage",
    description: "Mitgliedschaft, Probetraining oder Event-Anmeldung.",
    icon: "ClipboardList",
    category: "conversion",
    sections: [
      {
        type: "hero",
        label: "Hero — Anmeldung",
        config: {
          title: "Jetzt anmelden",
          subtitle: "Einfach und schnell — direkt online.",
        },
      },
      splitCardsSection(
        "So funktioniert es",
        "In 3 Schritten",
        "Einfache Anmeldung",
        [
          { id: "r1", title: "1. Formular ausfüllen", body: "Online-Formular in wenigen Minuten.", variant: "orange" },
          { id: "r2", title: "2. Bestätigung erhalten", body: "Per E-Mail oder Telefon.", variant: "blue" },
          { id: "r3", title: "3. Willkommen!", body: "Du bist Teil des FC Allschwil.", variant: "neutral" },
        ],
      ),
      {
        type: "callToAction",
        label: "Zum Formular",
        config: {
          title: "Bereit?",
          primaryLabel: "Jetzt anmelden",
          primaryUrl: "/anmelden",
        },
      },
    ],
  },

  // ── FAQ Page ───────────────────────────────────────────────────────────────
  {
    id: "faq",
    displayName: "FAQ-Seite",
    description: "Häufige Fragen mit Hero und Antworten-Karten.",
    icon: "HelpCircle",
    category: "content",
    sections: [
      {
        type: "hero",
        label: "Hero — FAQ",
        config: {
          title: "Häufige Fragen",
          subtitle: "Alles was du wissen musst.",
        },
      },
      splitCardsSection(
        "Häufige Fragen",
        "FAQ",
        "Antworten auf deine Fragen",
        [
          { id: "q1", title: "Wie kann ich Mitglied werden?", body: "Fülle unser Online-Formular aus oder komme direkt ins Sekretariat.", variant: "neutral" },
          { id: "q2", title: "Was kostet die Mitgliedschaft?", body: "Die Mitgliedsbeiträge variieren je nach Kategorie.", variant: "neutral" },
          { id: "q3", title: "Gibt es Probetraining?", body: "Ja! Kontaktiere deinen Wunschtrainer für einen Termin.", variant: "neutral" },
        ],
      ),
      {
        type: "callToAction",
        label: "Weitere Fragen?",
        config: {
          title: "Weitere Fragen?",
          body: "Schreibe uns — wir helfen gerne weiter.",
          primaryLabel: "Kontakt aufnehmen",
          primaryUrl: "/kontakt",
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns all page templates. */
export function getAllPageTemplates(): PageTemplate[] {
  return PAGE_TEMPLATES;
}

/** Returns templates grouped by category. */
export function getPageTemplatesByCategory(): Map<PageTemplate["category"], PageTemplate[]> {
  const map = new Map<PageTemplate["category"], PageTemplate[]>();
  for (const t of PAGE_TEMPLATES) {
    const list = map.get(t.category) ?? [];
    list.push(t);
    map.set(t.category, list);
  }
  return map;
}

/** Returns a single template by ID, or undefined. */
export function getPageTemplate(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}

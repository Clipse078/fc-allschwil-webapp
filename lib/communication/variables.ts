/**
 * Communication Template Variable System — Layer 2 of the Communication Foundation.
 *
 * Variables are deterministic context slots injected into templates at render time.
 * No AI generation — variables are defined, typed, and safe.
 *
 * Variable syntax: {{variable.key}}
 *
 * Rendering is a pure string substitution using a safe allowlist. Unknown variables
 * are kept as-is so templates are transparent about unresolved slots.
 *
 * Variable categories:
 *   club.*       — club-level context (always available)
 *   season.*     — active season context
 *   event.*      — event-specific context (moduleKey: "events")
 *   meeting.*    — meeting-specific context (moduleKey: "meetings")
 *   target.*     — target-specific context (moduleKey: "targets")
 *   initiative.* — initiative-specific context (moduleKey: "initiatives")
 *   recipient.*  — addressee context (always available when sending)
 *
 * TODO: Phase B.3.2 — context resolver
 *   Build a ContextResolver that auto-populates variables from DB entities:
 *   resolveContext(moduleKey, entityId) → Record<string, string>
 *   This enables: templateId + entityId → fully rendered output.
 *
 * TODO: Phase B.3.3 — delivery layer
 *   Once context resolution is in place, add:
 *   - email transport (SMTP/SendGrid/Postmark)
 *   - PDF export (headless Chrome / Puppeteer)
 *   - governance approval before send
 *   - audit log of sent communications
 */

export type TemplateVariable = {
  key: string;
  label: string;
  example: string;
  moduleKey?: string;
  description?: string;
};

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Club context — always available
  { key: "club.name", label: "Vereinsname", example: "FC Allschwil" },
  { key: "club.city", label: "Vereinsstadt", example: "Allschwil" },
  { key: "club.email", label: "Vereins-E-Mail", example: "info@fcallschwil.ch" },

  // Season context
  { key: "season.name", label: "Saison", example: "Saison 2025/26" },
  { key: "season.start", label: "Saisonbeginn", example: "01.08.2025" },
  { key: "season.end", label: "Saisonende", example: "31.07.2026" },

  // Event context
  { key: "event.title", label: "Event Titel", example: "E4 Frühlingsturnier Aesch", moduleKey: "events" },
  { key: "event.date", label: "Event Datum", example: "02.05.2026", moduleKey: "events" },
  { key: "event.time", label: "Event Zeit", example: "09:00 Uhr", moduleKey: "events" },
  { key: "event.location", label: "Event Ort", example: "Sportanlage Aesch", moduleKey: "events" },
  { key: "event.team", label: "Team", example: "FC Allschwil E4", moduleKey: "events" },
  { key: "event.opponent", label: "Gegner", example: "FC Concordia Basel", moduleKey: "events" },

  // Meeting context
  { key: "meeting.title", label: "Meeting Titel", example: "Vorstandssitzung April", moduleKey: "meetings" },
  { key: "meeting.date", label: "Meeting Datum", example: "16.04.2024", moduleKey: "meetings" },
  { key: "meeting.time", label: "Meeting Zeit", example: "20:00 Uhr", moduleKey: "meetings" },
  { key: "meeting.location", label: "Meeting Ort", example: "Clubhaus, Sitzungszimmer 1", moduleKey: "meetings" },

  // Target context
  { key: "target.title", label: "Ziel Titel", example: "Frauenfussball ausbauen", moduleKey: "targets" },
  { key: "target.category", label: "Ziel Kategorie", example: "Mitgliederwachstum", moduleKey: "targets" },
  { key: "target.period", label: "Ziel Zeitraum", example: "Saison 2025/26", moduleKey: "targets" },

  // Initiative context
  { key: "initiative.title", label: "Initiative Titel", example: "Website Relaunch", moduleKey: "initiatives" },
  { key: "initiative.owner", label: "Initiative Verantwortlich", example: "Michael Weber", moduleKey: "initiatives" },
  { key: "initiative.status", label: "Initiative Status", example: "In Arbeit", moduleKey: "initiatives" },

  // Recipient context — populated at send time
  { key: "recipient.name", label: "Empfänger Name", example: "Michael Weber", description: "Full name of the addressee" },
  { key: "recipient.firstName", label: "Empfänger Vorname", example: "Michael" },
  { key: "recipient.email", label: "Empfänger E-Mail", example: "m.weber@fcallschwil.ch" },
  { key: "recipient.role", label: "Empfänger Rolle", example: "Präsident" },
];

/** Variable keys grouped by module */
export function getVariablesByModule(moduleKey?: string): TemplateVariable[] {
  return TEMPLATE_VARIABLES.filter(
    (v) => !v.moduleKey || v.moduleKey === moduleKey,
  );
}

/** Build sample context for preview rendering. */
export function buildSampleContext(): Record<string, string> {
  return Object.fromEntries(
    TEMPLATE_VARIABLES.map((v) => [v.key, v.example]),
  );
}

/**
 * Render a template string with a context map.
 *
 * Unknown variables (not in context) are left as {{key}} so the preview
 * is transparent about unresolved slots.
 */
export function renderTemplate(
  template: string,
  context: Record<string, string>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return context[key.trim()] ?? match;
  });
}

/** Extract all variable references used in a template string. */
export function extractVariableKeys(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2).trim()))];
}

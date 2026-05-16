export type CTAVariant = "primary" | "secondary" | "outline" | "ghost";

export type CTATarget = "self" | "blank";

export type CTADefinition = {
  key: string;
  label: string;
  description: string;
  slugSuffix: string;
  variant: CTAVariant;
  target: CTATarget;
  icon: string;
  analyticsEvent?: string;
};

export const CTA_PRESETS: Record<string, CTADefinition> = {
  probetraining: {
    key: "probetraining",
    label: "Probetraining",
    description: "Einfach vorbeikommen und mitmachen — kein Risiko, keine Verpflichtung.",
    slugSuffix: "anmeldung#probetraining",
    variant: "primary",
    target: "self",
    icon: "Play",
    analyticsEvent: "cta_probetraining",
  },
  kontakt: {
    key: "kontakt",
    label: "Kontakt aufnehmen",
    description: "Wir sind für dich da. Schreib uns einfach.",
    slugSuffix: "kontakt",
    variant: "secondary",
    target: "self",
    icon: "Mail",
    analyticsEvent: "cta_kontakt",
  },
  mitglied: {
    key: "mitglied",
    label: "Mitglied werden",
    description: "Werde Teil der Vereinsfamilie und gestalte den Verein mit.",
    slugSuffix: "anmeldung#mitglied",
    variant: "primary",
    target: "self",
    icon: "UserPlus",
    analyticsEvent: "cta_mitglied",
  },
  sponsor: {
    key: "sponsor",
    label: "Sponsor werden",
    description: "Unterstütze den Club und profitiere von attraktiven Partnerpaketen.",
    slugSuffix: "anmeldung#sponsor",
    variant: "secondary",
    target: "self",
    icon: "Handshake",
    analyticsEvent: "cta_sponsor",
  },
  trainer: {
    key: "trainer",
    label: "Trainer werden",
    description: "Gib dein Wissen weiter und präge die nächste Spielergeneration.",
    slugSuffix: "anmeldung#trainer",
    variant: "outline",
    target: "self",
    icon: "Users",
    analyticsEvent: "cta_trainer",
  },
  jetzt_kontaktieren: {
    key: "jetzt_kontaktieren",
    label: "Jetzt kontaktieren",
    description: "Direkte Ansprechperson für deine Anliegen.",
    slugSuffix: "kontakt",
    variant: "primary",
    target: "self",
    icon: "ArrowRight",
    analyticsEvent: "cta_jetzt_kontaktieren",
  },
};

export type ResolvedCTA = CTADefinition & {
  href: string;
};

export function resolveCTA(
  ctaKey: string,
  tenantKey: string
): ResolvedCTA | null {
  const preset = CTA_PRESETS[ctaKey];
  if (!preset) return null;
  return {
    ...preset,
    href: `/${tenantKey}/${preset.slugSuffix}`,
  };
}

export function resolveHomepageCTAs(tenantKey: string): ResolvedCTA[] {
  return ["probetraining", "kontakt", "mitglied"]
    .map((k) => resolveCTA(k, tenantKey))
    .filter((c): c is ResolvedCTA => c !== null);
}

export function resolveRegistrationCTAs(tenantKey: string): ResolvedCTA[] {
  return ["probetraining", "mitglied", "trainer", "sponsor"]
    .map((k) => resolveCTA(k, tenantKey))
    .filter((c): c is ResolvedCTA => c !== null);
}

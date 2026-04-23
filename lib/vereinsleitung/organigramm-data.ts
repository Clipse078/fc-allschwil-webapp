export type OrganigrammRole = {
  id: string;
  title: string;
  personName: string;
  subtitle?: string;
  imageSrc?: string | null;
};

export type OrganigrammArea = {
  id: string;
  title: string;
  description: string;
  accent: "red" | "blue" | "slate";
  roles: OrganigrammRole[];
};

export const ORGANIGRAMM_AREAS: OrganigrammArea[] = [
  {
    id: "vereinsleitung",
    title: "Vereinsleitung",
    description: "Strategische Führung, Governance und langfristige Vereinsentwicklung.",
    accent: "red",
    roles: [
      { id: "praesidium", title: "Präsidium", personName: "Name ergänzen", subtitle: "Gesamtverantwortung", imageSrc: null },
      { id: "vizepraesidium", title: "Vizepräsidium", personName: "Name ergänzen", subtitle: "Stellvertretung & Koordination", imageSrc: null },
      { id: "finanzen", title: "Finanzen", personName: "Name ergänzen", subtitle: "Budget, Rechnungen, Kontrolle", imageSrc: null },
      { id: "aktuariat", title: "Aktuariat", personName: "Name ergänzen", subtitle: "Protokolle, Administration, Formalien", imageSrc: null },
      { id: "sponsoring", title: "Sponsoring", personName: "Name ergänzen", subtitle: "Partner, Betreuung, Ausbau", imageSrc: null },
      { id: "medien", title: "Medien & Kommunikation", personName: "Name ergänzen", subtitle: "Website, Social Media, Kommunikation", imageSrc: null }
    ]
  },
  {
    id: "operations",
    title: "Operations",
    description: "Operative Vereinsprozesse, Tagesgeschäft und organisatorische Steuerung.",
    accent: "blue",
    roles: [
      { id: "fussballorganisation", title: "Fussballorganisation", personName: "Name ergänzen", subtitle: "Operative Gesamtkoordination", imageSrc: null },
      { id: "spielbetrieb", title: "Spielbetrieb", personName: "Name ergänzen", subtitle: "Wochenplan, Ansetzungen, Abläufe", imageSrc: null },
      { id: "material", title: "Material", personName: "Name ergänzen", subtitle: "Bestand, Ausgaben, Bedarf", imageSrc: null },
      { id: "events", title: "Events & Aktivitäten", personName: "Name ergänzen", subtitle: "Vereinsanlässe & Helferkoordination", imageSrc: null },
      { id: "infrastruktur", title: "Infrastruktur", personName: "Name ergänzen", subtitle: "Anlage, Räume, Infrastruktur", imageSrc: null },
      { id: "administration", title: "Administration", personName: "Name ergänzen", subtitle: "Organisation, Support, Prozesse", imageSrc: null }
    ]
  },
  {
    id: "technisches-kader",
    title: "Technisches Kader",
    description: "Sportliche Führung, Ausbildung und technische Verantwortung über die Fussballbereiche.",
    accent: "slate",
    roles: [
      { id: "technische-leitung", title: "Technische Leitung", personName: "Name ergänzen", subtitle: "Sportliche Gesamtverantwortung", imageSrc: null },
      { id: "aktive", title: "Aktive", personName: "Name ergänzen", subtitle: "1./2. Mannschaft & sportliche Steuerung", imageSrc: null },
      { id: "frauen", title: "Frauen", personName: "Name ergänzen", subtitle: "Frauenbereich & Entwicklung", imageSrc: null },
      { id: "junioren", title: "Junioren", personName: "Name ergänzen", subtitle: "D/C/B/A und Ausbildungsstruktur", imageSrc: null },
      { id: "kifu", title: "Kinderfussball", personName: "Name ergänzen", subtitle: "G/F/E Koordination", imageSrc: null },
      { id: "torhueter", title: "Torhüter / Spezialfunktionen", personName: "Name ergänzen", subtitle: "Spezialtraining & fachliche Betreuung", imageSrc: null }
    ]
  }
];

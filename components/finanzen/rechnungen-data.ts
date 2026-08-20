// ── Demo-only invoice data — never persisted, never DB-backed ─────────────────
// All data is purely illustrative. No real invoices are created or stored.

export type InvoiceStatus =
  | "Entwurf"
  | "Offen"
  | "Überfällig"
  | "Bezahlt"
  | "Storniert";

export type RecipientType =
  | "Mitglied"
  | "Sponsor"
  | "Partner"
  | "Team / Gruppe"
  | "Sonstige";

export type InvoicePosition = {
  id: string;
  bezeichnung: string;
  menge: number;
  einzelpreis: number;
  mwstPct?: number; // e.g. 7.7
};

export type Invoice = {
  id: string;
  number: string;
  recipient: string;
  recipientType: RecipientType;
  recipientAddress: string;
  recipientContact?: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  subject: string;
  reference?: string;
  notes?: string;
  positions: InvoicePosition[];
  paidDate?: string;
  paymentMethod?: string;
};

export const DEMO_INVOICES: Invoice[] = [
  {
    id: "inv-001",
    number: "R-2026-001",
    recipient: "Max Müller",
    recipientType: "Mitglied",
    recipientAddress: "Kirchgasse 14, 5000 Aarau",
    recipientContact: "max.mueller@example.ch",
    issueDate: "15. Jan 2026",
    dueDate: "14. Feb 2026",
    amount: 280.0,
    status: "Bezahlt",
    subject: "Mitgliederbeitrag Saison 2026/27",
    reference: "MB-2026-MM",
    paidDate: "3. Feb 2026",
    paymentMethod: "Banküberweisung",
    positions: [
      { id: "p1", bezeichnung: "Aktivmitglied Jahresbeitrag", menge: 1, einzelpreis: 280.0 },
    ],
  },
  {
    id: "inv-002",
    number: "R-2026-002",
    recipient: "SportAarau AG",
    recipientType: "Sponsor",
    recipientAddress: "Industriestrasse 12, 5000 Aarau",
    recipientContact: "sponsoring@sportaarau.ch",
    issueDate: "1. Feb 2026",
    dueDate: "3. Mär 2026",
    amount: 12000.0,
    status: "Bezahlt",
    subject: "Sponsoring Hauptsponsor Saison 2026/27",
    reference: "SPON-2026-SA-01",
    paidDate: "22. Feb 2026",
    paymentMethod: "Banküberweisung",
    positions: [
      { id: "p1", bezeichnung: "Hauptsponsoring Trikot & Präsenz", menge: 1, einzelpreis: 10000.0, mwstPct: 8.1 },
      { id: "p2", bezeichnung: "Logobranding Vereinswebsite", menge: 1, einzelpreis: 1900.0, mwstPct: 8.1 },
      { id: "p3", bezeichnung: "Anzeige Matchprogramm (4 Ausgaben)", menge: 4, einzelpreis: 25.0, mwstPct: 8.1 },
    ],
    notes: "Jahreszahlung gemäss Sponsoringvertrag 2026.",
  },
  {
    id: "inv-003",
    number: "R-2026-003",
    recipient: "Familie Keller",
    recipientType: "Mitglied",
    recipientAddress: "Schlossgasse 3, 5001 Aarau",
    recipientContact: "keller.fam@example.ch",
    issueDate: "15. Jan 2026",
    dueDate: "14. Feb 2026",
    amount: 420.0,
    status: "Bezahlt",
    subject: "Mitgliederbeiträge Saison 2026/27 (Familienpaket)",
    reference: "MB-2026-KF",
    paidDate: "8. Feb 2026",
    paymentMethod: "Banküberweisung",
    positions: [
      { id: "p1", bezeichnung: "Aktivmitglied Jahresbeitrag (2× Kinder)", menge: 2, einzelpreis: 180.0 },
      { id: "p2", bezeichnung: "Passivmitglied Jahresbeitrag (Eltern)", menge: 1, einzelpreis: 60.0 },
    ],
  },
  {
    id: "inv-004",
    number: "R-2026-004",
    recipient: "Sportcenter Telli",
    recipientType: "Partner",
    recipientAddress: "Tellistrasse 88, 5004 Aarau",
    recipientContact: "info@sportcenter-telli.ch",
    issueDate: "1. Mär 2026",
    dueDate: "1. Apr 2026",
    amount: 2500.0,
    status: "Offen",
    subject: "Bandenwerbung Saison 2026/27",
    reference: "BAND-2026-SCT",
    positions: [
      { id: "p1", bezeichnung: "Bandenwerbung Hauptfeld (1 Saison)", menge: 1, einzelpreis: 2500.0, mwstPct: 8.1 },
    ],
    notes: "Zahlungsfrist 30 Tage netto.",
  },
  {
    id: "inv-005",
    number: "R-2026-005",
    recipient: "FCA Junioren B",
    recipientType: "Team / Gruppe",
    recipientAddress: "c/o FCA, Rüttiholzstrasse 1, 5000 Aarau",
    recipientContact: "junioren-b@fca.ch",
    issueDate: "10. Mär 2026",
    dueDate: "10. Apr 2026",
    amount: 350.0,
    status: "Überfällig",
    subject: "Turnierbeitrag Herbstturnier 2026",
    reference: "TURNIER-2026-JUB",
    positions: [
      { id: "p1", bezeichnung: "Startgebühr Herbstturnier", menge: 1, einzelpreis: 200.0 },
      { id: "p2", bezeichnung: "Schiedsrichtergebühr Anteil", menge: 3, einzelpreis: 50.0 },
    ],
  },
  {
    id: "inv-006",
    number: "R-2026-006",
    recipient: "Bank Cler AG",
    recipientType: "Sponsor",
    recipientAddress: "Bahnhofstrasse 10, 5000 Aarau",
    recipientContact: "sponsoring@cler.ch",
    issueDate: "15. Mär 2026",
    dueDate: "15. Apr 2026",
    amount: 5000.0,
    status: "Offen",
    subject: "Sponsoring Trikotwerbung Saison 2026/27",
    reference: "SPON-2026-BC-01",
    positions: [
      { id: "p1", bezeichnung: "Trikotbranding (3. Trikot, 1. Mannschaft)", menge: 1, einzelpreis: 5000.0, mwstPct: 8.1 },
    ],
  },
  {
    id: "inv-007",
    number: "R-2026-007",
    recipient: "Einwohnergemeinde Aarau",
    recipientType: "Sonstige",
    recipientAddress: "Rathausgasse 1, 5000 Aarau",
    recipientContact: "finanzen@aarau.ch",
    issueDate: "1. Apr 2026",
    dueDate: "30. Apr 2026",
    amount: 8400.0,
    status: "Offen",
    subject: "Platzmiete Jahresabrechnung 2025/26",
    reference: "PLATZ-2026-JA",
    positions: [
      { id: "p1", bezeichnung: "Platzmiete Hauptfeld (12 Monate)", menge: 12, einzelpreis: 650.0 },
      { id: "p2", bezeichnung: "Platzmiete Nebenfeld (12 Monate)", menge: 12, einzelpreis: 50.0 },
    ],
    notes: "Gemäss Vertrag mit der Gemeinde Aarau, erneuert bis 2028.",
  },
  {
    id: "inv-008",
    number: "R-2026-008",
    recipient: "Lisa Muster",
    recipientType: "Mitglied",
    recipientAddress: "Schachenallee 7, 5000 Aarau",
    recipientContact: "lisa.muster@example.ch",
    issueDate: "18. Apr 2026",
    dueDate: "18. Mai 2026",
    amount: 120.0,
    status: "Entwurf",
    subject: "Trainerlizenzgebühr Ausbildung 2026",
    reference: "LIZENZ-2026-LM",
    positions: [
      { id: "p1", bezeichnung: "Trainerlizenz Kursgebühr (Anteil Verein)", menge: 1, einzelpreis: 120.0 },
    ],
    notes: "Entwurf — noch nicht versandt.",
  },
  {
    id: "inv-009",
    number: "R-2026-009",
    recipient: "Intersport Aarau",
    recipientType: "Partner",
    recipientAddress: "Kasinostrasse 14, 5000 Aarau",
    recipientContact: "aarau@intersport.ch",
    issueDate: "5. Feb 2026",
    dueDate: "5. Mär 2026",
    amount: 1840.0,
    status: "Bezahlt",
    subject: "Materialbezug Saisonstart 2026",
    reference: "MAT-2026-IS",
    paidDate: "28. Feb 2026",
    paymentMethod: "Banküberweisung",
    positions: [
      { id: "p1", bezeichnung: "Trainingsbälle Gr. 5 (12 Stk.)", menge: 12, einzelpreis: 85.0, mwstPct: 8.1 },
      { id: "p2", bezeichnung: "Leibchen Set (24 Stk.)", menge: 24, einzelpreis: 18.0, mwstPct: 8.1 },
      { id: "p3", bezeichnung: "Trinkflaschen (12 Stk.)", menge: 12, einzelpreis: 12.0, mwstPct: 8.1 },
    ],
  },
  {
    id: "inv-010",
    number: "R-2026-010",
    recipient: "FCA 1. Mannschaft",
    recipientType: "Team / Gruppe",
    recipientAddress: "c/o FCA, Rüttiholzstrasse 1, 5000 Aarau",
    issueDate: "20. Feb 2026",
    dueDate: "22. Mär 2026",
    amount: 680.0,
    status: "Storniert",
    subject: "Auswärtsspiel Reisekostenrückerstattung",
    reference: "REISE-2026-1M",
    positions: [
      { id: "p1", bezeichnung: "Busmiete Auswärtsspiel Basel", menge: 1, einzelpreis: 480.0 },
      { id: "p2", bezeichnung: "Verpflegungspauschale", menge: 20, einzelpreis: 10.0 },
    ],
    notes: "Storniert — Spiel verlegt, neue Rechnung folgt.",
  },
  {
    id: "inv-011",
    number: "R-2026-011",
    recipient: "FCA Administration",
    recipientType: "Sonstige",
    recipientAddress: "Rüttiholzstrasse 1, 5000 Aarau",
    issueDate: "22. Apr 2026",
    dueDate: "22. Mai 2026",
    amount: 450.0,
    status: "Entwurf",
    subject: "Passgebühren Neuzugänge Saison 2026/27",
    reference: "PASS-2026-NEU",
    positions: [
      { id: "p1", bezeichnung: "Passgebühr SFV (Neuzugang)", menge: 9, einzelpreis: 50.0 },
    ],
    notes: "Entwurf — Passgebühren werden noch zusammengestellt.",
  },
  {
    id: "inv-012",
    number: "R-2026-012",
    recipient: "Garage Müller & Söhne",
    recipientType: "Sponsor",
    recipientAddress: "Hauptstrasse 45, 5022 Rombach",
    recipientContact: "info@garage-mueller.ch",
    issueDate: "1. Mär 2026",
    dueDate: "31. Mär 2026",
    amount: 800.0,
    status: "Überfällig",
    subject: "Sponsoring Kleinanzeige Matchprogramm 2026",
    reference: "SPON-2026-GM",
    positions: [
      { id: "p1", bezeichnung: "Kleinanzeige Matchprogramm (8 Ausgaben)", menge: 8, einzelpreis: 100.0, mwstPct: 8.1 },
    ],
  },
];

export type InvoiceStatusConfig = {
  variant: "success" | "warning" | "danger" | "default" | "info" | "secondary";
  label: string;
};

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, InvoiceStatusConfig> = {
  Entwurf:    { variant: "default",   label: "Entwurf"   },
  Offen:      { variant: "info",      label: "Offen"     },
  Überfällig: { variant: "danger",    label: "Überfällig"},
  Bezahlt:    { variant: "success",   label: "Bezahlt"   },
  Storniert:  { variant: "secondary", label: "Storniert" },
};

export const RECIPIENT_TYPE_OPTIONS: RecipientType[] = [
  "Mitglied",
  "Sponsor",
  "Partner",
  "Team / Gruppe",
  "Sonstige",
];

export const DEMO_RECIPIENTS: Record<RecipientType, string[]> = {
  "Mitglied": [
    "Max Müller",
    "Lisa Muster",
    "Familie Keller",
    "Thomas Berger",
    "Anna Schmidt",
    "Peter Huber",
  ],
  "Sponsor": [
    "SportAarau AG",
    "Bank Cler AG",
    "Garage Müller & Söhne",
    "Migros Aarau",
    "Baumann Immobilien",
  ],
  "Partner": [
    "Sportcenter Telli",
    "Intersport Aarau",
    "Physiotherapie Aarau",
    "Medbase Aarau",
  ],
  "Team / Gruppe": [
    "1. Mannschaft",
    "2. Mannschaft",
    "FCA Junioren A",
    "FCA Junioren B",
    "FCA Junioren C",
    "FCA Frauen",
  ],
  "Sonstige": [
    "Einwohnergemeinde Aarau",
    "FCA Administration",
    "SFV",
    "Kantonsverband Aargau",
  ],
};

export function calcPositionTotal(pos: InvoicePosition): number {
  const base = pos.menge * pos.einzelpreis;
  const vat = pos.mwstPct ? base * (pos.mwstPct / 100) : 0;
  return base + vat;
}

export function calcInvoiceTotals(positions: InvoicePosition[]): {
  subtotal: number;
  totalVat: number;
  total: number;
} {
  let subtotal = 0;
  let totalVat = 0;
  for (const pos of positions) {
    const base = pos.menge * pos.einzelpreis;
    const vat = pos.mwstPct ? base * (pos.mwstPct / 100) : 0;
    subtotal += base;
    totalVat += vat;
  }
  return { subtotal, totalVat, total: subtotal + totalVat };
}

export function fmtCHF(n: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

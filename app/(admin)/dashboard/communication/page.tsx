import {
  FileStack,
  Mail,
  Palette,
  PenLine,
  Send,
  Signature,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { ModuleCapabilityCard } from "@/components/admin/future-modules/ModuleCapabilityCard";
import { Badge } from "@/components/ui/Badge";
import { PageBreadcrumbs, PageHeader, PageShell, SectionCard } from "@/components/ui/page";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { TENANT_ADMINISTRATION_PERMISSIONS } from "@/lib/permissions/tenant-administration";

export const dynamic = "force-dynamic";

const audienceFoundations = [
  "Gesamter Verein",
  "Organisationseinheiten",
  "Teams und mehrere Teams",
  "Einzelpersonen",
  "Rollen und Funktionen",
  "Trainer, Co-Trainer, Spieler und Eltern",
  "Kombinationen und Ausschlüsse",
  "Gespeicherte, dynamische und manuelle Zielgruppen",
  "Deduplizierung",
  "Empfängervorschau und Zustellbarkeit",
];

export default async function CommunicationPage() {
  await requireAnyPermission(TENANT_ADMINISTRATION_PERMISSIONS);

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Kommunikation" },
        ]}
      />

      <PageHeader
        eyebrow="Kommunikation"
        title="Kommunikation"
        description="Nachrichten, Zielgruppen und Kommunikation zentral verwalten."
        badge={<Badge variant="warning">Modul im Aufbau</Badge>}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-primary)]" aria-hidden />
        <p className="text-xs leading-5 text-[var(--text-2)]">
          <span className="font-semibold text-[var(--foreground)]">
            E-Mail-Absender ist bereits verfügbar.
          </span>{" "}
          Alle weiteren Bereiche zeigen die geplante Produktausrichtung und speichern noch keine Daten.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCapabilityCard
          title="Nachrichten"
          description="E-Mail-Kommunikation und Kommunikationsverlauf zentral verwalten."
          icon={Mail}
          status="In Arbeit"
          details={["Kommunikationsverlauf", "Anhänge", "Mehrere Kanäle"]}
        />
        <ModuleCapabilityCard
          title="Neue Nachricht"
          description="Nachrichten an einzelne Personen oder zukünftige Zielgruppen senden."
          icon={PenLine}
          status="In Arbeit"
          details={["Einzelversand", "Zielgruppen", "Signaturauswahl"]}
        />
        <ModuleCapabilityCard
          title="Zielgruppen"
          description="Empfänger flexibel nach Organisation, Funktion, Team und weiteren Kriterien zusammenstellen."
          icon={UsersRound}
          status="Demnächst"
          details={["Dynamisch", "Manuell", "Hybrid", "Empfängervorschau"]}
        />
        <ModuleCapabilityCard
          title="Versand"
          description="Geplante und durchgeführte Versände nachvollziehen."
          icon={Send}
          status="Demnächst"
          details={["Einzel- und Massenversand", "Planung", "Status", "Fehler und Wiederholung"]}
        />
        <ModuleCapabilityCard
          title="E-Mail-Absender"
          description="Absendername und E-Mail-Adresse des Vereins verwalten."
          icon={SlidersHorizontal}
          status="Verfügbar"
          href="/dashboard/communication/email-sender"
          linkLabel="Absender verwalten"
          details={["Tenant-spezifisch", "Sicherer Standardabsender", "Antwort-Zuordnung"]}
        />
        <ModuleCapabilityCard
          title="Persönliche Signaturen"
          description="Eigene Signaturen für persönliche Vereinskommunikation verwalten."
          icon={Signature}
          status="Demnächst"
          details={["Pro Benutzer und Verein", "Mehrere Signaturen", "Standard und Auswahl", "Historisch erhalten"]}
        />
      </div>

      <SectionCard
        title="Zielgruppen — geplante Grundlage"
        description="Der spätere Zielgruppen-Baukasten verbindet Organisationsstruktur, Funktionen und einzelne Personen, ohne heute eine Auswahl vorzutäuschen."
        className="mt-8"
      >
        <div className="flex flex-wrap gap-2">
          {audienceFoundations.map((foundation) => (
            <span
              key={foundation}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text-2)]"
            >
              {foundation}
            </span>
          ))}
        </div>
      </SectionCard>

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Gemeinsame Plattformbausteine
            </h2>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Diese Fähigkeiten werden über Kommunikation hinaus für Dokumente und weitere Fachmodule geplant.
            </p>
          </div>
          <Badge variant="default">Plattformweit geplant</Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <ModuleCapabilityCard
            title="Vorlagen"
            description="Vorlagen für E-Mails, Newsletter, Briefe, Rechnungen, Verträge und weitere Dokumente."
            icon={FileStack}
            status="Demnächst"
            details={[
              "System-, Vereins- und persönliche Vorlagen",
              "Fachliche Variablen",
              "Versionierte Ergebnisse",
              "Nicht auf E-Mail beschränkt",
            ]}
          />
          <ModuleCapabilityCard
            title="Gestaltung / Erscheinungsbild"
            description="Farben, Logos und Gestaltung für Kommunikation und Dokumente definieren."
            icon={Palette}
            status="Demnächst"
            details={[
              "Logo und Farbwelt",
              "Sichere Typografie",
              "Header und Footer",
              "Briefe, Rechnungen und Dokumente",
            ]}
          />
        </div>
      </div>
    </PageShell>
  );
}

import {
  BarChart3,
  BellRing,
  Building2,
  ContactRound,
  FileSignature,
  Globe,
  Images,
  Mail,
  Megaphone,
  Monitor,
  PackageCheck,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { ModuleCapabilityCard } from "@/components/admin/future-modules/ModuleCapabilityCard";
import { Badge } from "@/components/ui/Badge";
import { PageBreadcrumbs, PageHeader, PageShell, SectionCard } from "@/components/ui/page";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { TENANT_ADMINISTRATION_PERMISSIONS } from "@/lib/permissions/tenant-administration";

export const dynamic = "force-dynamic";

const activationFlow = [
  "Sponsor",
  "Vertrag & Leistungsanspruch",
  "Kampagne & Werbefläche",
  "Publikationskanal",
  "Reporting",
];

export default async function SponsoringPage() {
  await requireAnyPermission(TENANT_ADMINISTRATION_PERMISSIONS);

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sponsoring" },
        ]}
      />

      <PageHeader
        eyebrow="Sponsoring"
        title="Sponsoring"
        description="Sponsoren, Verträge, Leistungen und Kampagnen zentral verwalten."
        badge={<Badge variant="warning">Zukunftsmodul</Badge>}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)] px-4 py-3">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-warning)]" aria-hidden />
        <p className="text-xs leading-5 text-[var(--sce-warning)]">
          <span className="font-semibold">Demo-Ansicht · Noch nicht funktional.</span>{" "}
          Die Bereiche zeigen die geplante Produktarchitektur. Es werden keine Sponsor-, Vertrags- oder Kampagnendaten gespeichert.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCapabilityCard
          title="Sponsoren"
          description="Sponsoren und Partnerschaften im Überblick."
          icon={Building2}
          status="Demnächst"
          details={["Organisation", "Status und Kategorie", "Verantwortung", "Wert und Beziehungshistorie"]}
        />
        <ModuleCapabilityCard
          title="Kontakte"
          description="Kontaktpersonen und Kommunikation pro Sponsor verwalten."
          icon={ContactRound}
          status="Demnächst"
          details={["Mehrere Kontakte", "Hauptkontakt", "Rolle und Kontaktdaten", "Gemeinsame E-Mail-Engine"]}
        />
        <ModuleCapabilityCard
          title="Verträge & Dokumente"
          description="Laufzeiten, Vertragswerte und Dokumente verwalten."
          icon={FileSignature}
          status="Demnächst"
          details={["Laufzeit und Kündigung", "Wert und Abrechnung", "Verantwortung", "Versionen und Dokumente"]}
        />
        <ModuleCapabilityCard
          title="Leistungen / Pakete"
          description="Vereinbarte Sponsorleistungen und Pakete nachvollziehen."
          icon={PackageCheck}
          status="Demnächst"
          details={["Gekauft", "Verwendet", "Verbleibend", "Aktiver Zeitraum"]}
        />
        <ModuleCapabilityCard
          title="Kampagnen"
          description="Sponsor-Kampagnen über Website, Infoboard und Mobile planen."
          icon={Megaphone}
          status="Demnächst"
          details={["Zeitraum und Angebot", "Zielgruppe", "Assets und Kanäle", "Planung und Status"]}
        />
        <ModuleCapabilityCard
          title="Werbeflächen"
          description="Verfügbare Sponsorflächen und Aktivierungen verwalten."
          icon={PanelsTopLeft}
          status="Demnächst"
          details={["Website", "Infoboard", "Mobile", "Push und Newsletter"]}
        />
        <ModuleCapabilityCard
          title="Verlängerungen & Erinnerungen"
          description="Auslaufende Verträge und Verlängerungen frühzeitig erkennen."
          icon={BellRing}
          status="Demnächst"
          details={["180 / 90 / 30 Tage", "Kündigungsfristen", "Verantwortliche", "Verlängerungsworkflow"]}
        />
      </div>

      <SectionCard
        title="Vom Vertrag zur Aktivierung"
        description="Sponsoring wird als CRM, Vertrags- und Leistungssteuerung, kommerzielles Inventar, Kampagnenaktivierung und Reporting gedacht."
        className="mt-8"
      >
        <ol className="grid gap-2 md:grid-cols-5" aria-label="Geplanter Sponsoring-Ablauf">
          {activationFlow.map((step, index) => (
            <li
              key={step}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3"
            >
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Schritt {index + 1}
              </span>
              <p className="mt-1 text-xs font-semibold text-[var(--foreground)]">{step}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Kommerzielle Pakete & Leistungsansprüche"
          description="Vertraglich zugesicherte Leistungen sollen später durch Kampagnen verbraucht und nachvollzogen werden."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <Badge variant="primary" size="sm">Beispiel</Badge>
              <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                MOBILE SEPTEMBER · CHF 1&apos;500
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                Mobile Banner, eine Push-Nachricht und Kampagnenreporting.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <Badge variant="primary" size="sm">Beispiel</Badge>
              <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">GOLD</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                Website Premium, Infoboard-Rotation, Push-Kampagnen, Newsletter und Event-Branding.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {["Push 3 / 4", "Newsletter 1 / 2", "Infoboard aktiv", "Website bis 30.06.2027"].map((item) => (
              <span
                key={item}
                className="rounded-lg border border-[var(--border)] px-2.5 py-2 text-center font-medium text-[var(--text-2)]"
              >
                {item}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Kanonische Medien & Publikation"
          description="Logos, Kampagnenbilder und Richtlinien werden einmal als SCE-Assets geführt und von allen Kanälen verwendet."
        >
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <Images className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sce-primary)]" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">SponsorAsset</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                Horizontales und quadratisches Logo, Kampagnenbanner, Kampagnenbild und Markenrichtlinien — ohne Kopien pro Kanal.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Website", Icon: Globe },
              { label: "Infoboard", Icon: Monitor },
              { label: "Mobile", Icon: Smartphone },
            ].map(({ label, Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-3 text-xs font-semibold text-[var(--text-2)]"
              >
                <Icon className="h-4 w-4 text-[var(--muted)]" aria-hidden />
                {label}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <SectionCard title="Partnerangebote" description="Mitgliedervorteile bleiben als eigener, steuerbarer Anwendungsfall vorgesehen.">
          <p className="text-sm font-semibold text-[var(--foreground)]">20% Rabatt im September</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
            Sponsor, Zielgruppe und Gültigkeit werden später mit QR-Code, Promo-Code oder Mitgliedervorteil verknüpft.
          </p>
        </SectionCard>

        <SectionCard title="Governance & Privatsphäre" description="Kommerzielle Kommunikation bleibt von operativen Mitteilungen getrennt.">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--sce-primary)]" aria-hidden />
            <p className="text-xs leading-5 text-[var(--text-2)]">
              Berechtigungen, Einwilligung oder Rechtsgrundlage, Opt-out, Kanaleignung, Alter, Frequenz und Kommunikationspräferenzen werden berücksichtigt.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Wirkungsnachweis" description="Messbare Leistung schafft einen belastbaren Kampagnenreport.">
          <div className="flex gap-3">
            <BarChart3 className="h-5 w-5 shrink-0 text-[var(--sce-primary)]" aria-hidden />
            <p className="text-xs leading-5 text-[var(--text-2)]">
              Reichweite, Zustellung, Öffnungen, Klicks, Website- und Mobile-Impressionen, Infoboard-Ausspielungen und optionale Einlösungen.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[0.7rem] font-medium text-[var(--muted)]">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Kampagnenreport.pdf · später verfügbar
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}

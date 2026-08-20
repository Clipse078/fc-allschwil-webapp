import {
  AlertCircle,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  ListChecks,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageShell, PageHeader, PageBreadcrumbs, SectionCard } from "@/components/ui/page";
import { DashboardKpiCard } from "@/components/ui/dashboard/DashboardKpiCard";

// ── Demo-only data — never persisted, never DB-backed ─────────────────────────

const DEMO_TEMPLATES = [
  {
    id: "t1",
    title: "Saisonstart Junioren vorbereiten",
    category: "Betrieb",
    steps: 8,
    description: "Materialkontrolle, Spielerpässe, Trainingsplan, Elterninformation.",
  },
  {
    id: "t2",
    title: "Heimturnier organisieren",
    category: "Events",
    steps: 11,
    description: "Platzbelegung, Schiedsrichter, Catering, Kommunikation, Nachbereitung.",
  },
  {
    id: "t3",
    title: "Trainer-Onboarding",
    category: "Personal",
    steps: 5,
    description: "Begrüssung, Zugangsrechte, Materialausgabe, Regelwerk, Vorstellung.",
  },
  {
    id: "t4",
    title: "Materialkontrolle Saisonstart",
    category: "Material",
    steps: 6,
    description: "Inventar prüfen, Defekte erfassen, Nachbestellung auslösen.",
  },
  {
    id: "t5",
    title: "Vereinsversammlung vorbereiten",
    category: "Governance",
    steps: 9,
    description: "Einladung, Traktanden, Protokoll, Abstimmungsunterlagen.",
  },
  {
    id: "t6",
    title: "Sponsoring-Unterlagen erneuern",
    category: "Finanzen",
    steps: 7,
    description: "Angebotsmappe, Leistungsbericht, Vertragsentwurf, Versand.",
  },
];

const DEMO_ACTIVE = [
  {
    id: "a1",
    title: "Saisonstart Junioren vorbereiten",
    templateId: "t1",
    status: "Läuft",
    statusVariant: "success" as const,
    owner: "A. Müller",
    dueDate: "15. Aug 2026",
    priority: "Hoch",
    priorityVariant: "warning" as const,
    checklistDone: 5,
    checklistTotal: 8,
    tasks: [
      { id: "a1-1", title: "Materialraum inventarisieren", done: true },
      { id: "a1-2", title: "Spielerpässe bestellen", done: true },
      { id: "a1-3", title: "Trainingsplan erstellen", done: true },
      { id: "a1-4", title: "Trainingszeiten kommunizieren", done: true },
      { id: "a1-5", title: "Erste-Hilfe-Koffer prüfen", done: true },
      { id: "a1-6", title: "Elterninfo versenden", done: false },
      { id: "a1-7", title: "Trikots verteilen", done: false },
      { id: "a1-8", title: "Saisonstart-Meeting abhalten", done: false },
    ],
  },
  {
    id: "a2",
    title: "Heimturnier organisieren",
    templateId: "t2",
    status: "In Vorbereitung",
    statusVariant: "info" as const,
    owner: "S. Weber",
    dueDate: "1. Sep 2026",
    priority: "Hoch",
    priorityVariant: "warning" as const,
    checklistDone: 2,
    checklistTotal: 11,
    tasks: [
      { id: "a2-1", title: "Platzbelegung bestätigen", done: true },
      { id: "a2-2", title: "Schiedsrichter anfragen", done: true },
      { id: "a2-3", title: "Einladungen versenden", done: false },
      { id: "a2-4", title: "Catering-Anbieter kontaktieren", done: false },
      { id: "a2-5", title: "Helfer organisieren", done: false },
    ],
  },
  {
    id: "a3",
    title: "Trainer-Onboarding Neuzugänge",
    templateId: "t3",
    status: "Läuft",
    statusVariant: "success" as const,
    owner: "T. Bauer",
    dueDate: "20. Aug 2026",
    priority: "Mittel",
    priorityVariant: "default" as const,
    checklistDone: 3,
    checklistTotal: 5,
    tasks: [
      { id: "a3-1", title: "Willkommens-Mail senden", done: true },
      { id: "a3-2", title: "Zugänge einrichten", done: true },
      { id: "a3-3", title: "Material ausgeben", done: true },
      { id: "a3-4", title: "Regelwerk durchbesprechen", done: false },
      { id: "a3-5", title: "Teamvorstellung", done: false },
    ],
  },
  {
    id: "a4",
    title: "Materialkontrolle Saisonstart",
    templateId: "t4",
    status: "Überfällig",
    statusVariant: "danger" as const,
    owner: "M. Keller",
    dueDate: "10. Aug 2026",
    priority: "Hoch",
    priorityVariant: "warning" as const,
    checklistDone: 1,
    checklistTotal: 6,
    tasks: [
      { id: "a4-1", title: "Materialraum öffnen und sichten", done: true },
      { id: "a4-2", title: "Defekte Bälle erfassen", done: false },
      { id: "a4-3", title: "Markierungshütchen zählen", done: false },
      { id: "a4-4", title: "Mini-Tore prüfen", done: false },
      { id: "a4-5", title: "Bestellliste erstellen", done: false },
      { id: "a4-6", title: "Bestellung auslösen", done: false },
    ],
  },
];

export default function ProzessePage() {
  const running = DEMO_ACTIVE.filter((p) => p.status === "Läuft").length;
  const preparing = DEMO_ACTIVE.filter((p) => p.status === "In Vorbereitung").length;
  const overdue = DEMO_ACTIVE.filter((p) => p.status === "Überfällig").length;

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Club Entwicklung", href: "/vereinsleitung/club-entwicklung" },
          { label: "Prozesse & Aufgaben" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Club Entwicklung"
          title="Prozesse & Aufgaben"
          description="Wiederkehrende Vereinsprozesse als strukturierte Checklisten — mit Verantwortlichen, Fristen und Fortschrittsverfolgung."
          badge={<Badge variant="warning">In Entwicklung</Badge>}
          className="mb-0"
        />
        <button
          type="button"
          disabled
          title="Demnächst verfügbar"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--muted)] cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Neuer Prozess
          <Badge variant="warning" size="sm">Demnächst</Badge>
        </button>
      </div>

      {/* Demo notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)] px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sce-warning)] mt-0.5" />
        <p className="text-xs text-[var(--sce-warning)] leading-relaxed">
          <span className="font-semibold">Demo-Ansicht · In Entwicklung.</span>{" "}
          Alle Prozesse, Aufgaben und Fortschrittsangaben sind Demodaten und dienen der Produktvision. Keine Datenpersistenz.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <DashboardKpiCard
          title="Laufend"
          value={String(running)}
          accent="success"
          icon={<ClipboardList className="h-5 w-5" />}
          description="Aktive Prozesse"
        />
        <DashboardKpiCard
          title="In Vorbereitung"
          value={String(preparing)}
          accent="info"
          icon={<Clock className="h-5 w-5" />}
          description="Noch nicht gestartet"
        />
        <DashboardKpiCard
          title="Überfällig"
          value={String(overdue)}
          accent="danger"
          icon={<AlertCircle className="h-5 w-5" />}
          description="Deadline überschritten"
        />
        <DashboardKpiCard
          title="Vorlagen"
          value={String(DEMO_TEMPLATES.length)}
          accent="default"
          icon={<ListChecks className="h-5 w-5" />}
          description="Prozessvorlagen verfügbar"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        {/* Active processes */}
        <div>
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Laufende &amp; geplante Prozesse</h2>
          <div className="space-y-4">
            {DEMO_ACTIVE.map((p) => {
              const pct = Math.round((p.checklistDone / p.checklistTotal) * 100);
              return (
                <SectionCard key={p.id} className="overflow-hidden">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">{p.title}</h3>
                        <Badge variant={p.statusVariant} size="sm">{p.status}</Badge>
                        <Badge variant={p.priorityVariant} size="sm">{p.priority}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-[var(--text-2)]">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.dueDate}
                        </span>
                        <span>{p.owner}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-[var(--foreground)]">{pct}%</p>
                      <p className="text-[0.68rem] text-[var(--muted)]">{p.checklistDone}/{p.checklistTotal} erledigt</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: p.status === "Überfällig"
                          ? "var(--sce-danger)"
                          : "var(--sce-primary)",
                      }}
                    />
                  </div>

                  {/* Task checklist */}
                  <ul className="mt-4 space-y-1.5">
                    {p.tasks.slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5">
                        <CheckSquare
                          className={`h-3.5 w-3.5 shrink-0 ${t.done ? "text-[var(--sce-success)]" : "text-[var(--border)]"}`}
                        />
                        <span
                          className={`text-xs ${
                            t.done
                              ? "line-through text-[var(--muted)]"
                              : "text-[var(--text-2)]"
                          }`}
                        >
                          {t.title}
                        </span>
                      </li>
                    ))}
                    {p.tasks.length > 5 && (
                      <li className="text-[0.68rem] text-[var(--muted)] pl-6">
                        +{p.tasks.length - 5} weitere Aufgaben
                      </li>
                    )}
                  </ul>

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <p className="text-[0.68rem] text-[var(--muted)]">Demo-Daten</p>
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-1 text-xs font-medium text-[var(--muted)] cursor-not-allowed"
                      title="Demnächst verfügbar"
                    >
                      Öffnen <ChevronRight className="h-3 w-3" />
                      <Badge variant="warning" size="sm">Demnächst</Badge>
                    </button>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        </div>

        {/* Templates sidebar */}
        <div>
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Prozessvorlagen</h2>
          <SectionCard>
            <div className="space-y-3">
              {DEMO_TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">
                    <ListChecks className="h-4 w-4 text-[var(--muted)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--foreground)] leading-tight">{t.title}</p>
                    <p className="text-[0.68rem] text-[var(--muted)] mt-0.5">{t.category} · {t.steps} Schritte</p>
                    <p className="text-[0.68rem] text-[var(--text-2)] mt-1 leading-relaxed">{t.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="shrink-0 rounded border border-[var(--border)] px-2 py-1 text-[0.65rem] font-medium text-[var(--muted)] cursor-not-allowed"
                    title="Demnächst verfügbar"
                  >
                    Starten
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
              <Badge variant="warning" size="sm">In Entwicklung</Badge>
              <p className="text-[0.68rem] text-[var(--muted)]">Prozessvorlagen — Demo</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}

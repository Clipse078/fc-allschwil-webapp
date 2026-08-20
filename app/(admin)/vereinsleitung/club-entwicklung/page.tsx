import Link from "next/link";
import {
  ArrowRight,
  CheckSquare,
  ClipboardList,
  Flag,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageShell, PageHeader, PageBreadcrumbs } from "@/components/ui/page";
import { DashboardKpiCard } from "@/components/ui/dashboard/DashboardKpiCard";

// ── Demo-only process data — never persisted, never DB-backed ─────────────────

const DEMO_PROCESSES = [
  {
    id: "p1",
    title: "Saisonstart Junioren vorbereiten",
    category: "Betrieb",
    status: "Läuft",
    statusVariant: "success" as const,
    owner: "A. Müller",
    dueDate: "15. Aug 2026",
    checklistDone: 5,
    checklistTotal: 8,
    priority: "Hoch",
    priorityVariant: "warning" as const,
  },
  {
    id: "p2",
    title: "Heimturnier organisieren",
    category: "Events",
    status: "In Vorbereitung",
    statusVariant: "info" as const,
    owner: "S. Weber",
    dueDate: "1. Sep 2026",
    checklistDone: 2,
    checklistTotal: 11,
    priority: "Hoch",
    priorityVariant: "warning" as const,
  },
  {
    id: "p3",
    title: "Trainer-Onboarding Neuzugänge",
    category: "Personal",
    status: "Läuft",
    statusVariant: "success" as const,
    owner: "T. Bauer",
    dueDate: "20. Aug 2026",
    checklistDone: 3,
    checklistTotal: 5,
    priority: "Mittel",
    priorityVariant: "default" as const,
  },
  {
    id: "p4",
    title: "Materialkontrolle Saisonstart",
    category: "Material",
    status: "Überfällig",
    statusVariant: "danger" as const,
    owner: "M. Keller",
    dueDate: "10. Aug 2026",
    checklistDone: 1,
    checklistTotal: 6,
    priority: "Hoch",
    priorityVariant: "warning" as const,
  },
  {
    id: "p5",
    title: "Vereinsversammlung vorbereiten",
    category: "Governance",
    status: "Geplant",
    statusVariant: "default" as const,
    owner: "P. Schneider",
    dueDate: "10. Okt 2026",
    checklistDone: 0,
    checklistTotal: 9,
    priority: "Mittel",
    priorityVariant: "default" as const,
  },
  {
    id: "p6",
    title: "Sponsoring-Unterlagen erneuern",
    category: "Finanzen",
    status: "Geplant",
    statusVariant: "default" as const,
    owner: "R. Fischer",
    dueDate: "30. Sep 2026",
    checklistDone: 0,
    checklistTotal: 7,
    priority: "Niedrig",
    priorityVariant: "default" as const,
  },
];

export default function ClubEntwicklungPage() {
  const activeProcesses = DEMO_PROCESSES.filter((p) =>
    ["Läuft", "In Vorbereitung"].includes(p.status)
  ).length;
  const overdueProcesses = DEMO_PROCESSES.filter(
    (p) => p.status === "Überfällig"
  ).length;

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Club Entwicklung" },
        ]}
      />

      <PageHeader
        eyebrow="Club Entwicklung"
        title="Club Entwicklung"
        description="Strategische Steuerung, operative Prozesse und Entwicklungsinitiativen — alles an einem Ort."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <DashboardKpiCard
          title="Aktive Prozesse"
          value={String(activeProcesses)}
          accent="success"
          icon={<ClipboardList className="h-5 w-5" />}
          description="Laufend oder in Vorbereitung"
        />
        <DashboardKpiCard
          title="Überfällig"
          value={String(overdueProcesses)}
          accent="danger"
          icon={<CheckSquare className="h-5 w-5" />}
          description="Deadline überschritten"
        />
        <DashboardKpiCard
          title="Ziele aktiv"
          value="4"
          accent="primary"
          icon={<Target className="h-5 w-5" />}
          description="Strategische Vereinsziele"
        />
        <DashboardKpiCard
          title="Initiativen"
          value="6"
          accent="info"
          icon={<Flag className="h-5 w-5" />}
          description="Laufende Entwicklungsvorhaben"
        />
      </div>

      {/* Three capability families */}
      <div className="grid gap-6 xl:grid-cols-3">

        {/* A: Pläne & Ziele */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sce-primary-light)]">
                <Target className="h-4 w-4 text-[var(--sce-primary)]" />
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Bereich A</p>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Pläne &amp; Ziele</h2>
              </div>
            </div>
            <Badge variant="success" size="sm">Aktiv</Badge>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Strategische Vereinsziele mit messbaren KPIs, Fortschrittsverfolgung und saisonaler Meilensteinplanung.
            </p>
            <div className="space-y-2">
              <Link
                href="/vereinsleitung/targets"
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-medium text-[var(--foreground)]">Vereinsziele</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)]" />
              </Link>
              <Link
                href="/vereinsleitung/kpis"
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-medium text-[var(--foreground)]">KPIs</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)]" />
              </Link>
            </div>
            <p className="text-[0.7rem] text-[var(--muted)] pt-1">Produktiv · Datenbankgestützt</p>
          </div>
        </section>

        {/* B: Prozesse & Aufgaben */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sce-warning-light)]">
                <ClipboardList className="h-4 w-4 text-[var(--sce-warning)]" />
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Bereich B</p>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Prozesse &amp; Aufgaben</h2>
              </div>
            </div>
            <Badge variant="warning" size="sm">In Entwicklung</Badge>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Wiederkehrende Vereinsprozesse als strukturierte Vorlagen: Checklisten, Verantwortliche, Fristen und Status auf einen Blick.
            </p>
            <div className="space-y-2">
              <Link
                href="/vereinsleitung/prozesse"
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-medium text-[var(--foreground)]">Prozesse &amp; Aufgaben</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)]" />
              </Link>
            </div>
            <p className="text-[0.7rem] text-[var(--sce-warning)] pt-1 font-medium">In Entwicklung · Demo-Daten</p>
          </div>
        </section>

        {/* C: Initiativen */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sce-info-light)]">
                <Flag className="h-4 w-4 text-[var(--sce-info)]" />
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Bereich C</p>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Initiativen &amp; Entwicklung</h2>
              </div>
            </div>
            <Badge variant="success" size="sm">Aktiv</Badge>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Entwicklungsvorhaben mit Fortschritt, Verantwortlichen, Review-Stage und Sichtbarkeitssteuerung.
            </p>
            <div className="space-y-2">
              <Link
                href="/vereinsleitung/initiativen"
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm transition hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <Flag className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-medium text-[var(--foreground)]">Initiativen</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--muted)]" />
              </Link>
            </div>
            <p className="text-[0.7rem] text-[var(--muted)] pt-1">Produktiv · Datenbankgestützt</p>
          </div>
        </section>
      </div>

      {/* Prozesse & Aufgaben preview */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Aktive Prozesse</h2>
            <Badge variant="warning" size="sm">In Entwicklung</Badge>
          </div>
          <Link
            href="/vereinsleitung/prozesse"
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
          >
            Alle ansehen
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-[var(--shadow-xs)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Prozess</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] sm:table-cell">Kategorie</th>
                <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Status</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:table-cell">Verantwortlich</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] lg:table-cell">Fortschritt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {DEMO_PROCESSES.map((p) => {
                const pct = Math.round((p.checklistDone / p.checklistTotal) * 100);
                return (
                  <tr key={p.id} className="transition hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">{p.title}</p>
                      <p className="text-[0.7rem] text-[var(--muted)] mt-0.5">Fällig: {p.dueDate}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--text-2)] sm:table-cell">{p.category}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.statusVariant} size="sm">{p.status}</Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--text-2)] md:table-cell">{p.owner}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-[var(--sce-primary)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[0.7rem] text-[var(--muted)]">{p.checklistDone}/{p.checklistTotal}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 flex items-center gap-2">
            <Badge variant="warning" size="sm">In Entwicklung</Badge>
            <p className="text-[0.7rem] text-[var(--muted)]">Demo-Daten — nicht produktiv</p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

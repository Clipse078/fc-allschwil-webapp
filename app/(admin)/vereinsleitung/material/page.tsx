import {
  AlertCircle,
  Archive,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  Plus,
  Search,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageShell, PageHeader, PageBreadcrumbs, SectionCard } from "@/components/ui/page";
import { DashboardKpiCard } from "@/components/ui/dashboard/DashboardKpiCard";

// ── Demo-only data — never persisted, never DB-backed ─────────────────────────

type ItemStatus = "Verfügbar" | "Ausgegeben" | "Wartung fällig" | "Niedriger Bestand" | "Defekt";

type InventarItem = {
  id: string;
  name: string;
  category: string;
  qty: number;
  qtyAvailable: number;
  unit: string;
  status: ItemStatus;
  location: string;
  responsible: string;
  lastCheck: string;
  assignedTo?: string;
};

const statusConfig: Record<ItemStatus, { variant: "success" | "info" | "warning" | "danger" | "default"; icon: typeof CheckCircle }> = {
  Verfügbar:          { variant: "success", icon: CheckCircle },
  Ausgegeben:         { variant: "info",    icon: Archive },
  "Wartung fällig":  { variant: "warning", icon: Wrench },
  "Niedriger Bestand":{ variant: "warning", icon: AlertCircle },
  Defekt:             { variant: "danger",  icon: AlertCircle },
};

const INVENTORY: InventarItem[] = [
  {
    id: "i1",
    name: "Matchbälle (Grösse 5)",
    category: "Bälle",
    qty: 24,
    qtyAvailable: 18,
    unit: "Stk",
    status: "Verfügbar",
    location: "Materialraum Im Brüel",
    responsible: "M. Keller",
    lastCheck: "05. Aug 2026",
  },
  {
    id: "i2",
    name: "Trainingsbälle (Grösse 4)",
    category: "Bälle",
    qty: 16,
    qtyAvailable: 4,
    unit: "Stk",
    status: "Niedriger Bestand",
    location: "Kunstrasen 2",
    responsible: "M. Keller",
    lastCheck: "01. Aug 2026",
    assignedTo: "C-Junioren",
  },
  {
    id: "i3",
    name: "Überziehleibchen (orange)",
    category: "Kleidung",
    qty: 40,
    qtyAvailable: 38,
    unit: "Stk",
    status: "Verfügbar",
    location: "Materialraum Im Brüel",
    responsible: "A. Müller",
    lastCheck: "10. Aug 2026",
  },
  {
    id: "i4",
    name: "Markierungshütchen",
    category: "Trainingszubehör",
    qty: 60,
    qtyAvailable: 52,
    unit: "Stk",
    status: "Verfügbar",
    location: "Materialraum Im Brüel",
    responsible: "T. Bauer",
    lastCheck: "10. Aug 2026",
  },
  {
    id: "i5",
    name: "Mini-Tore (Set à 2)",
    category: "Trainingsgeräte",
    qty: 8,
    qtyAvailable: 6,
    unit: "Sets",
    status: "Ausgegeben",
    location: "Kunstrasen 3",
    responsible: "T. Bauer",
    lastCheck: "08. Aug 2026",
    assignedTo: "E-Junioren",
  },
  {
    id: "i6",
    name: "Ballpumpen",
    category: "Zubehör",
    qty: 5,
    qtyAvailable: 4,
    unit: "Stk",
    status: "Verfügbar",
    location: "Materialraum Im Brüel",
    responsible: "M. Keller",
    lastCheck: "03. Aug 2026",
  },
  {
    id: "i7",
    name: "Erste-Hilfe-Koffer",
    category: "Sicherheit",
    qty: 4,
    qtyAvailable: 2,
    unit: "Stk",
    status: "Wartung fällig",
    location: "Stadion",
    responsible: "P. Schneider",
    lastCheck: "15. Jul 2026",
  },
  {
    id: "i8",
    name: "Schlüssel Materialraum Im Brüel",
    category: "Schlüssel",
    qty: 6,
    qtyAvailable: 4,
    unit: "Stk",
    status: "Ausgegeben",
    location: "Materialraum Im Brüel",
    responsible: "P. Schneider",
    lastCheck: "01. Aug 2026",
    assignedTo: "Vorstand + Trainer",
  },
  {
    id: "i9",
    name: "Trainerjacken (FCA)",
    category: "Kleidung",
    qty: 10,
    qtyAvailable: 8,
    unit: "Stk",
    status: "Ausgegeben",
    location: "Stadion",
    responsible: "A. Müller",
    lastCheck: "05. Aug 2026",
    assignedTo: "Trainerteam",
  },
  {
    id: "i10",
    name: "Tornetz (Full-size)",
    category: "Trainingsgeräte",
    qty: 4,
    qtyAvailable: 3,
    unit: "Stk",
    status: "Defekt",
    location: "Stadion",
    responsible: "M. Keller",
    lastCheck: "12. Aug 2026",
  },
  {
    id: "i11",
    name: "Event-Bestuhlung (Klappstuhl)",
    category: "Turniermaterial",
    qty: 80,
    qtyAvailable: 80,
    unit: "Stk",
    status: "Verfügbar",
    location: "Materialraum Im Brüel",
    responsible: "S. Weber",
    lastCheck: "20. Jun 2026",
  },
  {
    id: "i12",
    name: "Trainingsbälle (Grösse 3)",
    category: "Bälle",
    qty: 12,
    qtyAvailable: 12,
    unit: "Stk",
    status: "Verfügbar",
    location: "Kunstrasen 2",
    responsible: "T. Bauer",
    lastCheck: "08. Aug 2026",
  },
];

const CATEGORY_ICONS: Record<string, typeof Package> = {
  Bälle:              Package,
  Kleidung:           Archive,
  Trainingszubehör:   Package,
  Trainingsgeräte:    Package,
  Zubehör:            Package,
  Sicherheit:         AlertCircle,
  Schlüssel:          MapPin,
  Turniermaterial:    Archive,
};

function getCategoryIcon(cat: string) {
  return CATEGORY_ICONS[cat] ?? Package;
}

export default function MaterialPage() {
  const totalItems = INVENTORY.length;
  const available = INVENTORY.filter((i) => i.status === "Verfügbar").length;
  const needsAttention = INVENTORY.filter((i) =>
    ["Wartung fällig", "Defekt", "Niedriger Bestand"].includes(i.status)
  ).length;
  const assignedOut = INVENTORY.filter((i) => i.status === "Ausgegeben").length;

  const categories = [...new Set(INVENTORY.map((i) => i.category))];

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Material & Inventar" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Material & Inventar"
          title="Material & Inventar"
          description="Vereinsmaterial, Inventar, Zuweisungen, Standorte und Wartungsstatus im Überblick."
          badge={<Badge variant="warning">In Entwicklung</Badge>}
          className="mb-0"
        />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled
            title="Demnächst verfügbar"
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--muted)] cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Material erfassen
            <Badge variant="warning" size="sm">Demnächst</Badge>
          </button>
        </div>
      </div>

      {/* Demo notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)] px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sce-warning)] mt-0.5" />
        <p className="text-xs text-[var(--sce-warning)] leading-relaxed">
          <span className="font-semibold">Demo-Ansicht · In Entwicklung.</span>{" "}
          Inventar, Standorte und Zuweisungen sind Demodaten und zeigen die geplante Produktfunktionalität. Keine Datenpersistenz.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <DashboardKpiCard
          title="Positionen"
          value={String(totalItems)}
          accent="default"
          icon={<Package className="h-5 w-5" />}
          description="Artikel im Inventar"
        />
        <DashboardKpiCard
          title="Verfügbar"
          value={String(available)}
          accent="success"
          icon={<CheckCircle className="h-5 w-5" />}
          description="Sofort nutzbar"
        />
        <DashboardKpiCard
          title="Ausgegeben"
          value={String(assignedOut)}
          accent="info"
          icon={<Archive className="h-5 w-5" />}
          description="An Teams / Personen"
        />
        <DashboardKpiCard
          title="Handlungsbedarf"
          value={String(needsAttention)}
          accent="warning"
          icon={<AlertCircle className="h-5 w-5" />}
          description="Wartung, defekt, tief"
        />
      </div>

      {/* Filters strip (demo, non-functional) */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-[var(--muted)]" />
          <span className="text-xs text-[var(--muted)]">Suchen…</span>
          <Badge variant="warning" size="sm">Demnächst</Badge>
        </div>
        {["Alle Kategorien", "Alle Standorte", "Alle Status"].map((f) => (
          <button
            key={f}
            type="button"
            disabled
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] cursor-not-allowed"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Main inventory table */}
      <SectionCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] min-w-[180px]">Artikel</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] sm:table-cell">Kategorie</th>
                <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Status</th>
                <th className="hidden px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:table-cell">Menge</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] lg:table-cell">Standort</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] xl:table-cell">Verantwortlich</th>
                <th className="hidden px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] xl:table-cell">Letzte Prüfung</th>
                <th className="px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {INVENTORY.map((item) => {
                const cfg = statusConfig[item.status];
                const StatusIcon = cfg.icon;
                const CatIcon = getCategoryIcon(item.category);
                return (
                  <tr key={item.id} className="transition hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">
                          <CatIcon className="h-3.5 w-3.5 text-[var(--muted)]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)] text-xs leading-tight">{item.name}</p>
                          {item.assignedTo && (
                            <p className="text-[0.65rem] text-[var(--muted)] mt-0.5">→ {item.assignedTo}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--text-2)] sm:table-cell">{item.category}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <StatusIcon className={`h-3 w-3 shrink-0 ${
                          cfg.variant === "success" ? "text-[var(--sce-success)]"
                          : cfg.variant === "warning" ? "text-[var(--sce-warning)]"
                          : cfg.variant === "danger" ? "text-[var(--sce-danger)]"
                          : "text-[var(--sce-info)]"
                        }`} />
                        <Badge variant={cfg.variant} size="sm">{item.status}</Badge>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-xs text-[var(--foreground)] md:table-cell">
                      <span className="font-semibold">{item.qtyAvailable}</span>
                      <span className="text-[var(--muted)]">/{item.qty} {item.unit}</span>
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <span className="flex items-center gap-1 text-xs text-[var(--text-2)]">
                        <MapPin className="h-3 w-3 shrink-0 text-[var(--muted)]" />
                        {item.location}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--text-2)] xl:table-cell">{item.responsible}</td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                        <Clock className="h-3 w-3 shrink-0" />
                        {item.lastCheck}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled
                        className="rounded border border-[var(--border)] px-2 py-1 text-[0.65rem] font-medium text-[var(--muted)] cursor-not-allowed"
                        title="Demnächst verfügbar"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 flex items-center gap-2">
          <Badge variant="warning" size="sm">In Entwicklung</Badge>
          <p className="text-[0.7rem] text-[var(--muted)]">Demo-Daten — {INVENTORY.length} Positionen — nicht produktiv</p>
        </div>
      </SectionCard>

      {/* Category overview */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Nach Kategorie</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((cat) => {
            const items = INVENTORY.filter((i) => i.category === cat);
            const CatIcon = getCategoryIcon(cat);
            const hasIssue = items.some((i) =>
              ["Wartung fällig", "Defekt", "Niedriger Bestand"].includes(i.status)
            );
            return (
              <div
                key={cat}
                className={`rounded-xl border px-4 py-3 ${
                  hasIssue
                    ? "border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <CatIcon className={`h-4 w-4 ${hasIssue ? "text-[var(--sce-warning)]" : "text-[var(--muted)]"}`} />
                  <p className="text-[0.72rem] font-semibold text-[var(--foreground)]">{cat}</p>
                </div>
                <p className="text-lg font-bold text-[var(--foreground)]">{items.length}</p>
                <p className="text-[0.68rem] text-[var(--muted)]">
                  {hasIssue ? "Handlungsbedarf" : "OK"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Locations */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Standorte</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Materialraum Im Brüel", "Stadion", "Kunstrasen 2", "Kunstrasen 3"].map((loc) => {
            const items = INVENTORY.filter((i) => i.location === loc);
            return (
              <div key={loc} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <p className="text-xs font-semibold text-[var(--foreground)]">{loc}</p>
                </div>
                <p className="text-xl font-bold text-[var(--foreground)]">{items.length}</p>
                <p className="text-[0.68rem] text-[var(--muted)]">Positionen erfasst</p>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}

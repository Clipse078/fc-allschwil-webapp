/**
 * /dashboard/website/blocks
 *
 * Admin Block Library overview page (CMS V2 Slice 3).
 *
 * Read-only server page listing all available homepage block types from the
 * canonical block registry. Groups blocks by category and shows status,
 * description, data-driven indicator, and supported config keys for each block.
 *
 * This is a foundation slice — the block library is informational only.
 * Full block config editing and visual block composition are deferred to
 * future slices.
 */

import Link from "next/link";
import {
  Blocks,
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  Database,
  SlidersHorizontal,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Wrench,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import {
  BLOCK_REGISTRY,
  BLOCK_CATEGORIES,
  getBlocksByCategory,
  type BlockDefinition,
  type BlockCategory,
  type BlockStatus,
} from "@/lib/homepage/block-registry";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

// ---------------------------------------------------------------------------
// Icon map (Lucide components keyed by registry icon name)
// ---------------------------------------------------------------------------

const BLOCK_ICON_MAP: Record<string, React.ReactNode> = {
  LayoutTemplate: <LayoutTemplate className="h-5 w-5" />,
  Newspaper: <Newspaper className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  CalendarDays: <CalendarDays className="h-5 w-5" />,
  MousePointerClick: <MousePointerClick className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Blocks: <Blocks className="h-5 w-5" />,
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  BlockStatus,
  {
    label: string;
    badgeClass: string;
    icon: React.ReactNode;
  }
> = {
  available: {
    label: "Verfügbar",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  "foundation-ready": {
    label: "Foundation Ready",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    icon: <Wrench className="h-3 w-3" />,
  },
  "coming-next": {
    label: "Kommt als nächstes",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <Clock className="h-3 w-3" />,
  },
};

// ---------------------------------------------------------------------------
// Category color accents
// ---------------------------------------------------------------------------

const CATEGORY_COLOR: Record<
  BlockCategory,
  { color: string; bg: string }
> = {
  Header: { color: "#8B5CF6", bg: "rgba(139,92,246,0.10)" },
  Content: { color: "#3B82F6", bg: "rgba(59,130,246,0.10)" },
  "Data-driven": { color: "#0EA5E9", bg: "rgba(14,165,233,0.10)" },
  Club: { color: "#10B981", bg: "rgba(16,185,129,0.10)" },
  Sponsors: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
  Conversion: { color: "#EF4444", bg: "rgba(239,68,68,0.10)" },
  Utility: { color: "#6B7280", bg: "rgba(107,114,128,0.10)" },
};

// ---------------------------------------------------------------------------
// Block card sub-component
// ---------------------------------------------------------------------------

function BlockCard({ block }: { block: BlockDefinition }) {
  const icon = BLOCK_ICON_MAP[block.icon] ?? (
    <Blocks className="h-5 w-5" />
  );
  const statusCfg = STATUS_CONFIG[block.status];
  const categoryCfg = CATEGORY_COLOR[block.category];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: categoryCfg.bg, color: categoryCfg.color }}
          >
            {icon}
          </div>
          <div>
            <p className="font-semibold text-sm text-[var(--foreground)] leading-tight">
              {block.displayName}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted)] font-mono">
              {block.type}
            </p>
          </div>
        </div>
        {/* Status badge */}
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.badgeClass}`}
        >
          {statusCfg.icon}
          {statusCfg.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-2)] leading-relaxed">
        {block.description}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        {/* Category badge */}
        <span
          className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-2)]"
          title="Kategorie"
        >
          {block.category}
        </span>

        {/* Data-driven indicator */}
        {block.datadriven ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700"
            title="Dieser Block lädt Daten automatisch aus der Datenbank"
          >
            <Database className="h-2.5 w-2.5" />
            Datenbankbasiert
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
            title="Dieser Block wird manuell konfiguriert"
          >
            <SlidersHorizontal className="h-2.5 w-2.5" />
            Manuell konfiguriert
          </span>
        )}
      </div>

      {/* Config keys */}
      {block.configKeys.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Config-Felder
          </p>
          <div className="flex flex-wrap gap-1">
            {block.configKeys.map((key) => (
              <code
                key={key}
                className="rounded bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-2)]"
              >
                {key}
              </code>
            ))}
          </div>
        </div>
      )}

      {block.configKeys.length === 0 && (
        <p className="text-[10px] text-[var(--muted)] italic">
          Keine Config-Felder (Platzhalter)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category section sub-component
// ---------------------------------------------------------------------------

function CategorySection({
  category,
  blocks,
}: {
  category: BlockCategory;
  blocks: BlockDefinition[];
}) {
  if (blocks.length === 0) return null;

  const categoryCfg = CATEGORY_COLOR[category];

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ background: categoryCfg.color }}
        />
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {category}
        </h2>
        <span className="rounded-full bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          {blocks.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {blocks.map((block) => (
          <BlockCard key={block.type} block={block} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BlockLibraryPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const blocksByCategory = getBlocksByCategory();

  const totalBlocks = BLOCK_REGISTRY.length;
  const availableCount = BLOCK_REGISTRY.filter(
    (b) => b.status === "available",
  ).length;
  const foundationReadyCount = BLOCK_REGISTRY.filter(
    (b) => b.status === "foundation-ready",
  ).length;
  const comingNextCount = BLOCK_REGISTRY.filter(
    (b) => b.status === "coming-next",
  ).length;
  const dataDrivenCount = BLOCK_REGISTRY.filter((b) => b.datadriven).length;

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Block-Bibliothek" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Block-Bibliothek"
          description="Alle verfügbaren Homepage-Block-Typen mit Kategorien, Konfigurationsfeldern und Verfügbarkeitsstatus."
          className="mb-0"
        />
      </div>

      {/* Foundation info banner */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(14,165,233,0.10)", color: "#0EA5E9" }}
          >
            <Blocks className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Homepage Block Library Foundation
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Diese Foundation definiert alle Homepage-Block-Typen kanonisch mit
              Label, Beschreibung, Kategorie, Config-Feldern und öffentlicher API-Projektion.
              Der Homepage Builder und die öffentliche API nutzen dieses Registry
              als einzige Quelle der Wahrheit — keine Duplikate.
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Öffentliche API:{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px]">
                GET /api/public/[tenant]/website/homepage
              </code>{" "}
              gibt{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px]">
                block.category
              </code>{" "}
              +{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px]">
                block.datadriven
              </code>{" "}
              für jede Sektion zurück.
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Deferred:{" "}
              <span className="text-amber-600">
                Visueller Block-Editor · Zod-Config-Validation ·
                Sponsor-Datenmodell · Block-Vorschau · Block-Versionshistorie
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: "Gesamt",
            value: totalBlocks,
            color: "#111827",
            bg: "rgba(17,24,39,0.05)",
          },
          {
            label: "Verfügbar",
            value: availableCount,
            color: "#10B981",
            bg: "rgba(16,185,129,0.08)",
          },
          {
            label: "Foundation Ready",
            value: foundationReadyCount,
            color: "#3B82F6",
            bg: "rgba(59,130,246,0.08)",
          },
          {
            label: "Kommt als nächstes",
            value: comingNextCount,
            color: "#F59E0B",
            bg: "rgba(245,158,11,0.08)",
          },
          {
            label: "Datenbankbasiert",
            value: dataDrivenCount,
            color: "#0EA5E9",
            bg: "rgba(14,165,233,0.08)",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: stat.bg, color: stat.color }}
            >
              {stat.value}
            </span>
            <p className="text-xs text-[var(--text-2)] leading-tight">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Navigation links */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={CMS_ROUTES.overview} className="fca-button-secondary text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          CMS Übersicht
        </Link>
        <Link href={CMS_ROUTES.homepage} className="fca-button-secondary text-xs">
          <LayoutTemplate className="h-3.5 w-3.5" />
          Homepage Builder
        </Link>
      </div>

      {/* Block categories */}
      <div className="space-y-8">
        {BLOCK_CATEGORIES.map((category) => {
          const blocks = blocksByCategory.get(category) ?? [];
          return (
            <CategorySection
              key={category}
              category={category}
              blocks={blocks}
            />
          );
        })}
      </div>
    </PageShell>
  );
}

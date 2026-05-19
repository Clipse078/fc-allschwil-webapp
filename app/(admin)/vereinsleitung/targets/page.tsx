import Link from "next/link";
import { Plus, Target, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTargets } from "@/lib/targets/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import TargetMetricProgress from "@/components/admin/targets/TargetMetricProgress";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

const CATEGORY_LABELS: Record<string, string> = {
  SPORTLICHE_ENTWICKLUNG: "Sportliche Entwicklung",
  MITGLIEDERWACHSTUM: "Mitgliederwachstum",
  FINANZEN: "Finanzen & Infrastruktur",
  AUSBILDUNG: "Ausbildung",
  MEDIEN_SOZIALES: "Medien & Soziales",
  GOVERNANCE: "Governance",
};

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  ACTIVE: { label: "Aktiv", classes: "sce-chip-success" },
  DRAFT: { label: "Entwurf", classes: "sce-chip-warning" },
  PAUSED: { label: "Pausiert", classes: "sce-chip" },
  COMPLETED: { label: "Abgeschlossen", classes: "sce-chip-primary" },
  CANCELLED: { label: "Abgebrochen", classes: "sce-chip-danger" },
};

type PageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function TargetsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = (await searchParams) ?? {};
  const actor = await getActorContext(session.user);
  const targets = await getTargets(actor);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Ziele"
        title="Vereinsziele"
        description="Strategische Ziele und messbare Fortschrittskennzahlen für den Verein."
        actions={
          <Link
            href="/vereinsleitung/targets/new"
            className="sce-action-primary px-4 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Neues Ziel
          </Link>
        }
      />

      {params.status === "saved" ? (
        <div className="rounded-[20px] fca-status-box fca-status-box-success px-5 py-3 text-sm font-medium">
          Ziel wurde erfolgreich gespeichert.
        </div>
      ) : null}

      {targets.length === 0 ? (
        <section className="sce-empty-state p-10">
          <Target className="mx-auto mb-4 h-10 w-10 text-[var(--sce-subtle)]" />
          <h3 className="sce-section-title">
            Noch keine Ziele erfasst
          </h3>
          <p className="mt-2 text-sm text-[var(--sce-muted)]">
            Erstelle das erste strategische Vereinsziel.
          </p>
          <Link
            href="/vereinsleitung/targets/new"
            className="sce-action-primary mt-5 px-5 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Erstes Ziel erstellen
          </Link>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {targets.map((target) => {
            const statusInfo = STATUS_LABELS[target.status] ?? STATUS_LABELS.DRAFT;
            const categoryLabel = CATEGORY_LABELS[target.category] ?? target.category;
            const firstMetrics = target.metrics.slice(0, 2);

            return (
              <Link
                key={target.id}
                href={`/vereinsleitung/targets/${target.id}`}
                className="sce-list-card block p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="sce-kicker">
                      {categoryLabel}
                    </p>
                    <h3 className="mt-1 text-[1.05rem] font-semibold leading-6 text-[var(--sce-heading)]">
                      {target.title}
                    </h3>
                    {target.description ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-[var(--sce-muted)]">
                        {target.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusInfo.classes}`}
                    >
                      {statusInfo.label}
                    </span>
                    <ReviewStageBadge stage={target.reviewStage} size="sm" />
                  </div>
                </div>

                {firstMetrics.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {firstMetrics.map((metric) => (
                      <TargetMetricProgress
                        key={metric.id}
                        label={metric.label}
                        type={metric.type}
                        direction={metric.direction}
                        targetValue={metric.targetValue}
                        currentValue={metric.currentValue}
                        unit={metric.unit}
                      />
                    ))}

                    {target.metrics.length > 2 ? (
                      <p className="text-[11px] text-[var(--sce-subtle)]">
                        +{target.metrics.length - 2} weitere Metrik
                        {target.metrics.length - 2 === 1 ? "" : "en"}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center gap-2 text-[11px] text-[var(--sce-subtle)]">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{target.metrics.length} Metrik{target.metrics.length !== 1 ? "en" : ""}</span>
                  {target.periodLabel ? (
                    <>
                      <span>·</span>
                      <span>{target.periodLabel}</span>
                    </>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { CalendarDays, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTargetById } from "@/lib/targets/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";
import EmptyState from "@/components/shared/ui/EmptyState";
import TargetMetricCreateForm from "@/components/admin/targets/TargetMetricCreateForm";
import type { StatusBadgeTone } from "@/components/shared/ui/StatusBadge";

type Props = { params: Promise<{ id: string }> };

function statusTone(s: string): StatusBadgeTone { const m: Record<string, StatusBadgeTone> = { ACTIVE: "success", PAUSED: "warning", ACHIEVED: "success", MISSED: "danger", CANCELLED: "muted" }; return m[s] ?? "default"; }
function statusLabel(s: string): string { const m: Record<string, string> = { DRAFT: "Entwurf", ACTIVE: "Aktiv", PAUSED: "Pausiert", ACHIEVED: "Erreicht", MISSED: "Verfehlt", CANCELLED: "Abgesagt" }; return m[s] ?? s; }
function periodLabel(p: string): string { const m: Record<string, string> = { ONCE: "Einmalig", WEEKLY: "Wöchentlich", MONTHLY: "Monatlich", QUARTERLY: "Quartalsweise", SEASONAL: "Saisonweise", ANNUAL: "Jährlich", MULTI_YEAR: "Mehrjährig" }; return m[p] ?? p; }
function metricTypeLabel(t: string): string { const m: Record<string, string> = { NUMBER: "Anzahl", PERCENTAGE: "Prozent (%)", CURRENCY: "Betrag (CHF)", BOOLEAN: "Ja/Nein", RATIO: "Verhältnis", SCORE: "Punktzahl" }; return m[t] ?? t; }
function formatDate(d: Date) { return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d); }

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "INCREASE") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (direction === "DECREASE") return <TrendingDown className="h-4 w-4 text-rose-500" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

export default async function TargetDetailPage({ params }: Props) {
  await requireAnyPermission([PERMISSIONS.TARGETS_VIEW, PERMISSIONS.TARGETS_MANAGE]);
  const { id } = await params;
  const target = await getTargetById(id);
  if (!target) notFound();

  return (
    <PageShell>
      {/* Header */}
      <SectionCard className="p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {target.orgUnitLabel ? <p className="fca-eyebrow">{target.orgUnitLabel}</p> : null}
            <h2 className="mt-1 font-[var(--font-display)] text-[1.8rem] font-bold uppercase leading-none tracking-[-0.03em] text-[#0b4aa2]">{target.title}</h2>
            {target.description ? <p className="fca-body-muted mt-2 max-w-2xl">{target.description}</p> : null}
          </div>
          <StatusBadge label={statusLabel(target.status)} tone={statusTone(target.status)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-600">
          {target.periodType ? <span className="font-medium">{periodLabel(target.periodType)}</span> : null}
          {target.startsAt ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-[#0b4aa2]" />Start: {formatDate(target.startsAt)}</span> : null}
          {target.endsAt   ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-[#0b4aa2]" />Ende: {formatDate(target.endsAt)}</span> : null}
          {target.moduleKey ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">{target.moduleKey}</span> : null}
          {target.ageGroupHint ? <span className="text-slate-400">Altersgruppe: {target.ageGroupHint}</span> : null}
          {target.season ? <span className="text-slate-400">Saison: {target.season.name}</span> : null}
          {target.team   ? <span className="text-slate-400">Team: {target.team.name}</span>   : null}
        </div>

        {/* Nudging info */}
        {(target.recommendedRangeMin !== null || target.benchmarkSource) ? (
          <div className="mt-4 rounded-[16px] border border-sky-100 bg-sky-50/60 px-4 py-3 text-xs text-sky-700">
            {target.suggestedBySystem ? <span className="mr-3 font-semibold">Systemvorschlag</span> : null}
            {target.recommendedRangeMin !== null && target.recommendedRangeMax !== null
              ? <span>Empfohlener Bereich: {target.recommendedRangeMin}–{target.recommendedRangeMax}</span>
              : null}
            {target.recommendationConfidence !== null
              ? <span className="ml-3 text-sky-500">Konfidenz: {Math.round((target.recommendationConfidence ?? 0) * 100)}%</span>
              : null}
            {target.benchmarkSource ? <span className="ml-3 text-sky-500">Quelle: {target.benchmarkSource}</span> : null}
          </div>
        ) : null}
      </SectionCard>

      {/* Metrics */}
      <SectionCard className="p-6">
        <h3 className="fca-subheading">Kennzahlen</h3>

        {target.metrics.length === 0 ? (
          <EmptyState title="Noch keine Kennzahlen" description="Füge eine messbare Kennzahl hinzu, um den Fortschritt zu verfolgen." size="sm" />
        ) : (
          <div className="mt-4 space-y-3">
            {target.metrics.map((metric) => {
              const latest = metric.dataPoints[0]?.value ?? metric.currentValue;
              const progressPct = metric.targetValue && latest !== null && latest !== undefined
                ? Math.min(100, Math.round((latest / metric.targetValue) * 100))
                : null;
              return (
                <div key={metric.id} className="rounded-[18px] border border-slate-200/80 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <DirectionIcon direction={metric.direction} />
                      <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
                      <span className="text-xs text-slate-400">{metricTypeLabel(metric.metricType)}</span>
                    </div>
                    <div className="text-right">
                      {latest !== null && latest !== undefined ? (
                        <p className="text-lg font-bold text-slate-900">{latest}{metric.unit ? ` ${metric.unit}` : ""}</p>
                      ) : null}
                      {metric.targetValue !== null ? (
                        <p className="text-xs text-slate-400">Ziel: {metric.targetValue}{metric.unit ? ` ${metric.unit}` : ""}</p>
                      ) : null}
                    </div>
                  </div>
                  {progressPct !== null ? (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-[#0b4aa2] transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                      <p className="mt-1 text-right text-[11px] text-slate-400">{progressPct}%</p>
                    </div>
                  ) : null}
                  {metric.notes ? <p className="mt-2 text-xs text-slate-400">{metric.notes}</p> : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Kennzahl hinzufügen</p>
          <TargetMetricCreateForm targetId={id} />
        </div>
      </SectionCard>
    </PageShell>
  );
}

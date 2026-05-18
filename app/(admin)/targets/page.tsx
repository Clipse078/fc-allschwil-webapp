import Link from "next/link";
import { CalendarDays, Plus, Target } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listTargets } from "@/lib/targets/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";
import EmptyState from "@/components/shared/ui/EmptyState";
import type { StatusBadgeTone } from "@/components/shared/ui/StatusBadge";

function targetStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "ACTIVE":    return "success";
    case "PAUSED":    return "warning";
    case "ACHIEVED":  return "success";
    case "MISSED":    return "danger";
    case "CANCELLED": return "muted";
    default:          return "default"; // DRAFT
  }
}
function targetStatusLabel(status: string): string {
  const map: Record<string, string> = { DRAFT: "Entwurf", ACTIVE: "Aktiv", PAUSED: "Pausiert", ACHIEVED: "Erreicht", MISSED: "Verfehlt", CANCELLED: "Abgesagt" };
  return map[status] ?? status;
}
function periodLabel(p: string): string {
  const map: Record<string, string> = { ONCE: "Einmalig", WEEKLY: "Wöchentlich", MONTHLY: "Monatlich", QUARTERLY: "Quartalsweise", SEASONAL: "Saisonweise", ANNUAL: "Jährlich", MULTI_YEAR: "Mehrjährig" };
  return map[p] ?? p;
}
function formatDate(d: Date) { return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d); }

export default async function TargetsPage() {
  await requireAnyPermission([PERMISSIONS.TARGETS_VIEW, PERMISSIONS.TARGETS_MANAGE]);
  const targets = await listTargets();

  return (
    <PageShell>
      {targets.length === 0 ? (
        <SectionCard className="p-8">
          <EmptyState
            icon={Target}
            title="Noch keine Ziele"
            description="Strategische Ziele werden hier verwaltet — von Vereinsentwicklung bis Trainingsphilosophie."
            size="lg"
            action={
              <Link href="/targets/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]">
                <Plus className="h-4 w-4" />
                Neues Ziel
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard className="p-6">
          <div className="space-y-3">
            {targets.map((target) => (
              <Link
                key={target.id}
                href={`/targets/${target.id}`}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-semibold text-slate-900">{target.title}</h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {target.orgUnitLabel ? <span className="font-medium text-slate-500">{target.orgUnitLabel}</span> : null}
                    {target.ageGroupHint ? <span>· {target.ageGroupHint}</span> : null}
                    {target.targetCategory ? <span>· {target.targetCategory}</span> : null}
                    {target.moduleKey ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">{target.moduleKey}</span> : null}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {target.periodType ? <span className="font-medium">{periodLabel(target.periodType)}</span> : null}
                    {target.endsAt ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />Bis: {formatDate(target.endsAt)}</span> : null}
                    {target._count.metrics > 0 ? <span>{target._count.metrics} Kennzahl{target._count.metrics !== 1 ? "en" : ""}</span> : null}
                    {target.suggestedBySystem ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-600">Systemvorschlag</span> : null}
                    {target.recommendedRangeMin !== null && target.recommendedRangeMax !== null
                      ? <span>Empfehlung: {target.recommendedRangeMin}–{target.recommendedRangeMax}</span>
                      : null}
                  </div>
                </div>
                <StatusBadge label={targetStatusLabel(target.status)} tone={targetStatusTone(target.status)} />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </PageShell>
  );
}

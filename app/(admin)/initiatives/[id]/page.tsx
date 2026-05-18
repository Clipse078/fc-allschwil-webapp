import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Flag, TrendingUp } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getInitiativeById } from "@/lib/initiatives/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";
import EmptyState from "@/components/shared/ui/EmptyState";
import type { StatusBadgeTone } from "@/components/shared/ui/StatusBadge";

type InitiativeDetailPageProps = { params: Promise<{ id: string }> };

function statusTone(s: string): StatusBadgeTone {
  switch (s) {
    case "ACTIVE":    return "success";
    case "PAUSED":    return "warning";
    case "COMPLETED": return "muted";
    case "CANCELLED": return "danger";
    default:          return "default";
  }
}
function statusLabel(s: string): string {
  const map: Record<string, string> = { DRAFT: "Entwurf", ACTIVE: "Aktiv", PAUSED: "Pausiert", COMPLETED: "Abgeschlossen", CANCELLED: "Abgesagt" };
  return map[s] ?? s;
}
function priorityTone(p: string): StatusBadgeTone {
  switch (p) { case "CRITICAL": return "danger"; case "HIGH": return "warning"; case "MEDIUM": return "info"; default: return "muted"; }
}
function priorityLabel(p: string): string {
  const map: Record<string, string> = { CRITICAL: "Kritisch", HIGH: "Hoch", MEDIUM: "Mittel", LOW: "Niedrig" };
  return map[p] ?? p;
}
function taskStatusTone(s: string): StatusBadgeTone {
  switch (s) { case "DONE": return "success"; case "CANCELLED": return "muted"; case "IN_PROGRESS": return "info"; default: return "warning"; }
}
function formatDate(d: Date) {
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export default async function InitiativeDetailPage({ params }: InitiativeDetailPageProps) {
  await requireAnyPermission([PERMISSIONS.INITIATIVES_VIEW, PERMISSIONS.INITIATIVES_MANAGE]);

  const { id } = await params;
  const initiative = await getInitiativeById(id);
  if (!initiative) notFound();

  return (
    <PageShell>
      {/* Header info */}
      <SectionCard className="p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {initiative.orgUnitLabel ? (
              <p className="fca-eyebrow">{initiative.orgUnitLabel}</p>
            ) : null}
            <h2 className="mt-1 font-[var(--font-display)] text-[1.8rem] font-bold uppercase leading-none tracking-[-0.03em] text-[#0b4aa2]">
              {initiative.title}
            </h2>
            {initiative.summary ? (
              <p className="fca-body-muted mt-2">{initiative.summary}</p>
            ) : null}
            {initiative.description ? (
              <p className="mt-3 max-w-2xl text-sm text-slate-600">{initiative.description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={priorityLabel(initiative.priority)} tone={priorityTone(initiative.priority)} />
            <StatusBadge label={statusLabel(initiative.status)}   tone={statusTone(initiative.status)} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-6 text-sm text-slate-600">
          {initiative.ownerName ? (
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0b4aa2]" />
              {initiative.ownerName}
            </span>
          ) : null}
          {initiative.dueDate ? (
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#0b4aa2]" />
              Fällig: {formatDate(initiative.dueDate)}
            </span>
          ) : null}
          {initiative.startsAt ? (
            <span className="text-slate-400">Start: {formatDate(initiative.startsAt)}</span>
          ) : null}
          {initiative.completedAt ? (
            <span className="text-slate-400">Abgeschlossen: {formatDate(initiative.completedAt)}</span>
          ) : null}
          {initiative.season ? (
            <span className="text-slate-400">Saison: {initiative.season.name}</span>
          ) : null}
          {initiative.team ? (
            <span className="text-slate-400">Team: {initiative.team.name}</span>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        {/* Tasks */}
        <SectionCard className="p-6">
          <h3 className="fca-subheading">Aufgaben</h3>

          {initiative.tasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Keine Aufgaben" description="Noch keine Aufgaben erfasst." size="sm" />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {initiative.tasks.map((task) => (
                <li key={task.id} className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                    <StatusBadge label={task.status} tone={taskStatusTone(task.status)} />
                  </div>
                  {task.assignedTo ? <p className="mt-1 text-xs text-slate-400">→ {task.assignedTo}</p> : null}
                  {task.dueDate ? (
                    <p className="mt-1 text-xs text-slate-400">Fällig: {formatDate(task.dueDate)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Milestones */}
        <SectionCard className="p-6">
          <h3 className="fca-subheading">Meilensteine</h3>

          {initiative.milestones.length === 0 ? (
            <EmptyState icon={Flag} title="Keine Meilensteine" description="Noch keine Meilensteine erfasst." size="sm" />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {initiative.milestones.map((ms) => (
                <li key={ms.id} className="flex items-start gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-4 py-3">
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${ms.isCompleted ? "text-emerald-500" : "text-slate-300"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{ms.title}</p>
                    {ms.dueDate ? (
                      <p className="mt-0.5 text-xs text-slate-400">{formatDate(ms.dueDate)}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}

import Link from "next/link";
import { CalendarDays, Flag, Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listInitiatives } from "@/lib/initiatives/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";
import EmptyState from "@/components/shared/ui/EmptyState";
import type { StatusBadgeTone } from "@/components/shared/ui/StatusBadge";

function initiativeStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "ACTIVE":     return "success";
    case "PAUSED":     return "warning";
    case "COMPLETED":  return "muted";
    case "CANCELLED":  return "danger";
    default:           return "default"; // DRAFT
  }
}

function initiativeStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":      return "Entwurf";
    case "ACTIVE":     return "Aktiv";
    case "PAUSED":     return "Pausiert";
    case "COMPLETED":  return "Abgeschlossen";
    case "CANCELLED":  return "Abgesagt";
    default:           return status;
  }
}

function priorityTone(priority: string): StatusBadgeTone {
  switch (priority) {
    case "CRITICAL": return "danger";
    case "HIGH":     return "warning";
    case "MEDIUM":   return "info";
    default:         return "muted"; // LOW
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case "CRITICAL": return "Kritisch";
    case "HIGH":     return "Hoch";
    case "MEDIUM":   return "Mittel";
    case "LOW":      return "Niedrig";
    default:         return priority;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function InitiativesPage() {
  await requireAnyPermission([
    PERMISSIONS.INITIATIVES_VIEW,
    PERMISSIONS.INITIATIVES_MANAGE,
  ]);

  const initiatives = await listInitiatives();

  return (
    <PageShell>
      {initiatives.length === 0 ? (
        <SectionCard className="p-8">
          <EmptyState
            icon={Flag}
            title="Noch keine Initiativen"
            description="Initiativen werden hier als eigenständiges Modul verwaltet. Erstelle die erste Initiative, um loszulegen."
            size="lg"
            action={
              <Link
                href="/initiatives/new"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
              >
                <Plus className="h-4 w-4" />
                Neue Initiative
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard className="p-6">
          <div className="space-y-3">
            {initiatives.map((initiative) => (
              <Link
                key={initiative.id}
                href={`/initiatives/${initiative.id}`}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-semibold text-slate-900">
                    {initiative.title}
                  </h3>

                  {initiative.summary ? (
                    <p className="mt-1 text-sm text-slate-500 line-clamp-1">
                      {initiative.summary}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    {initiative.orgUnitLabel ? (
                      <span className="text-xs font-medium text-slate-500">
                        {initiative.orgUnitLabel}
                      </span>
                    ) : null}

                    {initiative.ownerName ? (
                      <span className="text-xs text-slate-400">
                        → {initiative.ownerName}
                      </span>
                    ) : null}

                    {initiative.dueDate ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Fällig: {formatDate(initiative.dueDate)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={priorityLabel(initiative.priority)}
                    tone={priorityTone(initiative.priority)}
                  />
                  <StatusBadge
                    label={initiativeStatusLabel(initiative.status)}
                    tone={initiativeStatusTone(initiative.status)}
                  />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </PageShell>
  );
}

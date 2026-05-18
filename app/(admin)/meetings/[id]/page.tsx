import { notFound } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Users,
  Video,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getMeetingById } from "@/lib/meetings/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";
import EmptyState from "@/components/shared/ui/EmptyState";
import type { StatusBadgeTone } from "@/components/shared/ui/StatusBadge";

type MeetingDetailPageProps = {
  params: Promise<{ id: string }>;
};

function meetingStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "SCHEDULED":   return "default";
    case "IN_PROGRESS": return "info";
    case "COMPLETED":   return "success";
    case "CANCELLED":   return "danger";
    default:            return "muted";
  }
}

function meetingStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":       return "Entwurf";
    case "SCHEDULED":   return "Geplant";
    case "IN_PROGRESS": return "Laufend";
    case "COMPLETED":   return "Abgeschlossen";
    case "CANCELLED":   return "Abgesagt";
    default:            return status;
  }
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  await requireAnyPermission([
    PERMISSIONS.MEETINGS_VIEW,
    PERMISSIONS.MEETINGS_MANAGE,
  ]);

  const { id } = await params;
  const meeting = await getMeetingById(id);

  if (!meeting) {
    notFound();
  }

  return (
    <PageShell>
      {/* Meeting info */}
      <SectionCard className="p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {meeting.orgUnitLabel ? (
              <p className="fca-eyebrow">{meeting.orgUnitLabel}</p>
            ) : null}
            <h2 className="mt-1 font-[var(--font-display)] text-[1.8rem] font-bold uppercase leading-none tracking-[-0.03em] text-[#0b4aa2]">
              {meeting.title}
            </h2>
            {meeting.description ? (
              <p className="fca-body-muted mt-3 max-w-2xl">{meeting.description}</p>
            ) : null}
          </div>

          <StatusBadge
            label={meetingStatusLabel(meeting.status)}
            tone={meetingStatusTone(meeting.status)}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-6 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#0b4aa2]" />
            {formatDateTime(meeting.scheduledAt)}
          </span>

          {meeting.location ? (
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#0b4aa2]" />
              {meeting.location}
            </span>
          ) : null}

          {meeting.onlineMeetingUrl ? (
            <a
              href={meeting.onlineMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
            >
              <Video className="h-4 w-4" />
              Online-Meeting öffnen
            </a>
          ) : null}

          {meeting.season ? (
            <span className="text-slate-400">Saison: {meeting.season.name}</span>
          ) : null}

          {meeting.team ? (
            <span className="text-slate-400">Team: {meeting.team.name}</span>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
        {/* Left column: Agenda + Decisions + Actions */}
        <div className="flex flex-col gap-6">
          {/* Agenda */}
          <SectionCard className="p-6">
            <h3 className="fca-subheading">Agenda</h3>

            {meeting.agendaItems.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Keine Agendapunkte"
                description="Noch keine Agendapunkte erfasst."
                size="sm"
              />
            ) : (
              <ol className="mt-4 space-y-3">
                {meeting.agendaItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-4 rounded-[18px] border border-slate-200/80 bg-slate-50 px-4 py-3.5"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-xs font-bold text-[#0b4aa2]">
                      {item.sortOrder + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.body ? (
                        <p className="mt-1 text-xs text-slate-500">{item.body}</p>
                      ) : null}
                      {item.presenter ? (
                        <p className="mt-1 text-xs text-slate-400">→ {item.presenter}</p>
                      ) : null}
                    </div>
                    {item.durationMin ? (
                      <span className="shrink-0 text-xs text-slate-400">{item.durationMin} min</span>
                    ) : null}
                    {item.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          {/* Decisions */}
          <SectionCard className="p-6">
            <h3 className="fca-subheading">Beschlüsse</h3>

            {meeting.decisions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Keine Beschlüsse"
                description="Noch keine Beschlüsse erfasst."
                size="sm"
              />
            ) : (
              <ol className="mt-4 space-y-3">
                {meeting.decisions.map((decision) => (
                  <li
                    key={decision.id}
                    className="rounded-[18px] border border-emerald-100 bg-emerald-50/60 px-4 py-3.5"
                  >
                    <p className="text-sm font-semibold text-slate-900">{decision.title}</p>
                    {decision.body ? (
                      <p className="mt-1 text-xs text-slate-600">{decision.body}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          {/* Actions */}
          <SectionCard className="p-6">
            <h3 className="fca-subheading">Massnahmen</h3>

            {meeting.actions.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Keine Massnahmen"
                description="Noch keine Massnahmen erfasst."
                size="sm"
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {meeting.actions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                      <StatusBadge
                        label={action.status}
                        tone={
                          action.status === "DONE" ? "success" :
                          action.status === "CANCELLED" ? "muted" :
                          action.status === "IN_PROGRESS" ? "info" : "warning"
                        }
                      />
                    </div>
                    {action.assignedTo ? (
                      <p className="mt-1 text-xs text-slate-500">→ {action.assignedTo}</p>
                    ) : null}
                    {action.dueDate ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Fällig: {new Intl.DateTimeFormat("de-CH").format(action.dueDate)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Right column: Participants */}
        <SectionCard className="p-6">
          <h3 className="fca-subheading">Teilnehmer</h3>

          {meeting.participants.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Keine Teilnehmer"
              description="Noch keine Teilnehmer erfasst."
              size="sm"
            />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {meeting.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[11px] font-bold text-[#0b4aa2]">
                      {p.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{p.displayName}</p>
                      <p className="text-xs text-slate-400">{p.role}</p>
                    </div>
                  </div>

                  {p.attended !== null && p.attended !== undefined ? (
                    <span
                      className={
                        p.attended
                          ? "text-xs font-semibold text-emerald-600"
                          : "text-xs font-semibold text-rose-500"
                      }
                    >
                      {p.attended ? "Anwesend" : "Abwesend"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}

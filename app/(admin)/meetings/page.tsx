import Link from "next/link";
import { CalendarDays, Plus, Users } from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { listMeetings } from "@/lib/meetings/queries";
import PageShell from "@/components/shared/ui/PageShell";
import SectionCard from "@/components/shared/ui/SectionCard";
import StatusBadge from "@/components/shared/ui/StatusBadge";
import EmptyState from "@/components/shared/ui/EmptyState";
import type { StatusBadgeTone } from "@/components/shared/ui/StatusBadge";

function meetingStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "SCHEDULED":   return "default";
    case "IN_PROGRESS": return "info";
    case "COMPLETED":   return "success";
    case "CANCELLED":   return "danger";
    default:            return "muted"; // DRAFT
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

function formatScheduledAt(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function MeetingsPage() {
  await requireAnyPermission([
    PERMISSIONS.MEETINGS_VIEW,
    PERMISSIONS.MEETINGS_MANAGE,
  ]);

  const meetings = await listMeetings();

  return (
    <PageShell>
      {meetings.length === 0 ? (
        <SectionCard className="p-8">
          <EmptyState
            icon={CalendarDays}
            title="Noch keine Meetings"
            description="Meetings werden hier als eigenständiges Modul verwaltet. Erstelle das erste Meeting, um loszulegen."
            size="lg"
            action={
              <Link
                href="/meetings/new"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
              >
                <Plus className="h-4 w-4" />
                Meeting planen
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard className="p-6">
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-semibold text-slate-900">
                    {meeting.title}
                  </h3>

                  {meeting.orgUnitLabel ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {meeting.orgUnitLabel}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {formatScheduledAt(meeting.scheduledAt)}
                    </span>

                    {meeting.location ? (
                      <span className="text-slate-400">· {meeting.location}</span>
                    ) : null}

                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {meeting._count.participants}
                    </span>
                  </div>
                </div>

                <StatusBadge
                  label={meetingStatusLabel(meeting.status)}
                  tone={meetingStatusTone(meeting.status)}
                />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </PageShell>
  );
}

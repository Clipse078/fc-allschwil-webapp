/**
 * DB-backed meetings list. Data is fetched server-side in meetings/page.tsx
 * and passed as props. When the result set is empty an empty-state is shown.
 *
 * VISIBILITY NOTE: The meetings array passed here is currently UNFILTERED —
 * every authenticated user sees every meeting. Once VisibilityScope is added
 * to the Meeting model (Phase 2), the server page must pass a visibility-filtered
 * list so that RESTRICTED and PRIVATE meetings are silently excluded.
 * The empty state MUST NOT reveal whether hidden meetings exist.
 *
 * TODO: Cross-Module Linking — Meeting detail integration
 * When this component is wired to real Meeting records, the detail page
 * should surface linked Targets (reverse query on Target.linkedMeetingRefs).
 * See lib/linking/stubs.ts for the migration path from static stubs to real
 * DB queries, and VereinsleitungMeetingDetail.tsx for the traceability TODOs.
 */

import Link from "next/link";
import { CalendarDays, ChevronRight, Edit, Plus, Users } from "lucide-react";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import VisibilityScopeBadge from "@/components/admin/shared/VisibilityScopeBadge";
import type { ReviewWorkflowStage } from "@prisma/client";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

export type MeetingListItemShape = {
  id: string;
  slug: string;
  title: string;
  meetingDate: Date;
  location: string | null;
  attendeeCount: number | null;
  status: "PLANNED" | "COMPLETED" | "CANCELLED";
  reviewStage: ReviewWorkflowStage;
  visibilityScope: VisibilityScopeValue;
};

const STATUS_LABELS: Record<MeetingListItemShape["status"], string> = {
  PLANNED: "Geplant",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
};

function formatSwissDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

type VereinsleitungMeetingsListProps = {
  meetings: MeetingListItemShape[];
};

export default function VereinsleitungMeetingsList({
  meetings,
}: VereinsleitungMeetingsListProps) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <CalendarDays className="mx-auto mb-4 h-10 w-10 text-slate-300" />
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Keine zugänglichen Meetings
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Noch keine Meetings erfasst oder keine für dich sichtbaren Einträge.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500">
          <Plus className="h-3.5 w-3.5" />
          POST /api/meetings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <Link
          key={meeting.slug}
          href={`/meetings/${meeting.slug}`}
          className="block rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[1.05rem] font-semibold text-slate-900">
                {meeting.title}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatSwissDate(meeting.meetingDate)}
                </span>

                {meeting.attendeeCount ? (
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {meeting.attendeeCount} Teilnehmer
                  </span>
                ) : null}

                {meeting.location ? (
                  <span className="text-slate-400">{meeting.location}</span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {STATUS_LABELS[meeting.status]}
              </span>
              <div className="flex items-center gap-1.5">
                <ReviewStageBadge stage={meeting.reviewStage} size="sm" />
                <VisibilityScopeBadge scope={meeting.visibilityScope} />
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/meetings/${meeting.slug}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Bearbeiten
                </Link>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2]">
                  Öffnen
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

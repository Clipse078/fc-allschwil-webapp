/**
 * Governance banner shown on meeting detail pages when the Meeting record
 * exists in the DB. Displays review stage, reviewer stamp, and stage actions.
 *
 * When the slug is not in the DB (legacy mock slug), this component is not
 * rendered — existing mock detail behavior is preserved with zero regression.
 */

import { ShieldCheck } from "lucide-react";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import MeetingStageActions from "@/components/admin/meetings/MeetingStageActions";
import type { ReviewWorkflowStage } from "@prisma/client";

type MeetingGovernanceBannerProps = {
  meeting: {
    id: string;
    title: string;
    reviewStage: ReviewWorkflowStage;
    requiresFourEyeReview: boolean;
    reviewedAt: Date | null;
  };
};

function formatSwissDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function MeetingGovernanceBanner({ meeting }: MeetingGovernanceBannerProps) {
  return (
    <section className="sce-page-card px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">
              Governance
            </span>
          </div>

          <ReviewStageBadge stage={meeting.reviewStage} />

          {meeting.requiresFourEyeReview ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
              <ShieldCheck className="h-3 w-3" />
              4-Augen
            </span>
          ) : null}

          {meeting.reviewedAt ? (
            <span className="text-[11px] text-slate-400">
              Geprüft {formatSwissDate(meeting.reviewedAt)}
            </span>
          ) : null}
        </div>

        <MeetingStageActions meetingId={meeting.id} currentStage={meeting.reviewStage} />
      </div>
    </section>
  );
}

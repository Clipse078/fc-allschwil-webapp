/**
 * Governance banner shown on initiative detail pages when the Initiative record
 * exists in the DB. Mirrors MeetingGovernanceBanner exactly.
 */

import { ShieldCheck } from "lucide-react";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import InitiativeStageActions from "@/components/admin/initiatives/InitiativeStageActions";
import type { ReviewWorkflowStage } from "@prisma/client";

type InitiativeGovernanceBannerProps = {
  initiative: {
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

export default function InitiativeGovernanceBanner({
  initiative,
}: InitiativeGovernanceBannerProps) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">
              Governance
            </span>
          </div>

          <ReviewStageBadge stage={initiative.reviewStage} />

          {initiative.requiresFourEyeReview ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
              <ShieldCheck className="h-3 w-3" />
              4-Augen
            </span>
          ) : null}

          {initiative.reviewedAt ? (
            <span className="text-[11px] text-slate-400">
              Geprüft {formatSwissDate(initiative.reviewedAt)}
            </span>
          ) : null}
        </div>

        <InitiativeStageActions
          initiativeId={initiative.id}
          currentStage={initiative.reviewStage}
        />
      </div>
    </section>
  );
}

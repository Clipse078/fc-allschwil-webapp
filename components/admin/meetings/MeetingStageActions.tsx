"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";
import { ReviewWorkflowStage } from "@prisma/client";
import { getAllowedTransitions, getReviewStageInfo } from "@/lib/governance/review-stage";

type MeetingStageActionsProps = {
  meetingId: string;
  currentStage: ReviewWorkflowStage;
};

export default function MeetingStageActions({
  meetingId,
  currentStage,
}: MeetingStageActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ReviewWorkflowStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = getAllowedTransitions(currentStage);
  if (allowed.length === 0) return null;

  async function handleTransition(toStage: ReviewWorkflowStage) {
    setError(null);
    setLoading(toStage);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: toStage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Statuswechsel fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(null);
    }
  }

  function getButtonStyle(stage: ReviewWorkflowStage): string {
    switch (stage) {
      case ReviewWorkflowStage.SUBMITTED:
        return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
      case ReviewWorkflowStage.APPROVED:
        return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
      case ReviewWorkflowStage.REJECTED:
        return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";
      case ReviewWorkflowStage.PUBLISHED:
        return "border-blue-200 bg-blue-50 text-[#3f63b5] hover:bg-blue-100";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? (
        <span className="text-[11px] font-medium text-rose-600">{error}</span>
      ) : null}
      {allowed.map((toStage) => {
        const info = getReviewStageInfo(toStage);
        const isLoading = loading === toStage;
        return (
          <button
            key={toStage}
            type="button"
            onClick={() => handleTransition(toStage)}
            disabled={loading !== null}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60 ${getButtonStyle(toStage)}`}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
            {info.label}
          </button>
        );
      })}
    </div>
  );
}

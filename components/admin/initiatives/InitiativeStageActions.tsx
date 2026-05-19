"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";
import { ReviewWorkflowStage } from "@prisma/client";
import { getAllowedTransitions, getReviewStageInfo } from "@/lib/governance/review-stage";

type InitiativeStageActionsProps = {
  initiativeId: string;
  currentStage: ReviewWorkflowStage;
};

export default function InitiativeStageActions({
  initiativeId,
  currentStage,
}: InitiativeStageActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ReviewWorkflowStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = getAllowedTransitions(currentStage);
  if (allowed.length === 0) return null;

  async function handleTransition(toStage: ReviewWorkflowStage) {
    setError(null);
    setLoading(toStage);
    try {
      const res = await fetch(`/api/initiatives/${initiativeId}/stage`, {
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
        return "sce-chip-warning hover:opacity-85";
      case ReviewWorkflowStage.APPROVED:
        return "sce-chip-success hover:opacity-85";
      case ReviewWorkflowStage.REJECTED:
        return "sce-chip-danger hover:opacity-85";
      case ReviewWorkflowStage.PUBLISHED:
        return "sce-chip-primary hover:opacity-85";
      default:
        return "sce-chip hover:opacity-85";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? (
        <span className="text-[11px] font-medium text-[var(--sce-danger)]">{error}</span>
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
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {info.label}
          </button>
        );
      })}
    </div>
  );
}

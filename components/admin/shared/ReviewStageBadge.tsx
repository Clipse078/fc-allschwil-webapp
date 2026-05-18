import { getReviewStageInfo } from "@/lib/governance/review-stage";
import { ReviewWorkflowStage } from "@prisma/client";

type ReviewStageBadgeProps = {
  stage: ReviewWorkflowStage;
  size?: "sm" | "md";
};

export default function ReviewStageBadge({
  stage,
  size = "md",
}: ReviewStageBadgeProps) {
  const info = getReviewStageInfo(stage);

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${info.badgeClasses}`}
      title={`Prüfstatus: ${info.label}`}
    >
      {info.label}
    </span>
  );
}

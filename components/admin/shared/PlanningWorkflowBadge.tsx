/**
 * ORG-ACCESS-03: Planning workflow stage badge for Training/Match/Tournament.
 *
 * Maps the planning lifecycle stages to user-facing German labels:
 *   DRAFT     → "Entwurf"
 *   SUBMITTED → "Zur Prüfung eingereicht"
 *   APPROVED  → "Von der Koordination validiert" (with lock icon)
 *
 * Used in TrainingCenter, MatchCenter, and TournamentCenter overviews and
 * detail views. Only shown where the planningStage is known and meaningful
 * for the current user (e.g., scoped users or records in workflow).
 *
 * Coordinators (tenant-wide) see no extra badge — their records are APPROVED
 * by default and management access is unconditional.
 */

type PlanningStage = "DRAFT" | "SUBMITTED" | "APPROVED" | string;

type PlanningWorkflowBadgeProps = {
  stage: PlanningStage;
  size?: "sm" | "md";
  /** Show as locked indicator (no label, just icon). */
  iconOnly?: boolean;
};

type StageInfo = {
  label: string;
  title: string;
  badgeClasses: string;
  icon?: string;
};

function getPlanningStageInfo(stage: PlanningStage): StageInfo | null {
  switch (stage) {
    case "DRAFT":
      return {
        label: "Entwurf",
        title: "Entwurf — kann noch bearbeitet werden",
        badgeClasses:
          "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
      };
    case "SUBMITTED":
      return {
        label: "Zur Prüfung eingereicht",
        title: "Eingereicht — wartet auf Validierung durch Koordination",
        badgeClasses:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
      };
    case "APPROVED":
      return {
        label: "Von der Koordination validiert",
        title: "Validiert — gesperrt für Bearbeitung",
        badgeClasses:
          "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
        icon: "🔒",
      };
    default:
      return null;
  }
}

export default function PlanningWorkflowBadge({
  stage,
  size = "sm",
  iconOnly = false,
}: PlanningWorkflowBadgeProps) {
  const info = getPlanningStageInfo(stage);

  if (!info) return null;

  // Only show coordinator-validated badge for SUBMITTED and APPROVED stages.
  // APPROVED records in coordinator-direct-management flow don't need a badge.
  // Only show badge for DRAFT and SUBMITTED (workflow in-progress).
  if (stage === "APPROVED" && !iconOnly) {
    // Show lock indicator for scoped creators viewing validated records.
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border font-semibold ${
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
        } ${info.badgeClasses}`}
        title={info.title}
      >
        {info.icon && <span aria-hidden="true">{info.icon}</span>}
        <span>{info.label}</span>
      </span>
    );
  }

  if (stage === "APPROVED") {
    return (
      <span title={info.title} aria-label={info.label}>
        🔒
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      } ${info.badgeClasses}`}
      title={info.title}
    >
      {info.label}
    </span>
  );
}

"use client";

/**
 * WaitingListWorkflowSteps — REG-WAIT-01D / REG-WAIT-01E / REG-WAIT-01F
 *
 * Visual workflow progression for a waiting-list entry.
 * Uses the canonical PremiumWorkflowSteps presentation.
 */

import type { WaitingListEntryItem } from "@/lib/registrations/waiting-list-queries";
import {
  WAITING_LIST_STATUS_COLORS,
  WAITING_LIST_STATUS_LABELS,
  formatWaitingListDateTime,
  getWaitingListNextStep,
  resolveWaitingListWorkflowState,
} from "@/lib/registrations/waiting-list-ui";
import {
  PremiumWorkflowSteps,
  type PremiumWorkflowStepState,
} from "./PremiumWorkflowSteps";

type Props = {
  entry: WaitingListEntryItem;
};

export function WaitingListWorkflowSteps({ entry }: Props) {
  const { steps, currentIndex, terminal, terminalStatus } = resolveWaitingListWorkflowState(entry);
  const nextStep = getWaitingListNextStep(entry.status);

  const stepStates: PremiumWorkflowStepState[] = steps.map((step, index) => {
    const isCompleted =
      index < currentIndex || (entry.status === "PLACED" && index <= 4);
    const isCurrent =
      !terminal && index === currentIndex
        ? true
        : terminal && index === currentIndex && terminalStatus !== "PLACED"
          ? true
          : entry.status === "PLACED" && index === 4;
    const state = isCurrent ? "current" : isCompleted ? "completed" : "future";

    return {
      key: step.key,
      label: step.label,
      timestamp: step.timestamp,
      state,
    };
  });

  return (
    <PremiumWorkflowSteps
      statusLabel={WAITING_LIST_STATUS_LABELS[entry.status]}
      statusBadgeClass={WAITING_LIST_STATUS_COLORS[entry.status]}
      steps={stepStates}
      nextStep={nextStep}
      formatTimestamp={formatWaitingListDateTime}
      terminalAlert={
        terminal && terminalStatus && terminalStatus !== "PLACED"
          ? {
              title: `Abgeschlossen: ${WAITING_LIST_STATUS_LABELS[terminalStatus]}`,
              detail: entry.resolvedAt ? (
                <p className="mt-0.5 text-[0.68rem] text-rose-700">
                  {formatWaitingListDateTime(entry.resolvedAt)}
                </p>
              ) : null,
            }
          : null
      }
    />
  );
}

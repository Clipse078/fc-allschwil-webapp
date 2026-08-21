"use client";

/**
 * RegistrationWorkflowSteps — REG-WAIT-01F
 *
 * Canonical workflow/status card for registration lifecycle.
 */

import type { RegistrationListItem } from "@/lib/registrations/queries";
import { formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";
import {
  getRegistrationNextStep,
  resolveRegistrationWorkflowState,
} from "@/lib/registrations/registration-workflow-ui";
import { STATUS_LABELS } from "@/lib/registrations/status";
import {
  PremiumWorkflowSteps,
  type PremiumWorkflowStepState,
} from "./PremiumWorkflowSteps";

type Props = {
  registration: RegistrationListItem;
  locale?: string;
  timezone?: string;
};

export function RegistrationWorkflowSteps({
  registration,
  locale = "de-CH",
  timezone = "Europe/Zurich",
}: Props) {
  const workflow = resolveRegistrationWorkflowState(registration);
  const nextStep = getRegistrationNextStep(registration);

  const stepStates: PremiumWorkflowStepState[] = workflow.steps.map((step, index) => {
    const isCompleted = index < workflow.currentIndex;
    const isCurrent = index === workflow.currentIndex;
    const state = isCurrent ? "current" : isCompleted ? "completed" : "future";

    return {
      key: step.key,
      label: step.label,
      timestamp: step.timestamp,
      state,
    };
  });

  const terminalAlert =
    workflow.terminal &&
    registration.status !== "ACCEPTED" &&
    registration.status !== "ARCHIVED"
      ? {
          title: `Abgeschlossen: ${STATUS_LABELS[registration.status]}`,
          detail: registration.archivedAt ? (
            <p className="mt-0.5 text-[0.68rem] text-rose-700">
              {formatDateTimeCompact(registration.archivedAt, { locale, timezone })}
            </p>
          ) : null,
        }
      : null;

  return (
    <PremiumWorkflowSteps
      statusLabel={workflow.statusLabel}
      statusBadgeClass={workflow.statusBadgeClass}
      steps={stepStates}
      nextStep={nextStep}
      formatTimestamp={(iso) =>
        iso ? formatDateTimeCompact(iso, { locale, timezone }) : "—"
      }
      terminalAlert={terminalAlert}
    />
  );
}

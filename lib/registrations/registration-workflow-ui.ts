/**
 * lib/registrations/registration-workflow-ui.ts
 *
 * REG-WAIT-01F — client-safe registration workflow display helpers.
 * Mirrors the waiting-list workflow model without inventing a second status set.
 */

import { RegistrationStatus } from "@prisma/client";
import { STATUS_BADGE_CLASS, STATUS_LABELS, TERMINAL_STATUSES } from "./status";

export type RegistrationWorkflowStepKey =
  | "received"
  | "review"
  | "contacted"
  | "waiting"
  | "completed";

export type RegistrationWorkflowStep = {
  key: RegistrationWorkflowStepKey;
  label: string;
  timestamp?: string | null;
};

export const REGISTRATION_WORKFLOW_STEPS: RegistrationWorkflowStep[] = [
  { key: "received", label: "Eingegangen" },
  { key: "review", label: "In Bearbeitung" },
  { key: "contacted", label: "Kontaktiert" },
  { key: "waiting", label: "Warteliste" },
  { key: "completed", label: "Abgeschlossen" },
];

export function isTerminalRegistrationStatus(status: RegistrationStatus) {
  return TERMINAL_STATUSES.includes(status);
}

export function getRegistrationNextStep(
  registration: {
    status: RegistrationStatus;
    personId?: string | null;
    assignedToUserId?: string | null;
    targetGroupId?: string | null;
  },
): string {
  const { status } = registration;
  const hasPerson = !!registration.personId;
  const hasAssignment = !!registration.assignedToUserId;
  const hasTarget = !!registration.targetGroupId;

  switch (status) {
    case RegistrationStatus.NEW:
      return hasTarget
        ? "Vereinsverwaltung prüfen oder Kontakt aufnehmen"
        : "Team zuweisen oder Vereinsverwaltung prüfen";
    case RegistrationStatus.REVIEWING:
      return hasTarget && hasAssignment
        ? "Kontakt aufnehmen"
        : hasTarget
          ? "Koordinator zuweisen"
          : "Zuweisung abschließen";
    case RegistrationStatus.ASSIGNED:
      return "Kontakt aufnehmen";
    case RegistrationStatus.CONTACTED:
      return hasPerson
        ? "Entscheidung treffen oder auf Warteliste setzen"
        : "In Vereinsverwaltung aufnehmen oder verknüpfen";
    case RegistrationStatus.WAITING:
      return "Warteliste bearbeiten";
    case RegistrationStatus.ACCEPTED:
      return "Abgeschlossen";
    case RegistrationStatus.REJECTED:
    case RegistrationStatus.ARCHIVED:
      return "Kein weiterer aktiver Schritt";
  }
}

export function resolveRegistrationWorkflowState(registration: {
  status: RegistrationStatus;
  submittedAt: string;
  updatedAt?: string;
  contactedAt?: string | null;
  archivedAt?: string | null;
}) {
  const steps = REGISTRATION_WORKFLOW_STEPS.map((step) => ({ ...step }));
  steps[0] = { ...steps[0], timestamp: registration.submittedAt };
  steps[2] = { ...steps[2], timestamp: registration.contactedAt ?? null };
  steps[4] = {
    ...steps[4],
    timestamp: registration.archivedAt ?? registration.updatedAt ?? null,
  };

  const status = registration.status;
  const terminal = isTerminalRegistrationStatus(status);

  let currentIndex = 0;
  if (status === RegistrationStatus.NEW) currentIndex = 0;
  else if (
    status === RegistrationStatus.REVIEWING ||
    status === RegistrationStatus.ASSIGNED
  ) {
    currentIndex = 1;
  } else if (status === RegistrationStatus.CONTACTED) currentIndex = 2;
  else if (status === RegistrationStatus.WAITING) currentIndex = 3;
  else if (terminal) currentIndex = 4;

  return {
    steps,
    currentIndex,
    terminal,
    terminalStatus: terminal ? status : null,
    statusLabel: STATUS_LABELS[status],
    statusBadgeClass: STATUS_BADGE_CLASS[status],
  };
}

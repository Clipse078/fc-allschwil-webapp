/**
 * lib/registrations/waiting-list-ui.ts
 *
 * REG-WAIT-01D — client-safe display helpers for the Warteliste operational UX.
 */

import type { WaitingListPriority, WaitingListStatus } from "@prisma/client";

export const WAITING_LIST_STATUS_LABELS: Record<WaitingListStatus, string> = {
  WAITING: "Wartend",
  CONTACTED: "Kontaktiert",
  OFFERED: "Angebot gemacht",
  PLACED: "Platziert",
  WITHDRAWN: "Zurückgezogen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

export const WAITING_LIST_STATUS_COLORS: Record<WaitingListStatus, string> = {
  WAITING: "border-amber-200 bg-amber-50 text-amber-800",
  CONTACTED: "border-blue-200 bg-blue-50 text-blue-800",
  OFFERED: "border-purple-200 bg-purple-50 text-purple-800",
  PLACED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WITHDRAWN: "border-slate-200 bg-slate-50 text-slate-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-500",
};

export const WAITING_LIST_PRIORITY_LABELS: Record<WaitingListPriority, string> = {
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

export const WAITING_LIST_PRIORITY_COLORS: Record<WaitingListPriority, string> = {
  NORMAL: "border-slate-200 bg-slate-50 text-slate-600",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  URGENT: "border-rose-200 bg-rose-50 text-rose-700",
};

export const WAITING_LIST_PRIORITY_DOT: Record<WaitingListPriority, string> = {
  NORMAL: "bg-slate-400",
  HIGH: "bg-amber-400",
  URGENT: "bg-rose-500",
};

export const ACTIVE_WAITING_LIST_STATUSES: WaitingListStatus[] = ["WAITING", "CONTACTED", "OFFERED"];

export const TERMINAL_WAITING_LIST_STATUSES: WaitingListStatus[] = [
  "PLACED",
  "WITHDRAWN",
  "REJECTED",
  "ARCHIVED",
];

export function formatWaitingListDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatWaitingListDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function waitingListDuration(addedAt: string) {
  const ms = Date.now() - new Date(addedAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `${days} Tage`;
  if (days < 30) return `${Math.floor(days / 7)} Wo.`;
  return `${Math.floor(days / 30)} Mon.`;
}

export function getWaitingListNextStep(status: WaitingListStatus): string {
  switch (status) {
    case "WAITING":
      return "Kontakt aufnehmen";
    case "CONTACTED":
      return "Angebot / Platzierung klären";
    case "OFFERED":
      return "Rückmeldung abwarten / Platzierung vorbereiten";
    case "PLACED":
      return "Abgeschlossen";
    case "WITHDRAWN":
    case "REJECTED":
    case "ARCHIVED":
      return "Kein weiterer aktiver Schritt";
  }
}

export type WaitingListWorkflowStepKey =
  | "waiting"
  | "contacted"
  | "offered"
  | "placement"
  | "completed";

export type WaitingListWorkflowStep = {
  key: WaitingListWorkflowStepKey;
  label: string;
  timestamp?: string | null;
};

export const WAITING_LIST_WORKFLOW_STEPS: WaitingListWorkflowStep[] = [
  { key: "waiting", label: "Auf Warteliste" },
  { key: "contacted", label: "Kontaktiert" },
  { key: "offered", label: "Angebot gemacht" },
  { key: "placement", label: "Platzierung" },
  { key: "completed", label: "Platziert / abgeschlossen" },
];

export function isTerminalWaitingListStatus(status: WaitingListStatus) {
  return TERMINAL_WAITING_LIST_STATUSES.includes(status);
}

export function resolveWaitingListWorkflowState(entry: {
  status: WaitingListStatus;
  addedAt: string;
  lastContactedAt?: string | null;
  offeredAt?: string | null;
  resolvedAt?: string | null;
}) {
  const steps = WAITING_LIST_WORKFLOW_STEPS.map((step) => ({ ...step }));
  steps[0] = { ...steps[0], timestamp: entry.addedAt };
  steps[1] = { ...steps[1], timestamp: entry.lastContactedAt ?? null };
  steps[2] = { ...steps[2], timestamp: entry.offeredAt ?? null };
  steps[4] = { ...steps[4], timestamp: entry.resolvedAt ?? null };

  const status = entry.status;
  const terminal = isTerminalWaitingListStatus(status);

  let currentIndex = 0;
  if (status === "WAITING") currentIndex = 0;
  else if (status === "CONTACTED") currentIndex = 1;
  else if (status === "OFFERED") currentIndex = 2;
  else if (status === "PLACED") currentIndex = 4;
  else if (terminal) {
    if (entry.resolvedAt) currentIndex = 4;
    else if (entry.offeredAt) currentIndex = 2;
    else if (entry.lastContactedAt) currentIndex = 1;
    else currentIndex = 0;
  }

  return {
    steps,
    currentIndex,
    terminal,
    terminalStatus: terminal ? status : null,
  };
}

export function getPersonInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

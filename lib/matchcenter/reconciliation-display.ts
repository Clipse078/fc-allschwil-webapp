/**
 * lib/matchcenter/reconciliation-display.ts
 *
 * MATCHCENTER-FINAL — admin-safe labels for sporting reconciliation issues.
 */

import type { SportingReconciliationIssue } from "@/lib/sporting-data/lifecycle";

const RECONCILIATION_ISSUE_LABELS: Record<SportingReconciliationIssue, string> = {
  PAST_FIXTURE_PROVIDER_NOT_PLAYED:
    "Vergangenes Spiel ohne Provider-Ergebnis",
  PROVIDER_COMPLETED_EVENT_NOT_COMPLETED:
    "Provider meldet ausgetragen, SCE noch nicht abgeschlossen",
  PROVIDER_LIVE_EVENT_NOT_LIVE:
    "Provider meldet live, SCE noch nicht live",
};

export function formatReconciliationIssueLabel(
  issue: SportingReconciliationIssue | null,
): string {
  if (!issue) {
    return "Datenprüfung erforderlich";
  }

  return RECONCILIATION_ISSUE_LABELS[issue];
}

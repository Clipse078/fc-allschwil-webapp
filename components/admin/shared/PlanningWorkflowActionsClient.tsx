"use client";

/**
 * ORG-ACCESS-03 — Planning workflow action buttons (client component).
 *
 * Renders the appropriate submit / validate / reopen button(s) for a planning
 * record based on:
 *   - planningStage: current workflow stage of the record
 *   - isCoordinator: true when the user holds tenant-wide manage permission
 *   - isProtectedSource: true for SFV / provider records (no scoped actions)
 *
 * Stage / role matrix:
 *   DRAFT  + any user (non-coordinator): "Zur Prüfung einreichen"
 *   DRAFT  + coordinator:               no workflow button (APPROVED by default)
 *   SUBMITTED + coordinator:            "Validieren"
 *   APPROVED  + coordinator:            "Zur Bearbeitung öffnen"
 *   SUBMITTED + non-coordinator:        read-only (badge already shown)
 *   APPROVED  + non-coordinator:        read-only (badge already shown)
 *
 * Provider-owned records (SFV/CLUBCORNER_FVNWS/CSV_EXCEL_IMPORT) never expose
 * scoped mutation controls regardless of stage.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";

export type PlanningWorkflowActionsProps = {
  /** Record identifier — used to call the submit/validate endpoint. */
  recordId: string;
  /** Domain determines the API path: training | match | tournament */
  domain: "training" | "match" | "tournament";
  /** Current workflow stage. */
  planningStage: string;
  /** True when the current user holds tenant-wide manage permission. */
  isCoordinator: boolean;
  /** True when the record was created by a provider (SFV, import) — no scoped mutations. */
  isProtectedSource?: boolean;
  /** Callback invoked after a successful workflow transition to allow the parent to refresh. */
  onSuccess?: (newStage: string) => void;
};

function submitEndpoint(domain: "training" | "match" | "tournament", id: string): string {
  if (domain === "training") return `/api/training-series/${id}/submit`;
  return `/api/events/${id}/planning-submit`;
}

function validateEndpoint(domain: "training" | "match" | "tournament", id: string): string {
  if (domain === "training") return `/api/training-series/${id}/validate`;
  return `/api/events/${id}/planning-validate`;
}

export default function PlanningWorkflowActionsClient({
  recordId,
  domain,
  planningStage,
  isCoordinator,
  isProtectedSource = false,
  onSuccess,
}: PlanningWorkflowActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStage, setLocalStage] = useState<string | null>(null);

  const currentStage = localStage ?? planningStage;

  async function callEndpoint(url: string, body?: Record<string, unknown>): Promise<string | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => null)) as
        | { reviewStage?: string; planningStage?: string; message?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "Ein Fehler ist aufgetreten.");
        return null;
      }
      const newStage = data?.planningStage ?? data?.reviewStage ?? null;
      if (newStage) {
        setLocalStage(newStage);
        onSuccess?.(newStage);
      }
      return newStage;
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    await callEndpoint(submitEndpoint(domain, recordId));
  }

  async function handleValidate() {
    await callEndpoint(validateEndpoint(domain, recordId));
  }

  async function handleReopen() {
    await callEndpoint(validateEndpoint(domain, recordId), { action: "reopen" });
  }

  // Provider-owned records: never show scoped submit button
  if (isProtectedSource) return null;

  // Determine which button(s) to show
  const showSubmit = currentStage === "DRAFT" && !isCoordinator;
  const showValidate = currentStage === "SUBMITTED" && isCoordinator;
  const showReopen = currentStage === "APPROVED" && isCoordinator;

  if (!showSubmit && !showValidate && !showReopen) return null;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {showSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          data-testid={`planning-action-submit-${recordId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Zur Prüfung einreichen
        </button>
      )}

      {showValidate && (
        <button
          type="button"
          onClick={handleValidate}
          disabled={loading}
          data-testid={`planning-action-validate-${recordId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-60 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Validieren
        </button>
      )}

      {showReopen && (
        <button
          type="button"
          onClick={handleReopen}
          disabled={loading}
          data-testid={`planning-action-reopen-${recordId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Zur Bearbeitung öffnen
        </button>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

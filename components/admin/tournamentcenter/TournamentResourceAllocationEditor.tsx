"use client";

/**
 * components/admin/tournamentcenter/TournamentResourceAllocationEditor.tsx
 *
 * TOURNAMENTCENTER-01B — "Ressourcen · Spielfeld / Halle" editor for a HOME
 * tournament. Supports one or more Spielfeld/Halle FacilityResource
 * allocations (e.g. KR2 + KR3 A + KR3 B) — never limited to a single
 * pitchCode.
 */

import { useCallback, useState, useTransition } from "react";
import { Building2, MapPin, X } from "lucide-react";
import type { TournamentResourceAllocationDto } from "@/lib/tournaments/types";
import { FacilityResourceSelector, type FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type Props = {
  tournamentId: string;
  canManage: boolean;
  initialAllocations: TournamentResourceAllocationDto[];
  /** Non-archived FULL_PITCH/HALF_PITCH (or other) resources, grouped by facility. */
  facilityGroups: FacilityGroup[];
};

export default function TournamentResourceAllocationEditor({
  tournamentId,
  canManage,
  initialAllocations,
  facilityGroups,
}: Props) {
  const [allocations, setAllocations] = useState<TournamentResourceAllocationDto[]>(initialAllocations);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allocatedResourceIds = new Set(allocations.map((a) => a.facilityResourceId));

  const handleAdd = useCallback(
    async (facilityResourceId: string) => {
      const res = await fetch(`/api/tournaments/${tournamentId}/resource-allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityResourceId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { allocation?: TournamentResourceAllocationDto; error?: string }
        | null;
      if (!res.ok || !data?.allocation) {
        throw new Error(data?.error ?? "Ressource konnte nicht zugewiesen werden.");
      }
      setAllocations((prev) => [...prev, data.allocation as TournamentResourceAllocationDto]);
    },
    [tournamentId],
  );

  const handleRemove = useCallback(
    (allocationId: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/tournaments/${tournamentId}/resource-allocations/${allocationId}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? "Ressource konnte nicht entfernt werden.");
          }
          setAllocations((prev) => prev.filter((a) => a.id !== allocationId));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ressource konnte nicht entfernt werden.");
        }
      });
    },
    [tournamentId],
  );

  return (
    <div className="space-y-4" data-testid="tournament-resource-allocation-editor">
      {allocations.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[var(--border)] py-6 text-center">
          <MapPin className="mx-auto mb-2 h-5 w-5 text-[var(--muted)]" aria-hidden />
          <p className="text-sm text-[var(--text-2)]">Noch kein Spielfeld / keine Halle zugewiesen.</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="tournament-resource-allocation-list">
          {allocations.map((allocation) => (
            <li
              key={allocation.id}
              className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {allocation.facilityResourceName}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-2)]">
                  <Building2 className="h-3 w-3" aria-hidden />
                  {allocation.facilityName}
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => handleRemove(allocation.id)}
                  disabled={isPending}
                  aria-label={`${allocation.facilityResourceName} entfernen`}
                  className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {canManage && (
        <FacilityResourceSelector
          facilityGroups={facilityGroups}
          allocatedResourceIds={allocatedResourceIds}
          onAdd={handleAdd}
          placeholder="Spielfeld / Halle auswählen…"
          addButtonLabel="Zuweisen"
          testId="tournament-resource-allocation-add"
        />
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SectionCard } from "@/components/ui/page/SectionCard";

type Impact = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  matchId: string;
  matchTitle: string;
  /**
   * ADMIN-DELETE-02A: effective PERMISSIONS.MATCHES_DELETE authority,
   * resolved by the caller. Deliberately independent of events.manage — the
   * operational PATCH surface (MatchcenterDetailOperational) is unaffected.
   */
  canDelete: boolean;
};

/**
 * MatchLifecycleCard — permanent-delete action for a Match (Event,
 * type=MATCH). Only ever renders when the caller holds matches.delete.
 *
 * ADMIN-DELETE-02A-C1 CORE PRODUCT RULE: dependencies (SFV/provider
 * mapping, live/completed sporting state, Weekplanner references) are
 * shown as IMPACT — a warning — and never block deletion for a
 * matches.delete holder. Flow: clicking "Löschen" opens the confirmation
 * dialog and fetches the current impact; clicking "Endgültig löschen"
 * atomically cleans up that dependent data (writing an
 * SfvMatchDeletionTombstone when a provider mapping exists, so the next SFV
 * sync never recreates this match) and permanently deletes it — see
 * app/api/matchcenter/[matchId]/route.ts.
 */
export default function MatchLifecycleCard({ matchId, matchTitle, canDelete }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<Impact[] | null>(null);

  if (!canDelete) {
    return null;
  }

  async function openConfirmation() {
    setConfirming(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(`/api/matchcenter/${matchId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen nicht möglich.");
      }

      setImpact(Array.isArray(data?.impact) ? data.impact : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoadingImpact(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/matchcenter/${matchId}?confirm=true`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }

      setConfirming(false);
      router.push("/dashboard/matchcenter");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setDeleting(false);
    }
  }

  function closeDialog() {
    setConfirming(false);
    setImpact(null);
    setError(null);
  }

  return (
    <>
      <SectionCard title="Endgültig löschen">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-2)]">
            Entfernt den Match unwiderruflich, inklusive Anbieter-Zuordnung und
            Wochenplan-Referenzen.
          </p>

          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash2 className="h-3.5 w-3.5" />}
            onClick={openConfirmation}
          >
            Löschen
          </Button>
        </div>
      </SectionCard>

      <Dialog
        open={confirming}
        onClose={closeDialog}
        title={`„${matchTitle}" endgültig löschen?`}
        description="Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={loadingImpact}
              onClick={handleConfirmDelete}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p className="text-sm font-medium text-[var(--sce-danger)]">{error}</p>}

          {loadingImpact ? (
            <p className="text-sm text-[var(--text-2)]">Auswirkungen werden geprüft…</p>
          ) : impact && impact.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] p-3 text-[var(--sce-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">
                  Folgende verknüpfte Daten werden ebenfalls unwiderruflich entfernt. Ein per SFV
                  importiertes Match wird nicht erneut angelegt.
                </p>
              </div>
              <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-2)]">
                {impact.map((item) => (
                  <li key={item.key}>
                    {item.label}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : impact ? (
            <p className="text-sm text-[var(--text-2)]">
              Keine Anbieter-Zuordnung, Spielstand-Historie oder Wochenplan-Referenzen vorhanden.
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

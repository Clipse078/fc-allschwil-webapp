"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SectionCard } from "@/components/ui/page/SectionCard";

type Blocker = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  matchId: string;
  matchTitle: string;
  /**
   * ADMIN-DELETE-02A: effective PERMISSIONS.MATCHES_DELETE authority,
   * resolved by the caller (see app/(admin)/dashboard/matchcenter/
   * [matchId]/page.tsx). Deliberately independent of events.manage — the
   * operational PATCH surface (MatchcenterDetailOperational) is unaffected.
   */
  canDelete: boolean;
};

/**
 * MatchLifecycleCard — permanent-delete action for a Match (Event,
 * type=MATCH). The smallest additive lifecycle control for Matchcenter's
 * existing detail surface (Matchcenter is NOT redesigned). Only ever
 * renders when the caller holds matches.delete. The server blocks deletion
 * and reports the concrete reason whenever the match carries an SFV/
 * provider mapping, is live/completed, or has Weekplanner operational
 * references — see lib/matchcenter/match-lifecycle-service.ts.
 */
export default function MatchLifecycleCard({ matchId, matchTitle, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!canDelete) {
    return null;
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/matchcenter/${matchId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409 && Array.isArray(data?.blockers)) {
          setBlockers(data.blockers);
          setError(data?.error ?? "Löschen nicht möglich.");
          return;
        }
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }

      setConfirming(false);
      setBlockers(null);
      router.push("/dashboard/matchcenter");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionCard title="Endgültig löschen">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-2)]">
            Entfernt den Match unwiderruflich. Nur möglich für unbenutzte, manuell erfasste
            Matches ohne Anbieter-Zuordnung, Spielstand oder Wochenplan-Referenzen.
          </p>

          {error && !blockers && (
            <p className="text-xs font-medium text-[var(--sce-danger)]">{error}</p>
          )}

          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => setConfirming(true)}
          >
            Löschen
          </Button>
        </div>
      </SectionCard>

      <Dialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setBlockers(null);
          setError(null);
        }}
        title={`„${matchTitle}" endgültig löschen?`}
        description={
          blockers
            ? undefined
            : "Diese Aktion kann nicht rückgängig gemacht werden. Nur möglich für Matches ohne Anbieter-Zuordnung, Spielstand oder Betriebsreferenzen."
        }
        footer={
          blockers ? (
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Schließen
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Abbrechen
              </Button>
              <Button variant="danger" loading={busy} onClick={handleDelete}>
                Endgültig löschen
              </Button>
            </>
          )
        }
      >
        {blockers ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] p-3 text-[var(--sce-warning)]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                Löschen blockiert — Anbieter-Zuordnung, Spielstand oder Betriebsdaten bestehen.
                Bitte stattdessen absagen/verschieben.
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-2)]">
              {blockers.map((blocker) => (
                <li key={blocker.key}>
                  {blocker.label}: {blocker.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

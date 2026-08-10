"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SectionCard } from "@/components/ui/page";

type Blocker = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  teamId: string;
  teamName: string;
  isActive: boolean;
  canManage: boolean;
  /**
   * ADMIN-DELETE-01B: effective PERMISSIONS.TEAMS_DELETE authority, resolved
   * by the caller (see app/(admin)/dashboard/teams/[teamId]/page.tsx).
   * Deliberately separate from `canManage` — holding teams.manage alone
   * (archive/restore/edit) must never surface the permanent-delete action.
   */
  canDelete: boolean;
};

/**
 * TeamLifecycleCard — archive / restore / safe-delete actions for a Team.
 *
 * Archive reuses the existing `isActive` flag (see
 * lib/teams/team-lifecycle-service.ts) — the same gate already used
 * downstream (e.g. TrainingCenter) to exclude a Team from active selectors.
 * Delete is safe-by-default: the server blocks it and reports the concrete
 * dependencies whenever meaningful history exists, recommending archiving.
 */
export default function TeamLifecycleCard({ teamId, teamName, isActive, canManage, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [confirmAction, setConfirmAction] = useState<"archive" | "restore" | "delete" | null>(null);

  async function runAction(action: "archive" | "restore" | "delete") {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        action === "delete" ? `/api/teams/${teamId}` : `/api/teams/${teamId}/${action}`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409 && Array.isArray(data?.blockers)) {
          setBlockers(data.blockers);
          setError(data?.error ?? "Aktion nicht möglich.");
          return;
        }
        throw new Error(data?.error ?? "Aktion fehlgeschlagen.");
      }

      setBlockers(null);
      setConfirmAction(null);

      if (action === "delete") {
        router.push("/dashboard/teams");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage && !canDelete) {
    return (
      <SectionCard title="Status">
        <Badge variant={isActive ? "success" : "outline"}>
          {isActive ? "Aktiv" : "Archiviert"}
        </Badge>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard title="Team-Status & Aktionen">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Badge variant={isActive ? "success" : "outline"}>
              {isActive ? "Aktiv" : "Archiviert"}
            </Badge>
            {!isActive && (
              <span className="text-xs text-[var(--text-2)]">
                Von aktiven Auswahllisten ausgeschlossen. Historie bleibt erhalten.
              </span>
            )}
          </div>

          {error && !blockers && (
            <p className="text-xs font-medium text-[var(--sce-danger)]">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {canManage &&
              (isActive ? (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Archive className="h-3.5 w-3.5" />}
                  onClick={() => setConfirmAction("archive")}
                >
                  Archivieren
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<ArchiveRestore className="h-3.5 w-3.5" />}
                  onClick={() => runAction("restore")}
                  loading={busy}
                >
                  Wiederherstellen
                </Button>
              ))}

            {/*
              ADMIN-DELETE-01B: permanent delete requires effective
              teams.delete authority, independent of teams.manage — a
              delegated user may hold teams.delete without teams.manage
              (or vice versa), so this button is gated on `canDelete` alone.
            */}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setConfirmAction("delete")}
              >
                Löschen
              </Button>
            )}
          </div>
        </div>
      </SectionCard>

      <Dialog
        open={confirmAction === "archive"}
        onClose={() => setConfirmAction(null)}
        title={`„${teamName}" archivieren?`}
        description="Das Team bleibt historisch erhalten, wird aber aus aktiven Auswahllisten ausgeblendet. Eine Wiederherstellung ist jederzeit möglich."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Abbrechen
            </Button>
            <Button variant="primary" loading={busy} onClick={() => runAction("archive")}>
              Archivieren
            </Button>
          </>
        }
      />

      <Dialog
        open={confirmAction === "delete"}
        onClose={() => {
          setConfirmAction(null);
          setBlockers(null);
          setError(null);
        }}
        title={`„${teamName}" endgültig löschen?`}
        description={
          blockers
            ? undefined
            : "Diese Aktion kann nicht rückgängig gemacht werden. Nur möglich, wenn keine Historie (Kader, Trainings, Spiele, Turniere, Anbieter-Zuordnungen) besteht."
        }
        footer={
          blockers ? (
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Schließen
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>
                Abbrechen
              </Button>
              <Button variant="danger" loading={busy} onClick={() => runAction("delete")}>
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
                Löschen blockiert — es bestehen noch Daten/Historie. Bitte stattdessen archivieren.
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

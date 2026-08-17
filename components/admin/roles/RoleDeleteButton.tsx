"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Shield, Trash2, Users } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type RoleDeletionImpact = {
  activeUserCount: number;
  totalUserRoleCount: number;
  permissionCount: number;
  workflowRuleCount: number;
};

type RoleDeletionBlocker = {
  reason: string;
  message: string;
};

type RoleDeleteButtonProps = {
  roleId: string;
  roleName: string;
  roleKey: string;
};

/**
 * RoleDeleteButton — permanent-delete action for a tenant Role (ADMIN-HARD-DELETE-UI).
 *
 * Blocked for: system roles (isSystem=true), PLATFORM-scoped roles.
 * If active users hold this role, the impact is shown but deletion is not blocked.
 */
export default function RoleDeleteButton({ roleId, roleName, roleKey }: RoleDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<RoleDeletionImpact | null>(null);
  const [blocker, setBlocker] = useState<RoleDeletionBlocker | null>(null);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setBlocker(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(`/api/roles/${encodeURIComponent(roleId)}/permanent`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (response.status === 409 && data?.blocked) {
        setBlocker(data.blocker);
        return;
      }

      if (!response.ok) {
        throw new Error(data?.error ?? "Vorschau nicht verfügbar.");
      }

      setImpact(data?.impact ?? null);
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
      const response = await fetch(
        `/api/roles/${encodeURIComponent(roleId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Rolle konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      router.push("/dashboard/administration/roles");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirmation}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-transparent px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Endgültig löschen
      </button>

      <Dialog
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Rolle endgültig löschen"
        description={`Rolle „${roleName}" (${roleKey}) dauerhaft und unwiderruflich entfernen.`}
        footer={
          <div className="flex flex-col gap-2">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={deleting || loadingImpact}
              >
                Abbrechen
              </Button>
              {!blocker ? (
                <Button
                  variant="danger"
                  onClick={handleConfirmDelete}
                  loading={deleting}
                  disabled={loadingImpact || !!error || !!blocker}
                >
                  Endgültig löschen
                </Button>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-[var(--text-2)]">
          {loadingImpact ? (
            <p className="text-[var(--muted)]">Auswirkungen werden geprüft…</p>
          ) : blocker ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Löschen nicht möglich</p>
                  <p className="mt-1 text-amber-700">{blocker.message}</p>
                </div>
              </div>
            </div>
          ) : impact ? (
            <>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="font-medium text-red-800">
                    Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Wird gelöscht:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Rolle &bdquo;{roleName}&ldquo; ({roleKey})</li>
                  {impact.permissionCount > 0 && (
                    <li>
                      {impact.permissionCount} Berechtigungs-Zuweisung
                      {impact.permissionCount !== 1 ? "en" : ""}
                    </li>
                  )}
                  {impact.workflowRuleCount > 0 && (
                    <li>
                      {impact.workflowRuleCount} Workflow-Regel
                      {impact.workflowRuleCount !== 1 ? "n" : ""}
                    </li>
                  )}
                  {impact.totalUserRoleCount > 0 && (
                    <li>
                      {impact.totalUserRoleCount} Rollenzuweisung
                      {impact.totalUserRoleCount !== 1 ? "en" : ""} (alle Benutzer verlieren diese Rolle)
                    </li>
                  )}
                </ul>
              </div>

              {impact.activeUserCount > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-amber-800">
                      {impact.activeUserCount} aktive{impact.activeUserCount !== 1 ? " Benutzer haben" : "r Benutzer hat"} diese Rolle.
                      {" "}Weise ihnen eine andere Rolle zu, bevor du diese Rolle löschst.
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

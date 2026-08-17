"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Shield, Trash2, User } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type UserDeletionImpact = {
  tenantMemberships: number;
  roleAssignments: number;
  hasLinkedPerson: boolean;
  linkedPersonId: string | null;
  linkedPersonName: string | null;
  isPlatformSuperAdmin: boolean;
  email: string;
  displayName: string;
};

type UserDeletionBlocker = {
  reason: string;
  message: string;
};

type GlobalUserDeleteButtonProps = {
  userId: string;
  userName: string;
  userEmail: string;
};

/**
 * GlobalUserDeleteButton — SCE Super Admin only permanent-delete for a global User account.
 *
 * This is the GLOBAL deletion flow — it removes the User account across ALL tenants.
 * For tenant membership removal only, use MembershipAccessControl instead.
 *
 * Authorization: PERMISSIONS.USERS_DELETE (scope=PLATFORM) — only super_admin holds this.
 */
export default function GlobalUserDeleteButton({
  userId,
  userName,
  userEmail,
}: GlobalUserDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<UserDeletionImpact | null>(null);
  const [blocker, setBlocker] = useState<UserDeletionBlocker | null>(null);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setBlocker(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/permanent`,
        { method: "DELETE" },
      );
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
        `/api/admin/users/${encodeURIComponent(userId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Benutzer konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      router.push("/dashboard/users");
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
        Account endgültig löschen
      </button>

      <Dialog
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Benutzer-Account endgültig löschen"
        description={`„${userName}" (${userEmail}) global und unwiderruflich aus dem System entfernen.`}
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
                  Account endgültig löschen
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
                  <div>
                    <p className="font-medium text-red-800">
                      Globale Löschung — betrifft alle Mandanten
                    </p>
                    <p className="mt-1 text-red-700">
                      Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
                      Der Account wird aus ALLEN Vereinen entfernt.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Wird gelöscht:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Benutzer-Account von &bdquo;{impact.displayName}&ldquo; ({impact.email})</li>
                  {impact.tenantMemberships > 0 && (
                    <li>
                      {impact.tenantMemberships} Vereinsmitgliedschaft
                      {impact.tenantMemberships !== 1 ? "en" : ""} (alle Mandanten)
                    </li>
                  )}
                  {impact.roleAssignments > 0 && (
                    <li>
                      {impact.roleAssignments} Rollenzuweisung
                      {impact.roleAssignments !== 1 ? "en" : ""} (alle Mandanten)
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
                <ul className="ml-4 list-disc space-y-1">
                  {impact.hasLinkedPerson && impact.linkedPersonName ? (
                    <li className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[var(--muted)]" />
                      Personendatensatz &bdquo;{impact.linkedPersonName}&ldquo; — Verlinkung wird getrennt, Personendaten bleiben bestehen
                    </li>
                  ) : null}
                  <li>Audit-Log-Einträge (Urheber-Verlinkung wird entfernt)</li>
                  <li>Verknüpfte Registrierungen (Zuweisung wird entfernt)</li>
                </ul>
              </div>

              {impact.isPlatformSuperAdmin ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-amber-800">
                      Achtung: Dieser Benutzer ist ein SCE Super Admin.
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldOff, ShieldCheck, Trash2, User } from "lucide-react";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
  membershipIsActive: boolean;
  userIsActive: boolean;
  canManage: boolean;
  isSelf: boolean;
  linkedPersonName?: string | null;
  tenantRoleNames?: string[];
};

export default function MembershipAccessControl({
  userId,
  userName,
  userEmail,
  membershipIsActive,
  userIsActive,
  canManage,
  isSelf,
  linkedPersonName,
  tenantRoleNames = [],
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const isEffectivelyActive = membershipIsActive && userIsActive;

  async function doToggle(isActive: boolean) {
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/membership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setPending(false);
    }
  }

  async function doRemoveMembership() {
    setRemoving(true);
    setRemoveError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/membership`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setRemoveError(data.error ?? "Zugriff konnte nicht entfernt werden.");
        return;
      }

      setShowRemoveDialog(false);
      router.push("/dashboard/admin/users");
      router.refresh();
    } catch {
      setRemoveError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Current access status */}
      <div className="flex items-center gap-3">
        {membershipIsActive ? (
          <AdminStatusPill label="Zugriff aktiv" tone="success" />
        ) : (
          <AdminStatusPill label="Zugriff gesperrt" tone="muted" />
        )}
        {!userIsActive ? (
          <AdminStatusPill label="Konto inaktiv" tone="warning" />
        ) : null}
      </div>

      {/* Error message */}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {/* Actions */}
      {canManage ? (
        isSelf ? (
          <p className="text-sm text-[var(--muted)]">
            Eigenen Zugriff kann nicht gesperrt werden.
          </p>
        ) : (
          <div className="space-y-3">
            {membershipIsActive ? (
              <>
                {showConfirm ? (
                  <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-4 space-y-3">
                    <p className="text-sm font-medium text-red-800">
                      Zugriff wirklich sperren?
                    </p>
                    <p className="text-sm text-red-700">
                      Der Benutzer kann sich nicht mehr anmelden. Rollen und Mitgliedschaft
                      bleiben erhalten und der Zugriff kann jederzeit wiederhergestellt werden.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowConfirm(false);
                          doToggle(false);
                        }}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        {pending ? "Sperren…" : "Zugriff sperren"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirm(false)}
                        disabled={pending}
                        className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirm(true)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Zugriff sperren
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => doToggle(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {pending ? "Wiederherstellen…" : "Zugriff wiederherstellen"}
              </button>
            )}

            {/* Permanent membership removal — always available to canManage when not self */}
            <div className="border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => setShowRemoveDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-red-200 bg-transparent px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Aus Verein entfernen
              </button>
            </div>
          </div>
        )
      ) : null}

      {/* Info for view-only */}
      {!canManage ? (
        <p className="text-sm text-[var(--muted)]">
          {isEffectivelyActive
            ? "Dieser Benutzer hat aktiven Zugriff auf den Club."
            : "Dieser Benutzer hat keinen aktiven Zugriff auf den Club."}
        </p>
      ) : null}

      {/* Permanent removal dialog */}
      <Dialog
        open={showRemoveDialog}
        onClose={() => !removing && setShowRemoveDialog(false)}
        title="Aus Verein entfernen"
        description={`„${userName}" (${userEmail}) dauerhaft aus diesem Club entfernen.`}
        footer={
          <div className="flex flex-col gap-2">
            {removeError ? (
              <p className="text-sm text-red-600">{removeError}</p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowRemoveDialog(false)}
                disabled={removing}
              >
                Abbrechen
              </Button>
              <Button variant="danger" onClick={doRemoveMembership} loading={removing}>
                Aus Verein entfernen
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-[var(--text-2)]">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="font-medium text-red-800">
                Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 font-medium text-[var(--foreground)]">Wird entfernt:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Club-Mitgliedschaft von &bdquo;{userName}&ldquo;</li>
              {tenantRoleNames.length > 0 && (
                <li>
                  {tenantRoleNames.length} Rollen-Zuweisung{tenantRoleNames.length !== 1 ? "en" : ""} ({tenantRoleNames.join(", ")})
                </li>
              )}
            </ul>
          </div>

          <div>
            <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[var(--muted)]" />
                Globales Benutzerkonto ({userEmail}) — Authentifizierungsdaten bleiben unverändert
              </li>
              {linkedPersonName ? (
                <li>Personendatensatz &bdquo;{linkedPersonName}&ldquo; bleibt im System</li>
              ) : null}
              <li>Mitgliedschaften in anderen Clubs sind nicht betroffen</li>
            </ul>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

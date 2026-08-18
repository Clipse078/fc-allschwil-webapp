"use client";

/**
 * ADMIN-HARD-DELETE — per-row ••• action menu for the tenant users list.
 *
 * Shown on User rows (never on Person-only rows).
 *
 * Club Admin actions (canManageMembership):
 *   - "Aus Verein entfernen"  → DELETE /api/admin/users/[userId]/membership
 *   - "Einladung widerrufen"  → DELETE /api/admin/users/[userId]/invite  (pending state only)
 *
 * Platform-only action (canGlobalDelete):
 *   - "Benutzer endgültig löschen" → navigates to /dashboard/users/[userId]
 *     (the platform detail page, where GlobalUserDeleteButton is already mounted)
 *
 * The two actions are deliberately kept separate and never combined.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, MoreHorizontal, Trash2, User, UserMinus, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
  /** True when there is an active (non-expired, non-used) invitation token. */
  pendingInvitation: boolean;
  /** Actor may manage memberships for this tenant (Club Admin or platform). */
  canManageMembership: boolean;
  /** Actor may permanently delete global user accounts (platform only). */
  canGlobalDelete: boolean;
  /** Prevent self-removal from offering the remove action. */
  isSelf: boolean;
  linkedPersonName?: string | null;
  tenantRoleNames?: string[];
};

export default function UserRowActionsMenu({
  userId,
  userName,
  userEmail,
  pendingInvitation,
  canManageMembership,
  canGlobalDelete,
  isSelf,
  linkedPersonName,
  tenantRoleNames = [],
}: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Tenant removal dialog state
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Revoke invitation state
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const canRemove = canManageMembership && !isSelf;

  // If no actions are available, render nothing.
  if (!canRemove && !canGlobalDelete) return null;

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleRemoveClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    if (pendingInvitation) {
      setRevokeError(null);
      setShowRevokeDialog(true);
    } else {
      setRemoveError(null);
      setShowRemoveDialog(true);
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

  async function doRevokeInvitation() {
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/invite`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setRevokeError(data.error ?? "Einladung konnte nicht widerrufen werden.");
        return;
      }
      setShowRevokeDialog(false);
      router.refresh();
    } catch {
      setRevokeError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      {/* ••• trigger */}
      <div ref={menuRef} className="relative" onClick={(e) => e.preventDefault()}>
        <button
          type="button"
          aria-label="Mehr Aktionen"
          onClick={openMenu}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            {/* Click-away backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }}
            />
            <div className="absolute right-0 top-9 z-20 min-w-[210px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-md)]">
              {/* Tenant removal / invitation revoke */}
              {canRemove && (
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition"
                >
                  {pendingInvitation ? (
                    <>
                      <X className="h-3.5 w-3.5 shrink-0" />
                      Einladung widerrufen
                    </>
                  ) : (
                    <>
                      <UserMinus className="h-3.5 w-3.5 shrink-0" />
                      Aus Verein entfernen
                    </>
                  )}
                </button>
              )}

              {/* Global delete — platform only, navigates to platform detail page */}
              {canGlobalDelete && (
                <>
                  {canRemove && (
                    <div className="mx-2 my-1 border-t border-[var(--border)]" />
                  )}
                  <Link
                    href={`/dashboard/users/${userId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    Benutzer endgültig löschen
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tenant membership removal confirmation dialog */}
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
        <RemovalImpactContent
          userName={userName}
          userEmail={userEmail}
          linkedPersonName={linkedPersonName}
          tenantRoleNames={tenantRoleNames}
        />
      </Dialog>

      {/* Invitation revoke confirmation dialog */}
      <Dialog
        open={showRevokeDialog}
        onClose={() => !revoking && setShowRevokeDialog(false)}
        title="Einladung widerrufen"
        description={`Ausstehende Einladung für „${userName}" (${userEmail}) widerrufen.`}
        footer={
          <div className="flex flex-col gap-2">
            {revokeError ? (
              <p className="text-sm text-red-600">{revokeError}</p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowRevokeDialog(false)}
                disabled={revoking}
              >
                Abbrechen
              </Button>
              <Button variant="danger" onClick={doRevokeInvitation} loading={revoking}>
                Einladung widerrufen
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-[var(--text-2)]">
          <p>
            Der ausstehende Einladungslink wird ungültig. Der Benutzer kann sich mit diesem
            Link nicht mehr im Club registrieren.
          </p>
          <p>
            Das globale Benutzerkonto (falls bereits vorhanden) und etwaige Mitgliedschaften
            in anderen Clubs bleiben unberührt.
          </p>
        </div>
      </Dialog>
    </>
  );
}

// ── Shared removal impact list ──────────────────────────────────────────────

function RemovalImpactContent({
  userName,
  userEmail,
  linkedPersonName,
  tenantRoleNames,
}: {
  userName: string;
  userEmail: string;
  linkedPersonName?: string | null;
  tenantRoleNames: string[];
}) {
  return (
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
          <li>Zugriff auf diesen Club für &bdquo;{userName}&ldquo;</li>
          {tenantRoleNames.length > 0 && (
            <li>
              {tenantRoleNames.length} Rollen-Zuweisung
              {tenantRoleNames.length !== 1 ? "en" : ""} ({tenantRoleNames.join(", ")})
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
  );
}

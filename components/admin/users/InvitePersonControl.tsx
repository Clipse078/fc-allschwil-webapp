"use client";

/**
 * InvitePersonControl — USER-ADMIN-02
 *
 * Shown on the user detail page when the user has a pending invitation.
 * Allows admins to resend or revoke the invitation.
 *
 * Also shown on the (future) Person detail page without a linked user.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, RotateCcw, X } from "lucide-react";

type Props = {
  userId: string;
  canManage: boolean;
  /** True when there's an active (non-expired, non-used) invitation token. */
  pendingInvitation: boolean;
};

export default function InvitePersonControl({ userId, canManage, pendingInvitation }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function handleResend() {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/invite`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ein Fehler ist aufgetreten.");
          return;
        }
        setSuccess("Einladung wurde erneut gesendet.");
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte versuche es erneut.");
      }
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/invite`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ein Fehler ist aufgetreten.");
          return;
        }
        setShowRevokeConfirm(false);
        setSuccess("Einladung wurde widerrufen.");
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte versuche es erneut.");
      }
    });
  }

  if (!canManage) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {pendingInvitation
          ? "Eine Einladung ist ausstehend. Der Benutzer hat den Link noch nicht geöffnet."
          : "Kein ausstehender Einladungslink."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {success ? (
        <p className="text-sm text-emerald-600">{success}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {pendingInvitation ? (
        <>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Einladung wurde gesendet. Der Benutzer hat den Link noch nicht verwendet.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isPending ? "Senden…" : "Erneut senden"}
            </button>

            {showRevokeConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  <X className="h-3.5 w-3.5" />
                  Wirklich widerrufen
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(false)}
                  disabled={isPending}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
              >
                <X className="h-3.5 w-3.5" />
                Einladung widerrufen
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition"
          >
            <Mail className="h-3.5 w-3.5" />
            {isPending ? "Senden…" : "Einladung senden"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, ShieldCheck } from "lucide-react";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";

type Props = {
  userId: string;
  membershipIsActive: boolean;
  userIsActive: boolean;
  canManage: boolean;
  isSelf: boolean;
};

export default function MembershipAccessControl({
  userId,
  membershipIsActive,
  userIsActive,
  canManage,
  isSelf,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

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
        ) : membershipIsActive ? (
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
    </div>
  );
}

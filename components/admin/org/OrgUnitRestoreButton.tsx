"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Loader2 } from "lucide-react";

type Props = {
  orgUnitId: string;
  orgUnitName: string;
  /** When true, redirect to list page after restore. Default: refresh in place. */
  redirectToList?: boolean;
};

/**
 * Restore button for archived org units.
 *
 * Calls POST /api/org-units/[id]/restore. On success, redirects to the list
 * page (when redirectToList=true) or refreshes the current page.
 *
 * Only renders for ARCHIVED units. Caller is responsible for the guard.
 * Includes a single confirmation step to prevent accidental restore.
 */
export default function OrgUnitRestoreButton({ orgUnitId, orgUnitName, redirectToList = false }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/org-units/${orgUnitId}/restore`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Wiederherstellung fehlgeschlagen.");
        setConfirming(false);
        return;
      }

      if (redirectToList) {
        router.push("/dashboard/org-units");
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <ArchiveRestore className="h-4 w-4" />
          Einheit wiederherstellen
        </button>

        {error ? (
          <p className="text-center text-[11px] font-medium text-rose-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-[13px] font-semibold text-emerald-800">
        {`${orgUnitName} wirklich wiederherstellen?`}
      </p>

      <p className="text-[12px] text-emerald-700">
        Die Einheit wird wieder aktiv. Untergeordnete Einheiten müssen separat
        wiederhergestellt werden.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArchiveRestore className="h-4 w-4" />
          )}
          {loading ? "Wiederherstellen…" : "Ja, wiederherstellen"}
        </button>

        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={loading}
          className="flex-1 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
        >
          Abbrechen
        </button>
      </div>

      {error ? (
        <p className="text-[11px] font-medium text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

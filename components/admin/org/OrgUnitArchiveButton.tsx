"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";

type Props = {
  orgUnitId: string;
  orgUnitName: string;
};

/**
 * Archive button for org units.
 *
 * Only rendered when the caller confirms the unit is a leaf (no children) and
 * not already archived. Calls DELETE /api/org-units/[id], which soft-archives
 * the unit (status → ARCHIVED). On success redirects to the list page.
 *
 * The confirmation step prevents accidental archival.
 */
export default function OrgUnitArchiveButton({ orgUnitId, orgUnitName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/org-units/${orgUnitId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Archivierung fehlgeschlagen.");
        setConfirming(false);
        return;
      }

      router.push("/dashboard/org-units");
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
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        >
          <Archive className="h-4 w-4" />
          Einheit archivieren
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
    <div className="space-y-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 p-4">
      <p className="text-[13px] font-semibold text-rose-800">
        {`„${orgUnitName}“ wirklich archivieren?`}
      </p>

      <p className="text-[12px] text-rose-700">
        Archivierte Einheiten sind nicht mehr aktiv. Mitgliedschaften bleiben
        erhalten. Diese Aktion kann durch Bearbeiten der Einheit rückgängig
        gemacht werden.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleArchive}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          {loading ? "Archivieren…" : "Ja, archivieren"}
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
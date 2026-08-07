"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";

type Resource = "club" | "team";

type ArchiveButtonProps = {
  resource: Resource;
  id: string;
  name: string;
  /** Where to redirect after archiving. Defaults to /dashboard/vereine. */
  redirectTo?: string;
};

function endpointFor(resource: Resource, id: string): string {
  return resource === "club"
    ? `/api/club-directory/clubs/${id}`
    : `/api/club-directory/teams/${id}`;
}

export function ClubDirectoryArchiveButton({
  resource,
  id,
  name,
  redirectTo = "/dashboard/vereine",
}: ArchiveButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpointFor(resource, id), { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Archivierung fehlgeschlagen.");
        setConfirming(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  const label = resource === "club" ? "Verein" : "Team";

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        >
          <Archive className="h-4 w-4" />
          {label} archivieren
        </button>
        {error ? <p className="text-center text-[11px] font-medium text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 p-4">
      <p className="text-[13px] font-semibold text-rose-800">{`${name} wirklich archivieren?`}</p>
      <p className="text-[12px] text-rose-700">
        {resource === "club"
          ? "Archivierte Vereine sind nicht mehr aktiv. Verknüpfte Teams bleiben erhalten. Diese Aktion kann rückgängig gemacht werden."
          : "Archivierte Teams sind nicht mehr aktiv. Diese Aktion kann rückgängig gemacht werden."}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleArchive}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
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
      {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

type RestoreButtonProps = {
  resource: Resource;
  id: string;
  name: string;
  redirectToList?: boolean;
};

export function ClubDirectoryRestoreButton({
  resource,
  id,
  name,
  redirectToList = false,
}: RestoreButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${endpointFor(resource, id)}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Wiederherstellung fehlgeschlagen.");
        return;
      }
      if (redirectToList) {
        router.push(resource === "club" ? "/dashboard/vereine" : "/dashboard/vereine");
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRestore}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArchiveRestore className="h-4 w-4" />
        )}
        {`${name} wiederherstellen`}
      </button>
      {error ? <p className="text-center text-[11px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

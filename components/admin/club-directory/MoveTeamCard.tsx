"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";

type ClubOption = { id: string; name: string; shortName: string | null };

type MoveTeamCardProps = {
  teamId: string;
  teamName: string;
  currentClubId: string;
};

const fieldClass =
  "w-full rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";

/**
 * CLUB-DIRECTORY-03 — lets a tenant admin re-parent an ExternalTeam onto a
 * different canonical ExternalClub (e.g. moving "BSC Old Boys B1" from its
 * own mistaken club shell onto the real "BSC Old Boys" club). Provider
 * identity is preserved automatically — see moveExternalTeamToClub.
 */
export function MoveTeamCard({ teamId, teamName, currentClubId }: MoveTeamCardProps) {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [targetClubId, setTargetClubId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/club-directory/clubs?limit=200");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data?.clubs)) {
          setClubs(
            data.clubs
              .filter((c: ClubOption & { id: string }) => c.id !== currentClubId)
              .map((c: ClubOption) => ({ id: c.id, name: c.name, shortName: c.shortName })),
          );
        }
      } finally {
        if (!cancelled) setLoadingClubs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentClubId]);

  async function handleConfirm() {
    if (!targetClubId) {
      setError("Bitte einen Ziel-Verein auswählen.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/club-directory/teams/${teamId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetExternalClubId: targetClubId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Team konnte nicht verschoben werden.");
        return;
      }
      router.push(`/dashboard/vereine/${targetClubId}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  }

  const targetClub = clubs.find((c) => c.id === targetClubId);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Verschiebt {teamName} unter einen anderen kanonischen Verein. Anbieter-Verknüpfungen
        (z.B. SFV) bleiben erhalten.
      </p>

      <select
        value={targetClubId}
        onChange={(e) => {
          setTargetClubId(e.target.value);
          setConfirming(false);
        }}
        disabled={loadingClubs}
        className={fieldClass}
      >
        <option value="">
          {loadingClubs ? "Vereine werden geladen…" : "Ziel-Verein wählen…"}
        </option>
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
            {club.shortName ? ` (${club.shortName})` : ""}
          </option>
        ))}
      </select>

      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!targetClubId}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Verein wechseln
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[12px] font-medium text-amber-800">
            {teamName} wirklich zu &bdquo;{targetClub?.name}&ldquo; verschieben?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Ja, verschieben
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="flex-1 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

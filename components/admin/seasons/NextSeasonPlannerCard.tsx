"use client";

import { useEffect, useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type SeasonApiItem = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

type SeasonsResponse = {
  currentSeasonKey: string | null;
  nextSeasonKey: string | null;
  seasons: SeasonApiItem[];
};

type SeasonsErrorResponse = {
  error?: string;
};

export default function NextSeasonPlannerCard() {
  const [currentSeasonKey, setCurrentSeasonKey] = useState<string | null>(null);
  const [nextSeasonKey, setNextSeasonKey] = useState<string | null>(null);
  const [existingKeys, setExistingKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/seasons", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json().catch(() => null)) as
          | SeasonsResponse
          | SeasonsErrorResponse
          | null;

        if (!response.ok) {
          throw new Error(
            data && typeof data === "object" && "error" in data && data.error
              ? String(data.error)
              : "Saisons konnten nicht geladen werden.",
          );
        }

        if (!isMounted || !data || !("seasons" in data)) {
          return;
        }

        setCurrentSeasonKey(data.currentSeasonKey ?? null);
        setNextSeasonKey(data.nextSeasonKey ?? null);
        setExistingKeys(
          Array.isArray(data.seasons) ? data.seasons.map((item) => item.key) : [],
        );
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const nextSeasonAlreadyExists =
    nextSeasonKey !== null && existingKeys.includes(nextSeasonKey);

  async function handleCreateNextSeason() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/seasons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Die nächste Saison konnte nicht erstellt werden.");
      }

      setMessage(data?.message ?? "Die nächste Saison wurde erfolgreich erstellt.");

      const refreshResponse = await fetch("/api/seasons", {
        method: "GET",
        cache: "no-store",
      });

      const refreshData = (await refreshResponse.json().catch(() => null)) as
        | SeasonsResponse
        | null;

      if (refreshResponse.ok && refreshData) {
        setCurrentSeasonKey(refreshData.currentSeasonKey ?? null);
        setNextSeasonKey(refreshData.nextSeasonKey ?? null);
        setExistingKeys(
          Array.isArray(refreshData.seasons)
            ? refreshData.seasons.map((item) => item.key)
            : [],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div className="space-y-6">
        <div>
          <p className="fca-eyebrow">Season-led planning</p>
          <h3 className="fca-heading mt-2">Nächste Saison vorbereiten</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Saison ist die führende Entität im Club. Zuerst wird die künftige
            Saison erstellt. Danach können Teams, Sponsoren und Events gezielt
            für diese Zukunftssaison geplant werden.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="fca-section-card p-4">
            <div className="fca-label">Aktuelle Saison</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">
              {loading ? "Lädt..." : currentSeasonKey ?? "-"}
            </div>
          </div>

          <div className="fca-section-card p-4">
            <div className="fca-label">Nächste Saison gemäss Logik</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">
              {loading ? "Lädt..." : nextSeasonKey ?? "-"}
            </div>
          </div>
        </div>

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        {message ? (
          <div className="fca-status-box fca-status-box-success">{message}</div>
        ) : null}

        {loading ? (
          <div className="fca-status-box fca-status-box-muted">
            Saisoninformationen werden geladen.
          </div>
        ) : nextSeasonAlreadyExists ? (
          <div className="fca-status-box fca-status-box-muted">
            Die nächste Saison ({nextSeasonKey}) existiert bereits. Als Nächstes
            können wir daraus einen echten Next Season Planner Flow für Teams,
            Sponsoren und Events aufbauen.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCreateNextSeason}
              disabled={submitting || !nextSeasonKey}
              className="fca-button-primary"
            >
              {submitting ? "Erstelle..." : "Nächste Saison erstellen"}
            </button>
          </div>
        )}
      </div>
    </AdminSurfaceCard>
  );
}

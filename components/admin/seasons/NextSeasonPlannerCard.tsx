"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";

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

        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
        );
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
        throw new Error(
          data?.error ?? "Die nächste Saison konnte nicht erstellt werden.",
        );
      }

      setMessage(
        data?.message ?? "Die nächste Saison wurde erfolgreich erstellt.",
      );

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
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Season key cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
                <CalendarDays className="h-4 w-4 text-[var(--blue)]" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Aktuelle Saison
              </span>
            </div>
          </div>
          <div className="sce-detail-section-body">
            <p
              className="text-xl font-bold text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {loading ? (
                <span className="text-[var(--muted)]">Lädt…</span>
              ) : (
                (currentSeasonKey ?? "–")
              )}
            </p>
          </div>
        </div>

        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
                <CalendarDays className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Nächste Saison gemäss Logik
              </span>
            </div>
          </div>
          <div className="sce-detail-section-body">
            <p
              className="text-xl font-bold text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {loading ? (
                <span className="text-[var(--muted)]">Lädt…</span>
              ) : (
                (nextSeasonKey ?? "–")
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback messages */}
      {error ? (
        <div className="fca-status-box fca-status-box-error">{error}</div>
      ) : null}

      {message ? (
        <div className="fca-status-box fca-status-box-success">{message}</div>
      ) : null}

      {/* Action / info */}
      {loading ? (
        <div className="fca-status-box fca-status-box-muted">
          Saisoninformationen werden geladen…
        </div>
      ) : nextSeasonAlreadyExists ? (
        <div className="fca-status-box fca-status-box-muted">
          Die nächste Saison ({nextSeasonKey}) existiert bereits. Teams,
          Sponsoren und Events können nun saisonspezifisch geplant werden.
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCreateNextSeason}
          disabled={submitting || !nextSeasonKey}
          className="fca-button-primary"
        >
          <Plus className="h-4 w-4" />
          {submitting ? "Erstelle…" : "Nächste Saison erstellen"}
        </button>
      )}
    </div>
  );
}

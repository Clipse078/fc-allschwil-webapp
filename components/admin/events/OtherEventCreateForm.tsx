"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type SeasonItem = {
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
  seasons: SeasonItem[];
};

export default function OtherEventCreateForm() {
  const router = useRouter();

  const [seasonId, setSeasonId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [remarks, setRemarks] = useState("");

  const [websiteVisible, setWebsiteVisible] = useState(true);
  const [homepageVisible, setHomepageVisible] = useState(false);
  const [wochenplanVisible, setWochenplanVisible] = useState(false);
  const [teamPageVisible, setTeamPageVisible] = useState(false);

  const [seasonOptions, setSeasonOptions] = useState<SeasonItem[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSeasons() {
      setLoadingSeasons(true);

      try {
        const response = await fetch("/api/seasons", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response.json().catch(() => null)) as SeasonsResponse | null;

        if (!response.ok) {
          throw new Error((data as { error?: string } | null)?.error ?? "Saisons konnten nicht geladen werden.");
        }

        if (!active || !data) {
          return;
        }

        const seasons = Array.isArray(data.seasons) ? data.seasons : [];
        setSeasonOptions(seasons);

        const preferred =
          seasons.find((season) => season.isActive) ??
          seasons[0] ??
          null;

        setSeasonId(preferred?.id ?? "");
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      } finally {
        if (active) {
          setLoadingSeasons(false);
        }
      }
    }

    loadSeasons();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "OTHER",
          source: "MANUAL",
          seasonId,
          title,
          description: description || null,
          location: location || null,
          startAt,
          endAt: endAt || null,
          organizerName: organizerName || null,
          remarks: remarks || null,
          websiteVisible,
          infoboardVisible: false,
          homepageVisible,
          wochenplanVisible,
          trainingsplanVisible: false,
          teamPageVisible,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Event konnte nicht zur Prüfung eingereicht werden.");
      }

      setSuccessMessage("Event wurde zur Prüfung eingereicht. Du wirst zurück zur Event-Übersicht geleitet.");
      router.push("/dashboard/events?submitted=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="fca-section-card border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Prüf-Workflow
          </p>
          <p className="mt-2 text-sm text-amber-900">
            Neue Events werden zuerst zur Prüfung eingereicht. Die Veröffentlichung erfolgt erst nach Freigabe.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Saison</span>
            <select
              value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              className="fca-select"
              required
              disabled={loadingSeasons}
            >
              <option value="">
                {loadingSeasons ? "Saisons laden..." : "Bitte wählen"}
              </option>
              {seasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.isActive ? " (aktuell)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Titel</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="fca-input"
              required
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Beschreibung</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="fca-textarea min-h-[120px]"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ort</span>
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Organisator</span>
            <input
              type="text"
              value={organizerName}
              onChange={(event) => setOrganizerName(event.target.value)}
              className="fca-input"
              placeholder="z. B. FC Allschwil / Business Club"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="fca-input"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ende</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Bemerkungen</span>
            <input
              type="text"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="fca-input"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Toggle
            label="Website sichtbar"
            value={websiteVisible}
            onChange={setWebsiteVisible}
          />
          <Toggle
            label="Homepage sichtbar"
            value={homepageVisible}
            onChange={setHomepageVisible}
          />
          <Toggle
            label="Wochenplan sichtbar"
            value={wochenplanVisible}
            onChange={setWochenplanVisible}
          />
          <Toggle
            label="Teamseite sichtbar"
            value={teamPageVisible}
            onChange={setTeamPageVisible}
          />
        </div>

        {successMessage ? (
          <div className="fca-status-box fca-status-box-success">{successMessage}</div>
        ) : null}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || loadingSeasons || !seasonId}
            className="fca-button-primary"
          >
            {submitting ? "Wird zur Prüfung eingereicht..." : "Event zur Prüfung einreichen"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/events")}
            className="fca-button-secondary"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </AdminSurfaceCard>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="fca-toggle-row">
      <span className="fca-label">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="fca-toggle-checkbox"
      />
    </div>
  );
}


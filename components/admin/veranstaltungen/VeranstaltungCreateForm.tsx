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

const VERANSTALTUNG_CATEGORIES = [
  "Generalversammlung",
  "Trainersitzung",
  "Vorstandssitzung",
  "Vereinsanlass",
  "Sponsorenanlass",
  "Helfereinsatz",
  "Interne Veranstaltung",
  "Sonstiges",
] as const;

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="fca-toggle-row">
      <span className="fca-label">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="fca-toggle-checkbox"
      />
    </div>
  );
}

export default function VeranstaltungCreateForm() {
  const router = useRouter();

  const [seasonId, setSeasonId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [remarks, setRemarks] = useState("");

  const [websiteVisible, setWebsiteVisible] = useState(true);
  const [homepageVisible, setHomepageVisible] = useState(false);
  const [infoboardVisible, setInfoboardVisible] = useState(false);
  const [wochenplanVisible, setWochenplanVisible] = useState(false);

  const [seasonOptions, setSeasonOptions] = useState<SeasonItem[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSeasons() {
      setLoadingSeasons(true);
      try {
        const res = await fetch("/api/seasons", { method: "GET", cache: "no-store" });
        const data = (await res.json().catch(() => null)) as SeasonsResponse | null;

        if (!res.ok) {
          throw new Error(
            (data as { error?: string } | null)?.error ??
              "Saisons konnten nicht geladen werden.",
          );
        }

        if (!active || !data) return;

        const seasons = Array.isArray(data.seasons) ? data.seasons : [];
        setSeasonOptions(seasons);

        const preferred =
          seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
        setSeasonId(preferred?.id ?? "");
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
        );
      } finally {
        if (active) setLoadingSeasons(false);
      }
    }

    loadSeasons();
    return () => {
      active = false;
    };
  }, []);

  // When category changes, pre-fill title if title is still empty or matches previous category
  function handleCategoryChange(value: string) {
    setCategory(value);
    if (!title || VERANSTALTUNG_CATEGORIES.includes(title as typeof VERANSTALTUNG_CATEGORIES[number])) {
      setTitle(value);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OTHER",
          source: "MANUAL",
          seasonId,
          title: title.trim(),
          description: description || null,
          location: location || null,
          startAt,
          endAt: endAt || null,
          organizerName: organizerName || null,
          remarks: remarks || null,
          websiteVisible,
          infoboardVisible,
          homepageVisible,
          wochenplanVisible,
          trainingsplanVisible: false,
          teamPageVisible: false,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setError(
          data?.error ?? "Veranstaltung konnte nicht erstellt werden.",
        );
        return;
      }

      router.push("/dashboard/veranstaltungen?submitted=1");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Saison</span>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="fca-select"
              required
              disabled={loadingSeasons}
            >
              <option value="">
                {loadingSeasons ? "Saisons laden..." : "Bitte wählen"}
              </option>
              {seasonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isActive ? " (aktuell)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Kategorie</span>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="fca-select"
            >
              <option value="">— frei wählen —</option>
              {VERANSTALTUNG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">
              Titel <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="fca-input"
              required
              placeholder="z. B. Generalversammlung 2025"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Beschreibung</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="fca-textarea min-h-[120px]"
              placeholder="Optionale Beschreibung der Veranstaltung..."
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ort / Venue</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="fca-input"
              placeholder="z. B. Vereinslokal, Halle West"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Organisator</span>
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              className="fca-input"
              placeholder="z. B. Vorstand / Sponsorenteam"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">
              Start <span className="text-rose-500">*</span>
            </span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="fca-input"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ende</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Bemerkungen</span>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="fca-input"
              placeholder="Interne Notizen oder Hinweise"
            />
          </label>
        </div>

        {/* Visibility */}
        <div>
          <p className="fca-label mb-3">Ausspielung</p>
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
              label="Infoboard sichtbar"
              value={infoboardVisible}
              onChange={setInfoboardVisible}
            />
            <Toggle
              label="Wochenplan sichtbar"
              value={wochenplanVisible}
              onChange={setWochenplanVisible}
            />
          </div>
        </div>

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || loadingSeasons || !seasonId}
            className="fca-button-primary"
          >
            {submitting ? "Wird erstellt..." : "Veranstaltung erstellen"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/veranstaltungen")}
            className="fca-button-secondary"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </AdminSurfaceCard>
  );
}

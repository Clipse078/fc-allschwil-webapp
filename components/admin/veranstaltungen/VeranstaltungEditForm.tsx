"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type SeasonSummary = {
  id: string;
  key: string;
  name: string;
};

type VeranstaltungEditFormProps = {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startAt: Date | string;
    endAt: Date | string | null;
    organizerName: string | null;
    remarks: string | null;
    status: string;
    source: string;
    websiteVisible: boolean;
    infoboardVisible: boolean;
    homepageVisible: boolean;
    wochenplanVisible: boolean;
    trainingsplanVisible: boolean;
    teamPageVisible: boolean;
    season: SeasonSummary | null;
  };
};

function toDatetimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // Format to "YYYY-MM-DDTHH:mm" for datetime-local input
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

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

export default function VeranstaltungEditForm({
  event,
}: VeranstaltungEditFormProps) {
  const router = useRouter();

  const isArchived = event.status === "ARCHIVED";
  const isReadonly = isArchived || event.source === "CLUBCORNER_FVNWS";

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [startAt, setStartAt] = useState(toDatetimeLocal(event.startAt));
  const [endAt, setEndAt] = useState(toDatetimeLocal(event.endAt));
  const [organizerName, setOrganizerName] = useState(
    event.organizerName ?? "",
  );
  const [remarks, setRemarks] = useState(event.remarks ?? "");
  const [websiteVisible, setWebsiteVisible] = useState(event.websiteVisible);
  const [infoboardVisible, setInfoboardVisible] = useState(
    event.infoboardVisible,
  );
  const [homepageVisible, setHomepageVisible] = useState(event.homepageVisible);
  const [wochenplanVisible, setWochenplanVisible] = useState(
    event.wochenplanVisible,
  );
  const [teamPageVisible, setTeamPageVisible] = useState(event.teamPageVisible);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || isReadonly) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
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
          teamPageVisible,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setError(
          data?.error ?? "Veranstaltung konnte nicht gespeichert werden.",
        );
        return;
      }

      setSuccessMessage(
        "Veranstaltung wurde gespeichert. Du wirst zur Übersicht weitergeleitet.",
      );
      router.push("/dashboard/veranstaltungen?updated=1");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      {isArchived && (
        <div className="fca-status-box fca-status-box-warning mb-6">
          Diese Veranstaltung ist archiviert und kann nicht bearbeitet werden.
          Stelle sie zuerst wieder her.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Season info (read-only) */}
        {event.season && (
          <div className="sce-data-field">
            <p className="sce-data-label">Saison</p>
            <p className="sce-data-value mt-1">{event.season.name}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
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
              disabled={isReadonly}
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Beschreibung</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="fca-textarea min-h-[120px]"
              disabled={isReadonly}
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ort</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="fca-input"
              disabled={isReadonly}
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Organisator</span>
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              className="fca-input"
              placeholder="z. B. FC Muster / Business Club"
              disabled={isReadonly}
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
              disabled={isReadonly}
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ende</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="fca-input"
              disabled={isReadonly}
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Bemerkungen</span>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="fca-input"
              disabled={isReadonly}
            />
          </label>
        </div>

        {/* Visibility toggles */}
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

        {successMessage ? (
          <div className="fca-status-box fca-status-box-success">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        {!isReadonly && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="fca-button-primary"
            >
              {submitting ? "Wird gespeichert..." : "Änderungen speichern"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/veranstaltungen")}
              className="fca-button-secondary"
            >
              Abbrechen
            </button>
          </div>
        )}

        {isReadonly && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/veranstaltungen")}
              className="fca-button-secondary"
            >
              Zurück zur Übersicht
            </button>
          </div>
        )}
      </form>
    </AdminSurfaceCard>
  );
}

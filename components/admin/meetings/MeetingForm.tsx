"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import VisibilityScopeSelect, {
  type VisibilityScopeValue,
} from "@/components/admin/shared/VisibilityScopeSelect";
import AllowlistPanel from "@/components/admin/shared/visibility/AllowlistPanel";

type MeetingFormProps = {
  mode: "create" | "edit";
  meetingId?: string;
  defaultValues?: {
    title?: string;
    description?: string;
    meetingDate?: string;
    location?: string;
    attendeeCount?: string;
    status?: string;
    visibilityScope?: VisibilityScopeValue;
    visibleOrgUnitRefs?: string[];
    visibleRoleRefs?: string[];
    visibleUserRefs?: string[];
  };
};

const STATUS_OPTIONS = [
  { value: "PLANNED", label: "Geplant" },
  { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "CANCELLED", label: "Abgesagt" },
] as const;

export default function MeetingForm({ mode, meetingId, defaultValues }: MeetingFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [meetingDate, setMeetingDate] = useState(defaultValues?.meetingDate ?? "");
  const [location, setLocation] = useState(defaultValues?.location ?? "");
  const [attendeeCount, setAttendeeCount] = useState(defaultValues?.attendeeCount ?? "");
  const [status, setStatus] = useState(defaultValues?.status ?? "PLANNED");
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScopeValue>(
    defaultValues?.visibilityScope ?? "ORGANISATION",
  );
  const [visibleOrgUnitRefs, setVisibleOrgUnitRefs] = useState<string[]>(
    defaultValues?.visibleOrgUnitRefs ?? [],
  );
  const [visibleRoleRefs, setVisibleRoleRefs] = useState<string[]>(
    defaultValues?.visibleRoleRefs ?? [],
  );
  const [visibleUserRefs, setVisibleUserRefs] = useState<string[]>(
    defaultValues?.visibleUserRefs ?? [],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }
    if (!meetingDate) {
      setError("Datum ist erforderlich.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        meetingDate,
        location: location.trim() || null,
        attendeeCount: attendeeCount ? Number(attendeeCount) : null,
        status,
        visibilityScope,
        visibleOrgUnitRefs: visibilityScope === "RESTRICTED" ? visibleOrgUnitRefs : [],
        visibleRoleRefs: visibilityScope === "RESTRICTED" ? visibleRoleRefs : [],
        visibleUserRefs: visibilityScope === "RESTRICTED" ? visibleUserRefs : [],
      };

      const url = mode === "edit" ? `/api/meetings/${meetingId}` : "/api/meetings";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      router.push("/vereinsleitung/meetings?status=saved");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "sce-form-field";
  const labelClass =
    "sce-kicker mb-1.5 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="fca-status-box fca-status-box-error px-5 py-4 font-medium">
          {error}
        </div>
      ) : null}

      <section className="sce-page-card p-6">
        <h3 className="sce-section-title mb-5">Grunddaten</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Vorstandssitzung Mai"
              className={fieldClass}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Meetings…"
              rows={3}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Datum & Uhrzeit *</label>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={fieldClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Ort</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z.B. Clubhaus, Sitzungszimmer 1"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Teilnehmeranzahl</label>
            <input
              type="number"
              min={0}
              value={attendeeCount}
              onChange={(e) => setAttendeeCount(e.target.value)}
              placeholder="z.B. 5"
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <section className="sce-page-card p-6">
        <h3 className="sce-section-title mb-2">Sichtbarkeit</h3>
        <p className="mb-5 text-[12px] text-[var(--sce-muted)]">
          Wer kann dieses Meeting sehen? Wähle sorgfältig — Privat und Eingeschränkt
          verbergen diesen Eintrag für nicht berechtigte Benutzer.
        </p>
        <VisibilityScopeSelect value={visibilityScope} onChange={setVisibilityScope} />
        <AllowlistPanel
          visibilityScope={visibilityScope}
          visibleOrgUnitRefs={visibleOrgUnitRefs}
          visibleRoleRefs={visibleRoleRefs}
          visibleUserRefs={visibleUserRefs}
          onOrgUnitsChange={setVisibleOrgUnitRefs}
          onRolesChange={setVisibleRoleRefs}
          onUsersChange={setVisibleUserRefs}
        />
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="sce-action-secondary px-5 py-2.5 text-sm font-medium"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="sce-action-primary px-6 py-2.5 text-sm disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Meeting erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import VisibilityScopeSelect, {
  type VisibilityScopeValue,
} from "@/components/admin/shared/VisibilityScopeSelect";

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
    "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
  const labelClass =
    "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Grunddaten</h3>

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

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-2 text-[1.05rem] font-semibold text-slate-900">Sichtbarkeit</h3>
        <p className="mb-5 text-[12px] text-slate-500">
          Wer kann dieses Meeting sehen? Wähle sorgfältig — Privat und Eingeschränkt
          verbergen diesen Eintrag für nicht berechtigte Benutzer.
        </p>
        <VisibilityScopeSelect value={visibilityScope} onChange={setVisibilityScope} />
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Meeting erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}

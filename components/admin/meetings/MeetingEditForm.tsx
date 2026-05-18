"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MEETING_STATUS_OPTIONS = [
  { value: "DRAFT",       label: "Entwurf" },
  { value: "SCHEDULED",   label: "Geplant" },
  { value: "IN_PROGRESS", label: "Laufend" },
  { value: "COMPLETED",   label: "Abgeschlossen" },
  { value: "CANCELLED",   label: "Abgesagt" },
] as const;

function formatLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export type MeetingEditInitialValues = {
  title: string;
  status: string;
  scheduledAt: Date;
  location: string | null;
  orgUnitLabel: string | null;
  onlineMeetingUrl: string | null;
  description: string | null;
  minutesBody: string | null;
};

type MeetingEditFormProps = {
  id: string;
  initialValues: MeetingEditInitialValues;
};

export default function MeetingEditForm({ id, initialValues }: MeetingEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);

    const title            = String(form.get("title") ?? "").trim();
    const scheduledAt      = String(form.get("scheduledAt") ?? "").trim();
    const status           = String(form.get("status") ?? "").trim();
    const orgUnitLabel     = String(form.get("orgUnitLabel") ?? "").trim() || null;
    const location         = String(form.get("location") ?? "").trim() || null;
    const onlineMeetingUrl = String(form.get("onlineMeetingUrl") ?? "").trim() || null;
    const description      = String(form.get("description") ?? "").trim() || null;
    const minutesBody      = String(form.get("minutesBody") ?? "").trim() || null;

    if (!title) {
      setError("Titel ist erforderlich.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      status,
      orgUnitLabel,
      location,
      onlineMeetingUrl,
      description,
      minutesBody,
    };

    if (scheduledAt) {
      payload.scheduledAt = new Date(scheduledAt).toISOString();
    }

    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Meeting konnte nicht gespeichert werden.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      router.push(`/meetings/${id}`);
      router.refresh();
    } catch {
      setError("Ein Netzwerkfehler ist aufgetreten. Bitte versuche es erneut.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="fca-status-box fca-status-box-error mb-6">{error}</div>
      ) : null}

      {success ? (
        <div className="fca-status-box fca-status-box-success mb-6">
          Änderungen wurden gespeichert.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Title */}
        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">
              Titel <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              name="title"
              required
              maxLength={200}
              defaultValue={initialValues.title}
              className="fca-input mt-2"
            />
          </label>
        </div>

        {/* scheduledAt */}
        <div>
          <label className="block">
            <span className="fca-label">Datum & Uhrzeit</span>
            <input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={formatLocalDateTimeInput(initialValues.scheduledAt)}
              className="fca-input mt-2"
            />
          </label>
        </div>

        {/* Status */}
        <div>
          <label className="block">
            <span className="fca-label">Status</span>
            <select
              name="status"
              defaultValue={initialValues.status}
              className="fca-select mt-2"
            >
              {MEETING_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* orgUnitLabel */}
        <div>
          <label className="block">
            <span className="fca-label">Org-Einheit</span>
            <input
              type="text"
              name="orgUnitLabel"
              maxLength={100}
              defaultValue={initialValues.orgUnitLabel ?? ""}
              placeholder="z.B. Vereinsleitung, Vorstand"
              className="fca-input mt-2"
            />
          </label>
        </div>

        {/* Location */}
        <div>
          <label className="block">
            <span className="fca-label">Ort</span>
            <input
              type="text"
              name="location"
              maxLength={200}
              defaultValue={initialValues.location ?? ""}
              placeholder="z.B. Clubhaus, Sitzungszimmer 1"
              className="fca-input mt-2"
            />
          </label>
        </div>

        {/* Online meeting URL */}
        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Online-Meeting-Link</span>
            <input
              type="url"
              name="onlineMeetingUrl"
              maxLength={500}
              defaultValue={initialValues.onlineMeetingUrl ?? ""}
              placeholder="https://teams.microsoft.com/..."
              className="fca-input mt-2"
            />
          </label>
        </div>

        {/* Description */}
        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Beschreibung</span>
            <textarea
              name="description"
              rows={2}
              maxLength={1000}
              defaultValue={initialValues.description ?? ""}
              placeholder="Kurze Beschreibung oder Notiz zum Meeting…"
              className="fca-textarea mt-2"
            />
          </label>
        </div>

        {/* minutesBody */}
        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Protokoll / Notizen</span>
            <textarea
              name="minutesBody"
              rows={6}
              maxLength={10000}
              defaultValue={initialValues.minutesBody ?? ""}
              placeholder="Protokoll, Besprechungspunkte, interne Notizen…"
              className="fca-textarea mt-2"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Inhalte werden gespeichert und sind nur für autorisierte Benutzer sichtbar.
            </p>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Wird gespeichert…" : "Änderungen speichern"}
        </button>

        <Link
          href={`/meetings/${id}`}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

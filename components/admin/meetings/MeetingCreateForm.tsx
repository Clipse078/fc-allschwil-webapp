"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MEETING_STATUS_OPTIONS = [
  { value: "DRAFT",     label: "Entwurf" },
  { value: "SCHEDULED", label: "Geplant" },
] as const;

function formatLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function defaultScheduledAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(20, 0, 0, 0);
  return formatLocalDateTimeInput(d);
}

export default function MeetingCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);

    const title        = String(form.get("title") ?? "").trim();
    const scheduledAt  = String(form.get("scheduledAt") ?? "").trim();
    const status       = String(form.get("status") ?? "SCHEDULED");
    const orgUnitLabel = String(form.get("orgUnitLabel") ?? "").trim() || null;
    const description  = String(form.get("description") ?? "").trim() || null;
    const location     = String(form.get("location") ?? "").trim() || null;
    const onlineMeetingUrl = String(form.get("onlineMeetingUrl") ?? "").trim() || null;

    if (!title) {
      setError("Titel ist erforderlich.");
      setSubmitting(false);
      return;
    }

    const scheduledAtIso = scheduledAt
      ? new Date(scheduledAt).toISOString()
      : new Date().toISOString();

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scheduledAt: scheduledAtIso,
          status,
          orgUnitLabel,
          description,
          location,
          onlineMeetingUrl,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Meeting konnte nicht erstellt werden.");
        setSubmitting(false);
        return;
      }

      router.push(`/meetings/${data.meeting.id}`);
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
              placeholder="z.B. Vorstandssitzung Mai 2026"
              className="fca-input mt-2"
              autoFocus
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
              defaultValue={defaultScheduledAt()}
              className="fca-input mt-2"
            />
          </label>
        </div>

        {/* Status */}
        <div>
          <label className="block">
            <span className="fca-label">Status</span>
            <select name="status" defaultValue="SCHEDULED" className="fca-select mt-2">
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
              placeholder="z.B. Vereinsleitung, Vorstand"
              className="fca-input mt-2"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Optional — wird später durch das Organisation-Modul ersetzt.
            </p>
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
              rows={3}
              maxLength={1000}
              placeholder="Kurze Beschreibung oder Notiz zum Meeting..."
              className="fca-textarea mt-2"
            />
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
          {submitting ? "Wird erstellt…" : "Meeting erstellen"}
        </button>

        <Link
          href="/meetings"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

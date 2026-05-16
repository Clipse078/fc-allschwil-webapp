"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

export default function EventImportCsvCard() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePrepare() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/events/import/csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "foundation_prepare",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "CSV / Excel Foundation konnte nicht vorbereitet werden.");
      }

      setMessage(data?.message ?? "CSV / Excel Foundation vorbereitet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div className="space-y-5">
        <div>
          <p className="fca-eyebrow">CSV / Excel</p>
          <h3 className="fca-heading mt-2">Upload Foundation</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Grundlage für spätere Datei-Uploads mit Mapping auf Matches, Turniere,
            Trainings und weitere Events.
          </p>
        </div>

        <div className="fca-section-card p-4">
          <div className="flex flex-wrap gap-2">
            <span className="fca-pill">Batch Tracking</span>
            <span className="fca-pill">Import Run Logging</span>
            <span className="fca-pill">Späteres Column Mapping</span>
          </div>
        </div>

        {message ? (
          <div className="fca-status-box fca-status-box-success">{message}</div>
        ) : null}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        <div>
          <button
            type="button"
            onClick={handlePrepare}
            disabled={submitting}
            className="fca-button-primary"
          >
            {submitting ? "Vorbereiten..." : "CSV / Excel Foundation starten"}
          </button>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}
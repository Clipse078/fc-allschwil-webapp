"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

export default function EventImportClubcornerCard() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePrepare() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/events/import/clubcorner", {
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
        throw new Error(data?.error ?? "ClubCorner / fvnws Foundation konnte nicht vorbereitet werden.");
      }

      setMessage(data?.message ?? "ClubCorner / fvnws Foundation vorbereitet.");
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
          <p className="fca-eyebrow">ClubCorner / fvnws</p>
          <h3 className="fca-heading mt-2">Sync Foundation</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Grundlage für spätere externe Synchronisation offizieller Match- und
            Turnierdaten mit Import Runs, Fehlerstatus und nachvollziehbarer Historie.
          </p>
        </div>

        <div className="fca-section-card p-4">
          <div className="flex flex-wrap gap-2">
            <span className="fca-pill">Future Pull Sync</span>
            <span className="fca-pill">Run Logging</span>
            <span className="fca-pill">Fehlerprotokoll</span>
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
            {submitting ? "Vorbereiten..." : "ClubCorner / fvnws Foundation starten"}
          </button>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}
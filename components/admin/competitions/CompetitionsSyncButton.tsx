"use client";

/**
 * CompetitionsSyncButton
 *
 * Client component that triggers SFV competition synchronization via API.
 * Shows sync status and result counts inline.
 */

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

type SyncResult = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  failed: number;
  durationMs: number;
};

export default function CompetitionsSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/integrations/sfv/competitions/sync", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as { result: SyncResult };
      setResult(data.result);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Synchronisierung läuft…" : "SFV Wettkämpfe synchronisieren"}
      </button>

      {result && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {result.fetched} Wettkämpfe verarbeitet — {result.created} erstellt, {result.updated}{" "}
            aktualisiert, {result.unchanged} unverändert
            {result.archived > 0 && `, ${result.archived} archiviert`}
            {result.failed > 0 && ` (${result.failed} Fehler)`}
            {" "}({result.durationMs} ms)
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

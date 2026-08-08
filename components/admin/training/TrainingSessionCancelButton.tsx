"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, RotateCcw } from "lucide-react";

type Props = {
  sessionId: string;
  /** Whether this occurrence is currently CANCELLED (renders the restore action instead). */
  isCancelled: boolean;
};

/**
 * Cancel/restore toggle for a single canonical TrainingSession occurrence
 * (TRAININGCENTER-01). Calls PATCH /api/training-sessions/[sessionId],
 * which only ever mutates this one occurrence's status — the parent
 * TrainingSeries recurrence definition is never touched.
 */
export default function TrainingSessionCancelButton({ sessionId, isCancelled }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/training-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCancelled ? "SCHEDULED" : "CANCELLED" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Aktion fehlgeschlagen.");
        return;
      }

      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={
          isCancelled
            ? "inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isCancelled ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : (
          <Ban className="h-3.5 w-3.5" />
        )}
        {isCancelled ? "Wiederherstellen" : "Absagen"}
      </button>
      {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";

export default function StopImpersonationButton() {
  const [submitting, setSubmitting] = useState(false);

  async function handleStop() {
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/stop-impersonation", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Die Impersonation konnte nicht beendet werden.");
      }

      window.location.href = "/dashboard/users";
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten."
      );
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleStop}
      disabled={submitting}
      className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? "Wird beendet..." : "Zurück zum Admin"}
    </button>
  );
}
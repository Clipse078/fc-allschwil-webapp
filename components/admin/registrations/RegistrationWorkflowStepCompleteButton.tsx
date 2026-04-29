"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegistrationWorkflowStepCompleteButton({
  registrationId,
  stepId,
}: {
  registrationId: string;
  stepId: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeStep() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/registrations/${registrationId}/steps/${stepId}/complete`, {
        method: "POST",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Schritt konnte nicht abgeschlossen werden.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schritt konnte nicht abgeschlossen werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={completeStep}
        disabled={isSaving}
        className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Speichern..." : "Als erledigt markieren"}
      </button>

      {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
    </div>
  );
}

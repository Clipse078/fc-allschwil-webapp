"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RegistrationAction = "IN_REVIEW" | "APPROVED" | "REJECTED";

export default function RegistrationActions({
  registrationId,
  status,
}: {
  registrationId: string;
  status: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<RegistrationAction | null>(null);

  async function updateRegistration(nextStatus: RegistrationAction) {
    setPendingAction(nextStatus);

    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          assignedTo: nextStatus === "IN_REVIEW" ? "Admin" : undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Anmeldung konnte nicht aktualisiert werden.");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Anmeldung konnte nicht aktualisiert werden.");
    } finally {
      setPendingAction(null);
    }
  }

  const isClosed = status === "APPROVED" || status === "REJECTED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isClosed || pendingAction !== null}
        onClick={() => updateRegistration("IN_REVIEW")}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pendingAction === "IN_REVIEW" ? "Zuweisen..." : "Zuweisen"}
      </button>

      <button
        type="button"
        disabled={isClosed || pendingAction !== null}
        onClick={() => updateRegistration("APPROVED")}
        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pendingAction === "APPROVED" ? "Freigeben..." : "Freigeben"}
      </button>

      <button
        type="button"
        disabled={isClosed || pendingAction !== null}
        onClick={() => updateRegistration("REJECTED")}
        className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pendingAction === "REJECTED" ? "Ablehnen..." : "Ablehnen"}
      </button>
    </div>
  );
}

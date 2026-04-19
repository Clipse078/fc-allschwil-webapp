"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type ResetPasswordFormProps = {
  userId: string;
};

export default function ResetPasswordForm({ userId }: ResetPasswordFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/users/" + userId + "/reset-password", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Reset-Link konnte nicht versendet werden.");
      }

      const debugUrl =
        typeof data?.debugUrl === "string" && data.debugUrl.trim().length > 0
          ? data.debugUrl
          : null;

      if (debugUrl) {
        window.prompt("STAGE Test-Link für Passwort-Reset", debugUrl);
        setMessage("Reset-Link wurde im Testmodus erzeugt.");
      } else {
        setMessage(data?.message ?? "Reset-Link erfolgreich versendet.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="fca-subheading">Passwort-Reset per E-Mail</h3>
          <p className="mt-3 text-sm text-slate-600">
            Der Admin sendet dem Benutzer einen Link per E-Mail, damit dieser sein Passwort selbst neu setzen kann.
          </p>
        </div>

        {message ? (
          <div className="fca-status-box fca-status-box-success">{message}</div>
        ) : null}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        <button
          type="button"
          onClick={handleReset}
          disabled={submitting}
          className="fca-button-primary"
        >
          {submitting ? "Sende..." : "Reset-Link senden"}
        </button>
      </div>
    </AdminSurfaceCard>
  );
}
"use client";

import { useState } from "react";

type ResetPasswordFormProps = {
  userId: string;
};

export default function ResetPasswordForm({ userId }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Passwort konnte nicht zurückgesetzt werden.");
      }

      setMessage("Passwort erfolgreich zurückgesetzt.");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-2)]">
        Setze ein neues temporäres Passwort für diesen Benutzer. Mindestens 8 Zeichen.
      </p>

      <input
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="fca-input"
          placeholder="Neues Passwort"
        />

        {message ? (
          <div className="fca-status-box fca-status-box-success">{message}</div>
        ) : null}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

      <button
        type="button"
        onClick={handleReset}
        disabled={submitting || password.length < 8}
        className="fca-button-primary"
      >
        {submitting ? "Speichern..." : "Passwort zurücksetzen"}
      </button>
    </div>
  );
}
